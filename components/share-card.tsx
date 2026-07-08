"use client";

import { useState } from "react";

const W = 1080;
const H = 1350;

const CANVAS_FAIL = "Couldn't build the share card. Try again.";

function cssVar(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function cssFont(varName: string, fallback: string) {
  return cssVar(varName) || fallback;
}

function withAlpha(color: string, alpha: number) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!m) return color;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  let overflow = false;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > max && line) {
      lines.push(line);
      line = word;
      if (lines.length === 3) {
        overflow = true;
        break;
      }
    } else {
      line = test;
    }
  }
  if (!overflow) {
    if (line) lines.push(line);
    return lines;
  }
  // Three full lines with more text remaining: ellipsize the last line.
  const ell = "…";
  let last = lines[2];
  while (last && ctx.measureText(`${last}${ell}`).width > max) {
    last = last.slice(0, -1).replace(/\s+$/, "");
  }
  lines[2] = `${last}${ell}`;
  return lines;
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
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      await document.fonts?.ready;

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setError(CANVAS_FAIL);
        return;
      }

      const navy = cssVar("--color-navy");
      const gold = cssVar("--color-gold");
      const chalk = cssVar("--color-chalk");
      const chalkDim = cssVar("--color-chalk-dim");
      if (!navy || !gold || !chalk || !chalkDim) {
        setError(CANVAS_FAIL);
        return;
      }

      const display = cssFont("--font-space-grotesk", "sans-serif");
      const mono = cssFont("--font-plex-mono", "monospace");
      const shown = Math.max(0, Math.min(100, Math.round(score)));

      ctx.fillStyle = navy;
      ctx.fillRect(0, 0, W, H);

      const glow = ctx.createRadialGradient(
        W * 0.85,
        120,
        0,
        W * 0.85,
        120,
        700,
      );
      glow.addColorStop(0, withAlpha(gold, 0.14));
      glow.addColorStop(1, withAlpha(gold, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      ctx.lineWidth = 3;
      ctx.strokeStyle = withAlpha(gold, 0.22);
      ctx.beginPath();
      ctx.moveTo(-60, H * 0.82);
      ctx.quadraticCurveTo(W * 0.35, H * 0.52, W + 60, H * 0.68);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(chalk, 0.12);
      ctx.beginPath();
      ctx.moveTo(-60, H * 0.9);
      ctx.quadraticCurveTo(W * 0.4, H * 0.62, W + 60, H * 0.78);
      ctx.stroke();

      ctx.fillStyle = chalk;
      ctx.font = `700 58px ${display}`;
      ctx.textBaseline = "top";
      ctx.fillText("Sideout", 72, 72);

      ctx.fillStyle = chalkDim;
      ctx.font = `28px ${mono}`;
      ctx.textAlign = "right";
      ctx.fillText(date, W - 72, 92);
      ctx.textAlign = "left";

      const cx = W / 2;
      const cy = 560;
      const r = 265;
      ctx.lineWidth = 26;
      ctx.strokeStyle = withAlpha(chalk, 0.12);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = gold;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        r,
        -Math.PI / 2,
        -Math.PI / 2 + (Math.PI * 2 * shown) / 100,
      );
      ctx.stroke();

      ctx.fillStyle = gold;
      ctx.font = `700 260px ${display}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(shown), cx, cy - 10);

      ctx.fillStyle = chalkDim;
      ctx.font = `34px ${mono}`;
      ctx.fillText(skillLabel.toUpperCase(), cx, cy + 170);

      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = gold;
      ctx.font = `26px ${mono}`;
      ctx.fillText("PRIORITY FIX", 72, 990);
      ctx.fillStyle = chalk;
      ctx.font = `700 46px ${display}`;
      wrap(ctx, fixTitle, W - 144).forEach((line, i) => {
        ctx.fillText(line, 72, 1040 + i * 62);
      });

      ctx.fillStyle = chalkDim;
      ctx.font = `26px ${mono}`;
      ctx.fillText("FILM. FIX. REPEAT.", 72, H - 96);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) {
        setError(CANVAS_FAIL);
        return;
      }
      const file = new File(
        [blob],
        `sideout-${skillLabel.toLowerCase()}-${shown}.png`,
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
    } catch {
      setError(CANVAS_FAIL);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="btn-ghost min-h-11 px-4 py-2 text-sm disabled:opacity-40"
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
      <span role="status" aria-live="polite" className="text-xs text-coral">
        {error}
      </span>
    </div>
  );
}
