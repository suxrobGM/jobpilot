"use client";

import { type ReactElement, useEffect } from "react";
import { Button, LinearProgress, Stack } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { campaignQueries, jobBoardQueries, userQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import type { CampaignDto, CreateCampaignRequest } from "@/api/types";
import { useLinkBoard } from "@/components/features/boards/use-link-board";
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { useAgent } from "@/providers/agent-provider";
import { ApplyFields } from "./apply-fields";
import { AutoApplyFields } from "./auto-apply-fields";
import { CampaignBasicsFields } from "./campaign-basics-fields";
import {
  type BoardOption,
  buildCreateCampaignRequest,
  buildSkillArg,
  COMPOSER_DEFAULT_VALUES,
  composerFormSchema,
  isUpworkSearch,
  SUBMIT_LABELS,
} from "./form-config";
import { NetworkingFields } from "./networking-fields";

interface CampaignComposerProps {
  /** Preselect a board (e.g. from /campaigns/new?board=upwork.com). */
  defaultBoard?: string;
}

export function CampaignComposer(props: CampaignComposerProps): ReactElement {
  const { defaultBoard } = props;
  const router = useRouter();
  const agent = useAgent();

  const boardsQuery = useApiQuery(jobBoardQueries.list());
  const profileQuery = useApiQuery(userQueries.detail());
  const recentCampaignsQuery = useApiQuery(campaignQueries.list());

  const linkedBoards = boardsQuery.data ?? [];

  // Upwork is picker-only, so /upwork's "Find jobs" presets a board most profiles have not
  // linked. Offer it from the catalog instead of falling back to the first linked board.
  const catalogQuery = useApiQuery(jobBoardQueries.catalog(), {
    enabled: Boolean(defaultBoard),
    // Admin-curated seed data, so a per-mount refetch buys nothing.
    staleTime: 10 * 60_000,
  });

  const createCampaign = useApiMutation<CampaignDto, CreateCampaignRequest>(
    (body) => api.campaigns.post(body),
    { invalidate: [queryKeys.campaigns.all] },
  );

  const linkBoard = useLinkBoard();

  // The catalog lists only boards this profile has not linked, so a hit here is always unlinked.
  const presetCatalogBoard = (catalogQuery.data ?? []).find((b) => b.domain === defaultBoard);

  const boards: BoardOption[] = presetCatalogBoard
    ? [...linkedBoards, presetCatalogBoard]
    : linkedBoards;

  const resumes = profileQuery.data?.resumes ?? [];
  const recentQueries = Array.from(
    new Set((recentCampaignsQuery.data?.items ?? []).map((r) => r.query)),
  ).slice(0, 5);
  const hasBoards = boards.length > 0;
  const hasResumes = resumes.length > 0;

  const presetBoard = boards.find((b) => b.domain === defaultBoard)?.domain;

  /** Skills read the board off the profile's own list, so adopt a catalog board before running one. */
  const adoptBoard = async (domain: string): Promise<boolean> => {
    if (presetCatalogBoard?.domain !== domain) {
      return true;
    }
    try {
      await linkBoard.mutateAsync({ domain });
      return true;
    } catch {
      // The mutation already toasted the failure; keep the form filled in so the user can retry.
      return false;
    }
  };

  const form = useAppForm({
    defaultValues: {
      ...COMPOSER_DEFAULT_VALUES,
      board: presetBoard ?? boards[0]?.domain ?? "",
      resumeId: resumes.find((r) => r.isPrimary)?.id ?? resumes[0]?.id ?? "",
      minScore: profileQuery.data?.autoApply?.minMatchScore ?? COMPOSER_DEFAULT_VALUES.minScore,
    },
    validators: { onSubmit: composerFormSchema },
    onSubmit: async ({ value }) => {
      const upwork = isUpworkSearch(value);
      const effective = upwork ? { ...value, mode: "search" as const } : value;
      if (!(await adoptBoard(effective.board))) {
        return;
      }
      const campaign = await createCampaign.mutateAsync(buildCreateCampaignRequest(effective));
      const campaignId = campaign.campaignId;
      router.push(`/campaigns/${encodeURIComponent(campaignId)}`);
      void agent.injectSkill(
        upwork ? "upwork-search" : effective.mode,
        buildSkillArg(effective, campaignId),
      );
    },
  });

  const mode = useSelector(form.store, (s) => s.values.mode);
  const board = useSelector(form.store, (s) => s.values.board);
  const isApply = mode === "apply";
  const isUpwork = isUpworkSearch({ mode, board });
  const isNetworking = mode === "networking";

  // Upwork has no auto-apply/networking path - pin the mode to search.
  useEffect(() => {
    if (isUpwork && mode !== "search") {
      form.setFieldValue("mode", "search");
    }
  }, [isUpwork, mode, form]);

  if (boardsQuery.isLoading || catalogQuery.isLoading || profileQuery.isLoading) {
    return <LinearProgress />;
  }

  return (
    <SectionCard>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <Stack spacing={2.5}>
          <CampaignBasicsFields
            form={form}
            boards={boards}
            resumes={resumes}
            recentQueries={recentQueries}
          />

          {mode === "search" && (
            <form.AppField name="maxJobs">
              {(field) => (
                <field.TextField
                  label="Jobs to search"
                  type="number"
                  helperText="How many results to rank. Leave empty for unlimited."
                  slotProps={{ htmlInput: { min: 1, step: 1 } }}
                />
              )}
            </form.AppField>
          )}
          {mode === "auto_apply" && <AutoApplyFields form={form} />}
          {mode === "networking" && <NetworkingFields form={form} />}
          {mode === "apply" && <ApplyFields form={form} />}

          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
            <Button onClick={() => router.back()}>Cancel</Button>
            <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  variant="contained"
                  disabled={
                    !canSubmit ||
                    isSubmitting ||
                    // Apply needs neither prerequisite: it takes pasted links and tailors per job.
                    (!isApply && (!hasResumes || (!hasBoards && !isNetworking)))
                  }
                >
                  {isUpwork ? "Find Upwork jobs" : SUBMIT_LABELS[mode]}
                </Button>
              )}
            </form.Subscribe>
          </Stack>
        </Stack>
      </form>
    </SectionCard>
  );
}
