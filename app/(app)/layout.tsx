import type { Metadata } from "next";
import Link from "next/link";
import { SideNavLinks, TabBar } from "@/components/app-nav";
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
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn-primary"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-navy/90 px-5 py-2 backdrop-blur-md md:hidden">
        <Link
          href="/dashboard"
          aria-label="Sideout, home"
          className="flex min-h-11 items-center font-display text-lg font-bold tracking-tight"
        >
          Sideout
        </Link>
        <form action={logout}>
          <LogoutButton variant="mobile" />
        </form>
      </header>
      <nav
        aria-label="Primary"
        className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r border-line p-4 md:flex"
      >
        <Link
          href="/dashboard"
          aria-label="Sideout, home"
          className="mb-6 flex min-h-11 items-center px-3 font-display text-xl font-bold tracking-tight"
        >
          Sideout
        </Link>
        <SideNavLinks />
        <form action={logout} className="mt-auto">
          <LogoutButton variant="sidebar" />
        </form>
      </nav>
      <main
        id="main"
        tabIndex={-1}
        className="min-w-0 flex-1 px-5 pb-28 pt-8 md:px-10 md:pb-12"
      >
        {children}
      </main>
      <TabBar />
    </div>
  );
}
