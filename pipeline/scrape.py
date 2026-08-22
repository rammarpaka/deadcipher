from __future__ import annotations

import trafilatura
from httpx import Client, HTTPError

from pipeline.ingest import USER_AGENT
from pipeline.models import FeedItem


def scrape_item(item: FeedItem, client: Client) -> FeedItem:
    try:
        response = client.get(item.url, follow_redirects=True, timeout=30.0)
        response.raise_for_status()
    except HTTPError as exc:
        item.scrape_status = "http_error"
        item.errors.append(str(exc))
        return item

    text = trafilatura.extract(
        response.text,
        url=str(response.url),
        include_comments=False,
        include_tables=False,
        favor_recall=True,
    )
    if not text:
        item.scrape_status = "empty"
        item.errors.append("trafilatura extracted no article body")
        return item

    item.scraped_text = text.strip()
    item.scrape_status = "ok"
    return item


def scrape_items(items: list[FeedItem], client: Client) -> list[FeedItem]:
    return [scrape_item(item, client) for item in items]


def scrape_client() -> Client:
    return Client(
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
        timeout=30.0,
    )
