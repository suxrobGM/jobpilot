// Pure error factories - no env/Prisma. Imported directly from the module file.

import { tooManyRequests } from "./http.error";
import { describe, expect, it } from "bun:test";

describe("tooManyRequests", () => {
  it("puts the retry hint on both the body details and the Retry-After header", () => {
    const err = tooManyRequests("slow down", 42);
    expect(err).toMatchObject({ code: "RATE_LIMITED", status: 429 });
    // Cross-origin browsers can't read the header unless CORS exposes it, so the body carries it too.
    expect(err.details).toEqual({ retryAfterSeconds: 42 });
    expect(err.headers).toEqual({ "retry-after": "42" });
  });
});
