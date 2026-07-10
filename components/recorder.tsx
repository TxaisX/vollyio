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
  const [live, setLive] = useState("");

  const enableBtnRef = useRef<HTMLButtonElement>(null);
  const startBtnRef = useRef<HTMLButtonElement>(null);
  const stopBtnRef = useRef<HTMLButtonElement>(null);
  const elapsedRef = useRef(0);
  const warned10Ref = useRef(false);
  const warned5Ref = useRef(false);
  const autoStoppedRef = useRef(false);
  const prevPhaseRef = useRef<Phase | null>(null);

  useEffect(() => {
    return () => stopStream();
  }, []);

  // Move focus to the control revealed by each phase transition. The initial
  // mount (prev === null) and no-op re-renders are skipped so nothing is stolen.
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (prev === null || prev === phase) return;
    if (phase === "ready") startBtnRef.current?.focus();
    else if (phase === "recording") stopBtnRef.current?.focus();
    else if (phase === "idle") enableBtnRef.current?.focus();
  }, [phase]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function enable() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setLive("Your camera could not start. Upload a clip instead.");
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
      setLive("Camera ready. Press Start to record.");
    } catch {
      setLive("Your camera could not start. Upload a clip instead.");
      onUnavailable();
    }
  }

  function start() {
    const stream = streamRef.current;
    if (!stream) return;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      setLive("Your camera could not start. Upload a clip instead.");
      onUnavailable();
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      stopStream();
      setLive(
        autoStoppedRef.current
          ? "Recording stopped at the 45 second limit. Analyzing your rep."
          : "Recording stopped. Analyzing your rep.",
      );
      setPhase("idle");
      onClip(blob);
    };

    try {
      recorder.start();
    } catch {
      setLive("Your camera could not start. Upload a clip instead.");
      onUnavailable();
      return;
    }

    recorderRef.current = recorder;
    elapsedRef.current = 0;
    warned10Ref.current = false;
    warned5Ref.current = false;
    autoStoppedRef.current = false;
    setElapsed(0);
    setPhase("recording");
    setLive("Recording started. 45 seconds max.");
  }

  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => {
      const next = Math.round((elapsedRef.current + 0.1) * 10) / 10;
      elapsedRef.current = next;
      setElapsed(next);
      if (!warned10Ref.current && next >= MAX_CLIP_SECONDS - 10) {
        warned10Ref.current = true;
        setLive("10 seconds left.");
      }
      if (!warned5Ref.current && next >= MAX_CLIP_SECONDS - 5) {
        warned5Ref.current = true;
        setLive("5 seconds left.");
      }
      if (next >= MAX_CLIP_SECONDS) {
        autoStoppedRef.current = true;
        stop();
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function stop() {
    recorderRef.current?.state === "recording" && recorderRef.current.stop();
  }

  return (
    <div className="card p-4">
      <p role="status" aria-live="polite" className="sr-only">
        {live}
      </p>
      {phase === "idle" ? (
        <button
          ref={enableBtnRef}
          type="button"
          onClick={enable}
          className="btn-primary animate-fade-up min-h-11 w-full"
        >
          Record a rep
        </button>
      ) : (
        <div className="animate-fade-up flex flex-col gap-3">
          <div className="relative overflow-hidden rounded-lg bg-navy">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              muted
              playsInline
              aria-label="Camera preview"
              className="block aspect-video w-full object-cover"
            />
            {phase === "recording" && (
              <span
                aria-hidden
                className="absolute right-2 top-2 flex items-center gap-1.5 rounded bg-navy/85 px-2 py-1 font-mono text-xs text-coral"
              >
                <span className="h-2 w-2 animate-pulse-dot rounded-full bg-coral" />
                {elapsed.toFixed(1)}s / {MAX_CLIP_SECONDS}s
              </span>
            )}
          </div>
          {phase === "ready" ? (
            <button
              ref={startBtnRef}
              type="button"
              onClick={start}
              className="btn-primary min-h-11 w-full"
            >
              Start
            </button>
          ) : (
            <button
              ref={stopBtnRef}
              type="button"
              onClick={stop}
              className="btn-destructive min-h-11 w-full"
            >
              Stop and analyze
            </button>
          )}
        </div>
      )}
    </div>
  );
}
