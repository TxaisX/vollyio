import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-4-8";

let cached: Anthropic | null = null;

export function coach(): Anthropic {
  if (!cached) {
    cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cached;
}
