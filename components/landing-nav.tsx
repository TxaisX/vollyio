"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#film", label: "Film room" },
  { href: "#analytics", label: "Analytics" },
  { href: "#skills", label: "Skills" },
  { href: "#progress", label: "Progress" },
  { href: "#faq", label: "FAQ" },
] as const;

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setScrolled(window.scrollY > 24);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Close the menu (and drop its state) once the layout is wide enough to
  // show the inline desktop nav.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const close = () => setOpen(false);

  // While the overlay menu is open: lock page scroll, move focus into the
  // menu, and keep Tab cycling inside the header (logo + toggle + menu) so
  // the page beneath is unreachable until it closes.
  useEffect(() => {
    if (!open) return;
    const root = headerRef.current;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    root
      ?.querySelector<HTMLElement>("#landing-menu a, #landing-menu button")
      ?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !root) return;
      const items = Array.from(
        root.querySelectorAll<HTMLElement>("a, button"),
      ).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header
      ref={headerRef}
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        scrolled || open
          ? "border-b border-line bg-navy/85 py-3 backdrop-blur-md"
          : "border-b border-transparent py-5"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 md:px-8">
        <Link
          href="/"
          aria-label="Sideout, home"
          className="flex min-h-11 items-center gap-2 font-display text-xl font-bold tracking-tight"
        >
          <Image src="/icon-mark.png" alt="" width={28} height={28} className="h-7 w-7" />
          Sideout
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-7 md:flex"
        >
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="flex min-h-11 items-center text-sm text-chalk-dim transition-colors hover:text-chalk"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="flex min-h-11 items-center px-3 text-sm text-chalk-dim transition-colors hover:text-chalk"
          >
            Log in
          </Link>
          <Link href="/signup" className="btn-primary min-h-11 px-4 py-2.5 text-sm">
            Analyze your first rep
          </Link>
        </div>

        <button
          ref={toggleRef}
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="landing-menu"
          onClick={() => setOpen((v) => !v)}
          className="flex h-11 w-11 items-center justify-center rounded-control text-chalk-dim transition-colors hover:text-chalk md:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden
            focusable="false"
          >
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav
          id="landing-menu"
          aria-label="Primary"
          // Full-height overlay anchored to the header's bottom edge: the
          // 100% inside the calc is the header's own height, so the panel
          // always ends exactly at the viewport bottom.
          className="landing-menu-in absolute inset-x-0 top-full h-[calc(100svh-100%)] overflow-y-auto border-t border-line bg-navy/95 backdrop-blur-md md:hidden"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-5 pb-8 pt-4">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => close()}
                className="flex min-h-12 items-center rounded-control px-3 text-base text-chalk-dim transition-colors hover:bg-navy-light hover:text-chalk"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-line pt-4">
              <Link
                href="/login"
                onClick={() => close()}
                className="flex min-h-12 items-center rounded-control px-3 text-base text-chalk-dim transition-colors hover:bg-navy-light hover:text-chalk"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={() => close()}
                className="btn-primary py-3"
              >
                Analyze your first rep
              </Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
