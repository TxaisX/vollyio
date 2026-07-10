import type { Metadata } from "next";
import { ViewTransition } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { CoachChat, type CoachSession } from "@/components/coach-chat";

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
      <section className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-2xl flex-col md:min-h-[calc(100dvh-4.5rem)]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-gold">Coach</p>
          <h1 className="font-display text-2xl font-bold">Ask your coach</h1>
        </div>
        <CoachChat
          key={active?.id ?? "new"}
          sessions={sessions}
          activeSessionId={active?.id ?? null}
          initialMessages={messages}
        />
      </section>
    </ViewTransition>
  );
}
