from __future__ import annotations

import argparse
import json
import os
import time

from dotenv import load_dotenv

from pipeline.synthesize import (
    CATEGORIES,
    SEVERITIES,
    _is_llm_configured,
    _llm_client,
    _llm_config,
    _parse_json,
)
from pipeline.supabase_export import connect

BATCH = 200
SPACING_SECONDS = 1.0
CONTEXT_CHARS = 1500

PROMPT = """Classify this cybersecurity news story.

Respond with ONLY a JSON object: {{"category": "...", "severity": "..."}}

- "category" must be exactly one of: {categories}
- "severity" must be exactly one of: {severities}
  (critical = actively exploited or catastrophic impact; high = major campaigns
  or serious flaws; medium = standard patches and advisories; low = research,
  opinion, or minor news)

STORY:
headline: {headline}
content: {content}
"""


def classify_story(llm, model: str, headline: str, content: str) -> dict | None:
    prompt = PROMPT.format(
        categories=", ".join(CATEGORIES),
        severities=", ".join(SEVERITIES),
        headline=headline[:300],
        content=content[:CONTEXT_CHARS],
    )
    response = llm.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "You are a cybersecurity news editor. Respond with JSON only.",
            },
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    data = _parse_json(response.choices[0].message.content)
    if not isinstance(data, dict):
        return None
    result: dict = {}
    category = str(data.get("category") or "").strip()
    if category in CATEGORIES:
        result["category"] = category
    severity = str(data.get("severity") or "").strip().lower()
    if severity in SEVERITIES:
        result["severity"] = severity
    return result or None


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Backfill category + severity on existing stories."
    )
    parser.parse_args()
    load_dotenv()
    if not _is_llm_configured():
        print("LLM not configured (LLM_API_KEY)")
        return 1

    db = connect()
    llm = _llm_client()
    _base, model, _key = _llm_config()
    print(f"classifying with model: {model}")

    stories = (
        db.table("cybersecurity_news")
        .select("id,headline,story_body")
        .or_("category.is.null,severity.is.null")
        .limit(BATCH)
        .execute()
        .data
        or []
    )
    print(f"stories to classify: {len(stories)}")

    done = 0
    for story in stories:
        first_paras = " ".join(
            p.get("paragraph_text", "") for p in story["story_body"][:2]
        )
        result = None
        for attempt, delay in enumerate((0, 15.0, 40.0)):
            if delay:
                print(f"[classify] rate limited, waiting {delay:.0f}s...")
                time.sleep(delay)
            try:
                result = classify_story(llm, model, story["headline"], first_paras)
                break
            except Exception as exc:  # noqa: BLE001 — keep classifying the rest
                if "429" in str(exc) and attempt < 2:
                    continue
                print(f"[classify] failed #{story['id']}: {str(exc)[:120]}")
                break
        if result:
            db.table("cybersecurity_news").update(result).eq(
                "id", story["id"]
            ).execute()
            done += 1
            print(
                f"#{story['id']} {result.get('category')}/{result.get('severity')} {story['headline'][:50]}"
            )
        time.sleep(SPACING_SECONDS)

    print(f"classified: {done}/{len(stories)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
