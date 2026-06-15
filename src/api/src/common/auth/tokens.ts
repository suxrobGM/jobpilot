import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/env";
import type { AuthUser } from "./types";

const secret = new TextEncoder().encode(env.JWT_SECRET);

/** Sign a short-lived access JWT for the web client. */
export function signAccessToken(user: AuthUser): Promise<string> {
  return new SignJWT({ role: user.role, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRY)
    .sign(secret);
}

/** Verify an access JWT. Returns the principal, or null if invalid/expired. */
export async function verifyAccessToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) {
      return null;
    }
    return {
      id: payload.sub,
      role: typeof payload.role === "string" ? payload.role : "USER",
      email: typeof payload.email === "string" ? payload.email : "",
    };
  } catch {
    // Invalid signature / expiry / malformed — treated as unauthenticated.
    return null;
  }
}

/** Opaque token (refresh / agent PAT). Only its hash is ever persisted. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Parse a duration like "15m" / "30d" / "3600s" into milliseconds. */
export function durationToMs(value: string, fallbackMs: number): number {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) {
    return fallbackMs;
  }
  const amount = Number(match[1]);
  const unit = match[2] as "s" | "m" | "h" | "d";
  const perUnit = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return amount * perUnit;
}
