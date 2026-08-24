import Logo from "@/components/Logo";

const FEATURES = [
  {
    title: "Real-time updates",
    desc: "Monitoring the threat landscape around the clock",
    icon: (
      <circle cx="12" cy="12" r="9" />
    ),
    iconExtra: <path d="M12 7v5l3 3" />,
  },
  {
    title: "Verified sources",
    desc: "Aggregated from trusted security researchers",
    icon: (
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
    ),
    iconExtra: <path d="m9 12 2 2 4-4" />,
  },
  {
    title: "No clickbait",
    desc: "Pure, factual reporting with evidence links",
    icon: (
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    ),
    iconExtra: null,
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-6 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-sky-500">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {f.icon}
                  {f.iconExtra}
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-fg">{f.title}</p>
                <p className="mt-0.5 text-xs text-muted">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-between border-t border-line pt-6 text-xs text-faint">
          <Logo size={20} />
          <span>&copy; {new Date().getFullYear()} deadcipher</span>
        </div>
      </div>
    </footer>
  );
}
