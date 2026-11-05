// Needs the dummy env block in ci.yml: importing a real controller makes `@/env` validate at load.
// Still no DB - a fake token service stands in for the session lookup.

import { Elysia } from "elysia";
import type { AuthUser } from "@/common/auth";
import { container } from "@/common/di/container";
import { errorMiddleware } from "@/common/middleware/error.middleware";
import { adminController } from "@/modules/admin/admin.controller";
import { AuthTokenService } from "@/modules/auth/auth-token.service";
import { adminBoardController } from "@/modules/job-board/admin-board.controller";
import { adminJobListingController } from "@/modules/job-listing/admin-listing.controller";
import { httpErrorResponses } from "@/types/response";
import { describe, expect, it } from "bun:test";

const USER_TOKEN = "user-session-token";
const user: AuthUser = {
  id: crypto.randomUUID(),
  role: "user",
  email: "user@example.com",
  tokenId: crypto.randomUUID(),
};
// Resolved per request by the auth middleware, so binding before the first request is enough.
container.bind({
  provide: AuthTokenService,
  useValue: {
    verify: async (raw: string) => (raw === USER_TOKEN ? user : null),
  } as unknown as AuthTokenService,
});

// Mounted exactly as app.ts does, so the paths under test are the paths that ship. Feature modules
// own their admin controllers, so mount every one here - an omitted one ships untested.
const app = new Elysia()
  .use(errorMiddleware)
  .guard({ as: "scoped", response: httpErrorResponses })
  .group("/api", (api) =>
    api.use(adminController).use(adminBoardController).use(adminJobListingController),
  );

/** Enumerated from the router, so a route added later is covered without touching this test. */
const adminRoutes = app.routes.filter((route) => route.path.startsWith("/api/admin"));

/** Fill `:params` with a well-formed uuid. The body is irrelevant - the guard runs before validation. */
function request(method: string, path: string, token?: string): Request {
  return new Request(`http://localhost${path.replace(/:[^/]+/g, crypto.randomUUID())}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: method === "GET" || method === "HEAD" ? undefined : "{}",
  });
}

describe("every /api/admin/* route is admin-guarded", () => {
  it("registers at least one admin route", () => {
    // Without this the suite would pass vacuously if the controller ever failed to mount.
    expect(adminRoutes.length).toBeGreaterThan(0);
  });

  it("403s a signed-in user on every route", async () => {
    for (const route of adminRoutes) {
      const response = await app.handle(request(route.method, route.path, USER_TOKEN));
      const label = `${route.method} ${route.path}`;
      expect({ label, status: response.status }).toEqual({ label, status: 403 });
      expect(await response.json()).toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("401s an anonymous caller on every route", async () => {
    for (const route of adminRoutes) {
      const response = await app.handle(request(route.method, route.path));
      const label = `${route.method} ${route.path}`;
      expect({ label, status: response.status }).toEqual({ label, status: 401 });
    }
  });
});
