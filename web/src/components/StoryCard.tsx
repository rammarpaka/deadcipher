import Image from "next/image";
import Link from "next/link";
import type { Story } from "@/lib/supabase";
import { imageUrl, sourceDomain, storyDate, timeAgo } from "@/lib/supabase";

function Favicon({ domain }: { domain: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="h-4 w-4 rounded-[4px] ring-1 ring-line"
    />
  );
}

export default function StoryCard({
  story,
  featured = false,
}: {
  story: Story;
  featured?: boolean;
}) {
  const paragraphs = story.story_body.filter(
    (p) => p?.paragraph_text && p?.citation_source_url,
  );
  const sources = [...new Set(paragraphs.map((p) => p.citation_source_url))];
  const firstText = paragraphs[0]?.paragraph_text ?? "";
  const excerpt = firstText.slice(0, featured ? 340 : 220);
  const image = imageUrl(story.image_path);

  const meta = (
    <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
      {featured && (
        <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 font-semibold tracking-widest text-sky-500">
          Latest
        </span>
      )}
      <time dateTime={storyDate(story)}>{timeAgo(storyDate(story))}</time>
      <span aria-hidden>&middot;</span>
      <span>
        {sources.length} source{sources.length > 1 ? "s" : ""}
      </span>
    </div>
  );

  const evidence = (
    <div className="mt-4 flex items-center gap-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-faint">
        Evidence
      </span>
      <span className="flex -space-x-1">
        {sources.slice(0, 4).map((url) => (
          <Favicon key={url} domain={sourceDomain(url)} />
        ))}
      </span>
      <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-sky-500 opacity-0 transition-opacity group-hover:opacity-100">
        Read analysis &rarr;
      </span>
    </div>
  );

  if (featured) {
    return (
      <Link
        href={`/story/${story.id}`}
        className="group block overflow-hidden rounded-2xl border border-line bg-surface ring-1 ring-sky-500/30 transition-all hover:border-sky-500/50 hover:bg-surface2"
      >
        {image && (
          <div className="relative aspect-[16/7] w-full overflow-hidden bg-surface2">
            <Image
              src={image}
              alt=""
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 900px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </div>
        )}
        <div className="p-6">
          {meta}
          <h2 className="mt-3 text-2xl font-semibold leading-snug tracking-tight text-fg transition-colors group-hover:text-sky-500">
            {story.headline}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {excerpt}
            {firstText.length > excerpt.length ? <>&hellip;</> : null}
          </p>
          {evidence}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/story/${story.id}`}
      className="group block rounded-2xl border border-line bg-surface p-5 transition-all hover:border-sky-500/50 hover:bg-surface2"
    >
      {meta}
      <div className={`mt-2.5 flex gap-5 ${image ? "items-center" : ""}`}>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-snug tracking-tight text-fg transition-colors group-hover:text-sky-500">
            {story.headline}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {excerpt}
            {firstText.length > excerpt.length ? <>&hellip;</> : null}
          </p>
        </div>
        {image && (
          <div className="relative hidden h-[92px] w-[148px] shrink-0 overflow-hidden rounded-xl bg-surface2 sm:block">
            <Image
              src={image}
              alt=""
              fill
              sizes="148px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          </div>
        )}
      </div>
      {evidence}
    </Link>
  );
}
