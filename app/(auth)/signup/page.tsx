import Link from "next/link";
import { signup } from "../actions";

export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-xl border border-line bg-navy-light p-6">
        <h1 className="font-display text-xl font-bold">Create account</h1>
        {error && <p className="mt-3 text-sm text-coral">{error}</p>}
        <form action={signup} className="mt-5 flex flex-col gap-3">
          <input
            name="display_name"
            type="text"
            placeholder="Name"
            className="rounded-lg border border-line bg-navy px-4 py-3 text-sm placeholder:text-chalk-dim focus:border-gold focus:outline-none"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="rounded-lg border border-line bg-navy px-4 py-3 text-sm placeholder:text-chalk-dim focus:border-gold focus:outline-none"
          />
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Password (8+ characters)"
            className="rounded-lg border border-line bg-navy px-4 py-3 text-sm placeholder:text-chalk-dim focus:border-gold focus:outline-none"
          />
          <button
            type="submit"
            className="mt-2 rounded-lg bg-gold px-4 py-3 font-display font-bold text-navy transition hover:bg-gold-dim"
          >
            Get started
          </button>
        </form>
        <p className="mt-4 text-sm text-chalk-dim">
          Already have an account?{" "}
          <Link href="/login" className="text-gold underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
