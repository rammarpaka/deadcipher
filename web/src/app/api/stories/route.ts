import { NextResponse } from "next/server";

import { FEED_LIMIT, STORY_FIELDS, toCardStory, type Story } from "@/lib/supabase";

// Scroll-pagination endpoint: returns the next batch of stories older than
// the `before` cursor (ISO timestamp = last story's published_at).
//
// Uses the publishable key — cybersecurity_news is the only publicly
// readable table (RLS), so no secrets are exposed.
//
// DISABLE: set INFINITE_SCROLL=0 — the route then returns an empty batch,
// and the feed stops requesting more (previous single-window behavior).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.INFINITE_SCROLL === "0") {
    return NextResponse.json({ stories: [], hasMore: false, disabled: true });
  }

  const { searchParams } = new URL(request.url);
  const before = searchParams.get("before");
  if (!before || Number.isNaN(Date.parse(before))) {
    return NextResponse.json(
      { error: "missing or invalid `before` cursor" },
      { status: 400 },
    );
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) {
    return NextResponse.json(
      { error: "Supabase env not configured" },
      { status: 500 },
    );
  }

  const url = new URL(`${base.replace(/\/$/, "")}/rest/v1/cybersecurity_news`);
  url.searchParams.set("select", STORY_FIELDS);
  url.searchParams.set("published_at", `lt.${before}`);
  url.searchParams.set("order", "published_at.desc.nullslast");
  url.searchParams.set("limit", String(FEED_LIMIT));

  const res = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: `Supabase REST error ${res.status}` },
      { status: 502 },
    );
  }

  const rows: Story[] = await res.json();
  const stories = rows
    .filter(
      (story) =>
        typeof story.headline === "string" &&
        Array.isArray(story.story_body) &&
        story.story_body.length > 0,
    )
    .map(toCardStory);

  return NextResponse.json({
    stories,
    hasMore: rows.length === FEED_LIMIT,
  });
}
