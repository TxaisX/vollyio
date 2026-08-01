import Link from "next/link";

export const metadata = {
  title: "Page not found",
};

// The root 404, for any path no route claims. Until this existed, an unknown
// URL rendered the framework's default "404: This page could not be found."
// inside the branded shell, which is the one page in the product that named
// its framework instead of its product. Guests and players both land here, so
// it offers the public library alongside home rather than an app surface that
// would bounce a guest to login.
export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between border-b border-line pb-5">
        <Link
          href="/"
          className="font-display text-lg font-bold tracking-wide text-gold"
        >
          Vollyio
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
          404
        </span>
      </div>

      <div className="card mt-10 p-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          There&apos;s no page here.
        </h1>
        <p className="mt-2 max-w-md text-body text-chalk-dim">
          The address may be mistyped, or the page moved. Everything worth
          finding is a click away.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/" className="btn-primary inline-block min-h-11 px-5 py-2.5 text-sm">
            Home
          </Link>
          <Link href="/learn" className="btn-ghost inline-block min-h-11 px-5 py-2.5 text-sm">
            Learn the skills
          </Link>
        </div>
      </div>
    </main>
  );
}
