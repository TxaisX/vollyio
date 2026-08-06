import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().max(254).email(),
  password: z.string().min(1).max(128),
});

// Two fields, both of them things the account genuinely cannot exist without.
//
// `display_name` used to be here and used to be the FIRST thing on the form,
// which made a two-field signup read as a three-field one. It is collected in
// the onboarding flow instead, where it costs nothing because the player is
// already answering questions.
//
// `terms` used to be a required checkbox. Consent is now given by submitting
// the form, disclosed immediately above the button, and still recorded on the
// account as `terms_accepted_at`. Dropping the assent LINE would have been a
// legal change; dropping the extra tap is a layout one.
const signupSchema = loginSchema.extend({
  password: z.string().min(8).max(128),
});

const forgotSchema = loginSchema.pick({ email: true });

// Both fields are required and must agree. The player is typing a password for
// an account they are, by definition, currently locked out of, so a typo they
// cannot see would lock them out a second time with no way to tell why.
const resetSchema = z
  .object({
    password: z.string().min(8).max(128),
    confirm: z.string().min(8).max(128),
  })
  .refine((value) => value.password === value.confirm, {
    path: ["confirm"],
  });

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function parseLoginInput(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: text(formData, "email"),
    password: text(formData, "password"),
  });
  if (!parsed.success) return parsed;
  return {
    success: true as const,
    data: { ...parsed.data, email: parsed.data.email.toLowerCase() },
  };
}

export function parseForgotInput(formData: FormData) {
  const parsed = forgotSchema.safeParse({ email: text(formData, "email") });
  if (!parsed.success) return parsed;
  return {
    success: true as const,
    data: { email: parsed.data.email.toLowerCase() },
  };
}

export function parseResetInput(formData: FormData) {
  return resetSchema.safeParse({
    password: text(formData, "password"),
    confirm: text(formData, "confirm"),
  });
}

export function parseSignupInput(formData: FormData) {
  const parsed = signupSchema.safeParse({
    email: text(formData, "email"),
    password: text(formData, "password"),
  });
  if (!parsed.success) return parsed;
  return {
    success: true as const,
    data: { ...parsed.data, email: parsed.data.email.toLowerCase() },
  };
}
