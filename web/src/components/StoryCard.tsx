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
  const excerpt = firstText.slice(0, featured ? 320 : 220);

  return (
    <Link
      href={`/story/${story.id}`}
      className={`group block rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-sky-800 hover:bg-zinc-900 ${
        featured ? "ring-1 ring-sky-900/60" : ""
      }`}
    >
      {featured && (
        <span className="mb-3 inline-block rounded-full bg-sky-950 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-sky-400">
          Latest
        </span>
      )}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <time dateTime={storyDate(story)}>{timeAgo(storyDate(story))}</time>
        <span aria-hidden>&middot;</span>
        <span>
          {sources.length} source{sources.length > 1 ? "s" : ""}
        </span>
      </div>

      <h2
        className={`mt-2 font-semibold leading-snug text-zinc-100 transition-colors group-hover:text-white ${
          featured ? "text-2xl" : "text-lg"
        }`}
      >
        {story.headline}
      </h2>

      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        {excerpt}
        {firstText.length > excerpt.length ? "&hellip;" : ""}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        {sources.slice(0, 4).map((url, i) => (
          <span
            key={url}
            className="rounded-full border border-zinc-700/80 bg-zinc-800/70 px-2 py-0.5 text-[11px] font-medium text-zinc-400"
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
