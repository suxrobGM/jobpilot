"use client";

import { useQuery } from "@tanstack/react-query";
import { RELEASES_URL } from "@/components/features/install/install-commands";

const TAG_PREFIX = "v";

interface GitHubRelease {
  tag_name: string;
}

function parseVersion(value: string): number[] {
  return value.split(".").map((part) => Number.parseInt(part, 10) || 0);
}

/** True when `latest` is a strictly higher semver than `current`. */
export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  for (let i = 0; i < 3; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) {
      return diff > 0;
    }
  }
  return false;
}

async function fetchLatestRelease(): Promise<string | null> {
  const res = await fetch(RELEASES_URL, { headers: { accept: "application/vnd.github+json" } });
  if (!res.ok) {
    return null;
  }
  const releases = (await res.json()) as GitHubRelease[];
  const versions = releases
    .map((r) => r.tag_name)
    .filter((tag) => tag.startsWith(TAG_PREFIX))
    .map((tag) => tag.slice(TAG_PREFIX.length));
  return versions.length > 0 ? versions.reduce((max, v) => (isNewer(v, max) ? v : max)) : null;
}

/**
 * Highest published terminal release on GitHub; null until fetched, or when offline or
 * rate-limited (no banner then). Cached for an hour: the dock remounts on every expand, and the
 * unauthenticated GitHub API allows 60 requests an hour.
 */
export function useLatestRelease(): string | null {
  const query = useQuery({
    queryKey: ["github", "latest-release"],
    queryFn: fetchLatestRelease,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  return query.data ?? null;
}
