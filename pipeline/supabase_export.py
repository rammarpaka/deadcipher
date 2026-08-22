from __future__ import annotations

import os

from supabase import Client, create_client

from pipeline.models import FeedItem


def _service_key() -> str | None:
    return os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")


def is_configured() -> bool:
    return bool(os.environ.get("SUPABASE_URL") and _service_key())


def connect() -> Client:
    return create_client(os.environ["SUPABASE_URL"], _service_key())


def known_urls(client: Client, urls: list[str]) -> set[str]:
    if not urls:
        return set()
    result = client.table("tracked_rss_links").select("url").in_("url", urls).execute()
    return {row["url"] for row in (result.data or [])}


def export_items(client: Client, items: list[FeedItem]) -> dict[str, int]:
    inserted = 0
    skipped = 0
    for item in items:
        existing = client.table("tracked_rss_links").select("url").eq("url", item.url).limit(1).execute()
        if existing.data:
            skipped += 1
            continue
        client.table("rss_articles").upsert(
            {
                "url": item.url,
                "feed_id": item.feed_id,
                "title": item.title,
                "published_at": item.published_at,
                "summary": item.summary,
                "body": item.scraped_text,
                "scrape_status": item.scrape_status,
            }
        ).execute()
        client.table("tracked_rss_links").insert(
            {
                "url": item.url,
                "guid": item.guid,
                "feed_id": item.feed_id,
            }
        ).execute()
        inserted += 1
    return {"inserted": inserted, "skipped": skipped}
