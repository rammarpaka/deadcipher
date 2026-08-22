from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from pipeline.ingest import default_client, ingest_feeds, load_feeds
from pipeline.scrape import scrape_client, scrape_items

ROOT = Path(__file__).resolve().parent
FEEDS_PATH = ROOT / "feeds.yaml"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest cybersecurity RSS feeds.")
    parser.add_argument("--max-items", type=int, default=8, help="Cap items to scrape this run.")
    parser.add_argument("--no-scrape", action="store_true", help="Only read RSS, skip article fetch.")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("artifacts/ingest.json"),
        help="Where to write the JSON report.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    feeds = load_feeds(FEEDS_PATH)

    with default_client() as client:
        items, failures = ingest_feeds(feeds, client)

    seen: set[str] = set()
    unique: list = []
    for item in items:
        if item.url in seen:
            continue
        seen.add(item.url)
        unique.append(item)

    unique.sort(key=lambda item: item.published_at or "", reverse=True)
    selected = unique[: args.max_items]

    if not args.no_scrape:
        with scrape_client() as client:
            scrape_items(selected, client)

    report = {
        "ran_at": datetime.now(timezone.utc).isoformat(),
        "feeds_configured": len(feeds),
        "items_from_rss": len(items),
        "unique_urls": len(unique),
        "selected": len(selected),
        "feed_failures": failures,
        "items": [item.to_dict() for item in selected],
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"Feeds configured: {len(feeds)}")
    print(f"RSS items: {len(items)} unique={len(unique)}")
    if failures:
        print("Feed failures:")
        for failure in failures:
            print(f"  - {failure['feed_id']}: {failure['error']}")
    for item in selected:
        preview = (item.title or item.url)[:90]
        print(
            f"[{item.feed_id}] {preview} | scrape={item.scrape_status} chars={len(item.scraped_text)}"
        )
    print(f"Wrote {args.output}")
    return 0 if not failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
