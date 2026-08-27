from __future__ import annotations

import argparse
import json
import os
import re
import time

from dotenv import load_dotenv

from pipeline.supabase_export import connect
from pipeline.synthesize import _is_llm_configured, _llm_client, _llm_config

BATCH = 500
# Seconds between LLM calls. Raise (e.g. IMPACT_SPACING=12) if your
# provider/proxy rate-limits: slower pacing = fewer 429 retries overall.
SPACING_SECONDS = float(os.environ.get("IMPACT_SPACING", "1.0"))
RETRY_DELAYS = (15.0, 40.0)

PROMPT = """Analyze this cybersecurity story and produce the two structured fields below.

RULES:
1. "recommended_action": ONE sentence, max 220 chars, stating who must act and
   the immediate action.
2. "why_it_matters": ONE sentence, max 220 chars, explaining the consequence
   if unaddressed.
3. Address the READER (security teams, administrators, users at large) —
   never describe one specific organization's own response.
4. Ground strictly in the story; no invented details, no hedging.
5. Never use semicolons.

Respond with ONLY a JSON object: {{"recommended_action": "...", "why_it_matters": "..."}}

STORY:
headline: {headline}
content: {content}
"""


def analysis_for(llm, model: str, headline: str, content: str) -> dict:
    prompt = PROMPT.format(headline=headline[:300], content=content[:1800])
    response = llm.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "You are a cybersecurity analyst. Respond with JSON only.",
            },
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    data = json.loads(response.choices[0].message.content)
    action = str(data.get("recommended_action") or data.get("impact") or data.get("insight") or "").strip()
    why = str(data.get("why_it_matters") or "").strip()
    # semicolons read as machine-generated — store clean sentences
    clean = lambda s: re.sub(r";\s*", ". ", s)
    if not action or not why:
        raise ValueError("missing recommended_action or why_it_matters")
    return {
        "recommended_action": clean(action)[:300],
        "why_it_matters": clean(why)[:300],
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Backfill AI security analysis (action + why it matters) for critical/high stories."
    )
    parser.parse_args()
    load_dotenv()
    if not _is_llm_configured():
        print("LLM not configured (LLM_API_KEY)")
        return 1

    db = connect()
    llm = _llm_client()
    _base, model, _key = _llm_config()
    print(f"backfilling analysis with model: {model}")

    stories = (
        db.table("cybersecurity_news")
        .select("id,headline,story_body")
        .in_("severity", ["critical", "high"])
        .or_("recommended_action.is.null,why_it_matters.is.null")
        .limit(BATCH)
        .execute()
        .data
        or []
    )
    print(f"applicable stories without full analysis: {len(stories)}")

    done = 0
    for story in stories:
        content = " ".join(
            p.get("paragraph_text", "") for p in story["story_body"][:2]
        )
        result = None
        for attempt, delay in enumerate((0,) + RETRY_DELAYS):
            if delay:
                print(f"[analysis] rate limited, waiting {delay:.0f}s...")
                time.sleep(delay)
            try:
                result = analysis_for(llm, model, story["headline"], content)
                break
            except Exception as exc:  # noqa: BLE001 — per-story isolation
                msg = str(exc)
                # transient proxy hiccups: rate limits + empty/invalid JSON
                retryable = any(
                    m in msg for m in ("429", "404", "Expecting value", "JSON", "not NoneType")
                )
                if retryable and attempt < len(RETRY_DELAYS):
                    continue
                print(f"[analysis] failed #{story['id']}: {msg[:120]}")
                break
        if result:
            db.table("cybersecurity_news").update(result).eq(
                "id", story["id"]
            ).execute()
            done += 1
            print(f"#{story['id']} {story['headline'][:55]}")
        time.sleep(SPACING_SECONDS)

    print(f"analysis backfilled: {done}/{len(stories)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
