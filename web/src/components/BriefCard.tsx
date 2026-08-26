import Link from "next/link";
import type { DailyBrief } from "@/lib/supabase";
import { timeAgo } from "@/lib/supabase";

export default function BriefCard({
  brief,
  compact = false,
}: {
  brief: DailyBrief;
  compact?: boolean;
}) {
  const s = brief.stats ?? {};
  return (
    <Link
      href="/brief"
      className="group block overflow-hidden rounded-2xl border border-sky-500/30 bg-surface shadow-lg shadow-sky-500/5 transition-all hover:border-sky-500/60 hover:shadow-sky-500/10"
    >
      <div className={compact ? "p-5" : "p-6"}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
            Today&rsquo;s brief
          </p>
          <span className="text-[10px] uppercase tracking-widest text-faint">
            {timeAgo(brief.generated_at)}
          </span>
        </div>
        <h2 className="mt-2.5 text-lg font-semibold leading-snug text-fg transition-colors group-hover:text-sky-500">
          {brief.headline}
        </h2>
        {!compact && (
          <p className="mt-2.5 text-sm leading-relaxed text-muted">
            {brief.summary}
          </p>
        )}
        <dl className="mt-4 flex items-center gap-6">
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-faint">
              Stories
            </dt>
            <dd className="text-base font-bold text-fg">
              {s.stories_24h ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-faint">
              Critical
            </dt>
            <dd className="text-base font-bold text-rose-500">
              {s.critical ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-faint">
              CVEs
            </dt>
            <dd className="text-base font-bold text-fg">{s.unique_cves ?? 0}</dd>
          </div>
          <span className="ml-auto text-xs font-medium text-sky-500 opacity-0 transition-opacity group-hover:opacity-100">
            Open brief &rarr;
          </span>
        </dl>
      </div>
    </Link>
  );
}
