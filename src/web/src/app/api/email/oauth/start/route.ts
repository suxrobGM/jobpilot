import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { err, ErrorCodes } from "@/lib/api";
import { parseQueryParams } from "@/lib/api/request";
import { getProvider } from "@/lib/email";

export async function GET(req: Request) {
  const { provider } = parseQueryParams(req, ["provider"] as const);
  const providerName = provider ?? "gmail";

  if (providerName !== "gmail") {
    return err(ErrorCodes.INVALID_REQUEST, `Unsupported provider: ${providerName}`, 400);
  }

  let authorizeUrl: string;
  const state = randomBytes(16).toString("hex");
  try {
    authorizeUrl = getProvider(providerName).getAuthorizeUrl(state);
  } catch (e) {
    return err(
      ErrorCodes.UNPROCESSABLE,
      e instanceof Error ? e.message : "Email provider unavailable",
      400,
    );
  }

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set("email_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/api/email/oauth",
    maxAge: 600,
  });
  res.cookies.set("email_oauth_provider", providerName, {
    httpOnly: true,
    sameSite: "lax",
    path: "/api/email/oauth",
    maxAge: 600,
  });
  return res;
}
