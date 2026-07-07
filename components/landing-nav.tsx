"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#skills", label: "Skills" },
  { href: "#progress", label: "Progress" },
] as const;

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        scrolled
          ? "border-b border-line bg-navy/85 py-3 backdrop-blur-md"
          : "border-b border-transparent py-5"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 md:px-8">
        <Link href="/" className="font-display text-xl font-bold tracking-tight">
          Sideout
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-chalk-dim transition-colors hover:text-chalk"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-2 py-2 text-sm text-chalk-dim transition-colors hover:text-chalk"
          >
            Log in
          </Link>
          <Link href="/signup" className="btn-primary px-4 py-2 text-sm">
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
