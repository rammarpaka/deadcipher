import type { Metadata } from "next";
import Link from "next/link";
import SiteShell from "@/components/SiteShell";
import StoryCard from "@/components/StoryCard";
import { getLatestBrief, getStories, type Story } from "@/lib/supabase";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Today's brief — deadcipher",
  description: "Today's cybersecurity intelligence summary with full coverage.",
};

export default async function BriefPage() {
  const brief = await getLatestBrief().catch(() => null);
  let stories: Story[] = [];

  if (brief) {
    const cutoff = Date.now() - 24 * 3_600_000;
    const all = await getStories().catch(() => [] as Story[]);
    stories = all.filter(
      (s) => new Date(s.published_at ?? s.created_at).getTime() >= cutoff,
    );
  }

  const stats = brief?.stats ?? {};

  return (
    <SiteShell>
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10">
        <Link
          href="/"
          className="text-xs font-medium text-muted transition-colors hover:text-fg"
        >
          &larr; All stories
        </Link>

        {!brief ? (
          <div className="mt-8 rounded-xl border border-line bg-surface p-6 text-sm text-muted">
            No brief has been generated yet — it appears automatically once the
            day&rsquo;s coverage accumulates.
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                  Today&rsquo;s brief
                </p>
                <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-fg sm:text-4xl">
                  {brief.headline}
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
                  {brief.summary}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface p-5 lg:grid-cols-1">
                <div className="rounded-xl bg-surface2 p-3 text-center">
                  <dt className="text-[10px] uppercase tracking-widest text-faint">
                    Stories
                  </dt>
                  <dd className="text-2xl font-bold text-fg">
                    {stats.stories_24h ?? "—"}
                  </dd>
                </div>
                <div className="rounded-xl bg-rose-500/5 p-3 text-center">
                  <dt className="text-[10px] uppercase tracking-widest text-faint">
                    Critical
                  </dt>
                  <dd className="text-2xl font-bold text-rose-500">
                    {stats.critical ?? 0}
                  </dd>
                </div>
                <div className="rounded-xl bg-orange-500/5 p-3 text-center">
                  <dt className="text-[10px] uppercase tracking-widest text-faint">
                    High
                  </dt>
                  <dd className="text-2xl font-bold text-orange-500">
                    {stats.high ?? 0}
                  </dd>
                </div>
                <div className="rounded-xl bg-surface2 p-3 text-center">
                  <dt className="text-[10px] uppercase tracking-widest text-faint">
                    CVEs
                  </dt>
                  <dd className="text-2xl font-bold text-fg">
                    {stats.unique_cves ?? 0}
                  </dd>
                </div>
              </dl>
            </div>

            <p className="mt-14 text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
              Coverage from the last 24 hours
            </p>
            <div className="mt-4 space-y-5">
              {stories.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          </>
        )}
      </main>
    </SiteShell>
  );
}
