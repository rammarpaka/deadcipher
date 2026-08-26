"use client";

import { useEffect, useMemo, useState } from "react";
import StoryCard from "@/components/StoryCard";
import { CATEGORIES, type Story } from "@/lib/supabase";

export default function CategoryFeed({
  stories,
  infiniteScroll = true,
}: {
  stories: Story[];
  infiniteScroll?: boolean;
}) {
  // `stories` = initial window from the server render.
  // `extra` = batches appended by scroll pagination (INFINITE_SCROLL).
  const [extra, setExtra] = useState<Story[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(!infiniteScroll);

  const all = useMemo(() => {
    const seen = new Set(stories.map((s) => s.id));
    return [...stories, ...extra.filter((s) => !seen.has(s.id))];
  }, [stories, extra]);

  // counts re-tally from loaded stories so tab badges always match what
  // the filter will actually return (they grow as batches append)
  const loadedCounts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const s of all) {
      if (s.category) tally[s.category] = (tally[s.category] ?? 0) + 1;
    }
    return tally;
  }, [all]);

  const filtered = active
    ? all.filter((s) => s.category === active)
    : all;

  const withImage = filtered.findIndex((s) => s.image_path);
  const featuredIdx = withImage !== -1 && withImage < 5 ? withImage : 0;
  const featured = filtered[featuredIdx];
  const rest = filtered.filter((_, i) => i !== featuredIdx);

  const cursor = all.length ? all[all.length - 1].published_at : null;

  async function loadMore() {
    if (loading || done || !cursor) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/stories?before=${encodeURIComponent(cursor)}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      const data: { stories: Story[]; hasMore: boolean } = await res.json();
      setExtra((prev) => [...prev, ...data.stories]);
      if (!data.hasMore || data.stories.length === 0) setDone(true);
    } catch {
      setDone(true); // stop retrying; the feed still shows what loaded
    } finally {
      setLoading(false);
    }
  }

  // auto-load when the sentinel scrolls into view
  useEffect(() => {
    if (!infiniteScroll || done) return;
    const el = document.getElementById("feed-sentinel");
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  });

  function select(category: string | null) {
    setActive(category);
    requestAnimationFrame(() => {
      document
        .getElementById("latest")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const tab =
    "cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors";
  const tabClass = (isActive: boolean) =>
    `${tab} ${
      isActive
        ? "bg-sky-500/10 text-sky-500 ring-1 ring-sky-500/40"
        : "border border-line bg-surface text-muted hover:text-fg"
    }`;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => select(null)} className={tabClass(!active)}>
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => select(cat)}
            className={tabClass(active === cat)}
          >
            {cat}
            {loadedCounts[cat] ? (
              <span className="ml-1.5 text-faint">{loadedCounts[cat]}</span>
            ) : null}
          </button>
        ))}
      </div>

      <p
        id="latest"
        className="mt-8 scroll-mt-24 text-[11px] font-semibold uppercase tracking-[0.18em] text-faint"
      >
        {active ? `${active} intelligence` : "Latest intelligence"}
      </p>

      {filtered.length === 0 && (
        <div className="mt-4 rounded-xl border border-line bg-surface p-6 text-sm text-muted">
          No stories in <strong className="text-fg">{active}</strong> yet — new
          coverage is classified automatically as it arrives.
        </div>
      )}

      {featured && (
        <>
          <div className="mt-4">
            <StoryCard story={featured} featured />
          </div>
          <div className="mt-5 space-y-5">
            {rest.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        </>
      )}

      {infiniteScroll && (
        <div id="feed-sentinel" className="mt-8 text-center text-xs text-faint">
          {loading
            ? "Loading more stories..."
            : done
              ? "End of the feed — older coverage is searchable."
              : "Scroll for more"}
        </div>
      )}
    </div>
  );
}
