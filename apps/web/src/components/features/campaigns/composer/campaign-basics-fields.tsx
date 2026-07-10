"use client";

import { Chip, Stack, Typography } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import type { JobBoardDto, ProfileResponse } from "@/api/types";
import { withForm } from "@/components/ui/form/tanstack";
import {
  COMPOSER_DEFAULT_VALUES,
  MODE_DESCRIPTIONS,
  UPWORK_DOMAIN,
  UPWORK_MODE_DESCRIPTION,
} from "./form-config";

/** Always-shown campaign basics: mode, query (+ recent), board, and resume. */
export const CampaignBasicsFields = withForm({
  defaultValues: COMPOSER_DEFAULT_VALUES,
  props: {
    boards: [] as JobBoardDto[],
    resumes: [] as ProfileResponse["resumes"],
    recentQueries: [] as string[],
  },
  render: function CampaignBasicsFields({ form, boards, resumes, recentQueries }) {
    const mode = useSelector(form.store, (s) => s.values.mode);
    const board = useSelector(form.store, (s) => s.values.board);
    const isUpwork = board === UPWORK_DOMAIN;
    const isOutreach = mode === "outreach";

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
        {boards.length > 0 ? (
          <Stack spacing={0.75}>
            <form.AppField name="board">
              {(field) => (
                <field.Select
                  label="Board"
                  optional={isOutreach}
                  emptyLabel="No board - reach by criteria"
                  items={boards.map((b) => ({ value: b.domain, label: b.name }))}
                />
              )}
            </form.AppField>
            {isOutreach && (
              <Typography variant="captionMuted">
                With a board, each contact is grounded in a matching opening; without one, outreach
                uses your criteria alone.
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

        {/* Resume is mandatory for every mode - it drives scoring and is tailored
            per application (search/auto-apply) or shared as a link (outreach). */}
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
    );
  },
});
