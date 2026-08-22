-- Run this in the Supabase SQL editor once.
-- Service role (GitHub Action / local pipeline) bypasses RLS.
-- The Next.js app should use the anon key with SELECT-only policies later.

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
    synthesized_at timestamptz
);

create table if not exists cybersecurity_news (
    id bigint generated always as identity primary key,
    headline text not null,
    story_body jsonb not null,
    created_at timestamptz not null default now()
);

alter table tracked_rss_links enable row level security;
alter table rss_articles enable row level security;
alter table cybersecurity_news enable row level security;
