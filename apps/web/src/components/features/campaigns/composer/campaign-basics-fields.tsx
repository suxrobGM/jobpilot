"use client";

import { Chip, Stack, Tooltip, Typography } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import type { UserAggregateResponse } from "@/api/types";
import { withForm } from "@/components/ui/form/tanstack";
import {
  type BoardOption,
  COMPOSER_DEFAULT_VALUES,
  canResearch,
  isResearch,
  isUpworkSearch,
  MODE_DESCRIPTIONS,
  type RecentQuery,
  UPWORK_MODE_DESCRIPTION,
} from "./form-config";

const ANYWHERE_HINT =
  "Searches university and lab portals, company career pages and niche job sites beyond your boards. It never logs in or signs up.";

/** Campaign basics: the mode toggle, plus query (+ recent), board, and resume for every mode but apply. */
export const CampaignBasicsFields = withForm({
  defaultValues: COMPOSER_DEFAULT_VALUES,
  props: {
    boards: [] as BoardOption[],
    resumes: [] as UserAggregateResponse["resumes"],
    recentQueries: [] as RecentQuery[],
  },
  render: function CampaignBasicsFields({ form, boards, resumes, recentQueries }) {
    const mode = useSelector(form.store, (s) => s.values.mode);
    const board = useSelector(form.store, (s) => s.values.board);
    const searchIn = useSelector(form.store, (s) => s.values.searchIn);
    const isApply = mode === "apply";
    const isUpwork = isUpworkSearch({ mode, board, searchIn });
    const isNetworking = mode === "networking";
    const researching = isResearch({ mode, searchIn });

    let placeholder = "Senior React TypeScript remote";
    if (isNetworking) placeholder = "Hiring managers at NYC fintech startups";
    if (researching) placeholder = "ML research assistant roles at US universities";

    const pickRecent = (recent: RecentQuery) => {
      form.setFieldValue("query", recent.query);
      if (canResearch(mode)) form.setFieldValue("searchIn", recent.anywhere ? "anywhere" : "board");
    };

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
          <Typography variant="captionMuted">
            {isUpwork ? UPWORK_MODE_DESCRIPTION : MODE_DESCRIPTIONS[mode]}
          </Typography>
        </Stack>

        {canResearch(mode) && (
          <Stack spacing={0.75}>
            <form.AppField name="searchIn">
              {(field) => (
                <field.Toggle
                  label="Search in"
                  options={[
                    { value: "board", label: "A job board" },
                    { value: "anywhere", label: "Anywhere on the web" },
                  ]}
                />
              )}
            </form.AppField>
            {researching && <Typography variant="captionMuted">{ANYWHERE_HINT}</Typography>}
          </Stack>
        )}

        {/* Apply has none of these - it takes pasted links and tailors a resume per job. */}
        {!isApply && (
          <>
            <Stack spacing={0.75}>
              <form.AppField name="query">
                {(field) => (
                  <field.TextField
                    label={isNetworking ? "Target criteria" : "Query"}
                    placeholder={placeholder}
                    autoFocus
                  />
                )}
              </form.AppField>
              {recentQueries.length > 0 && (
                <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }}>
                  <Typography variant="captionMuted" sx={{ alignSelf: "center" }}>
                    Recent:
                  </Typography>
                  {recentQueries.map((recent) => (
                    <Tooltip key={recent.query} title={recent.query}>
                      <Chip
                        label={recent.query}
                        size="small"
                        variant="outlined"
                        sx={{ maxWidth: 280 }}
                        onClick={() => pickRecent(recent)}
                      />
                    </Tooltip>
                  ))}
                </Stack>
              )}
            </Stack>

            {/* Required for a board search, optional for networking, where it toggles
                board-grounded vs criteria-only discovery. */}
            {!researching && boards.length > 0 && (
              <Stack spacing={0.75}>
                <form.AppField name="board">
                  {(field) => (
                    <field.Select
                      label="Board"
                      optional={isNetworking}
                      emptyLabel="No board - reach by criteria"
                      items={boards.map((b) => ({ value: b.domain, label: b.name }))}
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
            {!researching && !isNetworking && boards.length === 0 && (
              <Typography variant="body2Muted">
                No boards linked yet. Add one on the Boards page, or search anywhere on the web.
              </Typography>
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
