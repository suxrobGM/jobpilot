import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { err, ErrorCodes } from "@/lib/api";
import { parseQueryParams } from "@/lib/api/request";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/email";

export async function GET(req: Request) {
  const { code, state, error } = parseQueryParams(req, ["code", "state", "error"] as const);

  if (error) {
    return err(ErrorCodes.UNPROCESSABLE, `OAuth error: ${error}`, 400);
  }
  if (!code || !state) {
    return err(ErrorCodes.INVALID_REQUEST, "Missing code or state", 400);
  }

  const jar = await cookies();
  const expectedState = jar.get("email_oauth_state")?.value;
  const providerName = jar.get("email_oauth_provider")?.value ?? "gmail";
  if (!expectedState || expectedState !== state) {
    return err(ErrorCodes.INVALID_REQUEST, "OAuth state mismatch", 400);
  }

  const provider = getProvider(providerName);
  const { tokens, email } = await provider.exchangeCode(code);

  await db.emailAccount.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      provider: providerName,
      email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      tokenExpiresAt: tokens.expiresAt ?? null,
      scope: tokens.scope ?? null,
    },
    update: {
      provider: providerName,
      email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      tokenExpiresAt: tokens.expiresAt ?? null,
      scope: tokens.scope ?? null,
    },
  });

  const res = NextResponse.redirect(new URL("/inbox", req.url));
  res.cookies.delete("email_oauth_state");
  res.cookies.delete("email_oauth_provider");
  return res;
}
