import { PIPELINE_JOB_VIEWS, type PipelineJobView } from "@jobpilot/contracts/pipeline";

export type PipelineTab = PipelineJobView | "applied";

export const PIPELINE_TABS: { key: PipelineTab; label: string }[] = [
  { key: "found", label: "Found" },
  { key: "toApply", label: "To apply" },
  { key: "applied", label: "Applied" },
  { key: "needsYou", label: "Needs you" },
  { key: "skipped", label: "Skipped" },
  { key: "failed", label: "Failed" },
];

export const PIPELINE_TAB_KEYS: readonly PipelineTab[] = [...PIPELINE_JOB_VIEWS, "applied"];
