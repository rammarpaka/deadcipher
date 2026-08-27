-- Run this in the Supabase SQL editor once.
-- Service role (GitHub Action / local pipeline) bypasses RLS.
-- The Next.js app uses the publishable key with SELECT-only policy on
-- cybersecurity_news (see the policy at the bottom).

create table if not exists tracked_rss_links (
    url text primary key,
    guid text,
    feed_id text,
    processed_at timestamptz not null default now()
);

create table if not exists rss_articles (
    url text primary key,
    feed_id text not null,
    title text not null default '',
    published_at timestamptz,
    summary text not null default '',
    body text not null default '',
    scrape_status text not null default 'skipped',
    scraped_at timestamptz not null default now(),
    synthesized_at timestamptz,
    image_path text
);

create table if not exists cybersecurity_news (
    id bigint generated always as identity primary key,
    headline text not null,
    story_body jsonb not null,
    image_path text,
    category text,
    severity text,
    recommended_action text,
    why_it_matters text,
    published_at timestamptz,
    created_at timestamptz not null default now()
);

-- ============================================================
-- FULL-TEXT SEARCH
-- Tokenizes headline + all paragraph text into search_vector.
-- The generated column maintains itself; the pipeline writes nothing.
--
-- FULL BACKOUT — run these 3 statements to remove FTS completely:
--   drop index if exists fts_cybersecurity_news;
--   alter table cybersecurity_news drop column if exists search_vector;
--   drop function if exists story_search_text(text, jsonb);
-- ============================================================

create or replace function story_search_text(headline text, body jsonb)
returns text language sql immutable as $$
  select coalesce(headline, '') || ' ' || coalesce((
    select string_agg(p->>'paragraph_text', ' ')
    from jsonb_array_elements(body) p
  ), '')
$$;

alter table cybersecurity_news add column if not exists search_vector tsvector
  generated always as (to_tsvector('english', story_search_text(headline, story_body))) stored;

create index if not exists fts_cybersecurity_news
  on cybersecurity_news using gin (search_vector);

-- ============================================================
-- TODAY'S BRIEF
-- One LLM-generated editorial summary, refreshed when older than 12h
-- by the pipeline (see pipeline/daily_brief.py). History is kept.
-- ============================================================

create table if not exists daily_brief (
    id bigint generated always as identity primary key,
    headline text not null,
    summary text not null,
    stats jsonb not null default '{}'::jsonb,
    generated_at timestamptz not null default now()
);

alter table daily_brief enable row level security;
create policy "public read brief"
on daily_brief for select
to anon
using (true);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table tracked_rss_links enable row level security;
alter table rss_articles enable row level security;
alter table cybersecurity_news enable row level security;

-- Public read access to published stories only.
create policy "public read stories"
on cybersecurity_news for select
to anon
using (true);
