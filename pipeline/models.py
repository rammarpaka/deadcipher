from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class FeedItem:
    feed_id: str
    feed_name: str
    guid: str
    url: str
    title: str
    published_at: str | None
    summary: str
    scraped_text: str = ""
    scrape_status: str = "skipped"
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        text = payload.get("scraped_text") or ""
        payload["scraped_chars"] = len(text)
        if len(text) > 400:
            payload["scraped_text_preview"] = text[:400]
        else:
            payload["scraped_text_preview"] = text
        return payload
