from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from supabase import Client

# ============================================================
# DATA RETENTION
# Deletes stories, staged articles, and feed links older than
# RETENTION_DAYS to keep the Supabase free-tier database bounded.
#
# TO DISABLE RETENTION: set RETENTION_DAYS=0 in the environment
# (or comment out the enforce_retention call in run.py).
# ============================================================

DEFAULT_RETENTION_DAYS = 730  # 2 years


def _retention_days() -> int:
    try:
        return int(os.environ.get("RETENTION_DAYS", DEFAULT_RETENTION_DAYS))
    except ValueError:
        return DEFAULT_RETENTION_DAYS


def enforce_retention(db: Client) -> dict:
    days = _retention_days()
    stats = {"retention_days": days, "deleted": 0}
    if days <= 0:
        stats["disabled"] = True
        return stats

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    news = (
        db.table("cybersecurity_news")
        .delete()
        .lt("published_at", cutoff)
        .execute()
    )
    articles = (
        db.table("rss_articles").delete().lt("scraped_at", cutoff).execute()
    )
    links = (
        db.table("tracked_rss_links")
        .delete()
        .lt("processed_at", cutoff)
        .execute()
    )

    deleted = sum(len(r.data or []) for r in (news, articles, links))
    stats["deleted"] = deleted
    if deleted:
        print(f"[retention] removed {deleted} rows older than {days} days")
    return stats
