import type { Cookie } from "elysia";
import { durationToMs } from "@/common/auth";
import { env } from "@/env";

/**
 * Dual-mode auth cookies. The backend returns tokens in the response body (the
 * agent reads them) and also sets these httpOnly cookies so the web app
 * authenticates without exposing tokens to JS. authGuard prefers the Bearer
 * header, then falls back to the `accessToken` cookie.
 */
type CookieJar = Record<string, Cookie<unknown>>;

const ACCESS_COOKIE = "accessToken";
export const REFRESH_COOKIE = "refreshToken";
const REFRESH_PATH = "/api/auth";

const isProduction = env.NODE_ENV === "production";
const accessMaxAge = Math.floor(durationToMs(env.JWT_EXPIRY, 15 * 60_000) / 1000);
const refreshMaxAge = Math.floor(durationToMs(env.REFRESH_TOKEN_EXPIRY, 30 * 86_400_000) / 1000);

export function setAuthCookies(cookie: CookieJar, accessToken: string, refreshToken: string): void {
  cookie[ACCESS_COOKIE]!.set({
    value: accessToken,
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: accessMaxAge,
  });
  cookie[REFRESH_COOKIE]!.set({
    value: refreshToken,
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: REFRESH_PATH,
    maxAge: refreshMaxAge,
  });
}

export function clearAuthCookies(cookie: CookieJar): void {
  cookie[ACCESS_COOKIE]!.set({ value: "", httpOnly: true, sameSite: "lax", secure: isProduction, path: "/", maxAge: 0 });
  cookie[REFRESH_COOKIE]!.set({ value: "", httpOnly: true, sameSite: "lax", secure: isProduction, path: REFRESH_PATH, maxAge: 0 });
}
