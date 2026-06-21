import { createApiClient } from "@jobpilot/api-client";
import { NextResponse, type NextRequest } from "next/server";
import { isProfileEmpty } from "@/utils/profile";

const API_BASE = process.env.API_URL ?? "http://localhost:8002";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Per-request Eden client that forwards the incoming auth cookie (middleware
  // has no ambient cookie jar, so we pass it explicitly).
  const cookie = request.headers.get("cookie") ?? "";
  const { api } = createApiClient(API_BASE, {
    headers: cookie ? { cookie } : {},
    fetch: { cache: "no-store" },
  });

  // One call yields both the verified flag and the profile (auth rides the cookie).
  const { data, error } = await api.auth.me.get();

  // Not authenticated -> send to login.
  if (error || data === null) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Authenticated but unverified -> gate at verify-email until they confirm.
  if (!data.user.emailVerified) {
    return NextResponse.redirect(new URL("/verify-email", request.url));
  }

  // Verified but profile not filled in -> onboarding.
  if (data.profile === null || isProfileEmpty(data.profile)) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next|login|register|onboarding|verify-email|forgot-password|reset-password|favicon.ico|.*\\..*).*)",
  ],
};
