// Fetches a pinned model (hosted as fixed-size parts), reassembles it,
// verifies its sha256 against the manifest, and caches the verified whole in
// the Cache API so each device downloads a model once. Worker-compatible
// (no DOM). A hash mismatch is treated as a failed load, never served.

import type { ModelSpec } from "./rtm/model-manifest.ts";

const CACHE_NAME = "pose-models-v1";

export type FetchProgress = (loadedBytes: number, totalBytes: number) => void;

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function readChunk(
  url: string,
  onBytes: (delta: number) => void,
): Promise<Uint8Array[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`model fetch failed: ${response.status}`);
  if (!response.body) {
    const whole = new Uint8Array(await response.arrayBuffer());
    onBytes(whole.byteLength);
    return [whole];
  }
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    onBytes(value.byteLength);
  }
  return parts;
}

export async function fetchModel(
  chunkUrls: string[],
  spec: ModelSpec,
  onProgress?: FetchProgress,
): Promise<Uint8Array> {
  const cacheKey = chunkUrls[0];
  let cache: Cache | null = null;
  try {
    cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(cacheKey);
    if (hit) {
      const bytes = new Uint8Array(await hit.arrayBuffer());
      // Cached copies were verified before being stored; re-checking size is
      // a cheap guard against truncated writes.
      if (bytes.byteLength === spec.bytes) {
        onProgress?.(spec.bytes, spec.bytes);
        return bytes;
      }
      await cache.delete(cacheKey);
    }
  } catch {
    cache = null;
  }

  let loaded = 0;
  const parts: Uint8Array[] = [];
  for (const url of chunkUrls) {
    const chunkParts = await readChunk(url, (delta) => {
      loaded += delta;
      onProgress?.(Math.min(loaded, spec.bytes), spec.bytes);
    });
    parts.push(...chunkParts);
  }
  if (loaded !== spec.bytes) {
    throw new Error(`model size mismatch: ${loaded} != ${spec.bytes}`);
  }
  const whole = new Uint8Array(spec.bytes);
  let offset = 0;
  for (const part of parts) {
    whole.set(part, offset);
    offset += part.byteLength;
  }
  const hash = await sha256Hex(whole);
  if (hash !== spec.sha256) {
    throw new Error("model hash mismatch");
  }
  if (cache) {
    try {
      await cache.put(
        cacheKey,
        new Response(whole.slice().buffer, {
          headers: { "Content-Type": "application/octet-stream" },
        }),
      );
    } catch {
      // Cache quota failures are non-fatal; the model still loads this session.
    }
  }
  onProgress?.(spec.bytes, spec.bytes);
  return whole;
}
