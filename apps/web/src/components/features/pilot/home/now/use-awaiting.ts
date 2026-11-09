"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";

export type Awaiting = "reply" | "request";

/** What the user asked that the pilot hasn't started: an unanswered message, or a queued request. */
export function useAwaiting(): Awaiting | null {
  const newest = useInfiniteQuery(pilotQueries.thread()).data?.pages[0]?.items ?? [];
  const unanswered = newest.some(
    (item) =>
      item.type === "message" && item.message.author === "user" && item.message.answeredAt === null,
  );
  if (unanswered) {
    return "reply";
  }
  const queued = newest.some(
    (item) => item.type === "request" && item.request.status === "pending",
  );
  return queued ? "request" : null;
}
