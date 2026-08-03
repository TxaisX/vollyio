import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  SideNavLinks,
  SettingsNavLink,
  SettingsTopBarLink,
  TabBar,
} from "@/components/app-nav";
import { FunnelHandoff } from "@/components/funnel-handoff";
import { SeamArcs } from "@/components/motif";
import { logout } from "@/app/(auth)/actions";
import { LogoutButton } from "./logout-button";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <FunnelHandoff />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn-primary"
      >
        Skip to content
      </a>
      <header
        style={{ viewTransitionName: "app-topbar" }}
        className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-navy/90 px-5 py-2 backdrop-blur-md md:hidden"
      >
        <Link
          href="/dashboard"
          aria-label="Vollyio, home"
          className="flex min-h-11 items-center gap-2 font-display text-lg font-bold tracking-tight"
        >
          <Image src="/icon-mark.png" alt="" width={24} height={24} className="h-6 w-6" />
          Vollyio
        </Link>
        {/* Settings lives here rather than in the tab bar: the five tabs below
            are the daily loop, and the gear keeps the monthly page one tap
            away without costing a slot. */}
        <div className="flex items-center gap-1">
          <SettingsTopBarLink />
          <form action={logout}>
            <LogoutButton variant="mobile" />
          </form>
        </div>
      </header>
      <nav
        aria-label="Primary"
        style={{ viewTransitionName: "app-sidebar" }}
        className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r border-line bg-navy/90 p-4 backdrop-blur-xl md:flex"
      >
        <Link
          href="/dashboard"
          aria-label="Vollyio, home"
          className="mb-6 flex min-h-11 items-center gap-2 px-3 font-display text-xl font-bold tracking-tight"
        >
          <Image src="/icon-mark.png" alt="" width={28} height={28} className="h-7 w-7" />
          Vollyio
        </Link>
        <SideNavLinks />
        <div className="mt-auto flex flex-col gap-1">
          <SettingsNavLink />
          <form action={logout}>
            <LogoutButton variant="sidebar" />
          </form>
        </div>
      </nav>
      <main
        id="main"
        tabIndex={-1}
        className="relative isolate min-w-0 flex-1 px-5 pb-28 pt-8 md:px-10 md:pb-12"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-y-0 right-0 -z-10 hidden w-[min(72rem,78vw)] overflow-hidden md:block"
        >
          <SeamArcs className="h-full w-full animate-drift" opacity={0.035} />
        </div>
        <div className="relative z-0">{children}</div>
      </main>
      <TabBar />
    </div>
  );
}
