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

function CitationFavicon({ domain }: { domain: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      width={14}
      height={14}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="rounded-[3px]"
    />
  );
}

export const revalidate = 60;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const story = await getStory(Number(id)).catch(() => null);
  return {
    title: story ? `${story.headline} — deadcipher` : "Story not found",
    description:
      story?.story_body[0]?.paragraph_text.slice(0, 150) ?? undefined,
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

  return (
    <SiteShell>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
          <time dateTime={storyDate(story)} className="font-mono">
            {new Date(storyDate(story)).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </time>
          <span aria-hidden>&middot;</span>
          <span>{timeAgo(storyDate(story))}</span>
          <span aria-hidden>&middot;</span>
          <span>
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
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          </div>
        )}

        <article className="mt-8 space-y-6">
          {paragraphs.map((para, i) => (
            <p key={i} className="text-[15px] leading-7 text-muted">
              {para.paragraph_text}{" "}
              <a
                href={para.citation_source_url}
                target="_blank"
                rel="noopener noreferrer"
                title={para.citation_source_url}
                className="inline-flex translate-y-px items-center gap-1.5 rounded-full border border-line bg-surface2 px-2 py-0.5 text-[11px] font-medium text-muted no-underline transition-colors hover:border-sky-500/60 hover:text-sky-500"
              >
                <CitationFavicon domain={sourceDomain(para.citation_source_url)} />
                [{numbers.get(para.citation_source_url)}]{" "}
                {sourceDomain(para.citation_source_url)}
              </a>
            </p>
          ))}
        </article>

        <p className="mt-10 border-t border-line pt-6 text-xs leading-relaxed text-faint">
          This report is an original synthesis generated from the public
          sources cited inline above. Sentences are rewritten, not copied; each
          citation links back to the article its facts came from.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-sky-500 hover:underline"
        >
          &larr; All stories
        </Link>
      </main>
    </SiteShell>
  );
}
