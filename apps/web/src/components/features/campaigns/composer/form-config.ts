import type { CampaignSource } from "@jobpilot/contracts/campaign";
import { z } from "zod/v4";
import type { CreateCampaignRequest } from "@/api/types";
import { buildCliArgs } from "@/utils/cli-args";
import { slugify } from "@/utils/slug";

export const composerFormSchema = z
  .object({
    mode: z.enum(["search", "auto-apply", "outreach"]),
    query: z.string().trim().min(2, "Enter a query"),
    board: z.string(),
    // Base resume the campaign scores and tailors against (mandatory, all modes).
    resumeId: z.string().min(1, "Select a resume"),
    minScore: z.number().int().min(0).max(100),
    maxApps: z.union([z.number().int().min(1).max(500), z.null(), z.undefined()]),
    maxJobs: z.number().int().min(1).max(100),
    // Outreach campaign settings (mode === "outreach").
    channels: z.array(z.enum(["email", "linkedin"])),
    linkedinTier: z.enum(["free", "premium"]),
    autonomy: z.enum(["draft", "review", "auto"]),
    dailyCap: z.number().int().min(1).max(100),
  })
  .superRefine((v, ctx) => {
    // Board is required for search/auto-apply; for outreach it is optional (the
    // control between board-grounded and criteria-only discovery).
    if (v.mode !== "outreach" && !v.board) {
      ctx.addIssue({ code: "custom", message: "Pick a board", path: ["board"] });
    }
    if (v.mode === "outreach" && v.channels.length === 0) {
      ctx.addIssue({ code: "custom", message: "Pick at least one channel", path: ["channels"] });
    }
  });

export type CampaignMode = Extract<CampaignSource, "search" | "auto-apply" | "outreach">;
export type ComposerFormValues = z.infer<typeof composerFormSchema>;

/** Upwork is recommend-only — searched + scored, never auto-submitted. */
export const UPWORK_DOMAIN = "upwork.com";
export const UPWORK_MODE_DESCRIPTION =
  "JobPilot searches Upwork, filters out low-quality and unresponsive clients, and ranks the rest by fit. Review the recommendations, then draft a proposal per job — you submit on Upwork yourself.";

/**
 * Static defaults shared by the parent `useAppForm` and the `withForm` field
 * groups so their form types line up. The parent overlays runtime values
 * (first board, profile min-score) before mounting.
 */
export const COMPOSER_DEFAULT_VALUES: ComposerFormValues = {
  mode: "auto-apply",
  query: "",
  board: "",
  resumeId: "",
  minScore: 60,
  maxApps: null,
  maxJobs: 15,
  channels: ["email", "linkedin"],
  linkedinTier: "free",
  autonomy: "draft",
  dailyCap: 20,
};

export function makeCampaignId(query: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").replace(/Z$/, "");
  return `${ts}_${slugify(query, { maxLength: 40, fallback: "campaign" })}`;
}

function hasMaxApps(
  values: ComposerFormValues,
): values is ComposerFormValues & { maxApps: number } {
  return values.maxApps != null && Number.isFinite(values.maxApps);
}

/** Whether an outreach campaign has a board picked (board-grounded vs criteria-only). */
export function isBoardSelected(board: string): boolean {
  return board.trim() !== "";
}

export function buildCampaignConfig(values: ComposerFormValues): CreateCampaignRequest["config"] {
  if (values.mode === "outreach") {
    // A selected board grounds outreach in real openings; the optional cap
    // (reusing the maxApps field) maps to config.maxJobs — omit it to run until
    // the user stops. No board → criteria-only discovery.
    const searchesBoard = isBoardSelected(values.board);
    return {
      ...(searchesBoard ? { board: values.board } : {}),
      ...(searchesBoard && hasMaxApps(values) ? { maxJobs: values.maxApps } : {}),
      outreach: {
        channels: values.channels,
        ...(values.channels.includes("linkedin") ? { linkedinTier: values.linkedinTier } : {}),
        autonomy: values.autonomy,
        ...(values.autonomy === "auto" ? { dailyCap: values.dailyCap } : {}),
      },
    };
  }
  if (values.mode !== "auto-apply") {
    return { board: values.board, maxJobs: values.maxJobs };
  }
  return {
    board: values.board,
    minScore: values.minScore,
    ...(hasMaxApps(values) ? { maxApplications: values.maxApps } : {}),
  };
}

export function buildSkillArg(values: ComposerFormValues, campaignId: string): string {
  if (values.mode === "outreach") {
    // The skill reads channels/tier/autonomy from the campaign's config.outreach.
    return buildCliArgs({ positional: [values.query.trim()], flags: { campaign: campaignId } });
  }
  return buildCliArgs({
    positional: [values.query.trim()],
    flags: {
      board: values.board,
      "min-score": values.mode === "auto-apply" ? values.minScore : undefined,
      "max-apps": values.mode === "auto-apply" && hasMaxApps(values) ? values.maxApps : undefined,
      "max-jobs": values.mode === "search" ? values.maxJobs : undefined,
      // Search saves results onto this campaign; pass the id the UI just created so
      // the skill doesn't have to rediscover it.
      campaign: values.mode === "search" || values.mode === "auto-apply" ? campaignId : undefined,
    },
  });
}

export const SUBMIT_LABELS: Record<CampaignMode, string> = {
  search: "Start search",
  "auto-apply": "Start auto-apply",
  outreach: "Start outreach",
};

export const MODE_DESCRIPTIONS: Record<CampaignMode, string> = {
  search:
    "Search a board and score matches in the selected board - nothing is sent. Review the ranked list yourself.",
  "auto-apply":
    "Search, score, then auto-submit applications to matches above your score threshold in the selected board.",
  outreach:
    "Find hiring managers or recruiters and message them directly. Pick a board to ground outreach in real openings, or none to reach by criteria.",
};
