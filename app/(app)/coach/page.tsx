import type { Metadata } from "next";
import { ViewTransition } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { CoachChat } from "@/components/coach-chat";

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

export default async function Coach() {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("user_id", userId!)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  const messages = (((data as Row[] | null) ?? [])).slice().reverse();

  return (
    <ViewTransition enter="vt-reveal-in" default="none">
      <section className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-2xl flex-col md:min-h-[calc(100dvh-4.5rem)]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-gold">Coach</p>
          <h1 className="font-display text-2xl font-bold">Ask your coach</h1>
        </div>
        <CoachChat initialMessages={messages} />
      </section>
    </ViewTransition>
  );
}
