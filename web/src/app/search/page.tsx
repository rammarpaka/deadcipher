import SiteShell from "@/components/SiteShell";
import StoryCard from "@/components/StoryCard";
import { searchStories, type Story } from "@/lib/supabase";

export const metadata = {
  title: "Search — deadcipher",
};

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const term = (q ?? "").trim();

  let stories: Story[] = [];
  let error: string | null = null;
  if (term) {
    try {
      stories = await searchStories(term);
    } catch (e) {
      error = e instanceof Error ? e.message : "Search failed";
    }
  }

  return (
    <SiteShell>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10">
        <h1 className="text-2xl font-bold tracking-tight text-fg">Search</h1>

        <form action="/search" className="mt-4">
          <input
            name="q"
            type="search"
            defaultValue={term}
            placeholder="Search news, topics, tools..."
            autoComplete="off"
            autoFocus
            className="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-fg placeholder:text-faint focus:border-sky-500 focus:outline-none"
          />
        </form>

        {term && (
          <p className="mt-4 text-xs text-faint">
            {error
              ? "Search failed."
              : `${stories.length} result${stories.length === 1 ? "" : "s"} for "${term}"`}
          </p>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">
            {error}
          </div>
        )}

        {term && !error && stories.length === 0 && (
          <div className="mt-6 rounded-xl border border-line bg-surface p-6 text-sm text-muted">
            Nothing matched &ldquo;{term}&rdquo;. Try a broader term — e.g.
            ransomware, CVE, phishing.
          </div>
        )}

        <div className="mt-6 space-y-5">
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      </main>
    </SiteShell>
  );
}
