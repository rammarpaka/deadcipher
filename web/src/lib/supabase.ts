export type Citation = {
  paragraph_text: string;
  citation_source_url: string;
};

export const CATEGORIES = [
  "Malware",
  "Vulnerabilities",
  "Ransomware",
  "Cloud Security",
  "IoT Security",
  "AI Security",
  "Privacy",
  "Data Breach",
] as const;

export type Story = {
  id: number;
  headline: string;
  story_body: Citation[];
  image_path: string | null;
  category: string | null;
  severity: string | null;
  published_at: string | null;
  created_at: string;
};

export function cdnBase(): string {
  const base = (process.env.NEXT_PUBLIC_IMAGE_CDN ?? "").trim();
  if (!base) return "";
  return `${/^https?:\/\//i.test(base) ? base : `https://${base}`}`.replace(
    /\/$/,
    "",
  );
}

export function imageUrl(path: string | null | undefined): string | null {
  const base = cdnBase();
  if (!path || !base) return null;
  return `${base}/${path.replace(/^\//, "")}`;
}

// Builds a to_tsquery string: words AND-ed together; hyphenated
// tokens containing digits (CVE ids) stay quoted as compound lexemes;
// multi-word queries also OR in the concatenated form so split vendor
// names ("key cloak") match single-word lexemes ("keycloak").
function buildTsQuery(term: string): string {
  const tokens = term
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) =>
      t.includes("-")
        ? /\d/.test(t)
          ? `"${t}"`
          : t.split("-").filter(Boolean).join(" & ")
        : t,
    )
    .filter(Boolean);
  if (tokens.length === 0) return "";
  if (tokens.length === 1) return tokens[0];
  const and = tokens.join(" & ");
  const concat = tokens.map((t) => t.replace(/"/g, "")).join("");
  return `(${and}) | ${concat}`;
}

export async function searchStories(q: string, limit = 20): Promise<Story[]> {
  // websearch-style input: strip chars that would break the PostgREST
  // fts(...) filter envelope
  const term = q.replace(/["'\\:()]/g, " ").replace(/\s+/g, " ").trim();
  const query = buildTsQuery(term);
  if (!query) return [];
  const { base, headers } = restConfig();
  const url = new URL(`${base.replace(/\/$/, "")}/rest/v1/cybersecurity_news`);
  url.searchParams.set(
    "select",
    "id,headline,story_body,image_path,category,severity,published_at,created_at",
  );
  url.searchParams.set("search_vector", `fts.${query}`);
  url.searchParams.set("order", "published_at.desc.nullslast");
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Supabase REST error ${res.status}: ${await res.text()}`);
  }
  const rows: Story[] = await res.json();
  return rows.filter(
    (story) =>
      typeof story.headline === "string" &&
      Array.isArray(story.story_body) &&
      story.story_body.length > 0,
  );
}

export function storyDate(story: Story): string {
  return story.published_at ?? story.created_at;
}

function restConfig(): { base: string; headers: HeadersInit } {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  return {
    base,
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  };
}

export async function getStories(limit = 30): Promise<Story[]> {
  const rows = await queryStories(limit);
  return rows.filter(
    (story) =>
      typeof story.headline === "string" &&
      Array.isArray(story.story_body) &&
      story.story_body.length > 0,
  );
}

async function queryStories(limit: number, id?: number): Promise<Story[]> {
  const { base, headers } = restConfig();
  const url = new URL(`${base.replace(/\/$/, "")}/rest/v1/cybersecurity_news`);
  url.searchParams.set(
    "select",
    "id,headline,story_body,image_path,category,severity,published_at,created_at",
  );
  if (id !== undefined) {
    url.searchParams.set("id", `eq.${id}`);
  } else {
    url.searchParams.set("order", "published_at.desc.nullslast");
    url.searchParams.set("limit", String(limit));
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Supabase REST error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function getStory(id: number): Promise<Story | null> {
  const rows = await queryStories(1, id);
  const story = rows[0];
  if (
    !story ||
    typeof story.headline !== "string" ||
    !Array.isArray(story.story_body)
  ) {
    return null;
  }
  return story;
}

export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function sourceDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}
