// `limiter.ts` pulls in `@/common/errors` for `tooManyRequests`, which is env/Prisma-free, so the
// suite needs no database or env. In-memory token buckets; `Date.now()` is fine under `bun test`.

import {
  acquireSlot,
  byAgentOrUser,
  byEmail,
  byEmailAndIp,
  byIp,
  byUser,
  type RateLimitContext,
  rateLimit,
} from "./limiter";
import { describe, expect, it } from "bun:test";

const ctx = (over: Partial<RateLimitContext>): RateLimitContext => ({
  request: new Request("http://localhost/"),
  server: null,
  headers: {},
  ...over,
});

describe("rate-limit keys", () => {
  it("byIp trusts x-real-ip, then server address, then unknown", () => {
    expect(byIp(ctx({ headers: { "x-real-ip": " 1.2.3.4 " } }))).toBe("ip:1.2.3.4");
    expect(byIp(ctx({ server: { requestIP: () => ({ address: "9.9.9.9" }) } }))).toBe("ip:9.9.9.9");
    expect(byIp(ctx({}))).toBe("ip:unknown");
  });

  it("byUser keys by user id, falling back to ip when anonymous", () => {
    expect(byUser(ctx({ user: { id: "u1" }, headers: { "x-real-ip": "1.1.1.1" } }))).toBe(
      "user:u1",
    );
    expect(byUser(ctx({ headers: { "x-real-ip": "1.1.1.1" } }))).toBe("ip:1.1.1.1");
  });

  it("byAgentOrUser buckets PAT callers apart from the same user's session", () => {
    expect(byAgentOrUser(ctx({ user: { id: "u1", tokenKind: "terminal" } }))).toBe("agent:u1");
    expect(byAgentOrUser(ctx({ user: { id: "u1", tokenKind: "session" } }))).toBe("user:u1");
    expect(byAgentOrUser(ctx({ headers: { "x-real-ip": "1.1.1.1" } }))).toBe("ip:1.1.1.1");
  });

  it("byEmail lowercases and skips (null) when the email is missing or oversized", () => {
    expect(byEmail(ctx({ body: { email: "Foo@Bar.com" } }))).toBe("email:foo@bar.com");
    expect(byEmail(ctx({ body: {} }))).toBeNull();
    expect(byEmail(ctx({ body: { email: `${"a".repeat(320)}@x.co` } }))).toBeNull();
  });

  it("byEmailAndIp combines both, and skips when no email", () => {
    expect(
      byEmailAndIp(ctx({ body: { email: "a@b.com" }, headers: { "x-real-ip": "1.1.1.1" } })),
    ).toBe("email:a@b.com|ip:1.1.1.1");
    expect(byEmailAndIp(ctx({ body: {} }))).toBeNull();
  });
});

describe("rateLimit token bucket", () => {
  const caught = (fn: () => void): unknown => {
    try {
      fn();
      return undefined;
    } catch (e) {
      return e;
    }
  };

  it("allows up to the limit, then throws 429 with a Retry-After", () => {
    const hook = rateLimit({ limit: 2, windowMs: 60_000, key: byIp });
    const c = ctx({ headers: { "x-real-ip": "5.5.5.5" } });
    hook(c);
    hook(c);
    const err = caught(() => hook(c));
    expect(err).toMatchObject({ status: 429, code: "RATE_LIMITED" });
    expect(
      Number((err as { headers?: Record<string, string> }).headers?.["retry-after"]),
    ).toBeGreaterThan(0);
  });

  it("buckets each key independently", () => {
    const hook = rateLimit({ limit: 1, windowMs: 60_000, key: byIp });
    hook(ctx({ headers: { "x-real-ip": "1.1.1.1" } }));
    // A different IP has its own full bucket.
    expect(caught(() => hook(ctx({ headers: { "x-real-ip": "2.2.2.2" } })))).toBeUndefined();
  });

  it("keeps an agent's bucket intact while the user's own bucket drains", () => {
    const hook = rateLimit({ limit: 1, windowMs: 60_000, key: byAgentOrUser });
    hook(ctx({ user: { id: "u1", tokenKind: "session" } }));
    expect(caught(() => hook(ctx({ user: { id: "u1", tokenKind: "session" } })))).toMatchObject({
      status: 429,
    });
    expect(caught(() => hook(ctx({ user: { id: "u1", tokenKind: "terminal" } })))).toBeUndefined();
  });

  it("honours the burst knob above the sustained limit", () => {
    const hook = rateLimit({ limit: 1, windowMs: 1000, burst: 3, key: byIp });
    const c = ctx({ headers: { "x-real-ip": "7.7.7.7" } });
    hook(c);
    hook(c);
    hook(c);
    expect(caught(() => hook(c))).toMatchObject({ status: 429 });
  });

  it("skips the check entirely when the key resolves to null", () => {
    const hook = rateLimit({ limit: 1, windowMs: 1000, key: byEmail });
    const c = ctx({ body: {} });
    hook(c);
    // No email -> null key -> never throttled, however many times it is called.
    expect(caught(() => hook(c))).toBeUndefined();
  });
});

describe("acquireSlot", () => {
  it("caps concurrent in-flight work per key", () => {
    const r1 = acquireSlot("cap", 2);
    const r2 = acquireSlot("cap", 2);
    expect(() => acquireSlot("cap", 2)).toThrow();
    r1();
    // One released -> a slot is free again.
    const r3 = acquireSlot("cap", 2);
    r2();
    r3();
  });

  it("has an idempotent release that never frees another holder's slot", () => {
    const r1 = acquireSlot("idem", 2);
    const r2 = acquireSlot("idem", 2);
    r1();
    r1(); // second call must be a no-op, not a decrement of r2's slot
    // r2 still holds one slot, so a max-1 acquire must be rejected.
    expect(() => acquireSlot("idem", 1)).toThrow();
    r2();
  });
});
