"use client";

import { useEffect, useState } from "react";
import StoryCard from "@/components/StoryCard";
import { CATEGORIES, type Story } from "@/lib/supabase";

export default function CategoryFeed({
  stories,
  counts,
}: {
  stories: Story[];
  counts: Record<string, number>;
}) {
  const [active, setActive] = useState<string | null>(null);

  // restore category from URL hash (e.g. /#Malware) on load
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.replace("#", ""));
    if (CATEGORIES.includes(hash as (typeof CATEGORIES)[number])) {
      setActive(hash);
      document
        .getElementById("latest")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const filtered = active
    ? stories.filter((s) => s.category === active)
    : stories;

  const withImage = filtered.findIndex((s) => s.image_path);
  const featuredIdx = withImage !== -1 && withImage < 5 ? withImage : 0;
  const featured = filtered[featuredIdx];
  const rest = filtered.filter((_, i) => i !== featuredIdx);

  function select(category: string | null) {
    setActive(category);
    window.history.replaceState(
      null,
      "",
      category ? `/#${encodeURIComponent(category)}` : "/",
    );
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
            {counts[cat] ? (
              <span className="ml-1.5 text-faint">{counts[cat]}</span>
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
    </div>
  );
}
