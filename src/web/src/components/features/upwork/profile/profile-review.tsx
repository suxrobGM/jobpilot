"use client";

import { useState, type ReactElement } from "react";
import { CloudUpload, TaskAlt } from "@mui/icons-material";
import { Box, Button, Divider, Stack, TextField, Typography } from "@mui/material";
import { apiClient } from "@/api/client";
import type { UpdateUpworkProfileInput } from "@/api/contracts/upwork";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { UpworkProfileDto } from "@/api/types";
import { useAgent } from "@/providers/agent-provider";
import { PortfolioList } from "./portfolio-list";

interface ProfileReviewProps {
  profile: UpworkProfileDto;
}

/**
 * Current-vs-suggested editor. The user tweaks the suggestion, saves it, approves
 * it, then dispatches the upwork-profile skill to write it to the live profile.
 * Remount via `key` (the parent keys on `updatedAt`) reseeds the local drafts.
 */
export function ProfileReview(props: ProfileReviewProps): ReactElement {
  const { profile } = props;
  const agent = useAgent();

  const [title, setTitle] = useState(profile.suggestedTitle ?? "");
  const [hourlyRate, setHourlyRate] = useState(profile.suggestedHourlyRate ?? "");
  const [overview, setOverview] = useState(profile.suggestedOverview ?? "");

  const save = useApiMutation<UpworkProfileDto, UpdateUpworkProfileInput>(
    (body) => apiClient.put<UpworkProfileDto>("/api/upwork/profile", body),
    { invalidate: [queryKeys.upworkProfile.all] },
  );

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
          <Typography variant="subtitle2">Current</Typography>
          <ReadonlyField label="Title" value={profile.currentTitle} />
          <ReadonlyField label="Hourly rate" value={profile.currentHourlyRate} />
          <ReadonlyField label="Overview" value={profile.currentOverview} multiline />
        </Stack>
        <Stack spacing={1.5} sx={{ flex: 1 }}>
          <Typography variant="subtitle2">Suggested</Typography>
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
          <Typography variant="subtitle2">Current portfolio</Typography>
          <PortfolioList items={profile.currentPortfolio} />
        </Stack>
        <Stack spacing={1} sx={{ flex: 1 }}>
          <Typography variant="subtitle2">Suggested portfolio</Typography>
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
              onClick={() => void agent.injectSkill("upwork-profile", "apply")}
            >
              Apply to Upwork
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
}

interface ReadonlyFieldProps {
  label: string;
  value: string | null;
  multiline?: boolean;
}

function ReadonlyField(props: ReadonlyFieldProps): ReactElement {
  const { label, value, multiline } = props;
  return (
    <Box>
      <Typography variant="captionMuted">{label}</Typography>
      <Typography
        variant="body2"
        sx={{
          whiteSpace: multiline ? "pre-wrap" : "normal",
          color: value ? "text.primary" : "text.disabled",
        }}
      >
        {value || "—"}
      </Typography>
    </Box>
  );
}
