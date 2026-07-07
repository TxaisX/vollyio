"use client";

import { useState } from "react";

const W = 1080;
const H = 1350;

function cssFont(varName: string, fallback: string) {
  const fam = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return fam || fallback;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

export function ShareCard({
  skillLabel,
  score,
  fixTitle,
  date,
}: {
  skillLabel: string;
  score: number;
  fixTitle: string;
  date: string;
}) {
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const display = cssFont("--font-space-grotesk", "sans-serif");
      const mono = cssFont("--font-plex-mono", "monospace");

      ctx.fillStyle = "#0f212c";
      ctx.fillRect(0, 0, W, H);

      const glow = ctx.createRadialGradient(W * 0.85, 120, 0, W * 0.85, 120, 700);
      glow.addColorStop(0, "rgba(232,185,59,0.14)");
      glow.addColorStop(1, "rgba(232,185,59,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(232,185,59,0.22)";
      ctx.beginPath();
      ctx.moveTo(-60, H * 0.82);
      ctx.quadraticCurveTo(W * 0.35, H * 0.52, W + 60, H * 0.68);
      ctx.stroke();
      ctx.strokeStyle = "rgba(242,239,230,0.12)";
      ctx.beginPath();
      ctx.moveTo(-60, H * 0.9);
      ctx.quadraticCurveTo(W * 0.4, H * 0.62, W + 60, H * 0.78);
      ctx.stroke();

      ctx.fillStyle = "#f2efe6";
      ctx.font = `700 58px ${display}`;
      ctx.textBaseline = "top";
      ctx.fillText("Sideout", 72, 72);

      ctx.fillStyle = "#b9c4c9";
      ctx.font = `28px ${mono}`;
      ctx.textAlign = "right";
      ctx.fillText(date, W - 72, 92);
      ctx.textAlign = "left";

      const cx = W / 2;
      const cy = 560;
      const r = 265;
      ctx.lineWidth = 26;
      ctx.strokeStyle = "rgba(242,239,230,0.12)";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#e8b93b";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        r,
        -Math.PI / 2,
        -Math.PI / 2 + (Math.PI * 2 * Math.min(100, score)) / 100,
      );
      ctx.stroke();

      ctx.fillStyle = "#e8b93b";
      ctx.font = `700 260px ${display}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(score), cx, cy - 10);

      ctx.fillStyle = "#b9c4c9";
      ctx.font = `34px ${mono}`;
      ctx.fillText(skillLabel.toUpperCase(), cx, cy + 170);

      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#e8b93b";
      ctx.font = `26px ${mono}`;
      ctx.fillText("PRIORITY FIX", 72, 990);
      ctx.fillStyle = "#f2efe6";
      ctx.font = `700 46px ${display}`;
      wrap(ctx, fixTitle, W - 144).forEach((line, i) => {
        ctx.fillText(line, 72, 1040 + i * 62);
      });

      ctx.fillStyle = "#b9c4c9";
      ctx.font = `26px ${mono}`;
      ctx.fillText("FILM. FIX. REPEAT.", 72, H - 96);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) return;
      const file = new File(
        [blob],
        `sideout-${skillLabel.toLowerCase()}-${score}.png`,
        { type: "image/png" },
      );

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] }).catch(() => undefined);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={generate}
      disabled={busy}
      className="btn-ghost px-4 py-2 text-sm disabled:opacity-40"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden
      >
        <path d="M12 3v12M8 7l4-4 4 4M5 13v6a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6" />
      </svg>
      {busy ? "Rendering…" : "Share card"}
    </button>
  );
}
