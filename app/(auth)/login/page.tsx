import Link from "next/link";
import { login } from "../actions";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-xl border border-line bg-navy-light p-6">
        <h1 className="font-display text-xl font-bold">Log in</h1>
        {message && <p className="mt-3 text-sm text-teal">{message}</p>}
        {error && <p className="mt-3 text-sm text-coral">{error}</p>}
        <form action={login} className="mt-5 flex flex-col gap-3">
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
            placeholder="Password"
            className="rounded-lg border border-line bg-navy px-4 py-3 text-sm placeholder:text-chalk-dim focus:border-gold focus:outline-none"
          />
          <button
            type="submit"
            className="mt-2 rounded-lg bg-gold px-4 py-3 font-display font-bold text-navy transition hover:bg-gold-dim"
          >
            Log in
          </button>
        </form>
        <p className="mt-4 text-sm text-chalk-dim">
          New here?{" "}
          <Link href="/signup" className="text-gold underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
