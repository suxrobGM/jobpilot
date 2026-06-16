import { createApiClient } from "@jobpilot/api-client";
import { NextResponse, type NextRequest } from "next/server";
import { isProfileEmpty } from "@/utils/profile";

const API_BASE = process.env.API_URL ?? "http://localhost:8002";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Per-request Eden client that forwards the incoming auth cookie (middleware
  // has no ambient cookie jar, so we pass it explicitly).
  const cookie = request.headers.get("cookie") ?? "";
  const api = createApiClient(API_BASE, {
    headers: cookie ? { cookie } : {},
    fetch: { cache: "no-store" },
  }).api;

  const { data, error } = await api.profile.get();

  // Not authenticated -> send to login.
  if (error?.status === 401) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (data === null || isProfileEmpty(data.profile)) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|login|register|onboarding|favicon.ico|.*\\..*).*)"],
};
