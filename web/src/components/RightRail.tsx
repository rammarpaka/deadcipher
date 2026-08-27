import Link from "next/link";

import type { Story } from "@/lib/supabase";
import { sourceDomain } from "@/lib/supabase";

function Widget({
  title,
  id,
  action,
  children,
}: {
  title: string;
  id?: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
          {title}
        </h3>
        {action && (
          <a
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-semibold uppercase tracking-widest text-sky-500 hover:underline"
          >
            {action.label}
          </a>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const SEVERITY_RANK: Record<string, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "text-rose-500",
  high: "text-orange-500",
  medium: "text-amber-500",
  low: "text-emerald-500",
};

function trendingCves(stories: Story[]) {
  const counts = new Map<
    string,
    { hits: number; latest: string; severity: string | null }
  >();
  const re = /CVE-\d{4}-\d{4,7}/gi;
  for (const story of stories) {
    const text = `${story.headline} ${story.story_body
      .map((p) => p.paragraph_text)
      .join(" ")}`;
    for (const cve of text.match(re) ?? []) {
      const id = cve.toUpperCase();
      const prev = counts.get(id);
      const severity =
        story.severity &&
        (!prev?.severity ||
          SEVERITY_RANK[story.severity] > SEVERITY_RANK[prev.severity])
          ? story.severity
          : prev?.severity ?? null;
      counts.set(id, {
        hits: (prev?.hits ?? 0) + 1,
        latest:
          !prev?.latest || story.published_at! > prev.latest
            ? story.published_at!
            : prev.latest,
        severity,
      });
    }
  }
  return [...counts.entries()]
    .sort(
      (a, b) =>
        b[1].hits - a[1].hits ||
        SEVERITY_RANK[b[1].severity ?? "low"] - SEVERITY_RANK[a[1].severity ?? "low"] ||
        b[1].latest.localeCompare(a[1].latest),
    )
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
        <Widget
          title="Trending vulnerabilities"
          id="trending-cves"
          action={{ label: "NVD", href: "https://nvd.nist.gov" }}
        >
          <ul className="space-y-2">
            {cves.map(([cve, info]) => (
              <li key={cve}>
                <Link
                  href={`/cve/${cve}`}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-surface2"
                >
                  <span className="font-mono text-xs text-fg">{cve}</span>
                  <span className="flex items-center gap-2">
                    {info.severity && (
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-widest ${SEVERITY_STYLES[info.severity] ?? ""}`}
                      >
                        {info.severity}
                      </span>
                    )}
                    <span className="text-[11px] text-faint">
                      {info.hits} mention{info.hits > 1 ? "s" : ""}
                    </span>
                  </span>
                </Link>
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

      {(() => {
        const catCounts = new Map<string, number>();
        for (const story of stories) {
          if (story.category) {
            catCounts.set(
              story.category,
              (catCounts.get(story.category) ?? 0) + 1,
            );
          }
        }
        const ranked = [...catCounts.entries()].sort((a, b) => b[1] - a[1]);
        if (ranked.length === 0) return null;
        return (
          <Widget title="Intelligence by category">
            <ul className="space-y-1">
              {ranked.map(([cat, count]) => (
                <li key={cat}>
                  <a
                    href={`/#${encodeURIComponent(cat)}`}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-surface2"
                  >
                    <span className="text-xs text-muted">{cat}</span>
                    <span className="text-[11px] text-faint">{count}</span>
                  </a>
                </li>
              ))}
            </ul>
          </Widget>
        );
      })()}

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
