import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteShell from "@/components/SiteShell";
import {
  getStory,
  imageUrl,
  sourceDomain,
  storyDate,
  timeAgo,
  type Citation,
} from "@/lib/supabase";

export const revalidate = 300;

const CVE_PATTERN = /(CVE-\d{4}-\d{4,7})/g;
const CVE_PAGES_ENABLED = process.env.CVE_PAGES !== "0";
const INSIGHTS_ENABLED = process.env.IMPACT_INSIGHTS !== "0";

type Props = { params: Promise<{ id: string }> };

function renderWithCveLinks(text: string) {
  const parts = text.split(CVE_PATTERN);
  return parts.map((part, i) => {
    if (!/^CVE-\d{4}-\d{4,7}$/i.test(part)) return <span key={i}>{part}</span>;
    const cve = part.toUpperCase();
    const href = CVE_PAGES_ENABLED ? `/cve/${cve}` : `https://nvd.nist.gov/vuln/detail/${cve}`;
    const external = !CVE_PAGES_ENABLED;
    return (
      <a
        key={i}
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="font-mono text-[13px] text-sky-500 underline decoration-sky-500/40 underline-offset-2 transition-colors hover:decoration-sky-500"
      >
        {cve}
      </a>
    );
  });
}

function SparkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 2.5l1.6 4.2L18 8.2l-4.4 1.5L12 14.5l-1.6-4.8L6 8.2l4.4-1.5L12 2.5z" fill="#F59E0B" />
      <path d="M19 10.5l0.9 1.9 1.9 0.9-1.9 0.9-0.9 1.9-0.9-1.9-1.9-0.9 1.9-0.9 0.9-1.9z" fill="#F59E0B" />
      <path d="M5.5 14.5l0.7 1.4 1.4 0.7-1.4 0.7-0.7 1.4-0.7-1.4-1.4-0.7 1.4-0.7 0.7-1.4z" fill="#F59E0B" opacity="0.85" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z" />
    </svg>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const story = await getStory(Number(id)).catch(() => null);
  return {
    title: story ? `${story.headline} — deadcipher` : "Story not found",
    description:
      story?.recommended_action?.slice(0, 150) ??
      story?.story_body[0]?.paragraph_text.slice(0, 150) ??
      undefined,
    openGraph: story
      ? {
          title: story.headline,
          images: imageUrl(story.image_path)
            ? [imageUrl(story.image_path)!]
            : undefined,
        }
      : undefined,
  };
}

export default async function StoryPage({ params }: Props) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const story = await getStory(numericId).catch(() => null);
  if (!story) notFound();

  const paragraphs = story.story_body.filter(
    (p: Citation) => p?.paragraph_text && p?.citation_source_url,
  );
  const numbers = new Map<string, number>();
  for (const p of paragraphs) {
    if (!numbers.has(p.citation_source_url)) {
      numbers.set(p.citation_source_url, numbers.size + 1);
    }
  }
  const sources = [...numbers.entries()].sort((a, b) => a[1] - b[1]);
  const action = INSIGHTS_ENABLED ? story.recommended_action : null;
  const whyItMatters = INSIGHTS_ENABLED ? story.why_it_matters : null;
  const hasInsight = Boolean(action || whyItMatters);
  const severityChip = story.severity ? (
    <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-600 ring-1 ring-amber-500/20">
      {story.severity} &middot; action required
    </span>
  ) : null;

  return (
    <SiteShell>
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-10">
        <Link
          href="/"
          className="text-xs font-medium text-muted transition-colors hover:text-fg"
        >
          &larr; All stories
        </Link>

        <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <article className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
              {story.category && (
                <span className="font-semibold tracking-widest text-sky-500">
                  {story.category}
                </span>
              )}
              {story.severity && (
                <span className="rounded-full bg-surface2 px-2 py-0.5 tracking-widest">
                  {story.severity}
                </span>
              )}
              <time dateTime={storyDate(story)} className="font-mono">
                {new Date(storyDate(story)).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
              <span aria-hidden>&middot;</span>
              <span className="normal-case tracking-normal">
                {timeAgo(storyDate(story))}
              </span>
              <span aria-hidden>&middot;</span>
              <span className="normal-case tracking-normal">
                {sources.length} source{sources.length > 1 ? "s" : ""}
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-fg sm:text-4xl">
              {story.headline}
            </h1>

            {imageUrl(story.image_path) && (
              <div className="relative mt-6 aspect-[16/8] w-full overflow-hidden rounded-2xl border border-line bg-surface2">
                <Image
                  src={imageUrl(story.image_path)!}
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 900px"
                  className="object-cover"
                />
              </div>
            )}

            <div className="mt-8 space-y-6">
              {paragraphs.map((para, i) => (
                <p key={i} className="text-[15px] leading-7 text-muted">
                  {renderWithCveLinks(para.paragraph_text)}{" "}
                  <a
                    href={para.citation_source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={para.citation_source_url}
                    className="inline-flex translate-y-px items-center gap-1.5 rounded-full border border-line bg-surface2 px-2 py-0.5 text-[11px] font-medium text-muted no-underline transition-colors hover:border-sky-500/60 hover:text-sky-500"
                  >
                    [{numbers.get(para.citation_source_url)}]{" "}
                    {sourceDomain(para.citation_source_url)}
                  </a>
                </p>
              ))}
            </div>
          </article>

          {(action || whyItMatters) && (
            <aside className="lg:sticky lg:top-20">
              <div className="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm dark:border-amber-500/20 dark:bg-gradient-to-b dark:from-amber-500/[0.06] dark:to-transparent">
                <div className="flex flex-nowrap items-center justify-between gap-2 border-b border-amber-100 bg-amber-50/50 px-4 py-3.5 dark:border-line dark:bg-surface">
                  <p className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-bold tracking-wide text-zinc-900 dark:text-fg">
                    <SparkIcon />
                    AI Insight
                  </p>
                  <span className="shrink-0">{severityChip}</span>
                </div>

                <div className="divide-y divide-amber-100/60 dark:divide-line/60">
                  {action && (
                    <div className="bg-amber-50/30 p-5 dark:bg-amber-500/[0.03]">
                      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-500">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15">
                          <ShieldIcon />
                        </span>
                        Recommended action
                      </p>
                      <p className="mt-3 text-[15px] font-semibold leading-relaxed text-zinc-900 dark:text-fg">
                        {action.split('. ')[0]}.
                      </p>
                      {action.includes('. ') && (
                        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-muted">
                          {action.split('. ').slice(1).join('. ')}
                        </p>
                      )}
                    </div>
                  )}
                  {whyItMatters && (
                    <div className="bg-white p-5 dark:bg-transparent">
                      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-faint">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-surface2 dark:text-faint">
                          <AlertIcon />
                        </span>
                        Why it matters
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-muted">{whyItMatters}</p>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </main>
    </SiteShell>
  );
}
