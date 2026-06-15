import { ApiTokenCreateSchema, LoginSchema, RegisterSchema } from "@jobpilot/contracts";
import { Elysia } from "elysia";
import { z } from "zod/v4";
import { container } from "@/common/di";
import { authGuard } from "@/common/middleware";
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from "./auth.cookies";
import { AuthService } from "./auth.service";

const authService = container.resolve(AuthService);
const IdParam = z.object({ id: z.coerce.number().int() });

export const authController = new Elysia({ prefix: "/auth", detail: { tags: ["Auth"] } })
  // --- public ---
  .post(
    "/register",
    async ({ body, cookie }) => {
      const result = await authService.register(body);
      setAuthCookies(cookie, result.accessToken, result.refreshToken);
      return result;
    },
    { body: RegisterSchema },
  )
  .post(
    "/login",
    async ({ body, cookie }) => {
      const result = await authService.login(body);
      setAuthCookies(cookie, result.accessToken, result.refreshToken);
      return result;
    },
    { body: LoginSchema },
  )
  .post("/refresh", async ({ cookie }) => {
    const raw = cookie[REFRESH_COOKIE]?.value;
    const result = await authService.rotateRefresh(typeof raw === "string" ? raw : "");
    setAuthCookies(cookie, result.accessToken, result.refreshToken);
    return result;
  })
  .post("/logout", async ({ cookie }) => {
    const raw = cookie[REFRESH_COOKIE]?.value;
    await authService.logout(typeof raw === "string" ? raw : "");
    clearAuthCookies(cookie);
    return { ok: true };
  })
  // --- authenticated ---
  .use(authGuard)
  .get("/me", ({ user }) => authService.me(user.id))
  .get("/tokens", ({ user }) => authService.listApiTokens(user.id))
  .post("/tokens", ({ user, body }) => authService.mintApiToken(user.id, body), {
    body: ApiTokenCreateSchema,
  })
  .delete("/tokens/:id", ({ user, params }) => authService.revokeApiToken(user.id, params.id), {
    params: IdParam,
  });
