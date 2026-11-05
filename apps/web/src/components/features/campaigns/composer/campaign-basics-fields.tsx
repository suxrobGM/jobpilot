"use client";

import { Chip, Stack, Tooltip, Typography } from "@mui/material";
import { useSelector } from "@tanstack/react-form";
import type { UserAggregateResponse } from "@/api/types";
import { withForm } from "@/components/ui/form/tanstack";
import {
  type BoardOption,
  COMPOSER_DEFAULT_VALUES,
  isResearch,
  isUpworkSearch,
  MODE_DESCRIPTIONS,
  type RecentQuery,
  UPWORK_MODE_DESCRIPTION,
} from "./form-config";

interface SourceCopy {
  label: string;
  board: string;
  anywhere: string;
  anywhereHint: string;
  noBoards: string;
}

const SEARCH_SOURCE: SourceCopy = {
  label: "Search in",
  board: "A job board",
  anywhere: "Anywhere on the web",
  anywhereHint:
    "Searches university and lab portals, company career pages and niche job sites beyond your boards. It never logs in or signs up.",
  noBoards: "No boards linked yet. Add one on the Boards page, or search anywhere on the web.",
};

const NETWORKING_SOURCE: SourceCopy = {
  label: "Find contacts through",
  board: "Openings on a board",
  anywhere: "Your criteria alone",
  anywhereHint: "Reaches people who match your criteria, without tying each one to an opening.",
  noBoards: "No boards linked yet. Add one on the Boards page, or reach contacts by criteria.",
};

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
    const onBoard = searchIn === "board";
    const source = isNetworking ? NETWORKING_SOURCE : SEARCH_SOURCE;

    let placeholder = "Senior React TypeScript remote";
    if (isNetworking) placeholder = "Hiring managers at NYC fintech startups";
    if (researching) placeholder = "ML research assistant roles at US universities";

    const pickRecent = (recent: RecentQuery) => {
      form.setFieldValue("query", recent.query);
      form.setFieldValue("searchIn", recent.anywhere ? "anywhere" : "board");
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

        {!isApply && (
          <Stack spacing={0.75}>
            <form.AppField name="searchIn">
              {(field) => (
                <field.Toggle
                  label={source.label}
                  options={[
                    { value: "board", label: source.board },
                    { value: "anywhere", label: source.anywhere },
                  ]}
                />
              )}
            </form.AppField>
            {!onBoard && <Typography variant="captionMuted">{source.anywhereHint}</Typography>}
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

            {onBoard && boards.length > 0 && (
              <form.AppField name="board">
                {(field) => (
                  <field.Select
                    label="Board"
                    items={boards.map((b) => ({ value: b.domain, label: b.name }))}
                  />
                )}
              </form.AppField>
            )}
            {onBoard && boards.length === 0 && (
              <Typography variant="body2Muted">{source.noBoards}</Typography>
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
