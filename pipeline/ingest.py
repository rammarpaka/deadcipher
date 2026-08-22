from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import feedparser
import httpx
import yaml
from dateutil import parser as date_parser

from pipeline.models import FeedItem

USER_AGENT = (
    "DeadcipherBot/0.1 (+https://github.com/deadcipher; cybersecurity news aggregator)"
)
TRACKING_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
}


def load_feeds(path: Path) -> list[dict]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return list(data["feeds"])


def canonicalize_url(url: str) -> str:
    parts = urlsplit(url.strip())
    query = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if k.lower() not in TRACKING_PARAMS
    ]
    path = parts.path.rstrip("/") or "/"
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, urlencode(query), ""))


def _guid_for(entry: dict, url: str) -> str:
    raw = entry.get("id") or entry.get("guid") or url
    return hashlib.sha256(str(raw).encode("utf-8")).hexdigest()[:32]


def _published_at(entry: dict) -> str | None:
    raw = entry.get("published") or entry.get("updated") or entry.get("created")
    if not raw:
        parsed = entry.get("published_parsed") or entry.get("updated_parsed")
        if parsed:
            return datetime(*parsed[:6], tzinfo=timezone.utc).isoformat()
        return None
    try:
        return date_parser.parse(raw).astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError, OverflowError):
        return None


def _summary(entry: dict) -> str:
    if entry.get("summary"):
        return str(entry["summary"])
    content = entry.get("content") or []
    if content and content[0].get("value"):
        return str(content[0]["value"])
    return ""


def fetch_feed_xml(url: str, client: httpx.Client) -> str:
    response = client.get(url, follow_redirects=True, timeout=30.0)
    response.raise_for_status()
    return response.text


def parse_feed(feed: dict, xml: str) -> list[FeedItem]:
    parsed = feedparser.parse(xml)
    items: list[FeedItem] = []
    for entry in parsed.entries:
        link = entry.get("link") or ""
        if not link:
            continue
        url = canonicalize_url(link)
        items.append(
            FeedItem(
                feed_id=feed["id"],
                feed_name=feed["name"],
                guid=_guid_for(entry, url),
                url=url,
                title=(entry.get("title") or "").strip(),
                published_at=_published_at(entry),
                summary=_summary(entry),
            )
        )
    return items


def ingest_feeds(feeds: list[dict], client: httpx.Client) -> tuple[list[FeedItem], list[dict]]:
    items: list[FeedItem] = []
    failures: list[dict] = []
    for feed in feeds:
        try:
            xml = fetch_feed_xml(feed["url"], client)
            items.extend(parse_feed(feed, xml))
        except Exception as exc:  # noqa: BLE001 — report per-feed failures, keep run alive
            failures.append({"feed_id": feed["id"], "url": feed["url"], "error": str(exc)})
    return items, failures


def default_client() -> httpx.Client:
    return httpx.Client(
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
        },
        timeout=30.0,
    )
