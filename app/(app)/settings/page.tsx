import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { DeleteAccount } from "@/components/delete-account";
import { PlanCard } from "@/components/plan-card";
import { Reveal } from "@/components/motion";
import { isPlan, type Plan } from "@/lib/plans";
import {
  ANALYZE_DISCIPLINES,
  DISCIPLINE_LABEL,
  disciplineGroup,
  type Discipline,
} from "@/lib/skills";
import {
  FREQUENCY_OPTIONS,
  LEVEL_OPTIONS,
  POSITION_OPTIONS,
  type PlayFrequency,
  type Position,
} from "@/lib/funnel";
import type { Level } from "@/lib/skills";
import { logout } from "@/app/(auth)/actions";
import { setTrainingConsent, updateProfile } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
  description: "Account, coaching level, player profile, and privacy.",
};

type ProfileRow = {
  display_name: string | null;
  discipline: Discipline;
  level: Level | null;
  position: Position | null;
  play_frequency: PlayFrequency | null;
  training_consent: boolean | null;
  plan: string | null;
};

export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const supabase = await createClient();
  const { checkout } = await searchParams;
  const userId = await getAuthUserId(supabase);
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const email = authUser?.email ?? null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "display_name, discipline, level, position, play_frequency, training_consent, plan",
    )
    .eq("id", userId!)
    .single();
  if (error) throw error;
  const profile = data as ProfileRow;

  // A plan string this build cannot name falls back to the free card, the same
  // direction lib/plans.ts fails: never show a player a larger entitlement than
  // the reservation will actually honour.
  const plan: Plan = isPlan(profile.plan) ? profile.plan : "free";

  // The checkout route returns the payer to /settings?checkout=complete#plan.
  // Until the provider's webhook lands, the stored plan still reads free, and a
  // card that keeps offering Upgrade in that window invites a second checkout
  // session, and with it a second customer record (D-064's read-then-act race,
  // but with real money attached). The marker holds the card in a waiting state
  // instead. Once the plan reads pro the marker is spent and ignored.
  const checkoutPending = checkout === "complete" && plan !== "pro";

  // Legacy 'beach' profiles light up the "Grass & sand" chip: the two wire
  // values are one environment everywhere the player sees it (D-035).
  const activeDiscipline = (d: Discipline) =>
    disciplineGroup(d) === disciplineGroup(profile.discipline);

  return (
    <section className="max-w-5xl">
      <Reveal>
        <div className="border-b border-line pb-5">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-gold">
            Settings
          </p>
          <h1 className="mt-2 font-display text-page-title">
            Your game, your way.
          </h1>
        </div>
      </Reveal>

      <div className="mt-6 space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
      <Reveal delay={60}>
        <div className="card p-5">
          <h2 className="font-display font-bold">Account</h2>
          <form action={updateProfile} className="mt-3">
            <label
              htmlFor="display_name"
              className="font-mono text-[10px] uppercase tracking-wide text-chalk-dim"
            >
              Display name
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="display_name"
                name="display_name"
                defaultValue={profile.display_name ?? ""}
                maxLength={40}
                required
                className="input-field min-h-11 flex-1"
                autoComplete="name"
              />
              <button type="submit" className="btn-ghost min-h-11 px-4 text-sm">
                Save
              </button>
            </div>
          </form>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-chalk-dim">{email ?? "Signed in"}</p>
            <form action={logout}>
              <button type="submit" className="btn-ghost min-h-11 px-4 text-sm">
                Sign out
              </button>
            </form>
          </div>
          <DeleteAccount />
        </div>
      </Reveal>

      <Reveal delay={120}>
        <PlanCard plan={plan} checkoutPending={checkoutPending} />
      </Reveal>

      <Reveal delay={180}>
        <div className="card p-5">
          <h2 className="font-display font-bold">Player profile</h2>
          <p className="mt-1 text-xs text-chalk-dim">
            Where and how you usually play. New film starts from these.
          </p>

          {/* Each chip row is a named group: on its own, a button reading
              "Indoor" or "Setter" arrives with no statement of what it sets. */}
          <p
            id="settings-environment"
            className="mt-4 font-mono text-[10px] uppercase tracking-wide text-chalk-dim"
          >
            Environment
          </p>
          <form
            action={updateProfile}
            role="group"
            aria-labelledby="settings-environment"
            className="mt-2 flex flex-wrap gap-2"
          >
            {ANALYZE_DISCIPLINES.map((d) => (
              <button
                key={d}
                type="submit"
                name="discipline"
                value={d}
                aria-pressed={activeDiscipline(d)}
                className={`chip min-h-11 ${activeDiscipline(d) ? "chip-active" : ""}`}
              >
                {DISCIPLINE_LABEL[d]}
              </button>
            ))}
          </form>

          {/* The level was set once at onboarding and then frozen, while it
              drives assignment difficulty, the plan seed and the coaching
              voice. A player who levels up should not need a new account for
              the coaching to notice. */}
          <p
            id="settings-level"
            className="mt-4 font-mono text-[10px] uppercase tracking-wide text-chalk-dim"
          >
            Coaching level
          </p>
          <form
            action={updateProfile}
            role="group"
            aria-labelledby="settings-level"
            className="mt-2 flex flex-wrap gap-2"
          >
            {LEVEL_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="submit"
                name="level"
                value={value}
                aria-pressed={profile.level === value}
                className={`chip min-h-11 ${profile.level === value ? "chip-active" : ""}`}
              >
                {label}
              </button>
            ))}
          </form>

          <p
            id="settings-position"
            className="mt-4 font-mono text-[10px] uppercase tracking-wide text-chalk-dim"
          >
            Position
          </p>
          <form
            action={updateProfile}
            role="group"
            aria-labelledby="settings-position"
            className="mt-2 flex flex-wrap gap-2"
          >
            {POSITION_OPTIONS[profile.discipline].map(({ value, label }) => (
              <button
                key={value}
                type="submit"
                name="position"
                value={value}
                aria-pressed={profile.position === value}
                className={`chip min-h-11 ${profile.position === value ? "chip-active" : ""}`}
              >
                {label}
              </button>
            ))}
          </form>

          <p
            id="settings-frequency"
            className="mt-4 font-mono text-[10px] uppercase tracking-wide text-chalk-dim"
          >
            How often you play
          </p>
          <form
            action={updateProfile}
            role="group"
            aria-labelledby="settings-frequency"
            className="mt-2 flex flex-wrap gap-2"
          >
            {FREQUENCY_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="submit"
                name="play_frequency"
                value={value}
                aria-pressed={profile.play_frequency === value}
                className={`chip min-h-11 ${profile.play_frequency === value ? "chip-active" : ""}`}
              >
                {label}
              </button>
            ))}
          </form>
        </div>
      </Reveal>

      <Reveal delay={240}>
        <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="min-w-0 max-w-md">
            <h2 id="settings-consent" className="font-display font-bold">
              Improve future analysis
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-chalk-dim">
              Allow your clips and frames to help train future analysis
              features. Footage stays private to your account either way.
            </p>
          </div>
          <form action={setTrainingConsent}>
            <input
              type="hidden"
              name="allow"
              value={profile.training_consent ? "false" : "true"}
            />
            {/* Named from the card title: "Allowed" on its own does not say
                what was allowed. */}
            <button
              type="submit"
              aria-pressed={!!profile.training_consent}
              aria-describedby="settings-consent"
              className={`chip min-h-11 ${profile.training_consent ? "chip-active" : ""}`}
            >
              {profile.training_consent ? "Allowed" : "Not allowed"}
            </button>
          </form>
        </div>
      </Reveal>
      </div>

    </section>
  );
}
