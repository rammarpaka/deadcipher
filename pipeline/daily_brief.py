from __future__ import annotations

import json
import os
import re
from datetime import datetime, timedelta, timezone

from supabase import Client

from pipeline.synthesize import (
    _is_llm_configured,
    _llm_client,
    _llm_config,
    _parse_json,
)

# ============================================================
# TODAY'S BRIEF
# One LLM-generated editorial summary of the last 24h of coverage.
# Regenerated only when the latest brief is older than STALE_HOURS —
# at most ~2 calls/day. Disable with DAILY_BRIEF=0.
#
# Stats (story counts, severity split, CVE tally) are computed in code
# from real rows; the LLM writes the narrative prose and is instructed
# to ground it strictly in the provided data.
#
# TO DISABLE: set DAILY_BRIEF=0 (or remove the call in run.py).
# TO REMOVE COMPLETELY: drop the daily_brief table + this module +
# the call in run.py. Fully additive otherwise.
# ============================================================

STALE_HOURS = 12
WINDOW_HOURS = 24
MIN_STORIES = 5
MAX_CONTEXT_STORIES = 60

SYSTEM_INSTRUCTION = (
    "You are a cybersecurity news editor writing a daily intelligence brief. "
    "You ground every statement strictly in the provided story list and "
    "statistics; you never invent events, numbers, or products. "
    "You respond with JSON only."
)

PROMPT_TEMPLATE = """Write today's brief from the cybersecurity stories below.

RULES:
1. "headline": one sentence (max 90 chars) naming the dominant theme of the day.
2. "summary": 2-3 sentences (max 320 chars) summarizing what mattered, grounded
   ONLY in the stories listed. Name concrete products/actors where present.
3. Never copy a headline verbatim; synthesize across them.
4. Respond with ONLY a JSON object: {{"headline": "...", "summary": "..."}}

STATS (computed from real data — reference consistently):
{stats}

STORIES:
{stories}
"""


def is_enabled() -> bool:
    return os.environ.get("DAILY_BRIEF", "1").lower() not in ("0", "false")


def generate_if_stale(db: Client) -> dict:
    stats: dict = {"state": "skipped"}
    if not _is_llm_configured():
        stats["reason"] = "LLM_API_KEY not set"
        return stats

    latest = (
        db.table("daily_brief")
        .select("generated_at")
        .order("generated_at", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    if latest:
        age_h = (
            datetime.now(timezone.utc)
            - datetime.fromisoformat(
                latest[0]["generated_at"].replace("Z", "+00:00")
            )
        ).total_seconds() / 3600
        if age_h < STALE_HOURS:
            stats["state"] = "fresh"
            stats["age_hours"] = round(age_h, 1)
            return stats

    cutoff = (datetime.now(timezone.utc) - timedelta(hours=WINDOW_HOURS)).isoformat()
    rows = (
        db.table("cybersecurity_news")
        .select("id,headline,story_body,category,severity,published_at")
        .gte("published_at", cutoff)
        .order("published_at", desc=True)
        .limit(MAX_CONTEXT_STORIES)
        .execute()
        .data
        or []
    )
    if len(rows) < MIN_STORIES:
        stats["state"] = "not-enough-stories"
        return stats

    # deterministic stats from real rows
    cves: set[str] = set()
    categories: dict[str, int] = {}
    severities: dict[str, int] = {}
    lines: list[str] = []
    for r in rows:
        sev = (r.get("severity") or "").lower()
        cat = r.get("category") or "Uncategorized"
        severities[sev] = severities.get(sev, 0) + 1
        if cat != "Uncategorized":
            categories[cat] = categories.get(cat, 0) + 1
        body_text = " ".join(
            p.get("paragraph_text", "")
            for p in (r.get("story_body") or [])[:2]
        )
        for m in re.findall(
            r"CVE-\d{4}-\d{4,7}", f"{r['headline']} {body_text}", re.IGNORECASE
        ):
            cves.add(m.upper())
        lines.append(f"- [{cat}/{sev or 'unknown'}] {r['headline']}")

    brief_stats = {
        "stories_24h": len(rows),
        "critical": severities.get("critical", 0),
        "high": severities.get("high", 0),
        "unique_cves": len(cves),
        "categories": dict(sorted(categories.items(), key=lambda kv: -kv[1])),
    }
    stats_text = json.dumps(brief_stats)

    prompt = PROMPT_TEMPLATE.format(stats=stats_text, stories="\n".join(lines))
    llm = _llm_client()
    model = _llm_config()[1]
    response = llm.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_INSTRUCTION},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    data = _parse_json(response.choices[0].message.content)
    if not isinstance(data, dict):
        raise ValueError("brief: invalid JSON structure")

    headline = str(data.get("headline") or "").strip()
    summary = str(data.get("summary") or "").strip()
    if not headline or not summary:
        raise ValueError("brief: empty headline/summary")

    db.table("daily_brief").insert(
        {
            "headline": headline[:200],
            "summary": summary[:600],
            "stats": brief_stats,
        }
    ).execute()
    stats.update({"state": "generated", "headline": headline})
    return stats
