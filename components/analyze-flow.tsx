"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SkillPicker } from "@/components/skill-picker";
import { Recorder } from "@/components/recorder";
import { Filmstrip } from "@/components/filmstrip";
import { createClient } from "@/lib/supabase/client";
import {
  extractFrames,
  extractFramesFromPhotos,
  type Frame,
  type FrameDebug,
} from "@/lib/frames";
import {
  SKILL_LABEL,
  DISCIPLINES,
  DISCIPLINE_LABEL,
  type Skill,
  type Discipline,
} from "@/lib/skills";
import type { AnalyzeRequest } from "@/lib/analysis-types";

type Status = { kind: "idle" | "reading" | "sending" } | { kind: "error"; message: string };

function clipExt(b: Blob): string {
  const type = (b.type || "").toLowerCase();
  if (type.includes("mp4")) return "mp4";
  if (type.includes("quicktime") || type.includes("mov")) return "mov";
  if (type.includes("webm")) return "webm";
  const name = (b as File).name ?? "";
  const m = name.toLowerCase().match(/\.([a-z0-9]{2,4})$/);
  return m ? m[1] : "webm";
}

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

const KIND_FILL: Record<string, string> = {
  peak: "var(--color-gold)",
  burst: "var(--color-chalk)",
  context: "var(--color-chalk-dim)",
};

