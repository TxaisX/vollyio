import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// THE ASK THIS FILE PINS: the coach surface was rebuilt on 2026-08-06 into a
// dense, type-led transcript with the conversation list behind a phone drawer.
// Nobody can log in to look at it, so everything the redesign was NOT allowed to
// break is asserted against source here, the same shape lib/nav-contract.test.ts
// and lib/breakdown-contract.test.ts use for components that cannot be imported
// under `node --test` (JSX, next/link, module-load env reads).
//
// The load-bearing behaviours, all of them recent and all of them cheap to undo
// by accident while moving classes around:
//   1. the transcript is the ONLY scroller, and the page itself does not scroll
//   2. the pinned-to-bottom check measures the TRANSCRIPT, never `window`
//   3. every fragment of coach prose reaches the screen through stripLongDashes
//   4. the server-built link map still reaches the inline renderer
//   5. the drawer is a real modal: focus in, focus trapped, focus back, Escape
// Plus the two things a compaction pass is most likely to cost: tap targets and
// the accessible names.
const CHAT = await readFile(new URL("../components/coach-chat.tsx", import.meta.url), "utf8");
const PAGE = await readFile(
  new URL("../app/(app)/coach/page.tsx", import.meta.url),
  "utf8",
);
const RAIL = await readFile(
  new URL("../components/coach-sessions.tsx", import.meta.url),
  "utf8",
);

/** The same source with every comment removed. All three files explain WHAT
 *  THEY NO LONGER DO in prose right next to the code that replaced it, so a
 *  `doesNotMatch` against the raw text fails on the explanation rather than on
 *  the thing it forbids. Every assertion below reads this instead. */
