"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  >
    {paths}
  </svg>
);

const ICONS = {
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
} as const;

const SIDE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: ICONS.dashboard },
  { href: "/analyze", label: "Analyze", icon: ICONS.analyze },
  { href: "/coach", label: "Coach", icon: ICONS.coach },
  { href: "/learn", label: "Learn", icon: ICONS.learn },
  { href: "/scoreboard", label: "Scoreboard", icon: ICONS.scoreboard },
  { href: "/goals", label: "Goals", icon: ICONS.goals },
  { href: "/history", label: "History", icon: ICONS.history },
  { href: "/drills", label: "Drills", icon: ICONS.drills },
];

const TAB_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: ICONS.dashboard },
  { href: "/analyze", label: "Analyze", icon: ICONS.analyze },
  { href: "/coach", label: "Coach", icon: ICONS.coach },
  { href: "/learn", label: "Learn", icon: ICONS.learn },
  { href: "/scoreboard", label: "Games", icon: ICONS.scoreboard },
  { href: "/drills", label: "Drills", icon: ICONS.drills },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNavLinks() {
  const pathname = usePathname();
  return (
    <>
      {SIDE_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex items-center gap-3 rounded-control px-3 py-2.5 text-sm transition-colors ${
              active
                ? "bg-navy-lighter font-medium text-chalk"
                : "text-chalk-dim hover:bg-navy-light hover:text-chalk"
            }`}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gold" />
            )}
            <span className={active ? "text-gold" : ""}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-navy/90 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex">
        {TAB_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors ${
                active ? "text-gold" : "text-chalk-dim"
              }`}
            >
              {item.icon}
              <span className="font-mono text-[9px] uppercase tracking-[0.08em]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
