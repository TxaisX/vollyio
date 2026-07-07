import Link from "next/link";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/analyze", label: "Analyze" },
  { href: "/history", label: "History" },
  { href: "/drills", label: "Drills" },
] as const;

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <nav className="hidden w-52 shrink-0 flex-col gap-1 border-r border-line p-4 md:flex">
        <Link href="/dashboard" className="mb-6 px-3 font-display text-xl font-bold">
          Sideout
        </Link>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-sm text-chalk-dim transition hover:bg-navy-light hover:text-chalk"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <main className="flex-1 px-5 pb-24 pt-8 md:px-10 md:pb-10">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 flex border-t border-line bg-navy-light/95 backdrop-blur md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 py-4 text-center font-display text-xs font-bold text-chalk-dim"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
