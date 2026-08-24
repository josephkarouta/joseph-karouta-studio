"use client";

export {};

type GenerationRequestRecord = {
  key: string;
  createdAt: number;
};

const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export async function generationFetch(
  input: RequestInfo | URL,
  init: RequestInit,
  identity: { scope: string; payload: unknown },
) {
  const storageKey = `heyy:generation:${safeSegment(identity.scope)}:${hash(stableSerialize(identity.payload))}`;
  const record = readOrCreate(storageKey);
  const headers = new Headers(init.headers);
  headers.set("Idempotency-Key", record.key);

  // Keep the key if the network response is lost. A retry after refresh will
  // then receive the original durable job instead of reserving again.
  const response = await fetch(input, { ...init, headers });
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Storage can be unavailable in strict privacy modes; server-side active
    // job deduplication still protects concurrent requests.
  }
  return response;
}

function readOrCreate(storageKey: string): GenerationRequestRecord {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GenerationRequestRecord>;
      if (
        typeof parsed.key === "string" &&
        parsed.key.length > 0 &&
        typeof parsed.createdAt === "number" &&
        Date.now() - parsed.createdAt < MAX_AGE_MS
      ) {
        return { key: parsed.key, createdAt: parsed.createdAt };
      }
    }
  } catch {
    // Fall through to an in-memory request key.
  }

  const record = {
    key: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
  };
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(record));
  } catch {
    // The request can proceed without persistent browser storage.
  }
  return record;
}

function safeSegment(value: string) {
  return String(value || "generation")
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .slice(0, 80);
}

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}
