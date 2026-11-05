import { createApiClient } from "@jobpilot/api-client";
import { type NextRequest, NextResponse } from "next/server";
import { API_ORIGIN } from "@/api/base-url";
import { clientIpHeader } from "@/api/client-ip";
import { isAdminRole } from "@/lib/roles";
import { isOnboardingIncomplete } from "@/utils/onboarding";

const PUBLIC_DETAIL_PATH = /^\/(?<kind>jobs|u)\/(?<id>[^/]+)$/;

function apiWith(headers: Record<string, string>) {
  return createApiClient(API_ORIGIN, { headers, fetch: { cache: "no-store" } }).api;
}

function redirect(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url));
}

/**
 * The page sends its PPR shell, and a 200, before it can call `notFound()`, which Google reports
 * as a soft 404. The proxy is the only place that runs before the status goes out.
 */
async function checkPublicDetail(request: NextRequest, kind: string, id: string) {
  const api = apiWith(clientIpHeader(request.headers));
  const key = decodeURIComponent(id);
  const { status } =
    kind === "jobs"
      ? await api.public.jobs({ slug: key }).exists.get()
      : await api.public.portfolios({ username: key }).exists.get();

  // Only a definite 404: a 429 or an API blip must not get a live page deindexed.
  return status === 404 ? NextResponse.rewrite(new URL("/404", request.url)) : NextResponse.next();
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  // Open to everyone, and the busiest page, so it skips the /me round trip.
  if (pathname === "/") {
    return NextResponse.next();
  }

  const detail = PUBLIC_DETAIL_PATH.exec(pathname)?.groups;
  if (detail) {
    return checkPublicDetail(request, detail.kind, detail.id);
  }

  const cookie = request.headers.get("cookie");
  const { data, error } = await apiWith(cookie ? { cookie } : {}).auth.me.get();
  if (error || data === null) {
    return redirect(request, "/login");
  }
  if (isOnboardingIncomplete(data)) {
    return redirect(request, "/onboarding");
  }
  if (pathname.startsWith("/admin") && !isAdminRole(data.role)) {
    return redirect(request, "/pilot");
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/jobs/:slug",
    "/u/:username",
    "/((?!_next|docs|install|jobs|leaderboard|u/|login|register|onboarding|verify-email|forgot-password|reset-password|confirm-email-change|opengraph-image|apple-icon|favicon.ico|.*\\..*).*)",
  ],
};
