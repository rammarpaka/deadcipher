from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime, timedelta, timezone

from supabase import Client

MODEL = "gemini-3.5-flash-lite"
BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
BODY_TRUNCATE = 6000
SUMMARY_FALLBACK = 2000
TITLE_JACCARD_THRESHOLD = 0.45
CLUSTER_WINDOW_DAYS = 7
MAX_CLUSTERS_PER_RUN = 6
REQUEST_SPACING_SECONDS = 4.0

CVE_PATTERN = re.compile(r"CVE-\d{4}-\d{4,7}", re.IGNORECASE)
MIN_PARAGRAPHS = 3

CATEGORIES = (
    "Malware",
    "Vulnerabilities",
    "Ransomware",
    "Cloud Security",
    "IoT Security",
    "AI Security",
    "Privacy",
    "Data Breach",
)
SEVERITIES = ("critical", "high", "medium", "low")


def _max_clusters_default() -> int:
    try:
        return max(1, int(os.environ.get("SYNTHESIS_MAX_CLUSTERS") or ""))
    except ValueError:
        return MAX_CLUSTERS_PER_RUN

SYSTEM_INSTRUCTION = (
    "You are a cybersecurity news editor. You merge multiple source articles "
    "about the same event into one original report. You never copy sentences "
    "verbatim from sources; you always write new prose. You respond with JSON only."
)

PROMPT_TEMPLATE = """Synthesize an ORIGINAL news report from the source articles below, which all cover the same event or topic.

STRICT RULES:
1. Write 3-5 short paragraphs of entirely original prose. NEVER fewer than 3 paragraphs. Never copy any sentence verbatim from the sources.
2. Structure: paragraph 1 = what happened; middle paragraphs = technical details, impact, and affected parties; final paragraph = context, history, or what happens next.
3. Every fact must come from the given sources only. Use ALL of the provided material — background, timelines, quotes paraphrased in your own words — to reach 3+ substantial paragraphs without inventing anything.
4. Each paragraph must include exactly one "citation_source_url" taken verbatim from that source's "url" field.
5. Spread the reporting across sources: consecutive paragraphs must cite DIFFERENT urls, and every provided source url must be cited at least once.
6. If sources conflict, state the disagreement neutrally and cite both sides in separate sentences.
7. Classify the story: "category" must be exactly one of {categories}; "severity" must be exactly one of {severities} (critical = actively exploited or catastrophic impact; high = major campaigns or serious flaws; medium = standard patches and advisories; low = research, opinion, or minor news).
8. Respond with ONLY a JSON object, no markdown fences, matching:
   {{"headline": "...", "category": "...", "severity": "...", "paragraphs": [{{"paragraph_text": "...", "citation_source_url": "..."}}, ...]}}

SOURCE ARTICLES:
{sources}
"""

DIVERSITY_NUDGE = """

MANDATORY CORRECTION: Your previous draft drew all citations from a single source. Rewrite it so each paragraph reports details from a DIFFERENT source url and every provided source url appears as a citation at least once."""

LENGTH_NUDGE = """

MANDATORY CORRECTION: Your previous draft had fewer than 3 paragraphs, which violates rule 1. Rewrite it with at least 3 paragraphs following the structure in rule 2 (what happened / technical detail and impact / context or outlook), expanding only with facts present in the source material."""


class Article:
    def __init__(self, row: dict):
        self.url = row["url"]
        self.title = row.get("title") or ""
        self.summary = row.get("summary") or ""
        self.body = row.get("body") or ""
        self.image_path = row.get("image_path") or ""
        self.published_at = row.get("published_at")
        self.scraped_at = row.get("scraped_at")
        self.cves = set(CVE_PATTERN.findall(f"{self.title} {self.summary}"))

    @property
    def timestamp(self) -> float:
        raw = self.published_at or self.scraped_at
        if not raw:
            return 0.0
        try:
            return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).timestamp()
        except ValueError:
            return 0.0

    def published_iso(self) -> str | None:
        raw = self.published_at
        if not raw:
            return None
        try:
            return (
                datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
                .astimezone(timezone.utc)
                .isoformat()
            )
        except ValueError:
            return None

    def source_text(self) -> str:
        text = self.body.strip() or self.summary.strip() or self.title
        limit = BODY_TRUNCATE if self.body.strip() else SUMMARY_FALLBACK
        return text[:limit]

    def to_prompt_block(self) -> str:
        return f"- url: {self.url}\n  title: {self.title}\n  content:\n{self.source_text()}"


