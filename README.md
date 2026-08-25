# Deadcipher

AI-synthesized cybersecurity real time updates with paragraph-level citations. An automated pipeline
watches security RSS feeds every 5 minutes, deduplicates stories, rewrites them into
original multi-paragraph reports with per-paragraph source attribution, and serves them
from storage  no AI at request time.

**Live:** https://www.deadcipher.com

---

## Architecture

```
[ GitHub Actions cron — every 5 min ]
                |
                v
[ 1. Ingest ]  fetch RSS feeds (feeds.yaml), canonicalize URLs,
               dedupe against tracked_rss_links (Supabase)
                |
                v
[ 2. Scrape ]  fetch each new article -> extract body text (trafilatura)
               + og:image -> resize 800px -> upload to Cloudflare R2
                |
                v
[ 3. Export ]  raw rows -> rss_articles (staging, synthesized_at IS NULL)
                |
                v
[ 4. Synthesize ]  cluster same-event articles (shared CVE ids +
                   title similarity) -> Gemini Flash-Lite via OpenAI-compatible
                   endpoint -> JSON contract: original headline + 3-5 rewritten
                   paragraphs, each citing exactly one source URL
                |
                v
[ Supabase Postgres ]  cybersecurity_news (headline, story_body JSONB,
                published_at, image_path) — RLS: public read on stories only
                |
                v
[ Next.js on Vercel ]  ISR (60s) -> www.deadcipher.com
                images served from cdn.deadcipher.com (R2 public domain)
```

Key design points:

- **Deduplication** — a URL is never fetched or processed twice (`tracked_rss_links`).
- **Clustering** — same-event coverage from multiple outlets merges into one story;
  citations must spread across sources (enforced by prompt + retry).
- **Self-healing** — failed synthesis leaves articles pending; the next cron run retries.
- **Provider-agnostic AI** — any OpenAI-compatible endpoint works via env vars.
- **Image re-hosting** — og:images are copied into R2 under content-hashed keys, so
  hotlink rot and source-side blocking never affect the frontend.

## Tech Stack

| Layer | Technology |
|---|---|
| Pipeline runtime | Python 3.12, [uv](https://docs.astral.sh/uv/) |
| Ingestion | feedparser, httpx, PyYAML, python-dateutil |
| Scraping | trafilatura, lxml-html-clean |
| AI synthesis | Google Gemini Flash-Lite via OpenAI SDK (swappable) |
| Database + REST API | Supabase (Postgres, Row Level Security) |
| Image hosting | Cloudflare R2 (S3-compatible API, boto3 + Pillow) |
| Scheduler | GitHub Actions (`cron: */5`) |
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS v4 |
| Hosting | Vercel (app) · Cloudflare (DNS, image CDN) |

## Repo Structure

```
pipeline/          ingestion, scraping, synthesis, image handling
  feeds.yaml       RSS source list
  ingest.py        feed fetch + URL canonicalization + dedupe
  scrape.py        article fetch, body extraction, og:image capture
  synthesize.py    clustering, LLM synthesis, story publication
  images.py        og:image extraction, resize, R2 upload
  backfill_images.py  one-shot image backfill for existing articles
supabase/          schema.sql (run once in the Supabase SQL editor)
web/               Next.js application
.github/workflows/ cron workflow
```

## Running the Pipeline Locally

Requires Python 3.12+ and [uv](https://docs.astral.sh/uv/).

```bash
# 1. Install dependencies
uv sync

# 2. Configure environment (.env in repo root — see .env.example)
cp .env.example .env
```

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | yes | Project URL |
| `SUPABASE_SECRET_KEY` | yes | Service key (`sb_secret_...`; legacy service_role JWT also accepted) |
| `LLM_API_KEY` | for synthesis | Any OpenAI-compatible provider key |
| `LLM_BASE_URL` | no | Defaults to Gemini's OpenAI-compatible layer |
| `LLM_MODEL` | no | Defaults to `gemini-3.5-flash-lite` |
| `R2_ENDPOINT` / `R2_ACCESS_KEY` / `R2_SECRET_KEY` | for images | R2 S3 API credentials |
| `MAX_ITEMS` / `SYNTHESIS_MAX_CLUSTERS` | no | Per-run caps (defaults 15 / 6) |

```bash
# 3. Full run: fetch feeds, dedupe, scrape, export, synthesize
uv run python -m pipeline

# Useful flags
uv run python -m pipeline --no-scrape        # skip article fetching
uv run python -m pipeline --no-synthesize    # ingest + scrape only
uv run python -m pipeline --dry-run-synthesis  # show clusters, no LLM calls
uv run python -m pipeline --max-items 30     # widen the ingest window

# Backfill images for existing articles
uv run python -m pipeline.backfill_images
```

## Running the Web App Locally

Requires Node.js 20+.

```bash
cd web

# 1. Install dependencies
npm install

# 2. Configure environment (.env.local — see web/.env.example)
cp .env.example .env.local
```

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (safe for browsers; RLS restricts access) |
| `NEXT_PUBLIC_IMAGE_CDN` | R2 public domain, e.g. `https://cdn.deadcipher.com` |

```bash
# 3. Start dev server
npm run dev        # -> http://localhost:3000

# Production build check
npm run build
```

## Deployment

1. **Supabase** — run `supabase/schema.sql` once (tables + RLS enablement).
2. **GitHub** — secrets `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `LLM_API_KEY`,
   `R2_ENDPOINT`, `R2_ACCESS_KEY`, `R2_SECRET_KEY` in the deploy environment;
   optional variables `MAX_ITEMS`, `SYNTHESIS_MAX_CLUSTERS`, `LLM_MODEL`.
3. **Vercel** — import repo with Root Directory `web`; env vars
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `NEXT_PUBLIC_IMAGE_CDN`.
4. **Cloudflare** — DNS for the app domain (→ Vercel) and the R2 bucket's public
   domain (`cdn.`) with TLS mode Full (strict).

## Roadmap

- [x] Story categories + severity badges (LLM-classified, filter tabs)
- [ ] Full-text search across story bodies
- [ ] Today's Brief — daily generated summary
- [ ] Manual content sections (articles, tutorials, tools)
- [ ] Trending topic widgets from classification data
