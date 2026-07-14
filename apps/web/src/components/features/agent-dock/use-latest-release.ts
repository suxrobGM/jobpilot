"use client";

import { useEffect, useState } from "react";
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
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/** Highest published terminal release version on GitHub; null until fetched (or when offline/rate-limited). */
export function useLatestRelease(): string | null {
  const [latest, setLatest] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const check = async (): Promise<void> => {
      try {
        const res = await fetch(RELEASES_URL, {
          headers: { accept: "application/vnd.github+json" },
        });

        if (!res.ok) {
          return;
        }

        const releases = (await res.json()) as GitHubRelease[];
        const versions = releases
          .map((r) => r.tag_name)
          .filter((tag) => tag.startsWith(TAG_PREFIX))
          .map((tag) => tag.slice(TAG_PREFIX.length));

        if (active && versions.length > 0) {
          setLatest(versions.reduce((max, v) => (isNewer(v, max) ? v : max)));
        }
      } catch {
        // offline or rate-limited - no banner
        console.warn("Failed to check for agent updates");
      }
    };

    void check();
    return () => {
      active = false;
    };
  }, []);

  return latest;
}
