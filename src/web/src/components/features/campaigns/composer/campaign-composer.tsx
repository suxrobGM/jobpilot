"use client";

import { useEffect, type ReactElement } from "react";
import { Button, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import { useStore } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { apiClient } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { CampaignDto, CreateCampaignRequest, JobBoardDto, ProfileResponse } from "@/api/types";
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { useAgent } from "@/providers/agent-provider";
import { AutoApplyFields } from "./auto-apply-fields";
import {
  buildCampaignConfig,
  buildSkillArg,
  COMPOSER_DEFAULT_VALUES,
  composerFormSchema,
  makeCampaignId,
  MODE_DESCRIPTIONS,
  SUBMIT_LABELS,
  UPWORK_DOMAIN,
  UPWORK_MODE_DESCRIPTION,
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
    apiClient.get<JobBoardDto[]>("/api/job-boards"),
  );
  const profileQuery = useApiQuery<ProfileResponse>(queryKeys.profile.detail(), () =>
    apiClient.get<ProfileResponse>("/api/profile"),
  );
  const recentCampaignsQuery = useApiQuery<CampaignDto[]>(queryKeys.campaigns.list(), () =>
    apiClient.get<CampaignDto[]>("/api/campaigns"),
  );

  const createCampaign = useApiMutation<CampaignDto, CreateCampaignRequest>(
    (body) => apiClient.post<CampaignDto>("/api/campaigns", body),
    { invalidate: [queryKeys.campaigns.all] },
  );

  const boards = boardsQuery.data ?? [];
  const recentQueries = Array.from(
    new Set((recentCampaignsQuery.data ?? []).map((r) => r.query)),
  ).slice(0, 5);
  const hasBoards = boards.length > 0;

  const presetBoard =
    defaultBoard && boards.some((b) => b.domain === defaultBoard) ? defaultBoard : undefined;

  const form = useAppForm({
    defaultValues: {
      ...COMPOSER_DEFAULT_VALUES,
      board: presetBoard ?? boards[0]?.domain ?? "",
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
        config: buildCampaignConfig(effective),
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
          <Stack spacing={0.75}>
            <form.AppField name="mode">
              {(field) => (
                <field.Toggle
                  label="Mode"
                  options={
                    isUpwork
                      ? [{ value: "search", label: "Recommend" }]
                      : [
                          { value: "search", label: "Search only" },
                          { value: "auto-apply", label: "Auto-apply" },
                          { value: "outreach", label: "Outreach" },
                        ]
                  }
                />
              )}
            </form.AppField>
            <Typography variant="captionMuted">
              {isUpwork ? UPWORK_MODE_DESCRIPTION : MODE_DESCRIPTIONS[mode]}
            </Typography>
          </Stack>

          <Stack spacing={0.75}>
            <form.AppField name="query">
              {(field) => (
                <field.TextField
                  label={isOutreach ? "Target criteria" : "Query"}
                  placeholder={
                    isOutreach
                      ? "Hiring managers at NYC fintech startups"
                      : "Senior React TypeScript remote"
                  }
                  autoFocus
                />
              )}
            </form.AppField>
            {recentQueries.length > 0 && (
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }}>
                <Typography variant="captionMuted" sx={{ alignSelf: "center" }}>
                  Recent:
                </Typography>
                {recentQueries.map((q) => (
                  <Chip
                    key={q}
                    label={q}
                    size="small"
                    variant="outlined"
                    onClick={() => form.setFieldValue("query", q)}
                  />
                ))}
              </Stack>
            )}
          </Stack>

          {/* One board control: required for search/auto-apply, optional for outreach
              (where it toggles board-grounded vs criteria-only discovery). */}
          {hasBoards ? (
            <Stack spacing={0.75}>
              <form.AppField name="board">
                {(field) => (
                  <field.Select
                    label="Board"
                    optional={isOutreach}
                    emptyLabel="No board — reach by criteria"
                    items={boards.map((b) => ({ value: b.domain, label: b.name }))}
                  />
                )}
              </form.AppField>
              {isOutreach && (
                <Typography variant="captionMuted">
                  With a board, each contact is grounded in a matching opening; without one,
                  outreach uses your criteria alone.
                </Typography>
              )}
            </Stack>
          ) : (
            !isOutreach && (
              <Typography variant="body2Muted">
                No boards configured. Add one on the Boards page first.
              </Typography>
            )
          )}

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
                  disabled={(!hasBoards && !isOutreach) || !canSubmit || isSubmitting}
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
