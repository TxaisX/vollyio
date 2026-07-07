import Link from "next/link";
import { SideNavLinks, TabBar } from "@/components/app-nav";
import { logout } from "@/app/(auth)/actions";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <nav className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r border-line p-4 md:flex">
        <Link
          href="/dashboard"
          className="mb-6 px-3 font-display text-xl font-bold tracking-tight"
        >
          Sideout
        </Link>
        <SideNavLinks />
        <form action={logout} className="mt-auto">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-sm text-chalk-dim transition-colors hover:bg-navy-light hover:text-chalk"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden
            >
              <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M15 8l4 4-4 4M19 12H9" />
            </svg>
            Log out
          </button>
        </form>
      </nav>
      <main className="min-w-0 flex-1 px-5 pb-28 pt-8 md:px-10 md:pb-12">
        {children}
      </main>
      <TabBar />
    </div>
  );
}
