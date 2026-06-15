import type { ApiTokenCreateInput, LoginInput, RegisterInput } from "@jobpilot/contracts";
import type { AuthUser } from "@/common/auth";
import {
  durationToMs,
  generateOpaqueToken,
  hashPassword,
  hashToken,
  signAccessToken,
  verifyPassword,
} from "@/common/auth";
import { db } from "@/common/database";
import { conflict, notFound, unauthorized } from "@/common/errors";
import { env } from "@/env";
import type { User } from "@/generated/prisma/client";

const REFRESH_TTL_MS = durationToMs(env.REFRESH_TOKEN_EXPIRY, 30 * 86_400_000);

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function principal(user: User): AuthUser {
  return { id: user.id, role: user.role, email: user.email };
}

function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
}

/** Mint an access JWT + a persisted (hashed) rotating refresh token. */
async function issueTokens(user: User): Promise<TokenPair> {
  const accessToken = await signAccessToken(principal(user));
  const refreshToken = generateOpaqueToken();
  await db.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput) {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw conflict("Email already registered");
  }
  const passwordHash = await hashPassword(input.password);
  // Co-create the 1:1 profile (empty; onboarding populates it via PUT /api/profile)
  // so profileGuard always resolves for a registered user.
  const user = await db.user.create({
    data: {
      email: input.email,
      passwordHash,
      profile: { create: { firstName: "", lastName: "", email: input.email } },
    },
  });
  const tokens = await issueTokens(user);
  return { user: publicUser(user), ...tokens };
}

export async function login(input: LoginInput) {
  const user = await db.user.findUnique({ where: { email: input.email } });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw unauthorized("Invalid email or password");
  }
  const tokens = await issueTokens(user);
  return { user: publicUser(user), ...tokens };
}

/** Validate + rotate a refresh token; revoke the old one. */
export async function rotateRefresh(rawRefresh: string) {
  if (!rawRefresh) {
    throw unauthorized("Missing refresh token");
  }
  const record = await db.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawRefresh) },
  });
  if (!record || record.revokedAt || record.expiresAt < new Date()) {
    throw unauthorized("Invalid or expired refresh token");
  }
  const user = await db.user.findUnique({ where: { id: record.userId } });
  if (!user) {
    throw unauthorized("Invalid refresh token");
  }
  await db.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });
  const tokens = await issueTokens(user);
  return { user: publicUser(user), ...tokens };
}

export async function logout(rawRefresh: string): Promise<void> {
  if (!rawRefresh) {
    return;
  }
  await db.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawRefresh), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function me(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user) {
    throw notFound("User not found");
  }
  return { user: publicUser(user), profile: user.profile };
}

// --- Agent personal access tokens (PATs) ---

export async function mintApiToken(userId: string, input: ApiTokenCreateInput) {
  const raw = generateOpaqueToken();
  const created = await db.apiToken.create({
    data: { userId, name: input.name, tokenHash: hashToken(raw) },
  });
  // The raw token is shown exactly once — the terminal stores it.
  return { id: created.id, name: created.name, token: raw, createdAt: created.createdAt };
}

export function listApiTokens(userId: string) {
  return db.apiToken.findMany({
    where: { userId, revokedAt: null },
    select: { id: true, name: true, lastUsedAt: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeApiToken(userId: string, id: number): Promise<{ ok: true }> {
  const token = await db.apiToken.findFirst({ where: { id, userId } });
  if (!token) {
    throw notFound("Token not found");
  }
  await db.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
  return { ok: true };
}

/** Used by authGuard: resolve a PAT to its user, bumping lastUsedAt. */
export async function verifyApiToken(raw: string): Promise<AuthUser | null> {
  const record = await db.apiToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!record || record.revokedAt || (record.expiresAt && record.expiresAt < new Date())) {
    return null;
  }
  void db.apiToken
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return principal(record.user);
}
