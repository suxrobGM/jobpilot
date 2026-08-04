import { applyUrlsSchema, type CampaignSource, MAX_APPLY_URLS } from "@jobpilot/contracts/campaign";
import { z } from "zod/v4";
import type { CreateCampaignRequest } from "@/api/types";
import { buildCliArgs } from "@/utils/cli-args";
import { UPWORK_DOMAIN } from "../constants";

/** Splits pasted text on whitespace/commas and dedupes - shared by validation and submit. */
export function parseUrls(raw: string): string[] {
  return [...new Set(raw.split(/[\s,]+/).filter(Boolean))];
}

function hostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    // Unparseable URLs already failed form validation; skip rather than crash.
    return null;
  }
}

/** First two distinct hostnames from a batch of pasted URLs, for a readable fallback campaign name. */
export function deriveApplyQuery(urls: string[]): string {
  const hosts = [...new Set(urls.map(hostname).filter((h) => h !== null))];
  if (hosts.length === 0) {
    return "Pasted links";
  }
  const rest = hosts.length - 2;
  const shown = hosts.slice(0, 2).join(", ");
  return rest > 0 ? `Pasted links: ${shown} +${rest} more` : `Pasted links: ${shown}`;
}

export const composerFormSchema = z
  .object({
    mode: z.enum(["search", "auto-apply", "networking", "apply"]),
    query: z.string().trim(),
    board: z.string(),
    // Base resume to score/tailor against; apply tailors per pasted job, so none up front.
    resumeId: z.string(),
    minScore: z.number().int().min(0).max(100),
    maxApps: z.union([z.number().int().min(1).max(500), z.null(), z.undefined()]),
    // Empty = unlimited (search until the board is exhausted), mirroring maxApps.
    maxJobs: z.union([z.number().int().min(1), z.null(), z.undefined()]),
    // Networking campaign settings (mode === "networking").
    channels: z.array(z.enum(["email", "linkedin"])),
    linkedinTier: z.enum(["free", "premium"]),
    autonomy: z.enum(["draft", "review", "auto"]),
    dailyCap: z.number().int().min(1).max(100),
    // Apply campaign settings (mode === "apply").
    urlsText: z.string(),
    applyLabel: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "apply") {
      if (!applyUrlsSchema.safeParse(parseUrls(v.urlsText)).success) {
        ctx.addIssue({
          code: "custom",
          message: `Add 1-${MAX_APPLY_URLS} job links.`,
          path: ["urlsText"],
        });
      }
      return;
    }
    if (v.query.trim().length < 2) {
      ctx.addIssue({ code: "custom", message: "Enter a query", path: ["query"] });
    }
    if (!v.resumeId) {
      ctx.addIssue({ code: "custom", message: "Select a resume", path: ["resumeId"] });
    }
    // Board is required for search/auto-apply; for networking it is optional (the
    // control between board-grounded and criteria-only discovery).
    if (v.mode !== "networking" && !v.board) {
      ctx.addIssue({ code: "custom", message: "Pick a board", path: ["board"] });
    }
    if (v.mode === "networking" && v.channels.length === 0) {
      ctx.addIssue({ code: "custom", message: "Pick at least one channel", path: ["channels"] });
    }
  });

export type CampaignMode = Extract<
  CampaignSource,
  "search" | "auto-apply" | "networking" | "apply"
>;
export type ComposerFormValues = z.infer<typeof composerFormSchema>;

export const UPWORK_MODE_DESCRIPTION =
  "JobPilot searches Upwork, filters out low-quality and unresponsive clients, and ranks the rest by fit. Review the recommendations, then draft a proposal per job - you submit on Upwork yourself.";

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
  urlsText: "",
  applyLabel: "",
};

function hasMaxApps(
  values: ComposerFormValues,
): values is ComposerFormValues & { maxApps: number } {
  return values.maxApps != null && Number.isFinite(values.maxApps);
}

function hasMaxJobs(
  values: ComposerFormValues,
): values is ComposerFormValues & { maxJobs: number } {
  return values.maxJobs != null && Number.isFinite(values.maxJobs);
}

/**
 * Whether the composer is set up to run Upwork's dedicated search skill. Apply never sources from
 * a board, so a board value left over from another mode must not hijack it into an Upwork search.
 */
