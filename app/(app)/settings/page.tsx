import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/supabase/user";
import { DeleteAccount } from "@/components/delete-account";
import { Reveal } from "@/components/motion";
import {
  ANALYZE_DISCIPLINES,
  DISCIPLINE_LABEL,
  disciplineGroup,
  type Discipline,
} from "@/lib/skills";
import {
  FREQUENCY_OPTIONS,
  POSITION_OPTIONS,
  type PlayFrequency,
  type Position,
} from "@/lib/funnel";
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
  position: Position | null;
  play_frequency: PlayFrequency | null;
  training_consent: boolean | null;
};

export default async function Settings() {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const email = authUser?.email ?? null;

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, discipline, position, play_frequency, training_consent")
    .eq("id", userId!)
    .single();
  if (error) throw error;
  const profile = data as ProfileRow;

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
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            Your game, your way.
          </h1>
        </div>
      </Reveal>

      <div className="mt-6 space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
      <Reveal delay={60}>
        <div className="card p-5">
          <p className="font-display font-bold">Account</p>
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

      <Reveal delay={180}>
        <div className="card p-5">
          <p className="font-display font-bold">Player profile</p>
          <p className="mt-1 text-xs text-chalk-dim">
            Where and how you usually play. New film starts from these.
          </p>

          <p className="mt-4 font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
            Environment
          </p>
          <form action={updateProfile} className="mt-2 flex flex-wrap gap-2">
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

          <p className="mt-4 font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
            Position
          </p>
          <form action={updateProfile} className="mt-2 flex flex-wrap gap-2">
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

          <p className="mt-4 font-mono text-[10px] uppercase tracking-wide text-chalk-dim">
            How often you play
          </p>
          <form action={updateProfile} className="mt-2 flex flex-wrap gap-2">
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
            <p className="font-display font-bold">Improve future analysis</p>
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
            <button
              type="submit"
              aria-pressed={!!profile.training_consent}
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
