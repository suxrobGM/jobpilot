"use client";

import { Chip, Stack, Typography } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import type { UserAggregateResponse } from "@/api/types";
import { withForm } from "@/components/ui/form/tanstack";
import {
  ANYWHERE_BOARD,
  ANYWHERE_MODE_DESCRIPTIONS,
  type BoardOption,
  COMPOSER_DEFAULT_VALUES,
  type ComposerFormValues,
  canResearch,
  isUpworkSearch,
  MODE_DESCRIPTIONS,
  UPWORK_MODE_DESCRIPTION,
} from "./form-config";

function modeDescription(mode: ComposerFormValues["mode"], board: string): string {
  if (isUpworkSearch({ mode, board })) return UPWORK_MODE_DESCRIPTION;
  const researching = mode === "search" || mode === "auto_apply";
  if (board === ANYWHERE_BOARD && researching) return ANYWHERE_MODE_DESCRIPTIONS[mode];
  return MODE_DESCRIPTIONS[mode];
}

function queryPlaceholder(mode: ComposerFormValues["mode"], board: string): string {
  if (mode === "networking") return "Hiring managers at NYC fintech startups";
  if (board === ANYWHERE_BOARD) return "ML research assistant roles at US universities";
  return "Senior React TypeScript remote";
}

/** Campaign basics: the mode toggle, plus query (+ recent), board, and resume for every mode but apply. */
export const CampaignBasicsFields = withForm({
  defaultValues: COMPOSER_DEFAULT_VALUES,
  props: {
    boards: [] as BoardOption[],
    resumes: [] as UserAggregateResponse["resumes"],
    recentQueries: [] as string[],
  },
  render: function CampaignBasicsFields({ form, boards, resumes, recentQueries }) {
    const mode = useSelector(form.store, (s) => s.values.mode);
    const board = useSelector(form.store, (s) => s.values.board);
    const isApply = mode === "apply";
    const isUpwork = isUpworkSearch({ mode, board });
    const isNetworking = mode === "networking";
    const researchable = canResearch(mode);
    const boardItems = [
      ...(researchable ? [{ value: ANYWHERE_BOARD, label: "Anywhere on the web" }] : []),
      ...boards.map((b) => ({ value: b.domain, label: b.name })),
    ];

    return (
      <>
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
                        { value: "auto_apply", label: "Auto-apply" },
                        { value: "networking", label: "Networking" },
                        { value: "apply", label: "Apply to links" },
                      ]
                }
              />
            )}
          </form.AppField>
          <Typography variant="captionMuted">{modeDescription(mode, board)}</Typography>
        </Stack>

        {/* Apply has none of these - it takes pasted links and tailors a resume per job. */}
        {!isApply && (
          <>
            <Stack spacing={0.75}>
              <form.AppField name="query">
                {(field) => (
                  <field.TextField
                    label={isNetworking ? "Target criteria" : "Query"}
                    placeholder={queryPlaceholder(mode, board)}
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

            {/* One board control: required for search/auto-apply, optional for networking, where it
                toggles board-grounded vs criteria-only discovery. */}
            {boardItems.length > 0 && (
              <Stack spacing={0.75}>
                <form.AppField name="board">
                  {(field) => (
                    <field.Select
                      label="Board"
                      optional={isNetworking}
                      emptyLabel="No board - reach by criteria"
                      items={boardItems}
                    />
                  )}
                </form.AppField>
                {isNetworking && (
                  <Typography variant="captionMuted">
                    With a board, each contact is grounded in a matching opening; without one,
                    networking uses your criteria alone.
                  </Typography>
                )}
              </Stack>
            )}

            {resumes.length > 0 ? (
              <Stack spacing={0.75}>
                <form.AppField name="resumeId">
                  {(field) => (
                    <field.Select
                      label="Resume"
                      items={resumes.map((r) => ({
                        value: r.id,
                        label: r.isPrimary ? `${r.label} (primary)` : r.label,
                      }))}
                    />
                  )}
                </form.AppField>
                <Typography variant="captionMuted">
                  JobPilot tailors a copy of this resume to each application automatically - your
                  original stays unchanged.
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2Muted">
                No resumes yet. Upload one on the Resumes page first.
              </Typography>
            )}
          </>
        )}
      </>
    );
  },
});
