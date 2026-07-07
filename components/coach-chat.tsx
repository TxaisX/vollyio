"use client";

import { useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/motion";

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

export function CoachChat({ initialMessages }: { initialMessages: ChatMessage[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedText, setFailedText] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      pinnedRef.current =
        doc.scrollHeight - window.innerHeight - window.scrollY < 120;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (pinnedRef.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, waiting]);

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
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error ?? "The coaching service is unavailable. Try again.",
        );
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
            return [...prev.slice(0, -1), { ...lastMessage, content: received }];
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

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 py-6">
        {messages.length === 0 && (
          <Reveal>
            <div className="card p-5">
              <p className="font-display font-bold">Your coach knows your game.</p>
              <p className="mt-1 text-sm text-chalk-dim">
                Ask about your scores, your priority fixes, or what to train next.
                Every answer comes from your own analyses.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
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

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-md bg-gold px-4 py-2.5 text-sm text-navy"
                  : "max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-navy-light px-4 py-2.5 text-sm text-chalk"
              }
            >
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
            </div>
            <span
              suppressHydrationWarning
              className="mt-1 px-1 font-mono text-[10px] text-chalk-dim"
            >
              {timeLabel(m.created_at)}
            </span>
          </div>
        ))}

        {waiting && (
          <div className="flex items-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-line bg-navy-light px-4 py-3.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-chalk-dim"
                  style={{
                    animationDuration: "1.2s",
                    animationDelay: `${i * -0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div className="sticky bottom-20 z-10 mt-auto bg-navy pb-1 pt-2 md:bottom-4">
        {error && (
          <div className="mb-2 flex items-baseline gap-3 text-sm text-coral">
            <span>{error}</span>
            {failedText && (
              <button
                type="button"
                className="shrink-0 font-display font-bold underline underline-offset-2"
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
          className="flex items-end gap-2"
        >
          <textarea
            ref={textareaRef}
            value={input}
            rows={1}
            placeholder="Ask your coach..."
            aria-label="Message your coach"
            className="input-field min-h-11 flex-1 resize-none leading-6"
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
