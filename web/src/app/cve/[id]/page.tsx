import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteShell from "@/components/SiteShell";
import StoryCard from "@/components/StoryCard";
import { searchStories, type Story } from "@/lib/supabase";

export const revalidate = 300;

const CVE_PATTERN = /^CVE-\d{4}-\d{4,7}$/i;

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-rose-500/10 text-rose-500 ring-rose-500/40",
  high: "bg-orange-500/10 text-orange-500 ring-orange-500/40",
  medium: "bg-amber-500/10 text-amber-500 ring-amber-500/40",
  low: "bg-emerald-500/10 text-emerald-500 ring-emerald-500/40",
};

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const cve = decodeURIComponent(id).toUpperCase();
  if (!CVE_PATTERN.test(cve)) {
    return { title: "Not found — deadcipher" };
  }
  const stories = await searchStories(cve).catch(() => [] as Story[]);
  return {
    title: `${cve} — coverage and analysis — deadcipher`,
    description: `${stories.length} cited report${stories.length === 1 ? "" : "s"} covering ${cve} on deadcipher.`,
  };
}

export default async function CvePage({ params }: Props) {
  if (process.env.CVE_PAGES === "0") notFound();

  const { id } = await params;
  const cve = decodeURIComponent(id).toUpperCase();
  if (!CVE_PATTERN.test(cve)) notFound();

  const stories = await searchStories(cve).catch(() => [] as Story[]);
  if (stories.length === 0) notFound();

  const rank: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
  const severity = stories
    .map((s) => s.severity)
    .filter(Boolean)
    .sort((a, b) => (rank[b!] ?? 0) - (rank[a!] ?? 0))[0];
  const sources = new Set(
    stories.flatMap((s) => s.story_body.map((p) => p.citation_source_url)),
  );

  return (
    <SiteShell>
      <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-10">
        <Link
          href="/"
          className="text-xs font-medium text-muted transition-colors hover:text-fg"
        >
          &larr; All stories
        </Link>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-3xl font-bold tracking-tight text-fg sm:text-4xl">
            {cve}
          </h1>
          {severity && (
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest ring-1 ${SEVERITY_STYLES[severity] ?? ""}`}
            >
              {severity}
            </span>
          )}
        </div>

        <p className="mt-3 text-sm text-muted">
          {stories.length} cited report{stories.length === 1 ? "" : "s"} on our
          platform mention this vulnerability, from {sources.size} source
          {sources.size === 1 ? "" : "s"}.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={`https://nvd.nist.gov/vuln/detail/${cve}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-fg transition-colors hover:border-sky-500/60"
          >
            View on NVD ↗
          </a>
          <a
            href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-fg transition-colors hover:border-sky-500/60"
          >
            CISA KE Catalog ↗
          </a>
        </div>

        <p className="mt-12 text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
          Coverage mentioning {cve}
        </p>
        <div className="mt-4 space-y-5">
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      </main>
    </SiteShell>
  );
}