def fetch_pending(db: Client, limit: int = 30) -> list[Article]:
    result = (
        db.table("rss_articles")
        .select("*")
        .is_("synthesized_at", "null")
        .order("scraped_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [Article(row) for row in (result.data or [])]


def _title_tokens(text: str) -> set[str]:
    stopwords = {"the", "a", "an", "in", "on", "for", "of", "to", "and", "with", "new"}
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in stopwords}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _same_event(a: Article, b: Article) -> bool:
    if a.cves and b.cves and a.cves & b.cves:
        return True
    gap = abs(a.timestamp - b.timestamp)
    if gap > CLUSTER_WINDOW_DAYS * 86400:
        return False
    # fuzzy headline match catches reworded coverage
    from difflib import SequenceMatcher

    if (
        SequenceMatcher(
            None, a.title.lower(), b.title.lower()
        ).ratio()
        >= 0.45
    ):
        return True
    # follow-up coverage within 24h often rewords the headline entirely —
    # compare title + summary tokens with a relaxed threshold
    tokens_a = _title_tokens(f"{a.title} {a.summary[:200]}")
    tokens_b = _title_tokens(f"{b.title} {b.summary[:200]}")
    shared = tokens_a & tokens_b
    if gap <= 86400:
        if _jaccard(tokens_a, tokens_b) >= 0.25:
            return True
        # overlap coefficient + minimum shared-token floor: same event
        # coverage shares the salient vocabulary (product, attack type)
        if len(shared) >= 4 and len(shared) / min(len(tokens_a), len(tokens_b)) >= 0.3:
            return True
    else:
        if _jaccard(tokens_a, tokens_b) >= TITLE_JACCARD_THRESHOLD:
            return True
    return False


def cluster_articles(articles: list[Article]) -> list[list[Article]]:
    ordered = sorted(articles, key=lambda a: a.timestamp, reverse=True)
    clusters: list[list[Article]] = []
    for article in ordered:
        merged = False
        for cluster in clusters:
            if any(_same_event(article, member) for member in cluster):
                cluster.append(article)
                merged = True
                break
        if not merged:
            clusters.append([article])
    return clusters


def fetch_recent_stories(db: Client, hours: int = 24) -> list[dict]:
    """Story rows published within the window, for dedupe + late merge."""
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    result = (
        db.table("cybersecurity_news")
        .select("id,headline,story_body,published_at,category,severity,image_path")
        .gte("published_at", cutoff)
        .order("published_at", desc=True)
        .limit(50)
        .execute()
    )
    return result.data or []


def _story_to_article(row: dict) -> Article:
    """Lightweight Article view of a published story, for dedupe matching."""
    paragraphs = row.get("story_body") or []
    summary = " ".join(p.get("paragraph_text", "") for p in paragraphs[:1])
    return Article(
        {
            "url": f"story:{row['id']}",
            "title": row.get("headline") or "",
            "summary": summary,
            "published_at": row.get("published_at"),
        }
    )


def merge_into_story(
    db: Client, llm, story_row: dict, new_articles: list[Article]
) -> None:
    """Re-synthesize an existing story with its original sources plus new
    late-arriving coverage, updating the row in place."""
    cited_urls = sorted(
        {
            p["citation_source_url"]
            for p in story_row.get("story_body", [])
            if p.get("citation_source_url")
        }
    )
    original_rows = (
        db.table("rss_articles")
        .select("*")
        .in_("url", cited_urls)
        .limit(20)
        .execute()
        .data
        or []
    )
    cluster = [Article(r) for r in original_rows] + list(new_articles)
    if len(cluster) <= len(new_articles):
        raise ValueError("original source articles unavailable for merge")
    story = synthesize_cluster(llm, cluster)
    payload: dict = {"story_body": story["paragraphs"]}
    if story.get("category"):
        payload["category"] = story["category"]
    if story.get("severity"):
        payload["severity"] = story["severity"]
    if not story_row.get("image_path"):
        image = next((a.image_path for a in new_articles if a.image_path), None)
        if image:
            payload["image_path"] = image
    db.table("cybersecurity_news").update(payload).eq(
        "id", story_row["id"]
    ).execute()


def _llm_config() -> tuple[str, str, str]:
    return (
        os.environ.get("LLM_BASE_URL") or BASE_URL,
        os.environ.get("LLM_MODEL") or MODEL,
        os.environ["LLM_API_KEY"],
    )


def _is_llm_configured() -> bool:
    return bool(os.environ.get("LLM_API_KEY"))


def _llm_client():
    from openai import OpenAI

    base_url, _model, api_key = _llm_config()
    return OpenAI(api_key=api_key, base_url=base_url)


def _validate_story(data: object, allowed_urls: set[str]) -> dict | None:
    if not isinstance(data, dict):
        return None
    headline = str(data.get("headline") or "").strip()
    paragraphs = data.get("paragraphs")
    if not headline or not isinstance(paragraphs, list):
        return None
    cleaned = []
    for para in paragraphs:
        if not isinstance(para, dict):
            continue
        text = str(para.get("paragraph_text") or "").strip()
        url = str(para.get("citation_source_url") or "").strip()
        if text and url in allowed_urls:
            cleaned.append({"paragraph_text": text, "citation_source_url": url})
    if not cleaned:
        return None
    story = {"headline": headline, "paragraphs": cleaned}
    category = str(data.get("category") or "").strip()
    if category in CATEGORIES:
        story["category"] = category
    severity = str(data.get("severity") or "").strip().lower()
    if severity in SEVERITIES:
        story["severity"] = severity
    return story


def _parse_json(text: str):
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned[:4].lower() == "json":
            cleaned = cleaned[4:].strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return json.loads(re.sub(r",\s*([}\]])", r"\1", cleaned))


def _attempt(client, model: str, prompt: str, allowed_urls: set[str]) -> dict:
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_INSTRUCTION},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    story = _validate_story(_parse_json(response.choices[0].message.content), allowed_urls)
    if story is None:
        raise ValueError("model returned invalid story structure")
    return story


