import Link from "next/link";
import Image from "next/image";

// Minimal chrome for the legal pages: the landing nav's section anchors
// (#how, #film…) only resolve on the landing page, so these pages get a
// plain header instead.
export default function LegalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link
            href="/"
            aria-label="Vollyio, home"
            className="flex min-h-11 items-center gap-2 font-display text-xl font-bold tracking-tight"
          >
            <Image src="/icon-mark.png" alt="" width={28} height={28} className="h-7 w-7" />
            Vollyio
          </Link>
          <Link
            href="/login"
            className="flex min-h-11 items-center px-3 text-sm text-chalk-dim transition-colors hover:text-chalk"
          >
            Log in
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 md:py-16">
        {children}
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-chalk-dim">
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="transition-colors hover:text-chalk">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-chalk">
              Terms
            </Link>
          </div>
          <span className="font-mono text-xs">© 2026 Vollyio</span>
        </div>
      </footer>
    </div>
  );
}
