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
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { useAgent } from "@/providers/agent-provider";
import { UPWORK_DOMAIN } from "../constants";
import { ApplyFields } from "./apply-fields";
import { AutoApplyFields } from "./auto-apply-fields";
import { CampaignBasicsFields } from "./campaign-basics-fields";
import {
  buildCreateCampaignRequest,
  buildSkillArg,
  type CampaignMode,
  COMPOSER_DEFAULT_VALUES,
  composerFormSchema,
  SUBMIT_LABELS,
} from "./form-config";
import { NetworkingFields } from "./networking-fields";

interface CampaignComposerProps {
  /** Preselect a board (e.g. from /campaigns/new?board=upwork.com). */
  defaultBoard?: string;
  /** Preselect a mode (e.g. from /campaigns/new?source=apply). */
  defaultMode?: CampaignMode;
}

export function CampaignComposer(props: CampaignComposerProps): ReactElement {
  const { defaultBoard, defaultMode } = props;
  const router = useRouter();
  const agent = useAgent();

  const boardsQuery = useApiQuery(jobBoardQueries.list());
  const profileQuery = useApiQuery(userQueries.detail());
  const recentCampaignsQuery = useApiQuery(campaignQueries.list());

  const createCampaign = useApiMutation<CampaignDto, CreateCampaignRequest>(
    (body) => api.campaigns.post(body),
    { invalidate: [queryKeys.campaigns.all] },
  );

  const boards = boardsQuery.data ?? [];
  const resumes = profileQuery.data?.resumes ?? [];
  const recentQueries = Array.from(
    new Set((recentCampaignsQuery.data?.items ?? []).map((r) => r.query)),
  ).slice(0, 5);
  const hasBoards = boards.length > 0;
  const hasResumes = resumes.length > 0;

  const presetBoard =
    defaultBoard && boards.some((b) => b.domain === defaultBoard) ? defaultBoard : undefined;

  const form = useAppForm({
    defaultValues: {
      ...COMPOSER_DEFAULT_VALUES,
      mode: defaultMode ?? COMPOSER_DEFAULT_VALUES.mode,
      board: presetBoard ?? boards[0]?.domain ?? "",
      resumeId: resumes.find((r) => r.isPrimary)?.id ?? resumes[0]?.id ?? "",
      minScore: profileQuery.data?.autoApply?.minMatchScore ?? COMPOSER_DEFAULT_VALUES.minScore,
    },
    validators: { onSubmit: composerFormSchema },
    onSubmit: async ({ value }) => {
      // Upwork always runs the dedicated search skill; apply never sources from a board,
      // so a stale board value must not hijack it into a search campaign.
      const upwork = value.mode !== "apply" && value.board === UPWORK_DOMAIN;
      const effective = upwork ? { ...value, mode: "search" as const } : value;
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
  const isUpwork = !isApply && board === UPWORK_DOMAIN;
  const isNetworking = mode === "networking";

  // Upwork has no auto-apply/networking path - pin the mode to search.
  useEffect(() => {
    if (isUpwork && mode !== "search") {
      form.setFieldValue("mode", "search");
    }
  }, [isUpwork, mode, form]);

  if (boardsQuery.isLoading || profileQuery.isLoading) {
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
          {mode === "auto-apply" && <AutoApplyFields form={form} />}
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
                    (!isApply && !hasResumes) ||
                    (!isApply && !hasBoards && !isNetworking) ||
                    !canSubmit ||
                    isSubmitting
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
