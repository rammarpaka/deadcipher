from __future__ import annotations

import argparse
import time

import httpx
from dotenv import load_dotenv

from pipeline.images import extract_og_image, is_configured, process_image
from pipeline.ingest import default_client
from pipeline.supabase_export import connect

BATCH = 500
SLEEP_SECONDS = 1.0
RETRY_DELAYS = (2.0, 5.0, 10.0)


def fetch_with_retry(client: httpx.Client, url: str) -> httpx.Response | None:
    for attempt, delay in enumerate((0.0,) + RETRY_DELAYS):
        if delay:
            time.sleep(delay)
        try:
            resp = client.get(url, follow_redirects=True, timeout=30.0)
            resp.raise_for_status()
            return resp
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status < 500 and status != 429:
                raise
            print(f"[backfill] {status} on {url[:60]} (attempt {attempt + 1})")
        except httpx.HTTPError:
            raise
    return None


def backfill_articles(db, client) -> tuple[int, int]:
    rows = (
        db.table("rss_articles")
        .select("url,image_path")
        .is_("image_path", "null")
        .limit(BATCH)
        .execute()
        .data
        or []
    )
    print(f"articles without images: {len(rows)}")
    updated = 0
    for row in rows:
        try:
            resp = fetch_with_retry(client, row["url"])
            if resp is None:
                print(f"[backfill] giving up on {row['url'][:60]}")
                continue
        except Exception as exc:  # noqa: BLE001 — best effort per article
            print(f"[backfill] fetch failed {row['url'][:60]}: {exc}")
            continue
        og = extract_og_image(resp.text, str(resp.url))
        if not og:
            continue
        key = process_image(og, row["url"], client)
        if key:
            db.table("rss_articles").update({"image_path": key}).eq(
                "url", row["url"]
            ).execute()
            updated += 1
        time.sleep(SLEEP_SECONDS)
    return len(rows), updated


def link_stories(db) -> int:
    stories = (
        db.table("cybersecurity_news")
        .select("id,story_body")
        .is_("image_path", "null")
        .limit(BATCH)
        .execute()
        .data
        or []
    )
    if not stories:
        return 0
    urls = {
        p["citation_source_url"]
        for s in stories
        for p in s["story_body"]
        if p.get("citation_source_url")
    }
    lookup: dict[str, str] = {}
    for i in range(0, len(urls), 50):
        chunk = list(urls)[i : i + 50]
        rows = (
            db.table("rss_articles")
            .select("url,image_path")
            .in_("url", chunk)
            .not_.is_("image_path", "null")
            .execute()
            .data
            or []
        )
        lookup.update({r["url"]: r["image_path"] for r in rows})
    linked = 0
    for story in stories:
        for p in story["story_body"]:
            path = lookup.get(p.get("citation_source_url"))
            if path:
                db.table("cybersecurity_news").update(
                    {"image_path": path}
                ).eq("id", story["id"]).execute()
                linked += 1
                break
    return linked


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill article images to R2.")
    parser.parse_args()
    load_dotenv()
    if not is_configured():
        print("R2 not configured (R2_ENDPOINT / R2_ACCESS_KEY / R2_SECRET_KEY)")
        return 1
    db = connect()
    with default_client() as client:
        total, updated = backfill_articles(db, client)
    print(f"articles processed: {total}, images uploaded: {updated}")
    linked = link_stories(db)
    print(f"stories linked to images: {linked}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
