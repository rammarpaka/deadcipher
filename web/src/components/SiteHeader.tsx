"use client";

import { useEffect, useRef } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";

export default function SiteHeader() {
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navLink =
    "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:text-fg";

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Logo />

        <form action="/search" className="relative mx-auto w-full max-w-md">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={searchRef}
            name="q"
            type="search"
            placeholder="Search news, topics, tools..."
            autoComplete="off"
            className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-12 text-sm text-fg placeholder:text-faint focus:border-sky-500 focus:outline-none"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-surface2 px-1.5 font-mono text-[10px] text-faint sm:block">
            ⌘K
          </kbd>
        </form>

        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-rose-500">
              Live
            </span>
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
