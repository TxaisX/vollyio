"use client";

import { useState } from "react";
import { metricLabel } from "@/lib/ai/metrics";
import { drillBySlug } from "@/content/drills";
import type { AnalysisResult } from "@/lib/analysis-types";
import type { Skill } from "@/lib/skills";

const W = 1080;
const PAD = 72;
const CW = W - PAD * 2;
const CANVAS_FAIL = "Couldn't build the share image. Try again.";

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function cssFont(varName: string, fallback: string) {
  return cssVar(varName) || fallback;
}
function withAlpha(color: string, alpha: number) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!m) return color;
  const [r, g, b] = [1, 2, 3].map((i) => parseInt(m[i], 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
// Wrap to as many lines as needed (unlike the old summary card's 3-line cap).
function wrapAll(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > max && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

// Renders the ENTIRE analysis to a tall image (summary, every metric with score +
// bar + note, the fixes, and the drills), not just the score/priority-fix card, so
// a shared file carries the whole breakdown.
export function ShareCard({
  skill,
  skillLabel,
  score,
  date,
  result,
}: {
  skill: Skill;
  skillLabel: string;
  score: number;
  date: string;
  result: AnalysisResult;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      await document.fonts?.ready;
      const big = document.createElement("canvas");
      big.width = W;
      big.height = 7000; // generous; cropped to the real height below
      const ctx = big.getContext("2d");
      if (!ctx) return void setError(CANVAS_FAIL);

      const navy = cssVar("--color-navy");
      const gold = cssVar("--color-gold");
      const chalk = cssVar("--color-chalk");
      const chalkDim = cssVar("--color-chalk-dim");
      const teal = cssVar("--color-teal");
      if (!navy || !gold || !chalk || !chalkDim) return void setError(CANVAS_FAIL);
      const display = cssFont("--font-space-grotesk", "sans-serif");
      const sans = cssFont("--font-instrument", "system-ui");
      const mono = cssFont("--font-plex-mono", "monospace");
      const shown = Math.max(0, Math.min(100, Math.round(score)));

      ctx.fillStyle = navy;
      ctx.fillRect(0, 0, W, big.height);
      const glow = ctx.createRadialGradient(W * 0.85, 100, 0, W * 0.85, 100, 640);
      glow.addColorStop(0, withAlpha(gold, 0.13));
      glow.addColorStop(1, withAlpha(gold, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, 700);

      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      let y = PAD;

      const para = (text: string, size: number, color: string, font = sans, lh = 1.4) => {
        ctx.fillStyle = color;
        ctx.font = `${size}px ${font}`;
        for (const line of wrapAll(ctx, text, CW)) {
          ctx.fillText(line, PAD, y);
          y += size * lh;
        }
      };
      const heading = (text: string) => {
        ctx.fillStyle = gold;
        ctx.font = `28px ${mono}`;
        ctx.fillText(text.toUpperCase(), PAD, y);
        y += 52;
      };
      const rule = () => {
        ctx.strokeStyle = withAlpha(chalk, 0.14);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(PAD, y);
        ctx.lineTo(W - PAD, y);
        ctx.stroke();
        y += 40;
      };

      // Header
      ctx.fillStyle = chalk;
      ctx.font = `700 52px ${display}`;
      ctx.fillText("Sideout", PAD, y);
      ctx.fillStyle = chalkDim;
      ctx.font = `26px ${mono}`;
      ctx.textAlign = "right";
      ctx.fillText(date, W - PAD, y + 14);
      ctx.textAlign = "left";
      y += 96;

      // Score + skill
      ctx.fillStyle = gold;
      ctx.font = `30px ${mono}`;
      ctx.fillText(skillLabel.toUpperCase(), PAD, y);
      y += 46;
      ctx.fillStyle = gold;
      ctx.font = `700 132px ${display}`;
      ctx.fillText(String(shown), PAD, y);
      const sw = ctx.measureText(String(shown)).width;
      ctx.fillStyle = chalkDim;
      ctx.font = `40px ${mono}`;
      ctx.fillText(" / 100", PAD + sw + 8, y + 78);
      y += 168;
      rule();

      // Summary
      heading("Summary");
      para(result.summary, 34, chalk, sans, 1.42);
      y += 48;

      // Metrics: label + score + bar + note (the whole per-metric read)
      heading("Metrics");
      for (const m of result.metrics) {
        const label = metricLabel(skill, m.key);
        const observed = m.observed !== false;
        ctx.fillStyle = chalk;
        ctx.font = `700 34px ${display}`;
        ctx.fillText(label, PAD, y);
        ctx.textAlign = "right";
        ctx.font = `700 34px ${mono}`;
        ctx.fillStyle = observed ? gold : chalkDim;
        ctx.fillText(observed ? String(Math.round(m.score)) : "Not visible", W - PAD, y + 2);
        ctx.textAlign = "left";
        y += 50;
        // bar
        const barH = 16;
        ctx.fillStyle = withAlpha(chalk, 0.12);
        roundRect(ctx, PAD, y, CW, barH, barH / 2);
        ctx.fill();
        if (observed) {
          ctx.fillStyle = gold;
          roundRect(ctx, PAD, y, Math.max(barH, (CW * Math.max(0, Math.min(100, m.score))) / 100), barH, barH / 2);
          ctx.fill();
        }
        y += barH + 18;
        if (m.note) para(m.note, 28, chalkDim, sans, 1.4);
        y += 30;
      }
      y += 20;

      // Fixes (changes)
      if (result.changes?.length) {
        heading("Fixes");
        result.changes.forEach((c, i) => {
          ctx.fillStyle = chalk;
          ctx.font = `700 38px ${display}`;
          for (const line of wrapAll(ctx, `${i + 1}. ${c.title}`, CW)) {
            ctx.fillText(line, PAD, y);
            y += 46;
          }
          ctx.fillStyle = teal || gold;
          ctx.font = `26px ${mono}`;
          ctx.fillText(
            `+${c.expected_gain} PTS  ·  ${c.timeframe.toUpperCase()}  ·  ${c.difficulty.toUpperCase()}`,
            PAD,
            y,
          );
          y += 42;
          if (c.detail) para(c.detail, 28, chalkDim, sans, 1.4);
          y += 34;
        });
        y += 10;
      }

      // Drills
      const drills = result.drill_slugs.map(drillBySlug).filter(Boolean);
      if (drills.length) {
        heading("Drills");
        for (const d of drills) {
          ctx.fillStyle = chalk;
          ctx.font = `700 30px ${display}`;
          ctx.fillText(d!.name, PAD, y);
          y += 40;
          if (d!.summary) para(d!.summary, 26, chalkDim, sans, 1.38);
          y += 26;
        }
        y += 10;
      }

      // Footer
      rule();
      ctx.fillStyle = gold;
      ctx.font = `26px ${mono}`;
      ctx.fillText("FILM. FIX. REPEAT.", PAD, y);
      y += PAD;

      const finalH = Math.min(big.height, Math.ceil(y));
      const out = document.createElement("canvas");
      out.width = W;
      out.height = finalH;
      const octx = out.getContext("2d");
      if (!octx) return void setError(CANVAS_FAIL);
      octx.drawImage(big, 0, 0, W, finalH, 0, 0, W, finalH);

      const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
      if (!blob) return void setError(CANVAS_FAIL);
      const file = new File([blob], `sideout-${skillLabel.toLowerCase()}-${shown}-breakdown.png`, {
        type: "image/png",
      });

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
        {busy ? "Rendering..." : "Share breakdown"}
      </button>
      <span role="status" aria-live="polite" className="text-xs text-coral">
        {error}
      </span>
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
