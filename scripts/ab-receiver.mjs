// Receives the browser-built A/B bundle and writes it to disk.
// The bundle is megabytes of base64 frames, which is impractical to move
// through the page's DOM, so the export page POSTs it here instead.
import { createServer } from "node:http";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "ab");
await mkdir(OUT, { recursive: true });

createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  if (req.method !== "POST") return res.writeHead(405).end();
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const name = req.url === "/trackbundle" ? "trackbundle.json" : "bundle.json";
  const file = path.join(OUT, name);
  await writeFile(file, body);
  console.log(`wrote ${file} (${(body.length / 1048576).toFixed(1)} MB)`);
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, bytes: body.length }));
}).listen(8900, () => console.log("receiver on :8900"));
