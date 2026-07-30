"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "@/components/motion";
import { COACH_ENABLED } from "@/lib/flags";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
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
  plan: icon(
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M8 3.5V6M16 3.5V6" />
      <path d="M9 14.5l2 2 4-4" />
    </>,
  ),
  dashboard: icon(
    <path d="M3 11.5 12 4l9 7.5M5.5 9.5V19a1 1 0 0 0 1 1H10v-5.5h4V20h3.5a1 1 0 0 0 1-1V9.5" />,
  ),
  analyze: icon(
    <>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <circle cx="12" cy="12" r="3.5" />
    </>,
  ),
  coach: icon(
    <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9.5L4.5 20V6Z" />,
  ),
  scoreboard: icon(
    <>
      <rect x="3.5" y="6" width="7.25" height="12" rx="1.5" />
      <rect x="13.25" y="6" width="7.25" height="12" rx="1.5" />
      <path d="M7 10v4M16.5 10h1v4" />
    </>,
  ),
  goals: icon(
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </>,
  ),
  progress: icon(
    <>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M7.5 15.5 11 11l3 2.5 4.5-6" />
    </>,
  ),
  history: icon(
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.25L14.75 15" />
    </>,
  ),
  drills: icon(
    <>
      <rect x="5" y="5" width="14" height="16" rx="2" />
      <path d="M9 5V4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4v1M9 11.5h6M9 15.5h4" />
    </>,
  ),
  learn: icon(
    <>
      <path d="M12 6.5C10.5 5 8 4.5 4 5v13c4-.5 6.5 0 8 1.5 1.5-1.5 4-2 8-1.5V5c-4-.5-6.5 0-8 1.5Z" />
      <path d="M12 6.5V19" />
    </>,
  ),
  settings: icon(
    <>
      <circle cx="12" cy="12" r="3.25" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </>,
  ),
} as const;

const SIDE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: ICONS.dashboard },
  { href: "/analyze", label: "Analyze", icon: ICONS.analyze },
  { href: "/plan", label: "Plan", icon: ICONS.plan },
  { href: "/coach", label: "Coach", icon: ICONS.coach },
  { href: "/learn", label: "Learn", icon: ICONS.learn },
  { href: "/scoreboard", label: "Scoreboard", icon: ICONS.scoreboard },
  { href: "/goals", label: "Goals", icon: ICONS.goals },
  { href: "/progress", label: "Progress", icon: ICONS.progress },
  { href: "/history", label: "History", icon: ICONS.history },
  { href: "/drills", label: "Drills", icon: ICONS.drills },
  { href: "/settings", label: "Settings", icon: ICONS.settings },
];

const TAB_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: ICONS.dashboard },
  { href: "/analyze", label: "Analyze", icon: ICONS.analyze },
  { href: "/plan", label: "Plan", icon: ICONS.plan },
  { href: "/coach", label: "Coach", icon: ICONS.coach },
  { href: "/learn", label: "Learn", icon: ICONS.learn },
  { href: "/scoreboard", label: "Games", icon: ICONS.scoreboard },
  { href: "/goals", label: "Goals", icon: ICONS.goals },
  { href: "/progress", label: "Progress", icon: ICONS.progress },
  { href: "/history", label: "History", icon: ICONS.history },
  { href: "/drills", label: "Drills", icon: ICONS.drills },
  { href: "/settings", label: "Settings", icon: ICONS.settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function visibleNav(items: NavItem[]) {
  return COACH_ENABLED ? items : items.filter((item) => item.href !== "/coach");
}

export function SideNavLinks() {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {visibleNav(SIDE_NAV).map((item) => {
        const active = isActive(pathname, item.href);
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
              <span className={active ? "nav-active-icon text-gold" : ""}>
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

export function TabBar() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    active?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [pathname, reducedMotion]);

  return (
    <nav
      ref={navRef}
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 overflow-x-auto overscroll-x-contain border-t border-line bg-navy/90 backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        viewTransitionName: "app-tabbar",
      }}
    >
      <ul className="flex w-max min-w-full snap-x snap-mandatory">
        {visibleNav(TAB_NAV).map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="w-[4.5rem] shrink-0 snap-center">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-1 py-2 transition-colors ${
                  active ? "text-gold" : "text-chalk-dim"
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
