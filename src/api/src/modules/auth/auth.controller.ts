import { ApiTokenCreateSchema, LoginSchema, RegisterSchema } from "@jobpilot/contracts";
import { Elysia } from "elysia";
import { z } from "zod/v4";
import { authGuard } from "@/common/middleware";
import * as auth from "@/domain/auth";
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from "./auth.cookies";

const IdParam = z.object({ id: z.coerce.number().int() });

export const authController = new Elysia({ prefix: "/auth", detail: { tags: ["Auth"] } })
  // --- public ---
  .post(
    "/register",
    async ({ body, cookie }) => {
      const result = await auth.register(body);
      setAuthCookies(cookie, result.accessToken, result.refreshToken);
      return result;
    },
    { body: RegisterSchema },
  )
  .post(
    "/login",
    async ({ body, cookie }) => {
      const result = await auth.login(body);
      setAuthCookies(cookie, result.accessToken, result.refreshToken);
      return result;
    },
    { body: LoginSchema },
  )
  .post("/refresh", async ({ cookie }) => {
    const raw = cookie[REFRESH_COOKIE]?.value;
    const result = await auth.rotateRefresh(typeof raw === "string" ? raw : "");
    setAuthCookies(cookie, result.accessToken, result.refreshToken);
    return result;
  })
  .post("/logout", async ({ cookie }) => {
    const raw = cookie[REFRESH_COOKIE]?.value;
    await auth.logout(typeof raw === "string" ? raw : "");
    clearAuthCookies(cookie);
    return { ok: true };
  })
  // --- authenticated ---
  .use(authGuard)
  .get("/me", ({ user }) => auth.me(user.id))
  .get("/tokens", ({ user }) => auth.listApiTokens(user.id))
  .post("/tokens", ({ user, body }) => auth.mintApiToken(user.id, body), {
    body: ApiTokenCreateSchema,
  })
  .delete("/tokens/:id", ({ user, params }) => auth.revokeApiToken(user.id, params.id), {
    params: IdParam,
  });
