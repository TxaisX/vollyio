import type { Metadata } from "next";
import { ViewTransition } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { CoachChat } from "@/components/coach-chat";
import {
  CoachSessionsDrawer,
  CoachSessionsRail,
  type CoachSession,
} from "@/components/coach-sessions";
import { COACH_ENABLED } from "@/lib/flags";
import { buildCoachLinks } from "@/lib/coach-links";
import { DRILLS } from "@/content/drills";
import { REHAB } from "@/content/rehab";
import { SKILLS, SKILL_LABEL } from "@/lib/skills";

// Built here, on the server, and passed down as a flat map of phrase to href.
// Importing the catalogs into the chat component instead would drag the whole
// drill and injury libraries into the client bundle to look up a few strings.
const COACH_LINKS = buildCoachLinks({
  drills: DRILLS.map((d) => ({ name: d.name, slug: d.slug })),
  rehab: REHAB.map((e) => ({ name: e.name, slug: e.slug, also_called: e.also_called })),
  skills: SKILLS.map((s) => ({ skill: s, label: SKILL_LABEL[s] })),
});

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
      {/* THIS PAGE DOES NOT SCROLL. Every other page in the app grows and lets
          the window scroll; a chat cannot, because scrolling the window takes
          the composer away from a player mid-sentence and hides the heading
          that says where they are.

          So the section is pinned to exactly the height the layout gives it and
          clips, and the transcript inside CoachChat is the only scroller. Two
          numbers make that exact, and both come from app/(app)/layout.tsx:
            - `-mb-28 md:-mb-12` cancels main's bottom padding, which otherwise
              adds 7rem of nothing below a section that is already full height.
            - the height subtracts main's `pt-8` (2rem) on both breakpoints, and
              additionally the mobile top bar (`py-2` around a `min-h-11` link,
              so 3.75rem) which does not exist from md up.
          The tab bar is `fixed` and out of flow, so its 3.5rem plus the safe
          area is reserved as padding on the column rather than subtracted here.

          If the layout's padding or the top bar's height ever change, these
          change with them. lib/nav-contract.test.ts pins them together. */}
      <section className="mx-auto flex h-[calc(100dvh-5.75rem)] w-full max-w-5xl flex-col overflow-hidden -mb-28 md:-mb-12 md:h-[calc(100dvh-2rem)] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-x-8 xl:max-w-6xl xl:grid-cols-[15rem_minmax(0,1fr)_15rem]">
        {/* THE ONLY CHROME LEFT ABOVE THE CONVERSATION, and on a phone it is one
            row of controls rather than a title block.

            This was a gold mono eyebrow over a `text-page-title` h1 reading
            "Ask your coach", roughly 4rem at the top of a surface where the
            conversation IS the content, paid for on every visit and saying
            nothing the lit Coach tab did not already say. The h1 survives at
            label size, so the page still has a real heading to navigate to and
            a name in the column.

            The row itself now earns its height on a phone: the left control
            opens the conversation list, which before this had no way in at all
            below lg, and the right one starts a new chat, which used to sit in
            a strip of chips that cost a permanent row of its own. From lg both
            disappear, because the rail beside this holds them. */}
        <div className="flex shrink-0 items-center gap-2 lg:col-start-2 lg:pb-2">
          <CoachSessionsDrawer sessions={sessions} activeId={active?.id ?? null} />
          <h1 className="font-mono text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
            Coach
          </h1>
          <Link
            href="/coach?s=new"
            aria-label="New chat"
            className="icon-btn -mr-3 ml-auto lg:hidden"
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
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Link>
        </div>
        <CoachSessionsRail sessions={sessions} activeId={active?.id ?? null} />
        <div className="flex min-h-0 w-full max-w-2xl flex-1 flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0 lg:col-start-2 lg:mx-auto">
          <CoachChat
            key={active?.id ?? "new"}
            activeSessionId={active?.id ?? null}
            initialMessages={messages}
            links={COACH_LINKS}
          />
        </div>
      </section>
    </ViewTransition>
  );
}