function code(src: string) {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const CHAT_CODE = code(CHAT);
const PAGE_CODE = code(PAGE);
const RAIL_CODE = code(RAIL);

/** The source between two markers, so a test reads one region and not the file. */
function between(src: string, open: string, close: string) {
  const from = src.indexOf(open);
  assert.notEqual(from, -1, `no \`${open}\``);
  const to = src.indexOf(close, from + open.length);
  assert.notEqual(to, -1, `no \`${close}\` after \`${open}\``);
  return src.slice(from, to);
}

/** Everything up to the `>` that ends an opening tag, counting braces so the
 *  `>` of an inline arrow function is not mistaken for the end of the tag. */
function tagHead(chunk: string) {
  let depth = 0;
  for (let i = 0; i < chunk.length; i++) {
    const c = chunk[i];
    if (c === "{") depth += 1;
    else if (c === "}") depth -= 1;
    else if (c === ">" && depth === 0) return chunk.slice(0, i + 1);
  }
  return chunk;
}

// ---------------------------------------------------------------------------
// 1. One scroller.
// ---------------------------------------------------------------------------

test("the transcript is the only vertical scroller in the chat", () => {
  const scrollers = [
    ...CHAT_CODE.matchAll(/overflow-y-auto|overflow-auto|overflow-y-scroll/g),
  ];
  assert.equal(scrollers.length, 1, "exactly one scrolling element in coach-chat.tsx");

  // And it is the element the scroll ref is attached to, not a sibling that
  // happens to also scroll.
  const at = CHAT_CODE.indexOf("ref={scrollRef}");
  assert.notEqual(at, -1, "the transcript must carry scrollRef");
  const el = CHAT_CODE.slice(at, at + 240);
  assert.match(el, /overflow-y-auto/, "the scroller and the ref'd element are one element");
  // min-h-0 on the flex chain is what lets it scroll instead of growing.
  assert.match(el, /min-h-0/);
  assert.match(CHAT_CODE, /className="flex min-h-0 flex-1 flex-col"/);
});

test("the page is pinned to the viewport and clips rather than scrolling", () => {
  assert.doesNotMatch(PAGE_CODE, /overflow-y-auto|overflow-auto|overflow-y-scroll/);
  assert.match(PAGE_CODE, /overflow-hidden/);
  // The two height numbers, which come from app/(app)/layout.tsx: mobile
  // subtracts the top bar plus main's pt-8, md+ subtracts pt-8 alone.
  assert.match(PAGE_CODE, /h-\[calc\(100dvh-5\.75rem\)\]/);
  assert.match(PAGE_CODE, /md:h-\[calc\(100dvh-2rem\)\]/);
  // ...and the negative margin that cancels main's bottom padding, without
  // which the pinned section sits above 7rem of nothing.
  assert.match(PAGE_CODE, /-mb-28 md:-mb-12/);
});

// The conversation list scrolls too, and that is fine, because the only two
// places it is ever rendered are the lg-only rail and the modal panel. Neither
// can lengthen the page, so the transcript is still the only thing that scrolls
// in the conversation column at any width.
test("the conversation list is the only other scroller, and it is never in flow", () => {
  assert.equal([...RAIL_CODE.matchAll(/overflow-y-auto/g)].length, 1);
  const list = between(RAIL_CODE, "function SessionList", "export function CoachSessionsRail");
  assert.match(list, /overflow-y-auto/);
  assert.match(list, /overscroll-contain/, "so the panel cannot chain its scroll outward");
  // Rendered once, placed twice, so the rail and the drawer cannot drift apart.
  assert.equal([...RAIL_CODE.matchAll(/<SessionList /g)].length, 2);
});

// ---------------------------------------------------------------------------
// 2. The pinned-to-bottom check.
// ---------------------------------------------------------------------------

// This is the regression that is invisible until a player is reading history:
// `window.scrollY` is 0 forever on a fixed page, so a window-based check reports
// "pinned" permanently and yanks them back to the bottom on every token.
test("the pinned check measures the transcript, not the window", () => {
  assert.match(
    CHAT_CODE,
    /pinnedRef\.current = el\.scrollHeight - el\.clientHeight - el\.scrollTop < 120/,
  );
  assert.match(
    CHAT_CODE,
    /const el = scrollRef\.current;[\s\S]{0,400}el\.addEventListener\("scroll"/,
  );
  assert.doesNotMatch(
    CHAT_CODE,
    /window\.scrollY|window\.pageYOffset|document\.documentElement\.scroll/,
  );
  assert.doesNotMatch(CHAT_CODE, /window\.addEventListener\(\s*"scroll"/);
  // Auto-follow sets scrollTop on the transcript. scrollIntoView is what walked
  // up to whichever ancestor scrolled and moved the whole page instead.
  assert.match(CHAT_CODE, /el\.scrollTop = el\.scrollHeight/);
  assert.doesNotMatch(CHAT_CODE, /scrollIntoView/);
});

// ---------------------------------------------------------------------------
// 3. Every coach text path goes through the dash stripper.
// ---------------------------------------------------------------------------

test("plain() is stripLongDashes and nothing else", () => {
  assert.match(CHAT_CODE, /import \{ stripLongDashes \} from "@\/lib\/coach-text"/);
  assert.match(CHAT_CODE, /const plain = \(text: string\) => stripLongDashes\(text\)/);
});

// Mechanical rather than by eye: renderInline emits coach prose by pushing onto
// `nodes`, so EVERY push is a path to the screen and every one of them has to
// carry plain(). A new branch that forgets it fails here rather than shipping a
// message with a long dash in it.
test("every fragment renderInline emits is stripped", () => {
  const body = between(CHAT_CODE, "function renderInline", "function AssistantContent");
  const pushes = body.split("nodes.push(").slice(1);
  assert.equal(pushes.length, 5, "five emit paths: two slices, bold, italic, code");
  for (const [i, chunk] of pushes.entries()) {
    assert.match(chunk, /plain\(/, `renderInline emit path ${i} does not strip dashes`);
  }
  // No raw capture group reaches JSX around them.
  assert.doesNotMatch(body, /\{\s*(?:label|m\[\d\](?:\s*\?\?\s*m\[\d\])?)\s*\}/);
});

test("the block renderer has no text path of its own", () => {
  const body = between(CHAT_CODE, "function AssistantContent", "const DRAWER_ID");
  // Paragraphs, bullets and numbers, and nothing else, all three via renderInline.
  assert.equal([...body.matchAll(/renderInline\(/g)].length, 3);
  assert.doesNotMatch(body, /\{\s*(?:block|text|l|lines)\s*\}/);
});

// The boundary, stated on purpose: the PLAYER's own words are reproduced exactly
// as typed. stripLongDashes exists to clean model output, and running it over a
// person's message would be editing them.
test("the player's own message is rendered verbatim", () => {
  assert.match(
    CHAT_CODE,
    /<p className="whitespace-pre-wrap break-words">\{m\.content\}<\/p>/,
  );
});

// ---------------------------------------------------------------------------
// 4. The link map, server to screen.
// ---------------------------------------------------------------------------

// Bold is load-bearing in a coach answer, not decoration: the coach is told to
// name drills exactly as the catalog does, so an emphasised phrase is usually a
// page, and the emphasis is the way in. That only works if the map built on the
// server survives all four hops.
test("the server-built link map reaches the inline renderer", () => {
  assert.match(PAGE_CODE, /const COACH_LINKS = buildCoachLinks\(\{/);
  assert.match(PAGE_CODE, /links=\{COACH_LINKS\}/);
  // Built on the server precisely so the drill and rehab catalogs stay out of
  // the client bundle; importing them into the chat would undo that.
  assert.doesNotMatch(CHAT_CODE, /@\/content\/drills|@\/content\/rehab/);

  assert.match(CHAT_CODE, /links,\s*\}: \{/);
  assert.match(CHAT_CODE, /links: CoachLinkMap;/);
  assert.match(CHAT_CODE, /<AssistantContent text=\{m\.content\} links=\{links\} \/>/);
  assert.match(CHAT_CODE, /renderInline\([^\n]*links\)/);
  assert.match(CHAT_CODE, /const href = resolveCoachLink\(links, label\)/);
  // And a resolved phrase renders as a real next/link, still gold, still bold.
  // `text-gold-ink` rather than `text-gold` since D-126: on the daylight
  // surfaces the bright fill token is 1.9:1 against sand and unreadable as
  // type, so every accent used AS TEXT takes the deep `-ink` half of the pair.
  assert.match(CHAT_CODE, /href \? \([\s\S]{0,200}<Link/);
  assert.match(CHAT_CODE, /className="font-bold text-gold-ink underline/);
  assert.match(CHAT_CODE, /import Link from "next\/link"/);
});

// ---------------------------------------------------------------------------
// 5. The drawer. A half-built one is worse than none, so all six of its
//    behaviours are pinned, not just that it opens.
// ---------------------------------------------------------------------------

// It is a native <dialog> opened with showModal(), which is the entire reason
// the component is short: the top layer, the backdrop, the focus trap, the
// return of focus and Escape are the browser's and are not reimplemented here.
// `show()` would give none of that, so it is forbidden by name.
test("the drawer is a real modal dialog, not a div with a z-index", () => {
  assert.match(CHAT_CODE, /<dialog/);
  assert.match(CHAT_CODE, /el\.showModal\(\)/);
  assert.doesNotMatch(CHAT_CODE, /\.show\(\)/);
  assert.doesNotMatch(CHAT_CODE, /role="dialog"/, "the element already has the role");
  // Overlays, never reflows: it is fixed to the viewport and in the top layer,
  // so the pinned non-scrolling section underneath is untouched by it.
  assert.match(CHAT_CODE, /className="fixed inset-0 m-0 h-auto max-h-none w-auto max-w-none/);
  // The dim is ::backdrop, in vollyio's own navy, not an element of our own.
  assert.match(CHAT_CODE, /backdrop:bg-navy\/80/);
});

test("the trigger announces the panel it controls", () => {
  assert.match(CHAT_CODE, /const DRAWER_ID = "coach-conversations"/);
  assert.match(CHAT_CODE, /aria-expanded=\{open\}/);
  assert.match(CHAT_CODE, /aria-controls=\{DRAWER_ID\}/);
  assert.match(CHAT_CODE, /id=\{DRAWER_ID\}/);
  // Both the trigger and the panel are named, and named the same thing.
  assert.equal([...CHAT_CODE.matchAll(/aria-label="Your conversations"/g)].length, 2);
});

test("focus goes in, and comes back to the control that opened it", () => {
  // showModal focuses the first focusable thing in the dialog, which is the
  // back button in the panel's top left; everything outside is inert until it
  // closes, which is the trap. The explicit focus after showModal is what makes
  // that a guarantee rather than a default: React applies `autoFocus` by
  // calling focus() at mount, and at mount the button is inside a closed dialog
  // and cannot take it.
  assert.match(CHAT_CODE, /autoFocus/);
  assert.match(CHAT_CODE, /el\.showModal\(\);\s*backRef\.current\?\.focus\(\)/);
  // `close` fires for Escape too, so this one listener covers every exit.
  assert.match(CHAT_CODE, /el\.addEventListener\("close", onClose\)/);
  assert.match(CHAT_CODE, /triggerRef\.current\?\.focus\(\)/);
  assert.match(CHAT_CODE, /el\.removeEventListener\("close", onClose\)/);
});

test("every way out of the drawer is wired", () => {
  // Escape and the backdrop are the browser's; these are the two we own.
  assert.match(CHAT_CODE, /if \(e\.target === dialogRef\.current\) setOpen\(false\)/);
  assert.match(CHAT_CODE, /closest\("a"\)\) setOpen\(false\)/);
  assert.match(CHAT_CODE, /aria-label="Close conversations"/);
  assert.match(CHAT_CODE, /if \(!open && el\.open\) el\.close\(\)/);
});

// A modal dialog holds the top layer and inerts the page behind it. Hiding it
// with `display: none` on a resize past lg while it was still open would leave
// the page inert with nothing on screen to dismiss.
test("a resize to the desktop breakpoint cannot strand the page inert", () => {
  assert.match(CHAT_CODE, /matchMedia\("\(min-width: 64rem\)"\)/);
  assert.match(CHAT_CODE, /if \(mq\.matches\) \{?\s*setOpen\(false\)/);
  assert.match(CHAT_CODE, /mq\.addEventListener\("change", sync\)/);
});

// A phone hides the list because there is no room. A desktop has the room, and
// making a desktop user open a panel to see conversations that could just be
// sitting there would be worse, not more consistent.
test("the drawer is the phone's answer only; the rail survives from lg", () => {
  assert.match(RAIL_CODE, /export function CoachSessionsRail/);
  assert.match(RAIL_CODE, /export function CoachSessionsDrawer/);
  assert.match(RAIL_CODE, /className="hidden lg:sticky/);
  assert.match(PAGE_CODE, /<CoachSessionsRail /);
  assert.match(PAGE_CODE, /<CoachSessionsDrawer /);
  // The trigger and the panel both stop existing at lg.
  const drawer = between(CHAT_CODE, "export function CoachDrawer", "export function CoachChat");
  assert.equal([...drawer.matchAll(/lg:hidden/g)].length, 2);
});

// The interactive shell is client code; the list inside it is not. Session rows
// arrive already rendered, so opening the drawer costs no round trip and ships
// no row markup to the browser.
test("the list stays a server component inside a client shell", () => {
  assert.doesNotMatch(RAIL_CODE, /"use client"/);
  assert.doesNotMatch(RAIL_CODE, /useState|useEffect|useRef/);
  assert.match(RAIL_CODE, /import \{ CoachDrawer \} from "@\/components\/coach-chat"/);
  assert.match(RAIL_CODE, /<CoachDrawer>/);
  assert.match(CHAT_CODE, /export function CoachDrawer\(\{ children \}/);
});

// The owner asked for it in the top left, and asked to get back out from the
// same corner. The trigger is the first thing in the header row.
test("the way in sits in the top left of the surface", () => {
  const row = between(PAGE_CODE, '<div className="flex shrink-0 items-center', "</div>");
  const trigger = row.indexOf("<CoachSessionsDrawer");
  const heading = row.indexOf("<h1");
  const newChat = row.indexOf('aria-label="New chat"');
  assert.ok(trigger > -1 && heading > trigger, "the drawer trigger leads the row");
  assert.ok(newChat > heading, "and new chat is the trailing control");
  assert.match(row, /ml-auto/, "which is pushed to the far end");
});

// ---------------------------------------------------------------------------
// Streaming, the error affordance, and session adoption.
// ---------------------------------------------------------------------------

test("the stream is still read chunk by chunk into one growing message", () => {
  assert.match(CHAT_CODE, /const reader = res\.body\.getReader\(\)/);
  assert.match(CHAT_CODE, /decoder\.decode\(value, \{ stream: true \}\)/);
  assert.match(CHAT_CODE, /setWaiting\(false\)/);
  assert.match(CHAT_CODE, /lastMessage\?\.id === assistantId/);
});

test("a fresh chat adopts the session the server mints, without a reload", () => {
  assert.match(CHAT_CODE, /res\.headers\.get\("x-coach-session"\)/);
  assert.match(
    CHAT_CODE,
    /window\.history\.replaceState\(null, "", `\/coach\?s=\$\{minted\}`\)/,
  );
  assert.match(CHAT_CODE, /router\.refresh\(\)/);
});

test("a failure keeps the text and offers it back", () => {
  assert.match(CHAT_CODE, /setFailedText\(trimmed\)/);
  assert.match(CHAT_CODE, /role="alert"/);
  assert.match(CHAT_CODE, /onClick=\{\(\) => void send\(failedText, false\)\}/);
  assert.match(CHAT_CODE, />\s*Retry\s*</);
});

// ---------------------------------------------------------------------------
// Accessibility. Smaller TYPE was the ask; smaller tap targets were not.
// ---------------------------------------------------------------------------

test("the transcript is a live region and every turn names its speaker", () => {
  assert.match(CHAT_CODE, /role="log" aria-live="polite"/);
  assert.match(
    CHAT_CODE,
    /className="sr-only">\s*\{m\.role === "user" \? "You" : "Coach"\}/,
  );
  assert.match(CHAT_CODE, /role="status"\s*aria-label="Coach is typing\."/);
  assert.match(CHAT_CODE, /aria-label="Message your coach"/);
  assert.match(CHAT_CODE, /aria-label="Send message"/);
});

// The timestamp lost its own line, which was the single biggest per-message
// cost on the page. It did not lose its reader.
test("the time is still announced, just not drawn", () => {
  assert.match(CHAT_CODE, /suppressHydrationWarning className="sr-only"/);
  assert.match(CHAT_CODE, /\{timeLabel\(m\.created_at\)\}/);
  assert.doesNotMatch(CHAT_CODE, /font-mono text-\[10px\] text-chalk-dim">\s*\{timeLabel/);
});

test("every control on the surface still clears 44px", () => {
  const surfaces: Array<[string, string, RegExp]> = [
    // The chat's only <Link> is a phrase inside a sentence, exempted below.
    ["coach-chat.tsx", CHAT_CODE, /<(?:button|textarea)\b/g],
    ["coach-sessions.tsx", RAIL_CODE, /<(?:button|Link)\b/g],
    ["coach/page.tsx", PAGE_CODE, /<(?:button|Link)\b/g],
  ];
  for (const [file, src, opener] of surfaces) {
    const controls = src.split(opener).slice(1);
    assert.ok(controls.length > 0, `${file} has controls`);
    for (const control of controls) {
      const head = tagHead(control);
      assert.match(
        head,
        /min-h-11|h-11|icon-btn/,
        `${file}: a control declares no 44px floor: ${head.slice(0, 140)}`,
      );
    }
  }
});

// WCAG 2.5.8 exempts a link inside a sentence, which is exactly what this is: a
// bolded phrase in a coach answer that happens to resolve to a page. Giving it a
// 44px box would break the line it sits in.
test("the one exempt control is the inline link inside coach prose", () => {
  assert.equal([...CHAT_CODE.matchAll(/<Link\b/g)].length, 1);
  const inline = between(CHAT_CODE, "function renderInline", "function AssistantContent");
  assert.match(inline, /<Link\b/);
});

// ---------------------------------------------------------------------------
// The redesign itself, so it cannot drift back.
// ---------------------------------------------------------------------------

// The owner's actual complaint: a page-title h1 reading "Ask your coach" over a
// mono eyebrow, eating the top of a phone screen on a surface whose content is
// the conversation. What is left is a label, and the row it sits in now carries
// the two controls instead of a title block.
test("the page heading is quiet, and still a heading", () => {
  assert.doesNotMatch(PAGE_CODE, /text-page-title/);
  assert.equal([...PAGE_CODE.matchAll(/<h1\b/g)].length, 1, "exactly one h1");
  assert.match(PAGE_CODE, /<h1 className="font-mono text-\[11px\]/);
});

test("the coach answer reads as prose, not as a filled bubble", () => {
  // No solid fill behind a message, in either direction.
  assert.doesNotMatch(CHAT_CODE, /bg-gold px-/);
  // The assistant turn carries no surface at all: no radius, no border, no fill.
  assert.match(CHAT_CODE, /: `w-full text-chalk \$\{PROSE\}`/);
  // The player's turn is the only one with a surface, and it is a neutral one.
  assert.match(CHAT_CODE, /rounded-2xl border border-line bg-navy-light px-3 py-1\.5/);
  // Alignment is the rest of the speaker cue.
  assert.match(CHAT_CODE, /m\.role === "user" \? "items-end" : "items-start"/);
  // Gold survives as the link colour only, which is the one thing in an answer
  // worth a colour.
  assert.equal([...CHAT_CODE.matchAll(/text-gold/g)].length, 1);
});

// One quiet rounded field with the send control inside it, and no rule above it.
test("the composer is one field, pinned, with send inside", () => {
  assert.match(CHAT_CODE, /className="input-field flex items-end gap-1/);
  assert.match(CHAT_CODE, /focus-within:border-gold/);
  assert.doesNotMatch(CHAT_CODE, /border-t border-line/);
  // Still an ordinary flex child of a column that cannot scroll, which is what
  // makes it pinned. `sticky` here would mean the window is scrolling again.
  assert.match(CHAT_CODE, /className="shrink-0 bg-navy pb-1 pt-2"/);
  assert.doesNotMatch(CHAT_CODE, /sticky bottom/);
});

test("the transcript type is smaller than page prose, and the measure is capped", () => {
  assert.match(CHAT_CODE, /const PROSE = "text-sm leading-relaxed break-words"/);
  assert.doesNotMatch(CHAT_CODE, /text-body/, "text-body is the page scale, not this one");
  assert.match(CHAT_CODE, /max-w-\[68ch\]/, "smaller type without a capped measure runs long");
});

test("the empty state kept its suggestions and lost its card", () => {
  assert.match(CHAT_CODE, /const SUGGESTIONS = \[/);
  assert.equal([...CHAT_CODE.matchAll(/className="chip min-h-11"/g)].length, 1);
  assert.doesNotMatch(CHAT_CODE, /className="card p-5"/);
  assert.doesNotMatch(CHAT_CODE, /Your coach knows your game/);
});

// Lint enforces em dashes on all source. En dashes are the same house rule and
// the same tell, and stripLongDashes removes both from model output, so the
// three files that make up this surface are held to both, comments included.
test("no long dashes anywhere in the coach surface source", () => {
  for (const [file, src] of [
    ["coach-chat.tsx", CHAT],
    ["coach/page.tsx", PAGE],
    ["coach-sessions.tsx", RAIL],
  ] as const) {
    // Written as code points so this file can forbid the two characters
    // without containing either of them and failing its own rule.
    assert.doesNotMatch(src, /[\u2013\u2014]/, `${file} contains a long dash`);
  }
});

// iOS SAFARI ZOOMS THE VIEWPORT when a text field under 16px takes focus. This
// page is pinned to 100dvh with nothing scrolling, so that zoom does not
// gracefully scroll back: it strands the composer off the new viewport with no
// way to reach it but pinching out. The transcript above is free to be smaller
// because nobody focuses it. This is a platform constraint, not a style choice,
// and folding the composer back to text-sm to match the prose is the change
// that breaks typing on an iPhone.
test("the composer never drops under the 16px iOS zoom floor", async () => {
  const src = await readFile(new URL("../components/coach-chat.tsx", import.meta.url), "utf8");
  // The element is self-closing, so read to the first "/>" after the tag opens
  // rather than to a closing tag that does not exist.
  const open = src.indexOf("<textarea");
  assert.notEqual(open, -1, "the composer textarea must exist");
  const textarea = src.slice(open, src.indexOf("/>", open) + 2);
  const cls = textarea.match(/className="([^"]*)"/);
  assert.ok(cls, "the composer textarea must carry a className");
  assert.match(cls[1], /text-\[16px\]/, "the composer must be pinned at 16px");
  assert.doesNotMatch(cls[1], /\btext-sm\b/, "text-sm is 14.88px here and triggers the zoom");
  assert.match(cls[1], /min-h-11/, "smaller type is never licence to shrink the tap target");
});

// The panel lives off the LEFT edge and must be seen arriving from it. The
// direction is the affordance: it is what tells a player the back control puts
// the drawer away rather than dismissing something that will not return. A
// fade-up reads as a menu dropping in, which is the wrong mental model.
test("the sessions drawer slides in from the left, not up", async () => {
  const src = await readFile(new URL("../components/coach-chat.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(src, /drawer-in-left/);
  assert.doesNotMatch(src, /landing-menu-in/, "the menu entrance is the wrong direction for a drawer");
  assert.match(css, /@keyframes drawer-in-left/);
  assert.match(css, /translateX\(-100%\)/, "it must travel from the edge it lives on");
});
