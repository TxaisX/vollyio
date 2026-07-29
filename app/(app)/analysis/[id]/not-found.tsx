import Link from "next/link";

export default function AnalysisNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="card w-full max-w-sm p-8">
        <h1 className="font-display text-2xl font-bold">Breakdown not found.</h1>
        <p className="mt-3 text-body text-chalk-dim">
          This breakdown doesn&apos;t exist or isn&apos;t yours. It may have been
          deleted.
        </p>
        <Link href="/history" className="btn-primary mt-6 w-full">
          Back to your history
        </Link>
      </div>
    </div>
  );
}
