"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Reveal } from "@/components/motion";
import { ReportContent } from "@/components/report-content";
import { resolveCoachLink, type CoachLinkMap } from "@/lib/coach-links";
import { stripLongDashes } from "@/lib/coach-text";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

const SUGGESTIONS = [
  "What should I work on first?",
  "Build me a practice plan for this week",
  "Why is my passing score stuck?",
] as const;

const MAX_COMPOSER_HEIGHT = 120;

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

const INLINE =
  /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|_([^_\n]+)_|`([^`]+)`)/g;

// Every fragment of coach prose passes through here on its way to the screen,
// so there is exactly one place a long dash can be removed and none it can slip
// past. See lib/coach-text.ts for why the prompt rule is not enough alone.
const plain = (text: string) => stripLongDashes(text);

function renderInline(text: string, keyBase: string, links: CoachLinkMap): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) nodes.push(plain(text.slice(last, m.index)));
    if (m[2] !== undefined || m[3] !== undefined) {
      const label = m[2] ?? m[3];
      // The coach is told to name drills exactly as the catalog does, so the
      // phrase it just emphasised is usually a page. When it is, the emphasis
      // becomes the way in; when it is not, this renders exactly as before.
      const href = resolveCoachLink(links, label);
      nodes.push(
        href ? (
          <Link
            key={`${keyBase}-b${i}`}
            href={href}
            className="font-bold text-gold-ink underline decoration-gold-ink/40 underline-offset-2 transition-colors hover:decoration-gold-ink"
          >
            {plain(label)}
          </Link>
        ) : (
          <strong key={`${keyBase}-b${i}`} className="font-bold">
            {plain(label)}
          </strong>
        ),
      );
    } else if (m[4] !== undefined || m[5] !== undefined) {
      nodes.push(
        <em key={`${keyBase}-i${i}`} className="italic">
          {plain(m[4] ?? m[5])}
        </em>,
      );
    } else if (m[6] !== undefined) {
      nodes.push(
        <code
          key={`${keyBase}-c${i}`}
          className="rounded bg-navy px-1 py-0.5 font-mono text-[0.9em]"
        >
          {plain(m[6])}
        </code>,
      );
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) nodes.push(plain(text.slice(last)));
  return nodes;
}

// TYPE SCALE ON THIS SURFACE, and why it is not text-body.
//
// app/globals.css argues that prose a player is meant to READ belongs at
// text-body (1rem, 17px at the 106.25% root), and on a scorecard or a drill page
// that is right: those pages hold a few paragraphs and the reader arrives once.
// A transcript is the opposite case. It is the whole page, it accumulates, and
// the owner's complaint was that too little of it fits on a phone. text-sm
// (14.88px) with leading-relaxed buys back roughly two lines per answer and a
// whole extra turn on a phone screen, and unlike the pages text-body was written
// for, the reader is looking at one continuous column with nothing competing
// with it.
const PROSE = "text-sm leading-relaxed break-words";

function AssistantContent({ text, links }: { text: string; links: CoachLinkMap }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim() !== "");
  return (
    // Measure capped in `ch`, not by the column. Dropping the type without this
    // would have stretched a coach answer to roughly 90 characters a line
    // inside the max-w-2xl column, which is past the point prose stays easy to
    // track back to the next line.
    <div className={`flex max-w-[68ch] flex-col gap-1.5 ${PROSE}`}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const isUL = lines.every((l) => /^\s*[-*]\s+/.test(l));
        const isOL = lines.every((l) => /^\s*\d+\.\s+/.test(l));
        if (isUL) {
          return (
            <ul key={bi} className="ml-4 list-disc space-y-0.5">
              {lines.map((l, li) => (
                <li key={li}>
                  {renderInline(l.replace(/^\s*[-*]\s+/, ""), `${bi}-${li}`, links)}
                </li>
              ))}
            </ul>
          );
        }
        if (isOL) {
          return (
            <ol key={bi} className="ml-4 list-decimal space-y-0.5">
              {lines.map((l, li) => (
                <li key={li}>
                  {renderInline(l.replace(/^\s*\d+\.\s+/, ""), `${bi}-${li}`, links)}
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <span key={li}>
                {li > 0 && <br />}
                {renderInline(l, `${bi}-${li}`, links)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** Ties the trigger to the panel for `aria-controls`. */
const DRAWER_ID = "coach-conversations";

/**
 * The conversation list as an off-canvas panel, phone only.
 *
 * Before this there was a horizontal strip of session chips above the
 * transcript, which cost a permanent row on the smallest screen and still could
 * not show more than two titles. The list now slides over the conversation from
 * the left, from a control in the top left, and the row it used to occupy goes
 * back to the transcript.
 *
 * A native <dialog> opened with showModal(), NOT a div with a z-index, and that
 * is the whole reason this is short. The browser gives us the top layer, the
 * backdrop, the focus trap, focus restoration to the trigger on close, and
 * Escape, all of it correct in every browser, none of it reimplemented. What is
 * left here is the state sync, the backdrop click, and closing when a link
 * inside it navigates.
 *
 * It lives in this file rather than beside the list because this is the coach
 * surface's single "use client" module. The list it wraps stays a server
 * component and arrives as children, so no session row ships to the browser.
 */
export function CoachDrawer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const backRef = useRef<HTMLButtonElement | null>(null);

  // showModal() already puts focus on the first focusable thing inside, which
  // is the back button, and the `autoFocus` below says so declaratively. Both
  // are hedges: React applies autoFocus by calling focus() at mount, and at
  // mount this button is inside a closed dialog and cannot take it. Asking for
  // it here, after the dialog is actually open, is the one that always lands.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      backRef.current?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  // `close` fires for Escape and for the backdrop-dismiss path as well as for
  // our own buttons, so this is the one place open state comes back down. The
  // browser already returns focus to whatever opened the dialog; asking for it
  // explicitly costs nothing and makes the guarantee local to this file.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onClose = () => {
      setOpen(false);
      triggerRef.current?.focus();
    };
    el.addEventListener("close", onClose);
    return () => el.removeEventListener("close", onClose);
  }, []);

  // A modal dialog holds the top layer and makes everything behind it inert. If
  // a resize past the lg breakpoint hid it with `display: none` while it was
  // still open, the page underneath would stay inert with nothing on screen to
  // dismiss. 64rem is the lg breakpoint, and media queries resolve rem against
  // the initial 16px rather than the root override, so this is exactly it.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 64rem)");
    const sync = () => {
      if (mq.matches) setOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Your conversations"
        aria-expanded={open}
        aria-controls={DRAWER_ID}
        onClick={() => setOpen(true)}
        className="icon-btn -ml-3 lg:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16" />
        </svg>
      </button>

      {/* The dialog itself is a transparent sheet over the whole viewport and
          the panel is the child inside it, which is what makes "tapped outside
          the panel" a plain `e.target === the dialog` check. The dim comes from
          ::backdrop, so it is the browser's, sits under the top layer, and
          needs no element of its own. */}
      <dialog
        id={DRAWER_ID}
        ref={dialogRef}
        aria-label="Your conversations"
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
        className="fixed inset-0 m-0 h-auto max-h-none w-auto max-w-none bg-transparent p-0 backdrop:bg-deep/60 lg:hidden"
      >
        <div
          // A tap on any link in here is a navigation, and the panel must not
          // still be sitting over the conversation it just switched to.
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
          // drawer-in-left, not the mobile menu's fade-up: this panel lives off
          // the left edge and has to be seen arriving from it, because that
          // direction is what tells a player the back control puts it away
          // again rather than dismissing something that will not come back.
          className="drawer-in-left flex h-dvh w-[17rem] max-w-[82vw] flex-col gap-1 border-r border-line bg-navy p-2 shadow-lift"
        >
          {/* Back, in the same top-left corner the trigger occupies, so the way
              out is where the way in was. */}
          <button
            ref={backRef}
            type="button"
            autoFocus
            aria-label="Close conversations"
            onClick={() => setOpen(false)}
            className="icon-btn mb-1 shrink-0"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          {children}
        </div>
      </dialog>
    </>
  );
}

export function CoachChat({
  activeSessionId,
  initialMessages,
  initialDraft = "",
  links,
}: {
  activeSessionId: string | null;
  initialMessages: ChatMessage[];
  /** A question handed over by whatever sent the player here, today the
   *  dashboard's "Focus now" fix. It FILLS the composer and is never sent:
   *  `/api/coach` spends a quota unit before the model is called, so an
   *  auto-send would charge a player for a question they had not read. The
   *  server has already capped it at the route's 600-character limit. */
  initialDraft?: string;
  /** Built on the server so the drill and injury catalogs stay out of this
   *  bundle; see lib/coach-links.ts. */
  links: CoachLinkMap;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState(initialDraft);
  const [streaming, setStreaming] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedText, setFailedText] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // The transcript, which is the ONLY thing on this page that scrolls. The
  // heading above it and the composer below it are fixed in place, so a player
  // mid-conversation never loses the box they are typing into.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);
  // The conversation this chat writes into; a fresh chat adopts the id the
  // server mints on the first message.
  const sessionRef = useRef<string | null>(activeSessionId);

  // "Am I still following the conversation?" Measured against the TRANSCRIPT,
  // not the window. It used to read document scroll, which stopped describing
  // anything once the page itself became fixed: `window.scrollY` is 0 forever
  // now, so the old check reported "pinned" permanently and would have yanked a
  // player back to the bottom while they were reading something further up.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      pinnedRef.current = el.scrollHeight - el.clientHeight - el.scrollTop < 120;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Setting scrollTop directly rather than scrollIntoView: the latter walks up
  // to whichever ancestor happens to scroll, which is the behaviour that let
  // the whole page jump instead of the message list.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, waiting]);

  // A handed-over draft has to be sized and reachable on arrival. The composer
  // only grows in its change handler, so a prefilled question would render at
  // one row with the rest of itself clipped, and the caret would sit at the
  // start where an edit means arrowing past the whole sentence first.
  //
  // Runs once, keyed on nothing: this is an arrival state, not something to
  // re-apply when the draft prop happens to match again later. Focus is safe
  // here because the player pressed a link whose entire promise was that they
  // were about to ask this, and the page itself does not scroll.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el || !initialDraft) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_COMPOSER_HEIGHT)}px`;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(text: string, appendUser = true) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setError(null);
    setFailedText(null);
    if (appendUser) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: trimmed,
          created_at: new Date().toISOString(),
        },
      ]);
    }
    setStreaming(true);
    setWaiting(true);
    pinnedRef.current = true;

    try {
      const wasNewSession = sessionRef.current == null;
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          ...(sessionRef.current ? { session_id: sessionRef.current } : {}),
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error ?? "The coaching service is unavailable. Try again.",
        );
      }

      // A fresh chat adopts its server-minted session without a reload, so
      // the stream keeps rendering and later messages join the same thread.
      const minted = res.headers.get("x-coach-session");
      if (wasNewSession && minted) {
        sessionRef.current = minted;
        window.history.replaceState(null, "", `/coach?s=${minted}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const assistantId = crypto.randomUUID();
      let received = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        received += chunk;
        setWaiting(false);
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage?.id === assistantId) {
            return [
              ...prev.slice(0, -1),
              { ...lastMessage, content: received },
            ];
          }
          return [
            ...prev,
            {
              id: assistantId,
              role: "assistant",
              content: received,
              created_at: new Date().toISOString(),
            },
          ];
        });
      }

      if (!received) {
        throw new Error("The coach didn't answer. Try again.");
      }
      if (wasNewSession) {
        // Pull the new session into the tab list without touching this
        // component's local message state.
        router.refresh();
      }
    } catch (err) {
      setFailedText(trimmed);
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong. Try again.",
      );
    } finally {
      setStreaming(false);
      setWaiting(false);
    }
  }

  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_COMPOSER_HEIGHT)}px`;
  }

  function handleSubmit() {
    if (streaming || !input.trim()) return;
    const text = input;
    setInput("");
    const el = textareaRef.current;
    if (el) el.style.height = "auto";
    void send(text);
  }

  // Which message is the one still arriving, so the report control can stay off
  // it until it has finished being written.
  const lastMessageId = messages[messages.length - 1]?.id ?? null;

  return (
    // min-h-0 on both, which is the whole trick: a flex child defaults to
    // min-height:auto and refuses to shrink below its content, so without it
    // the transcript grows the page instead of scrolling inside it.
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain py-2"
      >
        {messages.length === 0 && (
          <Reveal>
            {/* The way in for a player who has never asked anything, at the
                weight of a hint rather than of a card. It used to be a bordered
                .card with a display-weight headline, which announced itself
                every time an empty chat opened and then never appeared again;
                the suggestions are the useful half and they survive intact. */}
            <div>
              <p className="max-w-[60ch] text-xs leading-relaxed text-chalk-dim">
                Ask about your scores, your priority fixes, or what to train
                next. Every answer comes from your own analyses.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="chip min-h-11"
                    disabled={streaming}
                    onClick={() => void send(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>
        )}

        <div role="log" aria-live="polite" className="flex flex-col gap-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`message-in flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
            >
              {/* TWO SPEAKERS, ONE COLUMN, AND ONLY ONE OF THEM GETS A SURFACE.
                  Both turns used to be rounded blobs capped at 85%, the
                  player's filled solid gold. On a phone that reads as two
                  chat-app bubbles; on a full desktop column it puts a large
                  block of saturated colour behind what is really an essay.
                  A coach answer is prose the player is meant to read, so it now
                  renders as prose: no fill, no border, no radius, just type in
                  the column. The player's own line is short, is scanned rather
                  than read, and has to be findable when scrolling back, so it
                  keeps a quiet surface and the right edge; alignment plus that
                  surface is the whole speaker cue and it is enough.
                  Gold is gone from both turns on purpose. Inside a coach answer
                  gold now means exactly one thing, "this phrase is a page you
                  can open" (see resolveCoachLink), and it could not mean that
                  while an entire message was painted in it. */}
              <div
                className={
                  m.role === "user"
                    ? `max-w-[85%] rounded-2xl border border-line bg-navy-light px-3 py-1.5 text-chalk ${PROSE}`
                    : `w-full text-chalk ${PROSE}`
                }
              >
                {/* The clock moved in here. A per-message timestamp cost a line
                    of its own under every single turn, which is the densest
                    thing on the page that nobody reads; a screen reader still
                    gets it, announced with the speaker it belongs to. */}
                <span suppressHydrationWarning className="sr-only">
                  {m.role === "user" ? "You" : "Coach"}, {timeLabel(m.created_at)}:
                </span>
                {m.role === "assistant" ? (
                  <AssistantContent text={m.content} links={links} />
                ) : (
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                )}
              </div>
              {/* THE COACH IS THE REASON THIS APP IS IN SCOPE for Play's
                  AI-Generated Content policy: text-to-text chat where the AI
                  interaction is the central feature. That policy requires a way
                  to report an offensive answer without leaving the app, so the
                  control hangs off the answer itself rather than off a settings
                  page nobody opens mid-conversation.

                  It sends `m.content`, not `m.id`. A streamed answer carries a
                  client-minted uuid that exists in no table until the thread is
                  read back, so the id would be a dangling reference on exactly
                  the message most likely to be reported: the one just written.
                  The text is the thing being reported and it is what moderation
                  needs anyway. Hidden while streaming, because an answer still
                  arriving is not yet the answer anyone is judging.

                  It is quiet but it is NOT hover-revealed. There is no hover on
                  a phone, and a required reporting control that only appears to
                  a mouse is a control most of this app's users do not have. */}
              {m.role === "assistant" && !(streaming && m.id === lastMessageId) && (
                <div className="mt-1">
                  <ReportContent
                    target={{
                      surface: "coach",
                      sessionId: sessionRef.current,
                      excerpt: m.content,
                    }}
                    label="Report this answer"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {waiting && (
          // Sits where the answer will, at the answer's left edge, because the
          // answer no longer arrives in a bubble for this to have to match.
          <div
            role="status"
            aria-label="Coach is typing."
            className="flex items-center gap-1.5 py-1"
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                aria-hidden="true"
                className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-chalk-dim"
                style={{
                  animationDuration: "1.2s",
                  animationDelay: `${i * -0.2}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Was `sticky bottom-20`, which only looked pinned because the window
          was the scroller. Now it is an ordinary flex child that cannot move,
          because nothing around it scrolls. */}
      <div className="shrink-0 bg-navy pb-1 pt-2">
        {error && (
          <div role="alert" className="mb-1.5 flex items-center gap-3">
            <span className="text-sm text-coral-ink">{error}</span>
            {failedText && (
              <button
                type="button"
                className="btn-ghost min-h-11 shrink-0 px-4 text-sm"
                onClick={() => void send(failedText, false)}
              >
                Retry
              </button>
            )}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          // One quiet rounded field with the send control inside it, rather
          // than a box and a button sitting next to each other above a rule.
          // .input-field is still what draws it, moved up to the form so the
          // border wraps both; the rule that used to separate the composer from
          // the transcript is gone, because a bordered field already reads as
          // "not the conversation" and the divider was one more line of chrome
          // on the surface the owner asked to quieten.
          className="input-field flex items-end gap-1 py-1 pl-3 pr-1 focus-within:border-gold"
        >
          <textarea
            ref={textareaRef}
            value={input}
            rows={1}
            placeholder="Ask your coach..."
            aria-label="Message your coach"
            // Typing at the size the transcript reads at, so what a player is
            // composing does not sit a size larger than the answer it gets.
            // min-h-11 survives the smaller type: it is the tap target, and
            // shrinking type is not licence to shrink that.
            // 16px EXACTLY, and it is not a style choice. iOS Safari zooms the
            // viewport when a text field under 16px takes focus, and this page
            // is pinned to 100dvh with nothing scrolling, so that zoom does not
            // gracefully scroll back: it leaves the composer somewhere off the
            // new viewport with no way to reach it but pinching out. The
            // transcript above is free to be smaller because nobody focuses it.
            // Do not fold this into text-sm to match the prose; that is the
            // change that breaks typing on an iPhone.
            className="min-h-11 flex-1 resize-none bg-transparent py-2.5 text-[16px] leading-6 text-chalk outline-none placeholder:text-chalk-dim"
            onChange={(e) => {
              setInput(e.target.value);
              autoGrow();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={streaming || !input.trim()}
            className="btn-primary h-11 w-11 shrink-0 p-0 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22l-4-9-9-4Z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