def synthesize_cluster(client, cluster: list[Article]) -> dict:
    sources = "\n\n".join(article.to_prompt_block() for article in cluster)
    allowed_urls = {a.url for a in cluster}
    _base_url, model, _api_key = _llm_config()
    prompt = PROMPT_TEMPLATE.format(
        sources=sources,
        categories=", ".join(CATEGORIES),
        severities=", ".join(SEVERITIES),
    )
    story = _attempt(client, model, prompt, allowed_urls)
    if len(story["paragraphs"]) < MIN_PARAGRAPHS:
        try:
            story = _attempt(client, model, prompt + LENGTH_NUDGE, allowed_urls)
        except Exception:  # noqa: BLE001 — keep the shorter valid draft
            pass
    single_cited = (
        len(cluster) > 1
        and len({p["citation_source_url"] for p in story["paragraphs"]}) == 1
    )
    if single_cited:
        try:
            story = _attempt(client, model, prompt + DIVERSITY_NUDGE, allowed_urls)
        except Exception:  # noqa: BLE001 — first draft is valid; keep it rather than fail
            pass
    return story


def _is_quota_error(exc: Exception) -> bool:
    text = str(exc)
    return "429" in text or "RESOURCE_EXHAUSTED" in text or "quota" in text.lower()


def run_synthesis(db: Client, dry_run: bool = False, max_clusters: int | None = None) -> dict:
    stats: dict = {
        "pending": 0,
        "clusters": 0,
        "published": 0,
        "failed": 0,
        "deduped": 0,
        "merged": 0,
        "errors": [],
    }
    max_clusters = max_clusters or _max_clusters_default()
    pending = fetch_pending(db)
    stats["pending"] = len(pending)
    if not pending:
        return stats

    # match pending articles against stories published in the last 24h
    # (follow-up coverage of an already-synthesized event)
    recent_rows = fetch_recent_stories(db, hours=24)
    recent = [(_story_to_article(row), row) for row in recent_rows]
    dedupe_groups: dict[int, dict] = {}
    dedupe_urls: list[str] = []
    kept: list[Article] = []
    for article in pending:
        match_row = next(
            (row for art, row in recent if _same_event(article, art)), None
        )
        if match_row is None:
            kept.append(article)
            continue
        dedupe_urls.append(article.url)
        group = dedupe_groups.setdefault(
            match_row["id"], {"row": match_row, "articles": [], "consumed": False}
        )
        group["articles"].append(article)
    stats["deduped"] = len(dedupe_urls)
    pending = kept

    clusters = [c for c in cluster_articles(pending)][:max_clusters]
    stats["clusters"] = len(clusters)

    if dry_run:
        return stats

    if not _is_llm_configured():
        stats["failed"] = len(clusters)
        stats["error"] = "LLM_API_KEY not set"
        return stats

    llm = _llm_client()
    now_iso = datetime.now(timezone.utc).isoformat()

    def _consume(urls: list[str]) -> None:
        if urls:
            db.table("rss_articles").update({"synthesized_at": now_iso}).in_(
                "url", urls
            ).execute()

    # LATE MERGE: enrich recently published stories with the new coverage
    # instead of discarding it. Disable with LATE_MERGE=0 (falls back to
    # plain suppression) if LLM rate limits become a problem.
    late_merge_enabled = os.environ.get("LATE_MERGE", "1").lower() not in (
        "0",
        "false",
    )
    for story_id, group in dedupe_groups.items():
        new_articles = group["articles"]
        if late_merge_enabled:
            try:
                merge_into_story(db, llm, group["row"], new_articles)
                stats["merged"] += len(new_articles)
                print(
                    f"[merge] story #{story_id} enriched with {len(new_articles)} new source(s)"
                )
            except Exception as exc:  # noqa: BLE001 — suppress on failure
                stats["errors"].append(f"merge #{story_id}: {str(exc)[:150]}")
                print(f"[merge] failed for story #{story_id}: {str(exc)[:120]}")
            _consume([a.url for a in new_articles])
            if stats["errors"] and _is_quota_error(Exception(stats["errors"][-1])):
                stats["quota_exhausted"] = True
                break
            time.sleep(REQUEST_SPACING_SECONDS)
        else:
            _consume([a.url for a in new_articles])

    for cluster in clusters:
        try:
            story = synthesize_cluster(llm, cluster)
            dates = [iso for a in cluster if (iso := a.published_iso())]
            payload = {
                "headline": story["headline"],
                "story_body": story["paragraphs"],
            }
            if dates:
                payload["published_at"] = max(dates)
            image = next((a.image_path for a in cluster if a.image_path), "")
            if image:
                payload["image_path"] = image
            if story.get("category"):
                payload["category"] = story["category"]
            if story.get("severity"):
                payload["severity"] = story["severity"]
            db.table("cybersecurity_news").insert(payload).execute()
            db.table("rss_articles").update({"synthesized_at": now_iso}).in_(
                "url", [a.url for a in cluster]
            ).execute()
            stats["published"] += 1
        except Exception as exc:  # noqa: BLE001 — keep synthesizing remaining clusters
            stats["failed"] += 1
            message = f"{len(cluster)} source(s): {str(exc)[:200]}"
            stats["errors"].append(message)
            print(f"[synthesize] failed ({message})")
            if _is_quota_error(exc):
                stats["quota_exhausted"] = True
                break
        time.sleep(REQUEST_SPACING_SECONDS)
    return stats
