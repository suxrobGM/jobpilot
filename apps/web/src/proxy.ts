import { createApiClient } from "@jobpilot/api-client";
import { type NextRequest, NextResponse } from "next/server";
import { API_ORIGIN } from "@/api/base-url";
import { isAdminRole } from "@/lib/roles";
import { isOnboardingIncomplete } from "@/utils/onboarding";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // The landing page stays reachable signed in - asking for it is not a wrong turn.
  // Checked before /me so the busiest public page costs no auth round trip.
  if (request.nextUrl.pathname === "/") return NextResponse.next();

  // Per-request Eden client that forwards the incoming auth cookie
  const cookie = request.headers.get("cookie") ?? "";
  const { api } = createApiClient(API_ORIGIN, {
    headers: cookie ? { cookie } : {},
    fetch: { cache: "no-store" },
  });

  // One flat object carries the verified flag, role, and profile fields
  const { data, error } = await api.auth.me.get();

  // Not authenticated -> send to login.
  if (error || data === null) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Profile not filled in -> onboarding.
  if (isOnboardingIncomplete(data)) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // The /me call above already carried the role, so gating /admin here is free
  if (request.nextUrl.pathname.startsWith("/admin") && !isAdminRole(data.role)) {
    return NextResponse.redirect(new URL("/workspace", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|docs|install|jobs|leaderboard|u/|login|register|onboarding|verify-email|forgot-password|reset-password|confirm-email-change|opengraph-image|apple-icon|favicon.ico|.*\\..*).*)",
  ],
};
