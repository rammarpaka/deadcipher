import Link from "next/link";
import type { Story } from "@/lib/supabase";
import { sourceDomain, storyDate, timeAgo } from "@/lib/supabase";

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

  return (
    <Link
      href={`/story/${story.id}`}
      className={`group block rounded-2xl border border-line bg-surface p-6 transition-all hover:border-sky-500/50 hover:bg-surface2 ${
        featured ? "ring-1 ring-sky-500/30" : ""
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-faint">
        {featured && (
          <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-sky-500">
            Latest
          </span>
        )}
        <time dateTime={storyDate(story)}>{timeAgo(storyDate(story))}</time>
        <span aria-hidden>&middot;</span>
        <span>
          {sources.length} source{sources.length > 1 ? "s" : ""}
        </span>
      </div>

      <h2
        className={`mt-2.5 font-semibold leading-snug tracking-tight text-fg transition-colors group-hover:text-sky-500 ${
          featured ? "text-2xl" : "text-lg"
        }`}
      >
        {story.headline}
      </h2>

      <p className="mt-3 text-sm leading-relaxed text-muted">
        {excerpt}
        {firstText.length > excerpt.length ? <>&hellip;</> : null}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        {sources.slice(0, 4).map((url, i) => (
          <span
            key={url}
            className="rounded-full border border-line bg-surface2 px-2 py-0.5 font-mono text-[11px] text-muted"
          >
            [{i + 1}] {sourceDomain(url)}
          </span>
        ))}
        <span className="ml-auto text-xs font-medium text-sky-500 opacity-0 transition-opacity group-hover:opacity-100">
          Read analysis &rarr;
        </span>
      </div>
    </Link>
  );
}
