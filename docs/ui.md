# UI standard

The rules every page follows so anyone from a 13-year-old to a first-time
smartphone user can operate the app without instructions. New or changed UI is
checked against this page; it is deliberately one screenful.

## Primitives (defined in `app/globals.css`)

| Class | Use for | Notes |
| --- | --- | --- |
| `.card` | Any grouped block of content | Add `.card-lift` for hover lift, `.spot` for the cursor spotlight |
| `.chip` / `.chip-active` | One choice among a few (level, environment, filters) | Always a `<button>` in a form or with `aria-pressed` |
| `.btn-primary` | The one main action on a screen | At most one per view |
| `.btn-ghost` | Secondary actions | |
| `.btn-destructive` | Deleting or leaving | Never adjacent to the primary action |
| `.input-field` | Text entry | Pair with a visible `<label>` |
| `.tag`, `.stat-num` | Labels and big numbers | |
| `.nav-active-marker` / `.nav-active-icon` | Current-page indicator in nav | |

Tokens: navy ground (`--color-navy*`), chalk text (`--color-chalk*`), gold
accent (`--color-gold*`), teal for strengths, coral for fixes. Do not invent
new colors per feature; add a token if one is genuinely missing.

Borders carry meaning: `--color-line-control` on anything you press or type
into, `--color-line` on dividers and static labels. If a new control's edge is
the only thing marking it, it uses the control token (D-067).

Type carries meaning too: `text-body` for any sentence a player reads,
`text-page-title` for a top-level page's `h1`, `text-sm`/`text-xs` for labels
and meta only. A paragraph in `text-sm` renders at 14.88px, below the mobile
floor and the same size as the chrome around it (D-068).

## Ease-of-use rules

- Tap targets at least 44px tall. Chips, nav items, and buttons all qualify.
- Text label beside every icon. An icon may decorate a label, never replace it
  on a primary action.
- Color never carries meaning alone: pair status colors with a word or shape
  (see the metric legend).
- Plain language: "Sign out", not "Terminate session". Say what happens, not
  what the system does.
- One clear action per card. If a card needs three buttons, it is two cards.
- Destructive actions sit last, styled `.btn-destructive`, and confirm before
  acting.
- Each flow step reveals only after the previous decision, numbered 01/02/03.
- Respect `prefers-reduced-motion`; every animation has a reduced path.
