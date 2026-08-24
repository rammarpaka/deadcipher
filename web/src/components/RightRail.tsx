import type { Story } from "@/lib/supabase";
import { sourceDomain } from "@/lib/supabase";

function Widget({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function trendingCves(stories: Story[]) {
  const counts = new Map<string, { hits: number; latest: string }>();
  const re = /CVE-\d{4}-\d{4,7}/gi;
  for (const story of stories) {
    const text = `${story.headline} ${story.story_body
      .map((p) => p.paragraph_text)
      .join(" ")}`;
    for (const cve of text.match(re) ?? []) {
      const id = cve.toUpperCase();
      const prev = counts.get(id);
      counts.set(id, {
        hits: (prev?.hits ?? 0) + 1,
        latest:
          !prev?.latest || story.published_at! > prev.latest
            ? story.published_at!
            : prev.latest,
      });
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].hits - a[1].hits || b[1].latest.localeCompare(a[1].latest))
    .slice(0, 5);
}

function topSources(stories: Story[]) {
  const counts = new Map<string, number>();
  for (const story of stories) {
    for (const p of story.story_body) {
      const d = sourceDomain(p.citation_source_url);
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
}

const RESOURCES = [
  { name: "MITRE ATT&CK", desc: "Threat intelligence framework", url: "https://attack.mitre.org" },
  { name: "NVD Database", desc: "Search vulnerabilities", url: "https://nvd.nist.gov" },
  { name: "VirusTotal", desc: "Analyze suspicious files", url: "https://www.virustotal.com" },
  { name: "CISA KE Catalog", desc: "Exploited vulnerabilities", url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog" },
  { name: "Shodan", desc: "Search exposed devices", url: "https://www.shodan.io" },
];

export default function RightRail({ stories }: { stories: Story[] }) {
  const cves = trendingCves(stories);
  const sources = topSources(stories);

  return (
    <aside className="space-y-5">
      {cves.length > 0 && (
        <Widget title="Trending vulnerabilities">
          <ul className="space-y-2">
            {cves.map(([cve, info]) => (
              <li key={cve}>
                <a
                  href={`https://nvd.nist.gov/vuln/detail/${cve}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-surface2"
                >
                  <span className="font-mono text-xs text-fg">{cve}</span>
                  <span className="text-[11px] text-faint">
                    {info.hits} mention{info.hits > 1 ? "s" : ""}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Widget>
      )}

      {sources.length > 0 && (
        <Widget title="Top sources">
          <ul className="space-y-2">
            {sources.map(([domain, count], i) => (
              <li
                key={domain}
                className="flex items-center justify-between px-2 py-1 text-xs"
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-muted">{domain}</span>
                </span>
                <span className="text-[11px] text-faint">{count}</span>
              </li>
            ))}
          </ul>
        </Widget>
      )}

      <Widget title="Popular resources">
        <ul className="space-y-1">
          {RESOURCES.map((r) => (
            <li key={r.name}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg px-2 py-1.5 transition-colors hover:bg-surface2"
              >
                <span className="block text-xs font-medium text-fg">
                  {r.name}
                </span>
                <span className="block text-[11px] text-faint">{r.desc}</span>
              </a>
            </li>
          ))}
        </ul>
      </Widget>
    </aside>
  );
}
