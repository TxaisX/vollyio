"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_CLIP_SECONDS } from "@/lib/frames";

type Phase = "idle" | "ready" | "recording";

export function Recorder({
  onClip,
  onUnavailable,
}: {
  onClip: (blob: Blob) => void;
  onUnavailable: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    return () => stopStream();
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function enable() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      onUnavailable();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setPhase("ready");
    } catch {
      onUnavailable();
    }
  }

  function start() {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      stopStream();
      setPhase("idle");
      onClip(blob);
    };
    recorder.start();
    recorderRef.current = recorder;
    setPhase("recording");
    setElapsed(0);
  }

  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => {
      setElapsed((e) => {
        const next = e + 0.1;
        if (next >= MAX_CLIP_SECONDS) stop();
        return next;
      });
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function stop() {
    recorderRef.current?.state === "recording" && recorderRef.current.stop();
  }

  return (
    <div className="card p-4">
      {phase === "idle" ? (
        <button type="button" onClick={enable} className="btn-primary w-full">
          Record a rep
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="relative overflow-hidden rounded-lg bg-navy">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} muted playsInline className="w-full" />
            {phase === "recording" && (
              <span className="absolute right-2 top-2 flex items-center gap-1.5 rounded bg-navy/85 px-2 py-1 font-mono text-xs text-coral">
                <span className="h-2 w-2 animate-pulse-dot rounded-full bg-coral" />
                {elapsed.toFixed(1)}s / {MAX_CLIP_SECONDS}s
              </span>
            )}
          </div>
          {phase === "ready" ? (
            <button type="button" onClick={start} className="btn-primary w-full">
              Start
            </button>
          ) : (
            <button
              type="button"
              onClick={stop}
              className="w-full rounded-control bg-coral py-3 font-display font-bold text-navy transition hover:brightness-110"
            >
              Stop &amp; analyze
            </button>
          )}
        </div>
      )}
    </div>
  );
}
