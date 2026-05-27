"use client";

import type { ReactElement } from "react";
import {
  Button,
  Chip,
  LinearProgress,
  Slider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useStore } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { z } from "zod/v4";
import { useAppForm } from "@/components/ui/form/tanstack";
import { SectionCard } from "@/components/ui/layout";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { RunSource } from "@/lib/schemas/run";
import { useAgent } from "@/providers/agent-provider";
import type { CreateRunRequest, JobBoardDto, ProfileResponse, RunDto } from "@/types/api";
import { buildCliArgs } from "@/utils/cli-args";
import { slugify } from "@/utils/slug";

const formSchema = z.object({
  mode: z.enum(["search", "auto-apply"]),
  query: z.string().trim().min(2, "Enter a search query"),
  board: z.string().min(1, "Pick a board"),
  minScore: z.number().int().min(0).max(100),
  maxApps: z.union([z.number().int().min(1).max(500), z.null(), z.undefined()]),
  maxJobs: z.number().int().min(1).max(100),
});

type RunMode = Extract<RunSource, "search" | "auto-apply">;
type FormValues = z.infer<typeof formSchema>;

function makeRunId(query: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").replace(/Z$/, "");
  return `${ts}_${slugify(query, { maxLength: 40, fallback: "run" })}`;
}

function hasMaxApps(values: FormValues): values is FormValues & { maxApps: number } {
  return values.maxApps != null && Number.isFinite(values.maxApps);
}

function buildRunConfig(values: FormValues): CreateRunRequest["config"] {
  if (values.mode !== "auto-apply") {
    return { board: values.board, maxJobs: values.maxJobs };
  }
  return {
    board: values.board,
    minScore: values.minScore,
    ...(hasMaxApps(values) ? { maxApplications: values.maxApps } : {}),
  };
}

function buildSkillArg(values: FormValues, runId: string): string {
  return buildCliArgs({
    positional: [values.query.trim()],
    flags: {
      board: values.board,
      "min-score": values.mode === "auto-apply" ? values.minScore : undefined,
      "max-apps": values.mode === "auto-apply" && hasMaxApps(values) ? values.maxApps : undefined,
      "max-jobs": values.mode === "search" ? values.maxJobs : undefined,
      // Search saves results onto this run; pass the id the UI just created so
      // the skill doesn't have to rediscover it.
      run: values.mode === "search" ? runId : undefined,
    },
  });
}

export function RunComposer(): ReactElement {
  const router = useRouter();
  const agent = useAgent();

  const boardsQuery = useApiQuery<JobBoardDto[]>(queryKeys.jobBoards.list(), () =>
    apiClient.get<JobBoardDto[]>("/api/job-boards"),
  );
  const profileQuery = useApiQuery<ProfileResponse>(queryKeys.profile.detail(), () =>
    apiClient.get<ProfileResponse>("/api/profile"),
  );
  const recentRunsQuery = useApiQuery<RunDto[]>(queryKeys.runs.list(), () =>
    apiClient.get<RunDto[]>("/api/runs"),
  );

  const createRun = useApiMutation<RunDto, CreateRunRequest>(
    (body) => apiClient.post<RunDto>("/api/runs", body),
    { invalidate: [queryKeys.runs.all] },
  );

  const boards = boardsQuery.data ?? [];
  const recentQueries = Array.from(new Set((recentRunsQuery.data ?? []).map((r) => r.query))).slice(
    0,
    5,
  );
  const autoApply = profileQuery.data?.autoApply;
  const hasBoards = boards.length > 0;

  const form = useAppForm({
    defaultValues: {
      mode: "auto-apply" as RunMode,
      query: "",
      board: boards[0]?.domain ?? "",
      minScore: autoApply?.minMatchScore ?? 70,
      maxApps: null as number | null | undefined,
      maxJobs: 15,
    },
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => {
      const runId = makeRunId(value.query);
      await createRun.mutateAsync({
        runId,
        query: value.query.trim(),
        source: value.mode,
        config: buildRunConfig(value),
      });
      await agent.injectSkill(value.mode, buildSkillArg(value, runId));
      router.push(`/runs/${encodeURIComponent(runId)}`);
    },
  });

  const isSearch = useStore(form.store, (s) => s.values.mode === "search");
  const isAutoApply = useStore(form.store, (s) => s.values.mode === "auto-apply");

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
          <form.AppField name="mode">
            {(field) => (
              <Stack spacing={0.5}>
                <Typography variant="body2Muted">Mode</Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={field.state.value}
                  onChange={(_, next: RunMode | null) => next && field.handleChange(next)}
                >
                  <ToggleButton value="search">Search only</ToggleButton>
                  <ToggleButton value="auto-apply">Auto-apply</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            )}
          </form.AppField>

          <Stack spacing={0.75}>
            <form.AppField name="query">
              {(field) => (
                <field.TextField
                  label="Query"
                  placeholder="Senior React TypeScript remote"
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

          {hasBoards ? (
            <form.AppField name="board">
              {(field) => (
                <field.Select
                  label="Board"
                  items={boards.map((b) => ({ value: b.domain, label: b.name }))}
                />
              )}
            </form.AppField>
          ) : (
            <Typography variant="body2Muted">
              No boards configured. Add one on the Boards page first.
            </Typography>
          )}

          {isSearch && (
            <form.AppField name="maxJobs">
              {(field) => (
                <field.TextField
                  label="Jobs to search"
                  type="number"
                  helperText="How many results to rank (1–100)."
                  slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
                />
              )}
            </form.AppField>
          )}

          {isAutoApply && (
            <Stack spacing={2}>
              <form.AppField name="minScore">
                {(field) => (
                  <Stack spacing={0.5}>
                    <Typography variant="body2Muted">
                      Min match score: {field.state.value}
                    </Typography>
                    <Slider
                      value={field.state.value}
                      min={0}
                      max={100}
                      step={5}
                      marks
                      valueLabelDisplay="auto"
                      onChange={(_, v) => field.handleChange(v as number)}
                    />
                  </Stack>
                )}
              </form.AppField>
              <form.AppField name="maxApps">
                {(field) => (
                  <field.TextField
                    label="Max applications"
                    type="number"
                    helperText="Leave empty for unlimited."
                    slotProps={{ htmlInput: { min: 1, max: 500, step: 1 } }}
                  />
                )}
              </form.AppField>
            </Stack>
          )}

          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
            <Button onClick={() => router.back()}>Cancel</Button>
            <form.Subscribe selector={(s) => [s.values.mode, s.canSubmit, s.isSubmitting] as const}>
              {([mode, canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!hasBoards || !canSubmit || isSubmitting}
                >
                  {mode === "search" ? "Start search" : "Start auto-apply"}
                </Button>
              )}
            </form.Subscribe>
          </Stack>
        </Stack>
      </form>
    </SectionCard>
  );
}
