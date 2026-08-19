"use client";

import Link from "next/link";
import Image from "next/image";
import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { COACH_ENABLED } from "@/lib/flags";

// Five primary destinations, one player question each, in the order they are
// listed below: Home is "what do I do today", Progress is "is it working",
// Analyze is "how was that rep", Coach is "can I ask someone", Train is "what
// do I practice". Everything else the old eleven-item nav carried now lives
// inside one of these (goals on the dashboard, drills and learn under Train,
// history under Progress) or in the chrome (settings), so the mobile bar holds
// every tab on screen at once with nothing to scroll and nothing hidden off
// the edge.
type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  // Route prefixes that light this tab. A hub tab owns its sub-routes: Train
  // is active on /plan, /drills and /learn so the player always knows which
  // of the five they are inside, even three links deep.
  match: string[];
};

const icon = (paths: React.ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5 shrink-0"
    aria-hidden
    focusable="false"
  >
    {paths}
  </svg>
);

const ICONS = {
  home: icon(
    <path d="M3 11.5 12 4l9 7.5M5.5 9.5V19a1 1 0 0 0 1 1H10v-5.5h4V20h3.5a1 1 0 0 0 1-1V9.5" />,
  ),
  analyze: icon(
    <>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <circle cx="12" cy="12" r="3.5" />
    </>,
  ),
  train: icon(
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M8 3.5V6M16 3.5V6" />
      <path d="M9 14.5l2 2 4-4" />
    </>,
  ),
  progress: icon(
    <>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M7.5 15.5 11 11l3 2.5 4.5-6" />
    </>,
  ),
  coach: icon(
    <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9.5L4.5 20V6Z" />,
  ),
  settings: icon(
    <>
      <circle cx="12" cy="12" r="3.25" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </>,
  ),
} as const;

// ORDER IS OWNER-SET (2026-08-06) and is not alphabetical, not by frequency,
// and not the order these were built in. Analyze sits in the MIDDLE on purpose:
// it is the one thing a player comes here to do, and the centre slot is the
// easiest reach on a phone held one-handed. The two that answer "how am I
// doing" sit to its left, the two that answer "what next" to its right.
//
// The array is the single source for both surfaces. `SideNavLinks` renders the
// desktop sidebar from it and `TabBar` renders the phone bar from it, through
// the same `visibleNav` filter, so an order change lands on both or on neither.
const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: ICONS.home, match: ["/dashboard", "/goals"] },
  { href: "/progress", label: "Progress", icon: ICONS.progress, match: ["/progress", "/history"] },
  { href: "/analyze", label: "Analyze", icon: ICONS.analyze, match: ["/analyze", "/analysis"] },
  { href: "/coach", label: "Coach", icon: ICONS.coach, match: ["/coach"] },
  // Train lands on /drills, not /plan: the weekly plan is hidden (2026-08-05,
  // it was really a dietary check-in and is out of scope for now). /plan stays
  // in `match` so the tab still highlights if anyone reaches the page directly
  // by URL, which it remains reachable by.
  { href: "/drills", label: "Train", icon: ICONS.train, match: ["/plan", "/drills", "/learn"] },
];

