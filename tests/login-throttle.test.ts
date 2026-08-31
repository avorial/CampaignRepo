import { afterEach, describe, expect, it } from "vitest";
import { checkLogin, recordFailure, recordSuccess, MAX_ATTEMPTS, _setClock, _reset } from "@/lib/login-throttle";

afterEach(() => _reset());

const ACC = ["login:gm@example.com", "ip:203.0.113.7"];

describe("login throttle", () => {
  it("stays generous — a person fumbling their password is never locked", () => {
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      recordFailure(ACC);
      expect(checkLogin(ACC).allowed, `attempt ${i + 1}`).toBe(true);
    }
  });

  it("locks out on the configured attempt and reports a retry time", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailure(ACC);
    const gate = checkLogin(ACC);
    expect(gate.allowed).toBe(false);
    if (!gate.allowed) expect(gate.retryAfterSec).toBeGreaterThan(0);
  });

  it("a success clears the counter before the limit", () => {
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) recordFailure(ACC);
    recordSuccess(ACC);
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) recordFailure(ACC);
    expect(checkLogin(ACC).allowed).toBe(true);
  });

  it("blocks a spray across many accounts from one IP (per-IP key)", () => {
    // Different account each time, same address — the IP key still accrues.
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailure([`login:victim${i}@x.com`, "ip:198.51.100.9"]);
    expect(checkLogin(["login:fresh@x.com", "ip:198.51.100.9"]).allowed).toBe(false);
  });

  it("frees the account after the lockout window elapses", () => {
    let t = 1_000_000;
    _setClock(() => t);
    for (let i = 0; i < MAX_ATTEMPTS; i++) recordFailure(ACC);
    expect(checkLogin(ACC).allowed).toBe(false);
    t += 16 * 60 * 1000; // past the 15-minute lockout
    expect(checkLogin(ACC).allowed).toBe(true);
  });
});
