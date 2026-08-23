from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

from pipeline.ingest import default_client, ingest_feeds, load_feeds
from pipeline.scrape import scrape_client, scrape_items
from pipeline.supabase_export import connect, export_items, is_configured, known_urls
from pipeline.synthesize import run_synthesis

ROOT = Path(__file__).resolve().parent
FEEDS_PATH = ROOT / "feeds.yaml"


def _max_items_default() -> int:
    try:
        return max(1, int(os.environ.get("MAX_ITEMS") or ""))
    except ValueError:
        return 15


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest cybersecurity RSS feeds.")
    parser.add_argument(
        "--max-items",
        type=int,
        default=_max_items_default(),
        help="Cap items to scrape this run (env: MAX_ITEMS).",
    )
    parser.add_argument("--no-scrape", action="store_true", help="Only read RSS, skip article fetch.")
    parser.add_argument(
        "--no-synthesize", action="store_true", help="Skip Gemini synthesis step."
    )
    parser.add_argument(
        "--dry-run-synthesis",
        action="store_true",
        help="Cluster pending articles and print the plan without calling Gemini.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("artifacts/ingest.json"),
        help="Where to write the JSON report.",
    )
    return parser.parse_args()


def main() -> int:
    load_dotenv()
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

    db = None
    already_tracked = 0
    if is_configured():
        db = connect()
        tracked = known_urls(db, [item.url for item in selected])
        already_tracked = len(tracked)
        selected = [item for item in selected if item.url not in tracked]

    if not args.no_scrape:
        with scrape_client() as client:
            scrape_items(selected, client)

    export_stats = {"inserted": 0, "skipped": 0}
    if db is not None:
        export_stats = export_items(db, selected)

    synthesis_stats: dict = {"skipped": True}
    if db is not None and not args.no_synthesize:
        synthesis_stats = run_synthesis(db, dry_run=args.dry_run_synthesis)

    report = {
        "ran_at": datetime.now(timezone.utc).isoformat(),
        "feeds_configured": len(feeds),
        "items_from_rss": len(items),
        "unique_urls": len(unique),
        "already_tracked": already_tracked,
        "selected": len(selected),
        "supabase_configured": db is not None,
        "supabase_export": export_stats,
        "synthesis": synthesis_stats,
        "feed_failures": failures,
        "items": [item.to_dict() for item in selected],
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"Feeds configured: {len(feeds)}")
    print(f"RSS items: {len(items)} unique={len(unique)}")
    print(f"Supabase: configured={db is not None} skipped_known={already_tracked} {export_stats}")
    print(f"Synthesis: { {k: v for k, v in synthesis_stats.items() if k != 'errors'} }")
    if synthesis_stats.get("failed"):
        for error in synthesis_stats.get("errors", []):
            print(f"::warning::[synthesize] {error}")
    if synthesis_stats.get("quota_exhausted"):
        print("::warning::LLM daily quota exhausted — synthesis resumes on the next run")
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
    _write_github_summary(report)
    return 0


def _write_github_summary(report: dict) -> None:
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    lines = [
        "## RSS ingest log",
        f"- Ran at: `{report['ran_at']}`",
        f"- Feeds: {report['feeds_configured']}",
        f"- RSS items: {report['items_from_rss']} unique={report['unique_urls']}",
        f"- Supabase: configured={report['supabase_configured']} export={report['supabase_export']}",
        f"- Synthesis: { {k: v for k, v in report['synthesis'].items() if k != 'errors'} }",
        "",
    ]
    if report["synthesis"].get("failed"):
        lines.append("### Synthesis failures")
        for error in report["synthesis"].get("errors", []):
            lines.append(f"- ⚠️ {error}")
        lines.append("")
    if report["feed_failures"]:
        lines.append("### Feed failures")
        for failure in report["feed_failures"]:
            lines.append(f"- **{failure['feed_id']}**: {failure['error']}")
        lines.append("")
    lines.append("### Newest items")
    for item in report["items"]:
        lines.append(
            f"- [{item['feed_id']}] {item['title']} — scrape=`{item['scrape_status']}`"
        )
    Path(summary_path).write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
