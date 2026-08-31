/**
 * In-process brute-force throttle for the login route.
 *
 * The app runs as a single Node process (better-sqlite3, one container), so an
 * in-memory limiter is sufficient and matches the other in-process schedulers.
 * The threshold is deliberately generous — a real person fat-fingering their
 * password should never hit it; only automated guessing does.
 *
 * Attempts are counted per account AND per client IP, so neither hammering one
 * account nor spraying many accounts from one address slips through.
 */

export const MAX_ATTEMPTS = 20;
/** Rolling window in which failures accumulate. */
const WINDOW_MS = 15 * 60 * 1000;
/** How long a key is locked out once it trips the limit. */
const LOCKOUT_MS = 15 * 60 * 1000;

type Entry = { fails: number; firstAt: number; lockedUntil: number };

const store = new Map<string, Entry>();

/** Injected clock so tests can advance time deterministically. */
let now = () => Date.now();
export function _setClock(fn: () => number) { now = fn; }
export function _reset() { store.clear(); now = () => Date.now(); }

function live(key: string): Entry | undefined {
  const e = store.get(key);
  if (!e) return undefined;
  // Drop a stale window unless the key is actively locked.
  if (e.lockedUntil <= now() && now() - e.firstAt > WINDOW_MS) {
    store.delete(key);
    return undefined;
  }
  return e;
}

export type ThrottleResult = { allowed: true } | { allowed: false; retryAfterSec: number };

/** Check every key (account + IP); block if any is currently locked out. */
export function checkLogin(keys: string[]): ThrottleResult {
  let retryAfter = 0;
  for (const key of keys) {
    const e = live(key);
    if (e && e.lockedUntil > now()) retryAfter = Math.max(retryAfter, e.lockedUntil - now());
  }
  return retryAfter > 0 ? { allowed: false, retryAfterSec: Math.ceil(retryAfter / 1000) } : { allowed: true };
}

/** Record a failed attempt against every key, locking any that trip the limit. */
export function recordFailure(keys: string[]): void {
  for (const key of keys) {
    const e = live(key) || { fails: 0, firstAt: now(), lockedUntil: 0 };
    e.fails += 1;
    if (e.fails >= MAX_ATTEMPTS) {
      e.lockedUntil = now() + LOCKOUT_MS;
      e.fails = 0;
      e.firstAt = now();
    }
    store.set(key, e);
  }
}

/** Clear all keys on a successful login. */
export function recordSuccess(keys: string[]): void {
  for (const key of keys) store.delete(key);
}

/** Best-effort client IP from proxy headers, for use as a throttle key. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}
