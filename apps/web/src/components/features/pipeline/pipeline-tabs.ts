"use client";

import type { PipelineJobView } from "@jobpilot/contracts/pipeline";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { pipelineQueries } from "@/api/queries";
import { enumParam } from "@/utils/search-params";
import { usePipelineFilters } from "./pipeline-filters";

export type PipelineTab = Exclude<PipelineJobView, "needsYou"> | "applied";

export const PIPELINE_TABS: { key: PipelineTab; label: string }[] = [
  { key: "review", label: "To review" },
  { key: "inProgress", label: "In progress" },
  { key: "applied", label: "Applied" },
  { key: "notApplied", label: "Not applied" },
];

const PIPELINE_TAB_KEYS: readonly PipelineTab[] = PIPELINE_TABS.map((tab) => tab.key);

interface PipelineTabState {
  view: PipelineTab;
  /** Mounting a tab before the counts pick one fetches it, then remounts another. */
  picking: boolean;
  /** Null until the counts load. */
  count: (tab: PipelineTab) => number | null;
  /** Jobs per feed in the open tab; null on Applied, which isn't counted per feed. */
  feedCounts: Map<string, number> | null;
}

export function usePipelineTab(): PipelineTabState {
  const chosen = enumParam(PIPELINE_TAB_KEYS, useSearchParams().get("view"));
  const counts = useQuery(pipelineQueries.counts(usePipelineFilters()));
  const data = counts.data ?? null;

  const count = (tab: PipelineTab): number | null => {
    if (!data) {
      return null;
    }
    return tab === "applied" ? data.applied : data.views[tab];
  };
  // A URL that names no tab opens where the jobs are, not on an empty To review.
  const landing = PIPELINE_TAB_KEYS.find((tab) => (count(tab) ?? 0) > 0);
  const view = chosen ?? landing ?? "review";
  const feedCounts =
    data && view !== "applied"
      ? new Map(data.feeds.map((feed) => [feed.feedId, feed.views[view]]))
      : null;

  return { view, picking: chosen === null && counts.isPending, count, feedCounts };
}
