import type { MeasurementsBlock } from "@/lib/pose/types";
import {
  clockStamp,
  formatMeasurement,
  measurementLabel,
} from "@/lib/pose/measurement-format";

// The raw motion-tracking numbers behind the scored metrics, rendered exactly
// as measured. Server-renderable; hidden entirely when a clip produced no
// grounded measurements (photos, fallback extractions, old rows).
export function MeasuredCard({ block }: { block: MeasurementsBlock }) {
  if (block.reps.length === 0) return null;
  const multiRep = block.reps.length > 1;

  return (
    <div className="card p-5">
      <div className="space-y-4">
        {block.reps.map((rep, i) => (
          <div key={i}>
            {multiRep && (
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-gold">
                Rep {i + 1} · contact {clockStamp(rep.contact_s)}
              </p>
            )}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {Object.entries(rep.metrics).map(([key, m]) => (
                <div key={key} className="flex items-baseline justify-between gap-3">
                  <dt className="min-w-0 truncate text-xs text-chalk-dim">
                    {measurementLabel(key)}
                  </dt>
                  <dd className="shrink-0 font-mono text-xs text-chalk">
                    {formatMeasurement(m.value, m.unit)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
        Motion tracking · full clip
        {typeof block.capture.dense_fps === "number"
          ? ` · ${block.capture.dense_fps} fps`
          : ""}
        {block.omitted_below_confidence.length > 0
          ? ` · ${block.omitted_below_confidence.length} checkpoint${
              block.omitted_below_confidence.length === 1 ? "" : "s"
            } below confidence, not shown`
          : ""}
      </p>
    </div>
  );
}
