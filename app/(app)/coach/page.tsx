import { createClient } from "@/lib/supabase/server";
import { CoachChat } from "@/components/coach-chat";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export default async function Coach() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const messages = (((data as Row[] | null) ?? [])).slice().reverse();

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-2xl flex-col md:min-h-[calc(100dvh-4.5rem)]">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.1em] text-gold">Coach</p>
        <h1 className="font-display text-2xl font-bold">Ask your coach</h1>
      </div>
      <CoachChat initialMessages={messages} />
    </section>
  );
}
