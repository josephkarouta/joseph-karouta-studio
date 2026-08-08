import "server-only";

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

export function assertRateLimit(key: string, limit = 8, windowMs = 60_000) {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (existing.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    throw new Error(`Too many AI requests. Try again in ${retryAfter} seconds.`);
  }

  existing.count += 1;
}
