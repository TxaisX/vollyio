import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

export default function Offline() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-display text-2xl font-bold">You're offline</h1>
      <p className="max-w-sm text-sm text-chalk-dim">
        Sideout needs a connection to analyze reps. Your saved analyses will be
        here when you're back online.
      </p>
    </main>
  );
}