function FrameDebugPanel({ debug }: { debug: FrameDebug }) {
  const span = debug.curve.length
    ? debug.curve[debug.curve.length - 1].t || 1
    : 1;
  const maxScore = Math.max(1, ...debug.curve.map((c) => c.score));
  return (
    <div className="card mt-4 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
        Frame debug
      </p>
      <p className="mt-1 font-mono text-[11px] text-chalk-dim">
        {debug.fellBack ? "uniform fallback" : "motion-guided"} · scan {debug.scanMs}ms ·{" "}
        {Math.round(debug.totalBytes / 1024)} KB · {debug.chosen.length} frames
      </p>
      {debug.curve.length > 0 && (
        <svg
          viewBox="0 0 100 26"
          preserveAspectRatio="none"
          className="mt-3 h-14 w-full"
          aria-hidden
        >
          {debug.curve.map((c, i) => {
            const h = (c.score / maxScore) * 22;
            return (
              <rect
                key={i}
                x={(c.t / span) * 100}
                y={24 - h}
                width={1.2}
                height={h}
                style={{ fill: "var(--color-teal)" }}
              />
            );
          })}
          {debug.chosen.map((c, i) => (
            <circle
              key={`c${i}`}
              cx={(c.t / span) * 100}
              cy={2.5}
              r={1.2}
              style={{ fill: KIND_FILL[c.kind] }}
            />
          ))}
        </svg>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {debug.chosen.map((c, i) => (
          <span
            key={i}
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
              c.kind === "peak"
                ? "bg-gold text-navy"
                : c.kind === "burst"
                  ? "border border-line text-chalk"
                  : "text-chalk-dim"
            }`}
          >
            {c.t.toFixed(1)}s
          </span>
        ))}
      </div>
    </div>
  );
}

export function AnalyzeFlow() {
  const router = useRouter();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [source, setSource] = useState<"video" | "photos">("video");
  const [duration, setDuration] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [useUpload, setUseUpload] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [discipline, setDiscipline] = useState<Discipline>("indoor");
  const [frameDebug, setFrameDebug] = useState<FrameDebug | null>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const debugRef = useRef(false);
  const clipRef = useRef<Blob | null>(null);
  const stepTwoRef = useRef<HTMLHeadingElement>(null);
  const prevSkillRef = useRef<Skill | null>(skill);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("debug")
    ) {
      debugRef.current = true;
    }
  }, []);

  const busy = status.kind === "reading" || status.kind === "sending";
  const canSubmit = frames.length > 0 && (source === "photos" || useUpload);

  // Release the preview object URL when it is replaced or on unmount.
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // Move focus into the revealed step-02 block the first time a skill is picked
  // (null -> a value); re-picks leave focus where it is so roving arrow-key
  // navigation in the skill radiogroup is not disrupted.
  useEffect(() => {
    const had = prevSkillRef.current;
    prevSkillRef.current = skill;
    if (!had && skill) stepTwoRef.current?.focus();
  }, [skill]);

  async function submit(
    payloadFrames: Frame[],
    src: "video" | "photos",
    dur: number | null,
    isRetry = false,
  ) {
    if (!skill || payloadFrames.length === 0) return;
    setRetrying(isRetry);
    setStatus({ kind: "sending" });
    const clip = src === "video" ? clipRef.current : null;
    const body: AnalyzeRequest = {
      skill,
      discipline,
      source: src,
      duration_s: dur,
      has_clip: !!clip,
      clip_ext: clip ? clipExt(clip) : null,
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
      const { analysisId, clipPath, xpAwarded } = await res.json();
      if (clip && clipPath) {
        try {
          await createClient()
            .storage.from("clips")
            .upload(clipPath, clip, {
              contentType: (clip.type || "video/webm").split(";")[0],
              upsert: true,
            });
        } catch {
          // Non-fatal: the results page falls back to the frame player.
        }
      }
      router.push(
        `/analysis/${analysisId}${xpAwarded ? `?xp=${xpAwarded}` : ""}`,
      );
    } catch (err) {
      setRetrying(false);
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }

  async function onRecorded(blob: Blob) {
    setStatus({ kind: "reading" });
    setVideoUrl(null);
    clipRef.current = blob;
    try {
      const { frames: f, duration_s, debug } = await extractFrames(blob, {
        debug: debugRef.current,
      });
      setFrames(f);
      setSource("video");
      setDuration(duration_s);
      if (debug) {
        // Debug mode: inspect the selected frames instead of spending an API call.
        setFrameDebug(debug);
        setStatus({ kind: "idle" });
        return;
      }
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
        setVideoUrl(null);
        clipRef.current = null;
      } else {
        const { frames: f, duration_s, debug } = await extractFrames(file, {
          debug: debugRef.current,
        });
        setFrames(f);
        setSource("video");
        setDuration(duration_s);
        setFrameDebug(debug ?? null);
        setVideoUrl(URL.createObjectURL(file));
        clipRef.current = file;
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
      setVideoUrl(null);
      clipRef.current = null;
      setStatus({ kind: "idle" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't read those photos.",
      });
    }
  }

  function downloadEvalCase() {
    if (!skill || frames.length === 0) return;
    const payload = {
      id: `${skill}-${discipline}-${Date.now()}`,
      skill,
      discipline,
      frames: frames.map((f) => ({ time_s: f.time_s, data: f.dataUrl.split(",")[1] })),
      expected: {
        overall_min: 0,
        overall_max: 100,
        weakest_metric: "",
        notes: "TODO: label this rep — expected score band + weakest metric.",
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${payload.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="max-w-xl lg:max-w-none">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
        Analyze
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
        Film the rep.
      </h1>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-chalk-dim">
          Discipline
        </span>
        {DISCIPLINES.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDiscipline(d)}
            aria-pressed={discipline === d}
            className={`chip ${discipline === d ? "chip-active" : ""}`}
          >
            {DISCIPLINE_LABEL[d]}
          </button>
        ))}
      </div>

      <div
        className={
          skill
            ? "mt-8 lg:grid lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:items-start lg:gap-10"
            : "mt-8 max-w-xl"
        }
      >
        {/* Controls */}
        <div className="min-w-0">
          <div>
            <h2
              id="pick-a-skill"
              className="mb-3 flex items-center gap-2 font-display text-sm font-bold"
            >
              <span className="font-mono text-xs text-gold">01</span> Pick a skill
            </h2>
            <SkillPicker value={skill} onChange={setSkill} labelledBy="pick-a-skill" />
          </div>

          {skill && (
            <div className="mt-8 animate-fade-up">
              <h2
                ref={stepTwoRef}
                tabIndex={-1}
                className="mb-3 flex items-center gap-2 font-display text-sm font-bold"
              >
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
                  className="chip min-h-11"
                >
                  {useUpload ? "Record in-app instead" : "Upload a clip instead"}
                </button>
                <button
                  type="button"
                  onClick={() => photoInput.current?.click()}
                  disabled={busy}
                  className="chip min-h-11"
                >
                  Use photos instead
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        {skill && (
          <div className="mt-8 min-w-0 lg:sticky lg:top-8 lg:mt-0">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-gold">
              Preview
            </p>

            {videoUrl && (
              <div className="mb-3 overflow-hidden rounded-lg bg-navy">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  src={videoUrl}
                  aria-label="Clip preview"
                  controls
                  playsInline
                  preload="metadata"
                  className="block max-h-[60vh] w-full"
                />
              </div>
            )}

            {frames.length > 0 ? (
              <Filmstrip frames={frames} variant="grid" />
            ) : (
              <div className="card border-dashed border-line p-10 text-center text-xs text-chalk-dim">
                {busy
                  ? "Reading your rep…"
                  : "Your captured rep shows up here, frame by frame."}
              </div>
            )}

            {frameDebug && (
              <>
                <FrameDebugPanel debug={frameDebug} />
                <button
                  type="button"
                  onClick={downloadEvalCase}
                  className="btn-ghost mt-3 text-xs"
                >
                  Download eval case
                </button>
              </>
            )}

            {canSubmit && (
              <button
                type="button"
                aria-busy={busy}
                disabled={busy}
                onClick={() => submit(frames, source, duration)}
                className="btn-primary mt-4 w-full disabled:opacity-40"
              >
                {busy ? (
                  <>
                    <WorkingDots /> Break it down
                  </>
                ) : (
                  "Break it down"
                )}
              </button>
            )}

            <div className="mt-4 min-h-6 font-mono text-sm" aria-live="polite">
              {status.kind === "reading" && (
                <span className="flex items-center gap-2.5 text-teal">
                  <WorkingDots /> Pulling key frames…
                </span>
              )}
              {status.kind === "sending" && !retrying && (
                <span className="flex items-center gap-2.5 text-teal">
                  <WorkingDots /> Scoring your rep, frame by frame…
                </span>
              )}
              {status.kind === "error" && (
                <p className="animate-fade-up text-coral">{status.message}</p>
              )}
              {frames.length > 0 && (status.kind === "error" || retrying) && (
                <button
                  type="button"
                  aria-busy={retrying}
                  disabled={busy}
                  onClick={() => submit(frames, source, duration, true)}
                  className="btn-ghost mt-3 flex min-h-11 items-center gap-2 px-4 py-2 text-sm disabled:opacity-40"
                >
                  {retrying ? (
                    <>
                      <WorkingDots /> Scoring your rep, frame by frame…
                    </>
                  ) : (
                    "Send it again"
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
