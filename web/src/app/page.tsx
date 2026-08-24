import SiteShell from "@/components/SiteShell";
import StoryCard from "@/components/StoryCard";
import RightRail from "@/components/RightRail";
import { getStories, timeAgo, type Story } from "@/lib/supabase";

export const revalidate = 60;

function StatsBar({ stories }: { stories: Story[] }) {
  const sourceCount = new Set(
    stories.flatMap((s) => s.story_body.map((p) => p.citation_source_url)),
  ).size;
  const latest = stories[0]?.published_at ?? stories[0]?.created_at;

  return (
    <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted">
      <span className="rounded-full border border-line bg-surface px-3 py-1.5">
        <strong className="font-semibold text-fg">{stories.length}</strong>{" "}
        active stories
      </span>
      <span className="rounded-full border border-line bg-surface px-3 py-1.5">
        <strong className="font-semibold text-fg">{sourceCount}</strong>{" "}
        sources analyzed
      </span>
      {latest && (
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          updated {timeAgo(latest)}
        </span>
      )}
    </div>
  );
}

export default async function Home() {
  let stories: Story[] = [];
  let error: string | null = null;

  try {
    stories = await getStories();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load stories";
  }

  const [featured, ...rest] = stories;

  return (
    <SiteShell>
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-500">
          Live threat intelligence
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight tracking-tight text-fg sm:text-5xl">
          Cybersecurity news,{" "}
          <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            explained by evidence.
          </span>
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
          AI-synthesized reporting from across the security web. Every claim is
          traceable to its source, stripped of duplication, and prioritized by
          recency.
        </p>

        {!error && stories.length > 0 && <StatsBar stories={stories} />}

        {error && (
          <div className="mt-8 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">
            Failed to load stories: {error}
          </div>
        )}

        {!error && stories.length === 0 && (
          <div className="mt-8 rounded-xl border border-line bg-surface p-6 text-sm text-muted">
            No stories yet — the pipeline is working on its first batch. Check
            back in a few minutes.
          </div>
        )}

        {!error && featured && (
          <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              <StoryCard story={featured} featured />
              <p className="mt-10 text-xs font-semibold uppercase tracking-widest text-faint">
                Latest intelligence
              </p>
              <div className="mt-4 space-y-5">
                {rest.map((story) => (
                  <StoryCard key={story.id} story={story} />
                ))}
              </div>
            </div>
            <RightRail stories={stories} />
          </div>
        )}
      </main>
    </SiteShell>
  );
}
