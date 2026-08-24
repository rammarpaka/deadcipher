import SiteShell from "@/components/SiteShell";
import StoryCard from "@/components/StoryCard";
import RightRail from "@/components/RightRail";
import { getStories, timeAgo, type Story } from "@/lib/supabase";

export const revalidate = 60;

function StatusStrip({ stories }: { stories: Story[] }) {
  const sourceCount = new Set(
    stories.flatMap((s) => s.story_body.map((p) => p.citation_source_url)),
  ).size;
  const latest = stories[0]?.published_at ?? stories[0]?.created_at;

  return (
    <div className="border-b border-line bg-surface/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2.5 text-xs text-muted">
        <span className="inline-flex items-center gap-2 font-semibold text-fg">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Live stream
        </span>
        <span className="hidden h-3 w-px bg-line sm:block" aria-hidden />
        <span>
          <strong className="font-semibold text-fg">{stories.length}</strong>{" "}
          active stories
        </span>
        <span>
          <strong className="font-semibold text-fg">{sourceCount}</strong>{" "}
          sources analyzed
        </span>
        {latest && <span>updated {timeAgo(latest)}</span>}
        <span className="ml-auto hidden font-mono text-[10px] uppercase tracking-widest text-faint lg:block">
          AI-powered real-time threat intelligence
        </span>
      </div>
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

  // feature the newest story that has an image (falls back to newest overall)
  const withImage = stories.findIndex((s) => s.image_path);
  const featuredIdx = withImage !== -1 && withImage < 5 ? withImage : 0;
  const featured = stories[featuredIdx];
  const rest = stories.filter((_, i) => i !== featuredIdx);

  return (
    <SiteShell>
      {stories.length > 0 && !error && <StatusStrip stories={stories} />}

      <main className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-72 text-faint dot-grid opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]"
        />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-500">
            Live threat intelligence
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-[1.1] tracking-tight text-fg sm:text-5xl">
            Cybersecurity intelligence,
            <br />
            <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
              without the noise.
            </span>
          </h1>
          <div className="mt-5 h-1 w-14 rounded-full bg-gradient-to-r from-rose-500 to-sky-500" />
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted sm:text-base">
            We track the security web, connect the evidence, and surface what
            actually matters — every paragraph linked to the article it came
            from.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="#latest"
              className="inline-flex items-center gap-2 rounded-xl bg-fg px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-85"
            >
              Explore latest intelligence
              <span aria-hidden>&rarr;</span>
            </a>
            <a
              href="#trending-cves"
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-sky-500/60"
            >
              View trending CVEs
            </a>
          </div>
        </div>

        {error && (
          <div className="mt-10 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">
            Failed to load stories: {error}
          </div>
        )}

        {!error && stories.length === 0 && (
          <div className="mt-10 rounded-xl border border-line bg-surface p-6 text-sm text-muted">
            No stories yet — the pipeline is working on its first batch. Check
            back in a few minutes.
          </div>
        )}

        {!error && featured && (
          <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              <StoryCard story={featured} featured />
              <p
                id="latest"
                className="mt-12 scroll-mt-24 text-[11px] font-semibold uppercase tracking-[0.18em] text-faint"
              >
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
