import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getStory,
  sourceDomain,
  storyDate,
  timeAgo,
  type Citation,
} from "@/lib/supabase";

export const revalidate = 60;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const story = await getStory(Number(id)).catch(() => null);
  return {
    title: story ? `${story.headline} — deadcipher` : "Story not found",
    description:
      story?.story_body[0]?.paragraph_text.slice(0, 150) ?? undefined,
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

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-[11px] font-bold text-white">
              dc
            </span>
            <span className="font-semibold tracking-tight text-zinc-100">
              deadcipher
            </span>
          </Link>
          <Link
            href="/"
            className="text-xs font-medium text-zinc-400 transition-colors hover:text-sky-400"
          >
            ← All stories
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <time dateTime={storyDate(story)}>
            {new Date(storyDate(story)).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </time>
          <span aria-hidden>·</span>
          <span>{timeAgo(storyDate(story))}</span>
          <span aria-hidden>·</span>
          <span>
            {sources.length} source{sources.length > 1 ? "s" : ""}
          </span>
        </div>

        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
          {story.headline}
        </h1>

        <article className="mt-8 space-y-6">
          {paragraphs.map((para, i) => (
            <p
              key={i}
              className="text-[15px] leading-7 text-zinc-300"
            >
              {para.paragraph_text}{" "}
              <a
                href={para.citation_source_url}
                target="_blank"
                rel="noopener noreferrer"
                title={para.citation_source_url}
                className="inline-flex translate-y-px items-center rounded-full border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-[11px] font-medium text-zinc-300 no-underline transition-colors hover:border-sky-600 hover:text-sky-400"
              >
                [{numbers.get(para.citation_source_url)}]{" "}
                {sourceDomain(para.citation_source_url)}
              </a>
            </p>
          ))}
        </article>

        <p className="mt-10 border-t border-zinc-800/80 pt-6 text-xs leading-relaxed text-zinc-600">
          This report is an original synthesis generated from the public
          sources cited inline above. Sentences are rewritten, not copied; each
          citation links back to the article its facts came from.
        </p>
      </main>
    </div>
  );
}
