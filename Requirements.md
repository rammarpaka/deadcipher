# Project Specification: Free AI-Powered Cybersecurity News Aggregator

This document outlines the software requirements, system architecture, and database layout for a completely free, automated "answer engine" dashboard modeled after the structural paragraph and point-by-point link functionality found in Perplexity Discover.

---

## 📋 1. Project Requirements

### Functional Requirements
* **Automated Ingestion:** The system must automatically check for breaking updates from multiple cybersecurity RSS feeds on a strict 5-minute interval cycle.
* **Duplicate Filtering:** The system must track previously encountered source links in a lookup table to filter them out immediately and preserve AI token constraints.
* **Topic Clustering (Deduplication):** The system must automatically analyze distinct incoming articles from the same timeframe and group items reporting on the exact same event or vulnerability into individual story clusters.
* **Transformative Synthesis:** The system must extract full text contents from the clustered source URLs and synthesize them into an original, unified report. Verbatim line or sentence copying is completely barred to remain fully compliant with copyright fair-use boundaries.
* **Point-by-Point Citation:** The final output engine must link individual paragraphs or bullet points directly back to the explicit source URL matching the factual verification.
* **Instant UI Delivery:** The frontend customer website must load the consolidated news stories instantly from storage, meaning no live web-scraping or generative AI runtime bottlenecks occur during a user visit.

### Non-Functional Requirements
* **Infrastructure Budget:** Exactly \$0.00/month by utilizing the free product tiers of modern cloud services exclusively.
* **System Latency:** Frontend website rendering and page load latencies must remain under 2 seconds.
* **API Rate Compliance:** The backend pipeline must handle script executions within strict free API platform limitations (such as Google Gemini's 15 requests-per-minute threshold).

---

## 🏗️ 2. Architectural Design & Data Flow

To eliminate the extensive proxy and server costs of open-web crawlers, this architecture implements a **Hybrid RSS + RAG** pipeline. RSS feeds serve as lightweight real-time notification hooks, while a Large Language Model manages the core data structuring and compilation layers.

```
[ GitHub Actions Cron ]
       │ (Wakes up every 5 mins)
       ▼
[ 1. Ingestion Engine ] <───(Reads URLs)───> [ RSS Feeds (CISA, BleepingComputer) ]
       │
       ├───(Cross-checks)───> [ 💾 Supabase: tracked_rss_links ]
       ▼
[ 2. Text Scraper ] ───(Extracts Text Body)───> [ Source Web Pages ]
       │
       ▼
[ 3. Gemini 2.5-Flash AI ] ───(Structured JSON Synthesis)
       │
       ▼
[ 💾 Supabase: cybersecurity_news ]
       ▲
       │ (Instant HTTP REST API)
[ 🌐 Vercel Web UI Front-End ]
```

---

## 🗄️ 3. Database Schema (PostgreSQL)

The zero-cost hosting setup leverages two functional operational tables configured within a cloud relational PostgreSQL instance:

### Table A: `tracked_rss_links`
Logs separate source article URLs to ensure that no single news link is downloaded, scraped, or computed twice.
```sql
CREATE TABLE tracked_rss_links (
    url TEXT PRIMARY KEY,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Table B: `cybersecurity_news`
Stores the finalized, AI-summarized structured stories for instant downstream frontend loading.
```sql
CREATE TABLE cybersecurity_news (
    id SERIAL PRIMARY KEY,
    headline TEXT NOT NULL,
    story_body JSONB NOT NULL, -- Holds the collection of paragraphs + individual source URLs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Structural JSON Layout Inside the `story_body` Column
```json
[
  {
    "paragraph_text": "Security researchers discovered over 9,300 active, exposed Amazon Web Services access keys.",
    "citation_source_url": "https://www.bleepingcomputer.com/news/security/example-link"
  },
  {
    "paragraph_text": "Threat actors are actively leveraging automated scanning tools to exploit these keys, prompting urgent CISA rotation guidance.",
    "citation_source_url": "https://www.cisa.gov/cybersecurity-advisories/example-link"
  }
]
```

---

## 🚀 4. Technology Stack Summary (100% Free Tiers)

* **Code Runtime & Cron Trigger:** Python 3.10 environments executed automatically via scheduled **GitHub Actions** runners.
* **Database & Built-in API Layer:** **Supabase** (Provides hosted PostgreSQL along with auto-generated instant secure HTTPS REST API endpoints).
* **AI Generation & Synthesis Layer:** **Google Gemini 2.5-Flash** configured through a free developer token from Google AI Studio.
* **Frontend Web Application Hosting:** **Vercel** or **Netlify** serving a responsive, plain HTML/JavaScript or React user interface.