function isActive(pathname: string, item: NavItem) {
  return item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

function visibleNav(items: NavItem[]) {
  return COACH_ENABLED ? items : items.filter((item) => item.href !== "/coach");
}

export function SideNavLinks() {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {visibleNav(NAV).map((item) => {
        const active = isActive(pathname, item);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-11 items-center gap-3 rounded-control px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-navy-lighter font-medium text-chalk"
                  : "text-chalk-dim hover:bg-navy-light hover:text-chalk"
              }`}
            >
              {active && (
                <span className="nav-active-marker absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gold" />
              )}
              <span className={active ? "nav-active-icon text-gold-ink" : ""}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// Settings is chrome, not a destination: it sits above Sign out at the bottom
// of the sidebar and behind the gear in the mobile top bar, because a page
// visited once a month should not hold one of five prime slots.
export function SettingsNavLink() {
  const pathname = usePathname();
  const active = pathname === "/settings" || pathname.startsWith("/settings/");
  return (
    <Link
      href="/settings"
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-11 items-center gap-3 rounded-control px-3 py-2.5 text-sm transition-colors ${
        active
          ? "bg-navy-lighter font-medium text-chalk"
          : "text-chalk-dim hover:bg-navy-light hover:text-chalk"
      }`}
    >
      {active && (
        <span className="nav-active-marker absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gold" />
      )}
      <span className={active ? "nav-active-icon text-gold-ink" : ""}>
        {ICONS.settings}
      </span>
      Settings
    </Link>
  );
}

// The mobile gear, rendered in the top bar beside the logout control, so
// settings stays one tap away without costing a tab slot.
export function SettingsTopBarLink() {
  const pathname = usePathname();
  const active = pathname === "/settings" || pathname.startsWith("/settings/");
  return (
    <Link
      href="/settings"
      aria-label="Settings"
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 min-w-11 items-center justify-center rounded-control transition-colors ${
        active ? "text-gold-ink" : "text-chalk-dim hover:text-chalk"
      }`}
    >
      {ICONS.settings}
    </Link>
  );
}

export function TabBar() {
  const pathname = usePathname();

  // Four or five equal slots that always fit the viewport. The old bar held
  // eleven fixed-width tabs behind overflow-x scrolling, which left half the
  // app off the right edge of every phone with no affordance beyond a swipe
  // nobody was told about. With at most five slots there is nothing to
  // scroll, so the snap, overflow and scroll-into-view machinery went with it.
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-navy/90 backdrop-blur-md md:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        viewTransitionName: "app-tabbar",
      }}
    >
      <ul className="flex">
        {visibleNav(NAV).map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 py-2 transition-colors ${
                  active ? "text-gold-ink" : "text-chalk-dim"
                }`}
              >
                {/* Non-color active signal: a top indicator bar plus a
                    heavier label, mirroring the sidebar's treatment. */}
                {active && (
                  <span className="nav-active-marker absolute left-1/2 top-0 h-0.5 w-7 -translate-x-1/2 rounded-full bg-gold" />
                )}
                <span className={active ? "nav-active-icon" : ""}>{item.icon}</span>
                <span
                  className={`whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.02em] ${
                    active ? "font-medium" : ""
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}


/**
 * The wordmark. A link home from anywhere, and a REFRESH once you are already
 * home.
 *
 * A logo that points at the page you are standing on is the one piece of app
 * chrome that reliably does nothing, and the dashboard is exactly where a
 * player wants to re-read: an analysis they just ran, a plan that regenerated,
 * a goal note written by `after()` seconds after the redirect that put them
 * here. `router.refresh()` re-runs the server components and leaves client
 * state alone, so the page reloads its data without the full-reload flash.
 *
 * It renders a <button> rather than a <Link> on the dashboard on purpose. A
 * link whose href is the current URL is announced as navigation and does not
 * describe what the click will do; the button gets the honest label and
 * `aria-busy` while the refresh is in flight. Both branches take the same
 * classes so the two are visually identical.
 */
export function HomeMark({
  size,
  markClass,
  className,
}: {
  size: number;
  markClass: string;
  className: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const mark = (
    <>
      <Image
        src="/icon-mark.png"
        alt=""
        width={size}
        height={size}
        className={`${markClass} transition-opacity ${pending ? "opacity-50" : "opacity-100"}`}
      />
      Vollyio
    </>
  );

  if (pathname !== "/dashboard") {
    return (
      <Link href="/dashboard" aria-label="Vollyio, home" className={className}>
        {mark}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label="Refresh dashboard"
      aria-busy={pending}
      onClick={() => startTransition(() => router.refresh())}
      className={className}
    >
      {mark}
    </button>
  );
}
