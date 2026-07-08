import type { Frame } from "@/lib/frames";

export function Filmstrip({
  frames,
  highlight,
  variant = "strip",
}: {
  frames: Frame[];
  highlight?: Set<number>;
  variant?: "strip" | "grid";
}) {
  if (frames.length === 0) {
    return (
      <div className="card border-dashed border-line p-6 text-center text-xs text-chalk-dim">
        No frames to show for this rep.
      </div>
    );
  }

  if (variant === "grid") {
    return (
      <ul role="list" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {frames.map((f) => {
          const on = highlight?.has(f.index);
          return (
            <li
              key={f.index}
              className={`relative overflow-hidden rounded-lg border-2 ${
                on ? "border-gold" : "border-line"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.dataUrl}
                alt={`Frame ${f.index + 1}`}
                className="block aspect-video w-full object-cover"
              />
              <span
                className={`absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 font-mono text-[11px] ${
                  on ? "bg-gold text-navy" : "bg-navy/85 text-chalk"
                }`}
              >
                {f.time_s != null ? `${f.time_s}s` : f.index + 1}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul role="list" className="flex gap-2 overflow-x-auto pb-1">
      {frames.map((f) => {
        const on = highlight?.has(f.index);
        return (
          <li
            key={f.index}
            className={`relative w-24 shrink-0 overflow-hidden rounded-md border-2 ${
              on ? "border-gold" : "border-transparent"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={f.dataUrl}
              alt={`Frame ${f.index + 1}`}
              className="block w-full object-cover"
              style={{ height: 72 }}
            />
            <span
              className={`absolute left-1 top-1 rounded px-1.5 py-px font-mono text-[10px] ${
                on ? "bg-gold text-navy" : "bg-navy/85 text-chalk"
              }`}
            >
              {f.time_s != null ? `${f.time_s}s` : f.index + 1}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
