// Sanity check of the player-spotting prompt against a real frame.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const ROOT = process.cwd();
const env = await readFile(path.join(ROOT, ".env.local"), "utf8");
const client = new Anthropic({ apiKey: env.match(/ANTHROPIC_API_KEY=(.+)/)[1].trim() });
const bundle = JSON.parse(await readFile(path.join(ROOT, "ab", "trackbundle.json"), "utf8"));
const frame = bundle.cases.find((c) => c.clip === "20260719_093134.mp4").frames[0].data;

const spotSchema = z.object({
  players: z.array(z.object({ label: z.string().max(80), x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).max(6),
});

const res = await client.messages.parse(
  {
    model: "claude-opus-4-8",
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: frame } },
          {
            type: "text",
            text:
              "List the people in this frame who are clearly PLAYING volleyball and close enough to assess, most prominent first, up to six. " +
              "For each: a short physical description a user could match at a glance (kit or shirt color, distinguishing detail, where they are on the court; never a name or a guess about identity), " +
              "and the position of their torso center in normalized image coordinates (x 0 at the left edge to 1 at the right, y 0 at the top to 1 at the bottom). " +
              "Only include people you can actually see well enough to describe; distant background players and spectators are excluded. An empty list is a valid answer.",
          },
        ],
      },
    ],
    output_config: { effort: "low", format: zodOutputFormat(spotSchema) },
  },
  { maxRetries: 2 },
);
for (const p of res.parsed_output.players) {
  console.log(`(${p.x.toFixed(2)}, ${p.y.toFixed(2)})  ${p.label}`);
}
