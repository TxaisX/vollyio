import type { Frame } from "@/lib/frames";

export function Filmstrip({
  frames,
  highlight,
}: {
  frames: Frame[];
  highlight?: Set<number>;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {frames.map((f) => {
        const on = highlight?.has(f.index);
        return (
          <div
            key={f.index}
            className={`relative w-24 shrink-0 overflow-hidden rounded-md border-2 ${
              on ? "border-gold" : "border-transparent"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={f.dataUrl}
              alt={`Frame ${f.index + 1}`}
              className="block h-18 w-full object-cover"
              style={{ height: 72 }}
            />
            <span
              className={`absolute left-1 top-1 rounded px-1.5 py-px font-mono text-[10px] ${
                on ? "bg-gold text-navy" : "bg-navy/85 text-chalk"
              }`}
            >
              {f.time_s != null ? `${f.time_s}s` : f.index + 1}
            </span>
          </div>
        );
      })}
    </div>
  );
}
