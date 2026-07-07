"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SkillPicker } from "@/components/skill-picker";
import { Recorder } from "@/components/recorder";
import { Filmstrip } from "@/components/filmstrip";
import {
  extractFrames,
  extractFramesFromPhotos,
  type Frame,
} from "@/lib/frames";
import { SKILL_LABEL, type Skill } from "@/lib/skills";
import type { AnalyzeRequest } from "@/lib/analysis-types";

type Status = { kind: "idle" | "reading" | "sending" } | { kind: "error"; message: string };

export function AnalyzeFlow() {
  const router = useRouter();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [source, setSource] = useState<"video" | "photos">("video");
  const [duration, setDuration] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [useUpload, setUseUpload] = useState(false);
  const videoInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const busy = status.kind === "reading" || status.kind === "sending";

  async function submit(payloadFrames: Frame[], src: "video" | "photos", dur: number | null) {
    if (!skill || payloadFrames.length === 0) return;
    setStatus({ kind: "sending" });
    const body: AnalyzeRequest = {
      skill,
      source: src,
      duration_s: dur,
      frames: payloadFrames.map((f) => ({
        index: f.index,
        time_s: f.time_s,
        data: f.dataUrl.split(",")[1],
      })),
    };
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: null }));
        throw new Error(error ?? "The coaching service is unavailable. Try again.");
      }
      const { analysisId } = await res.json();
      router.push(`/analysis/${analysisId}`);
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }

  async function onRecorded(blob: Blob) {
    setStatus({ kind: "reading" });
    try {
      const { frames: f, duration_s } = await extractFrames(blob);
      setFrames(f);
      setSource("video");
      setDuration(duration_s);
      await submit(f, "video", duration_s);
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't read that clip.",
      });
    }
  }

  async function onVideoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus({ kind: "reading" });
    try {
      const { frames: f, duration_s } = await extractFrames(file);
      setFrames(f);
      setSource("video");
      setDuration(duration_s);
      setStatus({ kind: "idle" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't read that clip.",
      });
    }
  }

  async function onPhotosPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setStatus({ kind: "reading" });
    try {
      const f = await extractFramesFromPhotos(files);
      setFrames(f);
      setSource("photos");
      setDuration(null);
      setStatus({ kind: "idle" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't read those photos.",
      });
    }
  }

  return (
    <section className="max-w-xl">
      <h1 className="font-display text-2xl font-bold">Analyze</h1>

      <div className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold">
          <span className="font-mono text-xs text-gold">01</span> Pick a skill
        </h2>
        <SkillPicker value={skill} onChange={setSkill} />
      </div>

      {skill && (
        <div className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold">
            <span className="font-mono text-xs text-gold">02</span> Capture your{" "}
            {SKILL_LABEL[skill].toLowerCase()} rep
          </h2>

          {!useUpload ? (
            <Recorder onClip={onRecorded} onUnavailable={() => setUseUpload(true)} />
          ) : (
            <div className="rounded-lg border border-dashed border-gold/40 p-6 text-center">
              <button
                type="button"
                onClick={() => videoInput.current?.click()}
                className="font-display font-medium text-gold"
              >
                + Upload a clip
              </button>
              <p className="mt-1 text-xs text-chalk-dim">
                A few seconds, up to 45. Any angle you can get.
              </p>
            </div>
          )}

          <input
            ref={videoInput}
            type="file"
            accept="video/*"
            capture="environment"
            hidden
            onChange={onVideoPicked}
          />
          <input
            ref={photoInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={onPhotosPicked}
          />

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-chalk-dim">
            <button
              type="button"
              onClick={() => setUseUpload((v) => !v)}
              className="text-gold underline"
            >
              {useUpload ? "Record in-app instead" : "Upload a clip instead"}
            </button>
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              className="text-gold underline"
            >
              Use photos instead
            </button>
          </div>

          {frames.length > 0 && (
            <div className="mt-4">
              <Filmstrip frames={frames} />
              {source === "photos" || useUpload ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submit(frames, source, duration)}
                  className="mt-4 w-full rounded-lg bg-gold py-3 font-display font-bold text-navy transition hover:bg-gold-dim disabled:opacity-40"
                >
                  Break it down
                </button>
              ) : null}
            </div>
          )}

          <div className="mt-3 min-h-5 font-mono text-sm">
            {status.kind === "reading" && <span className="text-teal">Pulling key frames…</span>}
            {status.kind === "sending" && <span className="text-teal">Sending to your coach…</span>}
            {status.kind === "error" && <span className="text-coral">{status.message}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
