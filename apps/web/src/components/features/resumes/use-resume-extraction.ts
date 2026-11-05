"use client";

import type { ResumeData } from "@jobpilot/contracts/resume";
import { resumeChannel } from "@jobpilot/contracts/sse";
import { useQuery } from "@tanstack/react-query";
import { resumeQueries } from "@/api/queries";
import { useSseChannel } from "@/lib/sse/client";

/** Covers the race where the agent's PUT lands before the EventSource subscription is up. */
const POLL_MS = 2_000;

interface ResumeExtraction {
  /** Non-null once the agent has written structured fields. */
  content: ResumeData | null;
}

/** Watches a resume until `extract-resume` writes its fields. Shared with onboarding. */
export function useResumeExtraction(resumeId: string | null, enabled: boolean): ResumeExtraction {
  const active = enabled && resumeId !== null;

  const resume = useQuery({
    ...resumeQueries.detail(resumeId ?? ""),
    enabled: active,
    refetchInterval: POLL_MS,
  });

  useSseChannel(
    resumeChannel,
    { resumeId: resumeId ?? "" },
    { enabled: active, on: { "content.updated": () => void resume.refetch() } },
  );

  return { content: resume.data?.content ?? null };
}
