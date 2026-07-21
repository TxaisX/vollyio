import type { Metadata } from "next";
import { ViewTransition } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { CoachChat } from "@/components/coach-chat";
import { CoachSessions, type CoachSession } from "@/components/coach-sessions";
import { COACH_ENABLED } from "@/lib/flags";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Coach",
  description:
    "Ask your coach anything. Every answer comes from your own scores and goals.",
};

type Row = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export default async function Coach({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  if (!COACH_ENABLED) notFound();
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  const { s } = await searchParams;

  const { data: sessionsData, error: sessionsError } = await supabase
    .from("coach_sessions")
    .select("id, title, updated_at")
    .eq("user_id", userId!)
    .order("updated_at", { ascending: false })
    .limit(30);
  if (sessionsError) throw sessionsError;
  const sessions = (sessionsData as CoachSession[] | null) ?? [];

  // ?s=new is a fresh, not-yet-created conversation. Otherwise open the
  // requested session (when it is really yours) or the most recent one.
  const requested = s === "new" ? null : sessions.find((x) => x.id === s);
  const active = s === "new" ? null : (requested ?? sessions[0] ?? null);

  let messages: Row[] = [];
  if (active) {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("user_id", userId!)
      .eq("session_id", active.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    messages = (((data as Row[] | null) ?? [])).slice().reverse();
  }

  return (
    <ViewTransition enter="vt-reveal-in" default="none">
      {/* On xl screens a phantom right column mirrors the session rail so the
          conversation sits at the true center of the page. */}
      <section className="mx-auto w-full max-w-5xl lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-x-8 xl:max-w-6xl xl:grid-cols-[15rem_minmax(0,1fr)_15rem]">
        <div className="lg:col-start-2">
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-gold">Coach</p>
          <h1 className="font-display text-2xl font-bold">Ask your coach</h1>
        </div>
        <CoachSessions sessions={sessions} activeId={active?.id ?? null} />
        <div className="flex min-h-[calc(100dvh-11rem)] w-full max-w-2xl flex-col md:min-h-[calc(100dvh-7rem)] lg:col-start-2 lg:mx-auto">
          <CoachChat
            key={active?.id ?? "new"}
            activeSessionId={active?.id ?? null}
            initialMessages={messages}
          />
        </div>
      </section>
    </ViewTransition>
  );
}
