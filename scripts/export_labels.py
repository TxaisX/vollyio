#!/usr/bin/env python3
"""Export a frame-free label sidecar from evals/cases/*.json -> evals/labels.json.

The case files embed copyrighted source frames and are gitignored ("never
committed"). Their LABELS (skill, discipline, level, expected band, weakest
metric, excluded flag) are the actual calibration work and small enough to
version-control. Run after (re)labeling cases so the committed record stays in
sync with what's on disk.
"""
import json, glob, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CASES = os.path.join(ROOT, "evals", "cases")
OUT = os.path.join(ROOT, "evals", "labels.json")

rows = []
for p in sorted(glob.glob(os.path.join(CASES, "*.json"))):
    d = json.load(open(p, encoding="utf-8"))
    rows.append({
        "id": d["id"],
        "skill": d["skill"],
        "discipline": d["discipline"],
        "level": d.get("level"),
        "source": d.get("source"),
        "excluded": d.get("excluded", False),
        "expected": d.get("expected", {}),
    })

out = {
    "note": ("Frame-free label sidecar for evals/cases/*.json (the cases embed "
             "copyrighted source frames and are gitignored). This is the "
             "committable calibration record. Regenerate via scripts/export_labels.py."),
    "count": len(rows),
    "cases": rows,
}
json.dump(out, open(OUT, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print(f"wrote {OUT} rows={len(rows)}")
