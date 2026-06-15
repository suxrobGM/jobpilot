import { NextResponse, type NextRequest } from "next/server";
import type { ProfileResponse } from "@/api/types";
import { isProfileEmpty } from "@/utils/profile";

const API_BASE = process.env.API_PROXY_TARGET ?? "http://localhost:8002";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const cookie = request.headers.get("cookie") ?? "";
  const res = await fetch(`${API_BASE}/api/profile`, {
    headers: cookie ? { cookie } : {},
    cache: "no-store",
  });

  // Not authenticated -> send to login.
  if (res.status === 401) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const data = res.ok ? ((await res.json()) as ProfileResponse) : null;
  if (data === null || data.profile === null || isProfileEmpty(data.profile)) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|login|register|onboarding|favicon.ico|.*\\..*).*)"],
};
