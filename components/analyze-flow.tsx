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

function WorkingDots() {
  return (
    <span className="inline-flex gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-teal"
          style={{ animationDelay: `${i * 200}ms` }}
        />
      ))}
    </span>
  );
}

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
      const { analysisId, xpAwarded } = await res.json();
      router.push(
        `/analysis/${analysisId}${xpAwarded ? `?xp=${xpAwarded}` : ""}`,
      );
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
    e.target.value = "";
    if (!file) return;
    setStatus({ kind: "reading" });
    try {
      // The gallery picker can return a still image as well as a video —
      // handle whichever the player chose.
      if (file.type.startsWith("image/")) {
        const f = await extractFramesFromPhotos([file]);
        setFrames(f);
        setSource("photos");
        setDuration(null);
      } else {
        const { frames: f, duration_s } = await extractFrames(file);
        setFrames(f);
        setSource("video");
        setDuration(duration_s);
      }
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
    e.target.value = "";
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
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
        Analyze
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
        Film the rep.
      </h1>

      <div className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold">
          <span className="font-mono text-xs text-gold">01</span> Pick a skill
        </h2>
        <SkillPicker value={skill} onChange={setSkill} />
      </div>

      {skill && (
        <div className="mt-8 animate-fade-up">
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold">
            <span className="font-mono text-xs text-gold">02</span> Capture your{" "}
            {SKILL_LABEL[skill].toLowerCase()} rep
          </h2>

          {!useUpload ? (
            <Recorder onClip={onRecorded} onUnavailable={() => setUseUpload(true)} />
          ) : (
            <div className="card border-dashed border-gold/40 p-8 text-center">
              <button
                type="button"
                onClick={() => videoInput.current?.click()}
                disabled={busy}
                className="btn-ghost mx-auto text-sm"
              >
                Upload a clip
              </button>
              <p className="mt-3 text-xs text-chalk-dim">
                A few seconds, up to 45. Any angle you can get.
              </p>
            </div>
          )}

          <input
            ref={videoInput}
            type="file"
            // Lead with image/* so Android opens the media gallery picker
            // rather than treating video/* as a capture intent and jumping
            // straight to the camera. onVideoPicked handles either type.
            accept="image/*,video/*"
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

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (useUpload) {
                  setUseUpload(false);
                } else {
                  // Skip the recorder — open the file picker straight away.
                  setUseUpload(true);
                  videoInput.current?.click();
                }
              }}
              disabled={busy}
              className="chip"
            >
              {useUpload ? "Record in-app instead" : "Upload a clip instead"}
            </button>
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              disabled={busy}
              className="chip"
            >
              Use photos instead
            </button>
          </div>

          {frames.length > 0 && (
            <div className="mt-5 animate-fade-up">
              <Filmstrip frames={frames} />
              {(source === "photos" || useUpload) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submit(frames, source, duration)}
                  className="btn-primary mt-4 w-full disabled:opacity-40"
                >
                  Break it down
                </button>
              )}
            </div>
          )}

          <div className="mt-4 min-h-6 font-mono text-sm" aria-live="polite">
            {status.kind === "reading" && (
              <span className="flex items-center gap-2.5 text-teal">
                <WorkingDots /> Pulling key frames…
              </span>
            )}
            {status.kind === "sending" && (
              <span className="flex items-center gap-2.5 text-teal">
                <WorkingDots /> Scoring your rep, frame by frame…
              </span>
            )}
            {status.kind === "error" && (
              <div className="animate-fade-up">
                <span className="text-coral">{status.message}</span>
                {frames.length > 0 && (
                  <button
                    type="button"
                    onClick={() => submit(frames, source, duration)}
                    className="btn-ghost mt-3 block px-4 py-2 text-sm"
                  >
                    Send it again
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
