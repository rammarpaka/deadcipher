import Link from "next/link";

import StoryCard from "@/components/StoryCard";
import { getStories, timeAgo, type Story } from "@/lib/supabase";

export const revalidate = 60;

function StatsBar({ stories }: { stories: Story[] }) {
  const sourceCount = new Set(
    stories.flatMap((s) =>
      s.story_body.map((p) => p.citation_source_url),
    ),
  ).size;
  const latest = stories[0]?.created_at;

  return (
    <div className="mt-6 flex flex-wrap gap-2 text-xs text-zinc-400">
      <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1">
        <strong className="text-zinc-200">{stories.length}</strong> stories
      </span>
      <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1">
        <strong className="text-zinc-200">{sourceCount}</strong> sources cited
      </span>
      {latest && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1">
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
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-[11px] font-bold text-white">
              dc
            </span>
            <span className="font-semibold tracking-tight text-zinc-100">
              deadcipher
            </span>
          </Link>
          <span className="text-xs text-zinc-500">
            synthesized · cited · automated
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-20 pt-10">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Cybersecurity news,{" "}
          <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            synthesized and cited.
          </span>
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
          Breaking stories merged from across the security web into original
          reports — every paragraph linked to the article it came from. No
          clickbait, no repetition.
        </p>

        {!error && stories.length > 0 && <StatsBar stories={stories} />}

        {error && (
          <div className="mt-8 rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-300">
            Failed to load stories: {error}
          </div>
        )}

        {!error && stories.length === 0 && (
          <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-400">
            No stories yet — the pipeline is working on its first batch. Check
            back in a few minutes.
          </div>
        )}

        {!error && featured && (
          <section className="mt-10 space-y-5">
            <StoryCard story={featured} featured />
            <div className="space-y-5">
              {rest.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-zinc-800/80 py-6 text-center text-xs text-zinc-600">
        Original syntheses generated from public RSS sources with
        paragraph-level attribution.
      </footer>
    </div>
  );
}
