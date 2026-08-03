import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().max(254).email(),
  password: z.string().min(1).max(128),
});

const signupSchema = loginSchema.extend({
  display_name: z.string().trim().max(80),
  password: z.string().min(8).max(128),
  terms: z.literal(true),
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
    display_name: text(formData, "display_name"),
    email: text(formData, "email"),
    password: text(formData, "password"),
    terms: formData.get("terms") === "on",
  });
  if (!parsed.success) return parsed;
  return {
    success: true as const,
    data: { ...parsed.data, email: parsed.data.email.toLowerCase() },
  };
}
