import { notFound } from "next/navigation";
import { VideoLab } from "@/components/video-lab";

/**
 * Dev-only bench for the video analysis path. Not linked from anywhere.
 *
 * `notFound()` before anything renders is the gate: in production this route
 * does not exist, so the bearer token handed to the client below can never
 * reach a production bundle. It is handed over at all because /api/video-lab
 * shares /api/eval's gate, and a browser cannot set a header it was not given.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Video lab",
  robots: { index: false, follow: false },
};

export default function VideoLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const token = process.env.EVAL_TOKEN;
  if (!token) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-2xl text-chalk">Video lab</h1>
        <p className="mt-4 text-chalk-dim">
          Set <code className="font-mono text-gold">EVAL_TOKEN</code> in the dev server
          environment and reload. It is deliberately not in{" "}
          <code className="font-mono">.env.local</code>.
        </p>
      </main>
    );
  }
  return <VideoLab token={token} />;
}
