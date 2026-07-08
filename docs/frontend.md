# Frontend log (shared classes + notable patterns)

Records net-new shared classes added during the perfection mission, per quality-floor §2 (every new shared class logged with name, purpose, call sites). All live in `app/globals.css @layer components` and reuse only the ten color + three font tokens.

## New shared classes (this mission)
| Class | Purpose | Call sites |
|---|---|---|
| `.btn-destructive` | Coral destructive-action button (same shape as btn-primary, coral bg, navy text). | `components/recorder.tsx` Stop control. |
| `.icon-btn` | 44x44 round icon-only action button (chalk-dim, hover chalk + faint bg). | `components/xp-toast.tsx` dismiss; available for future close/dismiss controls. |

## Token-purity idiom (enforced)
Opacity/lighten variants of a token color are expressed against the token, never re-typed as a raw hex/rgb of the same color:
`color-mix(in oklab, var(--color-gold|chalk|navy|coral) N%, transparent | var(--color-chalk))`.
The `.text-sheen` mid-stops use `color-mix(in oklab, var(--color-gold) 55%, var(--color-chalk))` (no eleventh color). Sanctioned literal-color surfaces remain only: `app/manifest.ts` JSON, `viewport.themeColor`, and `app/opengraph-image.tsx` satori inline styles (cannot resolve CSS custom properties).
