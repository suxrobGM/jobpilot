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
export function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = parseVersion(latest);
  const currentParts = parseVersion(current);
  for (let i = 0; i < 3; i++) {
    const diff = (latestParts[i] ?? 0) - (currentParts[i] ?? 0);
    if (diff !== 0) {
      return diff > 0;
    }
  }
  return false;
}

async function fetchLatestVersion(): Promise<string | null> {
  const response = await fetch(RELEASES_URL, {
    headers: { accept: "application/vnd.github+json" },
  });
  if (!response.ok) {
    return null;
  }
  const releases = (await response.json()) as GitHubRelease[];
  const versions = releases
    .map((release) => release.tag_name)
    .filter((tag) => tag.startsWith(TAG_PREFIX))
    .map((tag) => tag.slice(TAG_PREFIX.length));
  return versions.length > 0
    ? versions.reduce((max, version) => (isNewerVersion(version, max) ? version : max))
    : null;
}

/** Cached an hour: the agent drawer remounts every time it opens, and anonymous GitHub allows 60 requests an hour. */
export function useLatestVersion(): string | null {
  const query = useQuery({
    queryKey: ["github", "latest-release"],
    queryFn: fetchLatestVersion,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  return query.data ?? null;
}
