import Link from "next/link";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="dc-grad" x1="4" y1="28" x2="26" y2="4">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      {/* cipher-disk ring with a top gap, reading as a "d" with the stem */}
      <path
        d="M 8.04 10.49 A 8.5 8.5 0 1 0 18.96 10.49"
        stroke="url(#dc-grad)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <line
        x1="22"
        y1="4"
        x2="22"
        y2="25.5"
        stroke="url(#dc-grad)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* the de-cipher slash */}
      <line
        x1="4.5"
        y1="24"
        x2="24.5"
        y2="3.5"
        stroke="#f43f5e"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5">
      <LogoMark size={size} />
      <span className="font-semibold tracking-tight text-fg">deadcipher</span>
    </Link>
  );
}
