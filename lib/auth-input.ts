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
