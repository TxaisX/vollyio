import Link from "next/link";

export default function LearnSkillNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="card w-full max-w-sm p-8">
        <h1 className="font-display text-2xl font-bold">Skill not found.</h1>
        <p className="mt-3 text-body text-chalk-dim">
          There&apos;s no skill at this link. Browse the six skills instead.
        </p>
        <Link href="/learn" className="btn-primary mt-6 w-full">
          All skills
        </Link>
      </div>
    </div>
  );
}
