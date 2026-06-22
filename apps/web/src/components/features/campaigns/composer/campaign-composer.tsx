"use client";

import { useEffect, type ReactElement } from "react";
import { Button, LinearProgress, Stack } from "@mui/material";
import { useStore } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { CampaignDto, CreateCampaignRequest, JobBoardDto, ProfileResponse } from "@/api/types";
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { useAgent } from "@/providers/agent-provider";
import { AutoApplyFields } from "./auto-apply-fields";
import { CampaignBasicsFields } from "./campaign-basics-fields";
import {
  buildCampaignConfig,
  buildSkillArg,
  COMPOSER_DEFAULT_VALUES,
  composerFormSchema,
  makeCampaignId,
  SUBMIT_LABELS,
  UPWORK_DOMAIN,
} from "./form-config";
import { OutreachFields } from "./outreach-fields";
import { SearchFields } from "./search-fields";

interface CampaignComposerProps {
  /** Preselect a board (e.g. from /campaigns/new?board=upwork.com). */
  defaultBoard?: string;
}

export function CampaignComposer(props: CampaignComposerProps): ReactElement {
  const { defaultBoard } = props;
  const router = useRouter();
  const agent = useAgent();

  const boardsQuery = useApiQuery<JobBoardDto[]>(queryKeys.jobBoards.list(), () =>
    api["job-boards"].get(),
  );
  const profileQuery = useApiQuery<ProfileResponse>(queryKeys.profile.detail(), () =>
    api.profile.get(),
  );
  const recentCampaignsQuery = useApiQuery<CampaignDto[]>(queryKeys.campaigns.list(), () =>
    api.campaigns.get(),
  );

  const createCampaign = useApiMutation<unknown, CreateCampaignRequest>(
    (body) => api.campaigns.post(body),
    { invalidate: [queryKeys.campaigns.all] },
  );

  const boards = boardsQuery.data ?? [];
  const resumes = profileQuery.data?.resumes ?? [];
  const recentQueries = Array.from(
    new Set((recentCampaignsQuery.data ?? []).map((r) => r.query)),
  ).slice(0, 5);
  const hasBoards = boards.length > 0;
  const hasResumes = resumes.length > 0;

  const presetBoard =
    defaultBoard && boards.some((b) => b.domain === defaultBoard) ? defaultBoard : undefined;

  const form = useAppForm({
    defaultValues: {
      ...COMPOSER_DEFAULT_VALUES,
      board: presetBoard ?? boards[0]?.domain ?? "",
      resumeId: resumes.find((r) => r.isPrimary)?.id ?? resumes[0]?.id ?? "",
      minScore: profileQuery.data?.autoApply?.minMatchScore ?? COMPOSER_DEFAULT_VALUES.minScore,
    },
    validators: { onSubmit: composerFormSchema },
    onSubmit: async ({ value }) => {
      // Upwork is recommend-only: it runs a search campaign driven by the
      // dedicated upwork-search skill regardless of the toggle.
      const upwork = value.board === UPWORK_DOMAIN;
      const effective = upwork ? { ...value, mode: "search" as const } : value;
      const campaignId = makeCampaignId(value.query);
      await createCampaign.mutateAsync({
        campaignId,
        query: value.query.trim(),
        source: effective.mode,
        // resumeId is campaign-wide (mandatory for every mode), not mode-specific.
        config: { resumeId: effective.resumeId, ...buildCampaignConfig(effective) },
      });
      router.push(`/campaigns/${encodeURIComponent(campaignId)}`);
      void agent.injectSkill(
        upwork ? "upwork-search" : effective.mode,
        buildSkillArg(effective, campaignId),
      );
    },
  });

  const mode = useStore(form.store, (s) => s.values.mode);
  const board = useStore(form.store, (s) => s.values.board);
  const isUpwork = board === UPWORK_DOMAIN;
  const isOutreach = mode === "outreach";

  // Upwork has no auto-apply/outreach path — pin the mode to search.
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

          {mode === "search" && <SearchFields form={form} />}
          {mode === "auto-apply" && <AutoApplyFields form={form} />}
          {mode === "outreach" && <OutreachFields form={form} />}

          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
            <Button onClick={() => router.back()}>Cancel</Button>
            <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!hasResumes || (!hasBoards && !isOutreach) || !canSubmit || isSubmitting}
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