export function isUpworkSearch(values: Pick<ComposerFormValues, "mode" | "board">): boolean {
  return values.mode !== "apply" && values.board === UPWORK_DOMAIN;
}

/** Whether a networking campaign has a board picked (board-grounded vs criteria-only). */
export function isBoardSelected(board: string): boolean {
  return board.trim() !== "";
}

export function buildCampaignConfig(values: ComposerFormValues): CreateCampaignRequest["config"] {
  if (values.mode === "networking") {
    // A selected board grounds networking in real openings; the optional cap
    // (reusing the maxApps field) maps to config.maxJobs - omit it to run until
    // the user stops. No board → criteria-only discovery.
    const searchesBoard = isBoardSelected(values.board);
    return {
      ...(searchesBoard ? { board: values.board } : {}),
      ...(searchesBoard && hasMaxApps(values) ? { maxJobs: values.maxApps } : {}),
      networking: {
        channels: values.channels,
        ...(values.channels.includes("linkedin") ? { linkedinTier: values.linkedinTier } : {}),
        autonomy: values.autonomy,
        ...(values.autonomy === "auto" ? { dailyCap: values.dailyCap } : {}),
      },
    };
  }
  if (values.mode !== "auto-apply") {
    // Omit maxJobs when empty so the search runs unlimited.
    return { board: values.board, ...(hasMaxJobs(values) ? { maxJobs: values.maxJobs } : {}) };
  }
  return {
    board: values.board,
    minScore: values.minScore,
    ...(hasMaxApps(values) ? { maxApplications: values.maxApps } : {}),
  };
}

/** Builds the campaigns POST body per mode - apply skips search config entirely. */
export function buildCreateCampaignRequest(values: ComposerFormValues): CreateCampaignRequest {
  if (values.mode === "apply") {
    const urls = parseUrls(values.urlsText);
    const label = values.applyLabel.trim();
    return {
      query: label || deriveApplyQuery(urls),
      source: "apply",
      config: {},
      urls,
      createdBy: "user",
    };
  }
  return {
    query: values.query.trim(),
    source: values.mode,
    // resumeId is campaign-wide (mandatory for search/auto-apply/networking), not mode-specific.
    config: { resumeId: values.resumeId, ...buildCampaignConfig(values) },
    createdBy: "user",
  };
}

export function buildSkillArg(values: ComposerFormValues, campaignId: string): string {
  if (values.mode === "apply") {
    // The apply skill looks the campaign up by id rather than taking search flags.
    return buildCliArgs({ positional: ["campaign", campaignId] });
  }
  if (values.mode === "networking") {
    // The skill reads channels/tier/autonomy from the campaign's config.networking.
    return buildCliArgs({ positional: [values.query.trim()], flags: { campaign: campaignId } });
  }
  return buildCliArgs({
    positional: [values.query.trim()],
    flags: {
      board: values.board,
      "min-score": values.mode === "auto-apply" ? values.minScore : undefined,
      "max-apps": values.mode === "auto-apply" && hasMaxApps(values) ? values.maxApps : undefined,
      "max-jobs": values.mode === "search" && hasMaxJobs(values) ? values.maxJobs : undefined,
      // Search saves results onto this campaign; pass the id the UI just created so
      // the skill doesn't have to rediscover it.
      campaign: values.mode === "search" || values.mode === "auto-apply" ? campaignId : undefined,
    },
  });
}

export const SUBMIT_LABELS: Record<CampaignMode, string> = {
  search: "Start search",
  "auto-apply": "Start auto-apply",
  networking: "Start networking",
  apply: "Apply to links",
};

export const MODE_DESCRIPTIONS: Record<CampaignMode, string> = {
  search:
    "Search a board and score matches in the selected board - nothing is sent. Review the ranked list yourself.",
  "auto-apply":
    "Search, score, then auto-submit applications to matches above your score threshold in the selected board.",
  networking:
    "Find hiring managers or recruiters and message them directly. Pick a board to ground networking in real openings, or none to reach by criteria.",
  apply:
    "Already found the jobs yourself? Paste the links and the agent reviews fit, tailors your resume, and applies to each.",
};
