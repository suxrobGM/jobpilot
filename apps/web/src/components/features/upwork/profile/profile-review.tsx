"use client";

import { type ReactElement, useState } from "react";
import type { UpdateUpworkProfileInput } from "@jobpilot/contracts/upwork";
import { CloudUpload, TaskAlt } from "@mui/icons-material";
import { Button, Divider, Stack, TextField, Typography } from "@mui/material";
import { api } from "@/api/client";
import { upworkProfileQueries } from "@/api/queries";
import type { UpworkProfileDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { LabelValue } from "@/components/ui/display";
import { PortfolioList } from "./portfolio-list";

interface ProfileReviewProps {
  profile: UpworkProfileDto;
}

/** The parent keys this on `updatedAt`, so a remount reseeds the local drafts. */
export function ProfileReview(props: ProfileReviewProps): ReactElement {
  const { profile } = props;
  const request = useCreateRequest();

  const [title, setTitle] = useState(profile.suggestedTitle ?? "");
  const [hourlyRate, setHourlyRate] = useState(profile.suggestedHourlyRate ?? "");
  const [overview, setOverview] = useState(profile.suggestedOverview ?? "");

  const save = useApiMutation((body: UpdateUpworkProfileInput) => api.upwork.profile.put(body), {
    invalidate: [upworkProfileQueries.all],
  });

  const isApplied = profile.status === "applied";
  const isApproved = profile.status === "approved";

  const editedSuggestion = (): UpdateUpworkProfileInput => ({
    suggestedTitle: title.trim() || null,
    suggestedHourlyRate: hourlyRate.trim() || null,
    suggestedOverview: overview.trim() || null,
    suggestedPortfolio: profile.suggestedPortfolio,
  });

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Stack spacing={1.5} sx={{ flex: 1 }}>
          <Typography variant="overlineMuted">Current</Typography>
          <LabelValue label="Title">{profile.currentTitle || "-"}</LabelValue>
          <LabelValue label="Hourly rate">{profile.currentHourlyRate || "-"}</LabelValue>
          <LabelValue label="Overview">
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
              {profile.currentOverview || "-"}
            </Typography>
          </LabelValue>
        </Stack>
        <Stack spacing={1.5} sx={{ flex: 1 }}>
          <Typography variant="overlineMuted">Suggested</Typography>
          <TextField
            label="Title"
            size="small"
            value={title}
            disabled={isApplied}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextField
            label="Hourly rate"
            size="small"
            value={hourlyRate}
            disabled={isApplied}
            onChange={(e) => setHourlyRate(e.target.value)}
          />
          <TextField
            label="Overview"
            value={overview}
            disabled={isApplied}
            onChange={(e) => setOverview(e.target.value)}
            multiline
            minRows={8}
          />
        </Stack>
      </Stack>

      <Divider />

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Stack spacing={1} sx={{ flex: 1 }}>
          <Typography variant="overlineMuted">Current portfolio</Typography>
          <PortfolioList items={profile.currentPortfolio} />
        </Stack>
        <Stack spacing={1} sx={{ flex: 1 }}>
          <Typography variant="overlineMuted">Suggested portfolio</Typography>
          <PortfolioList items={profile.suggestedPortfolio} />
        </Stack>
      </Stack>

      {!isApplied && (
        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
          <Button
            variant="text"
            disabled={save.isPending}
            onClick={() => save.mutate(editedSuggestion())}
          >
            Save changes
          </Button>
          {profile.status === "draft" && (
            <Button
              variant="contained"
              startIcon={<TaskAlt fontSize="sm" />}
              disabled={save.isPending}
              onClick={() => save.mutate({ ...editedSuggestion(), status: "approved" })}
            >
              Approve
            </Button>
          )}
          {isApproved && (
            <Button
              variant="contained"
              startIcon={<CloudUpload fontSize="sm" />}
              onClick={() =>
                request.mutate({ taskType: "upwork.profile", payload: { mode: "apply" } })
              }
            >
              Apply to Upwork
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
}
