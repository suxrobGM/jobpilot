import type { PipelineJobView } from "@jobpilot/contracts/pipeline";

export type PipelineTab = Exclude<PipelineJobView, "needsYou"> | "applied";

export const PIPELINE_TABS: { key: PipelineTab; label: string }[] = [
  { key: "review", label: "To review" },
  { key: "inProgress", label: "In progress" },
  { key: "applied", label: "Applied" },
  { key: "notApplied", label: "Not applied" },
];

export const PIPELINE_TAB_KEYS: readonly PipelineTab[] = PIPELINE_TABS.map((tab) => tab.key);
