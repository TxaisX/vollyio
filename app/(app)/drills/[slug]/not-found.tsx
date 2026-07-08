import Link from "next/link";

export default function DrillNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="card w-full max-w-sm p-8">
        <h1 className="font-display text-2xl font-bold">Drill not found.</h1>
        <p className="mt-3 text-sm text-chalk-dim">
          There&apos;s no drill at this link. Browse the full library
          instead.
        </p>
        <Link href="/drills" className="btn-primary mt-6 w-full">
          All drills
        </Link>
      </div>
    </div>
  );
}
