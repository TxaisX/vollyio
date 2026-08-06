"use client";

import { useEffect, useRef, useState } from "react";
import { canTrimVideo, trimClip, clipToBase64 } from "@/lib/video-clip";
import { MAX_CLIP_SECONDS } from "@/lib/frames";
import { SKILLS, SKILL_LABEL, ANALYZE_DISCIPLINES, DISCIPLINE_LABEL } from "@/lib/skills";
import type { Skill, Discipline } from "@/lib/skills";
import type { SimpleRating } from "@/lib/ai/simple-rubric";

type Result = {
  rating: SimpleRating | null;
  parsed_ok: boolean;
  usage: { input_tokens: number; output_tokens: number };
  cost_usd: number | null;
  ms: number;
  clip_bytes: number;
};

type Stage = "idle" | "trimming" | "sending" | "done" | "error";

export function VideoLab({ token }: { token: string }) {
  const [skill, setSkill] = useState<Skill>("set");
  const [discipline, setDiscipline] = useState<Discipline>("grass");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [startS, setStartS] = useState(0);
  const [spanS, setSpanS] = useState(4);
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState("");
  const [trimMs, setTrimMs] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => setSupported(canTrimVideo()), []);
  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const endS = Math.min(duration || spanS, startS + spanS);

  async function run() {
    if (!file) return;
    setResult(null);
    setMessage("");
    try {
      setStage("trimming");
      const t0 = performance.now();
      const clip = await trimClip(file, { startS, endS });
      setTrimMs(Math.round(performance.now() - t0));

      setStage("sending");
      const res = await fetch("/api/video-lab", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          skill,
          discipline,
          clip_b64: await clipToBase64(clip.blob),
          mime: clip.mime,
          duration_s: Number(clip.duration_s.toFixed(2)),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setStage("error");
        setMessage(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setResult(body);
      setStage("done");
    } catch (e) {
      setStage("error");
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }

  const busy = stage === "trimming" || stage === "sending";
  const rating = result?.rating;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-3xl text-chalk">Video lab</h1>
      <p className="mt-2 text-sm text-chalk-dim">
        Trims in the browser, sends the real bytes, returns the simplified rubric. Dev
        only. Spends gateway credit on every run.
      </p>

      {supported === false && (
        <p className="card mt-6 border-coral/40 text-coral">
          This browser has no MediaRecorder or canvas capture, so it cannot trim. Try
          Chrome or Safari.
        </p>
      )}

      <section className="card mt-6 space-y-5">
        <div>
          <label className="font-mono text-xs uppercase tracking-wide text-chalk-dim">
            Clip
          </label>
          <input
            type="file"
            accept="video/*"
            className="input-field mt-2 block w-full"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setResult(null);
              setStage("idle");
            }}
          />
        </div>

        {url && (
          <video
            ref={videoRef}
            src={url}
            controls
            muted
            playsInline
            className="w-full rounded-lg bg-navy-light"
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              setDuration(d);
              setSpanS(Math.min(MAX_CLIP_SECONDS, Math.max(1, Math.min(4, d))));
              setStartS(0);
            }}
          />
        )}

        <div>
          <label className="font-mono text-xs uppercase tracking-wide text-chalk-dim">
            Skill
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {SKILLS.map((s) => (
              <button
                key={s}
                type="button"
                className={s === skill ? "chip chip-active" : "chip"}
                onClick={() => setSkill(s)}
              >
                {SKILL_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="font-mono text-xs uppercase tracking-wide text-chalk-dim">
            Surface
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {ANALYZE_DISCIPLINES.map((d) => (
              <button
                key={d}
                type="button"
                className={d === discipline ? "chip chip-active" : "chip"}
                onClick={() => setDiscipline(d)}
              >
                {DISCIPLINE_LABEL[d]}
              </button>
            ))}
          </div>
        </div>

        {duration > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="font-mono text-xs uppercase tracking-wide text-chalk-dim">
                Start {startS.toFixed(1)}s
              </label>
              <input
                type="range"
                min={0}
                max={Math.max(0, duration - 1)}
                step={0.1}
                value={startS}
                className="mt-2 w-full"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setStartS(v);
                  if (videoRef.current) videoRef.current.currentTime = v;
                }}
              />
            </div>
            <div>
              <label className="font-mono text-xs uppercase tracking-wide text-chalk-dim">
                Length {spanS.toFixed(1)}s
              </label>
              <input
                type="range"
                min={1}
                max={MAX_CLIP_SECONDS}
                step={0.1}
                value={spanS}
                className="mt-2 w-full"
                onChange={(e) => setSpanS(Number(e.target.value))}
              />
            </div>
          </div>
        )}

        <button
          type="button"
          className="btn-primary w-full"
          disabled={!file || busy || supported === false}
          onClick={run}
        >
          {stage === "trimming"
            ? `Trimming ${(endS - startS).toFixed(1)}s in real time...`
            : stage === "sending"
              ? "Reading the clip..."
              : "Trim and analyze"}
        </button>
        {duration > 0 && (
          <p className="text-center font-mono text-xs text-chalk-dim">
            window {startS.toFixed(1)}s to {endS.toFixed(1)}s of {duration.toFixed(1)}s
          </p>
        )}
      </section>

      {stage === "error" && (
        <p className="card mt-6 border-coral/40 text-sm text-coral">{message}</p>
      )}

      {result && (
        <section className="mt-6 space-y-4">
          <div className="card grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Clip" value={`${(result.clip_bytes / 1e6).toFixed(2)} MB`} />
            <Stat label="Trim" value={`${(trimMs / 1000).toFixed(1)}s`} />
            <Stat label="Read" value={`${(result.ms / 1000).toFixed(1)}s`} />
            <Stat
              label="Cost"
              value={result.cost_usd != null ? `$${result.cost_usd.toFixed(4)}` : "n/a"}
            />
          </div>

          {!result.parsed_ok && (
            <p className="card border-coral/40 text-sm text-coral">
              The reply did not match the schema.
            </p>
          )}

          {rating && rating.ratable === false && (
            <div className="card border-gold/40">
              <p className="font-mono text-xs uppercase tracking-wide text-gold">
                Refused to rate
              </p>
              <p className="mt-2 text-chalk">{rating.not_ratable_reason}</p>
            </div>
          )}

          {rating && rating.ratable !== false && (
            <>
              <div className="card flex items-center gap-5">
                <div className="font-display text-5xl text-gold">
                  {rating.overall_score}
                </div>
                <div>
                  <p className="font-mono text-xs uppercase tracking-wide text-chalk-dim">
                    out of 100 &middot; {rating.confidence} confidence
                  </p>
                  <p className="mt-1 text-chalk">{rating.summary}</p>
                </div>
              </div>

              <Points
                title="Strengths"
                tone="text-teal"
                items={rating.strengths ?? []}
              />
              <Points
                title="Areas to improve"
                tone="text-gold"
                items={rating.improvements ?? []}
              />
            </>
          )}

          <details className="card">
            <summary className="cursor-pointer font-mono text-xs uppercase tracking-wide text-chalk-dim">
              Raw response
            </summary>
            <pre className="mt-3 overflow-x-auto font-mono text-xs text-chalk-dim">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-wide text-chalk-dim">{label}</p>
      <p className="mt-1 font-display text-xl text-chalk">{value}</p>
    </div>
  );
}

function Points({
  title,
  tone,
  items,
}: {
  title: string;
  tone: string;
  items: { title: string; detail: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="card">
      <p className={`font-mono text-xs uppercase tracking-wide ${tone}`}>{title}</p>
      <ul className="mt-3 space-y-3">
        {items.map((it, i) => (
          <li key={i}>
            <p className="text-chalk">{it.title}</p>
            <p className="mt-0.5 text-sm text-chalk-dim">{it.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
