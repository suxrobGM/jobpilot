"use client";

import { useState, type ReactElement } from "react";
import { Delete, Launch } from "@mui/icons-material";
import { Box, Button, Container, IconButton, Stack, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { apiClient } from "@/api/client";
import type { Stage, StageTransitionInput } from "@jobpilot/contracts/application";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { ApplicationDetailDto } from "@/api/types";
import { StageChip } from "@/components/ui/display";
import { ConfirmDialog } from "@/components/ui/feedback";
import { PageHeader, SectionCard } from "@/components/ui/layout";
import { StageTimeline } from "./stage-timeline";
import { StageTransitionDialog } from "./stage-transition-dialog";

interface ApplicationDetailProps {
  initialApplication: ApplicationDetailDto;
}

export function ApplicationDetail(props: ApplicationDetailProps): ReactElement {
  const { initialApplication } = props;
  const id = initialApplication.id;

  const router = useRouter();
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const detail = useApiQuery<ApplicationDetailDto>(
    queryKeys.applications.detail(id),
    () => apiClient.get<ApplicationDetailDto>(`/api/applied/${id}`),
    { initialData: initialApplication },
  );

  const updateStage = useApiMutation<{ id: number; stage: Stage }, StageTransitionInput>(
    (vars) => apiClient.post(`/api/applied/${id}/stage`, vars),
    {
      successMessage: "Stage updated",
      invalidate: [queryKeys.applications.all, queryKeys.dashboard.all],
      onSuccess: () => setStageDialogOpen(false),
    },
  );

  const remove = useApiMutation<{ deleted: number }, void>(
    () => apiClient.del<{ deleted: number }>(`/api/applied/${id}`),
    {
      successMessage: "Application deleted",
      invalidate: [queryKeys.applications.all, queryKeys.dashboard.all],
      onSuccess: () => router.replace("/"),
    },
  );

  const app = detail.data ?? initialApplication;

  return (
    <>
      <Container maxWidth="lg" sx={{ gap: 2 }}>
        <PageHeader
          eyebrow={app.company}
          title={app.title}
          actions={
            <>
              <Button
                variant="outlined"
                startIcon={<Launch fontSize="md" />}
                component="a"
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open posting
              </Button>
              <Button variant="contained" onClick={() => setStageDialogOpen(true)}>
                Update stage
              </Button>
              <IconButton onClick={() => setConfirmDelete(true)} aria-label="Delete application">
                <Delete fontSize="md" />
              </IconButton>
            </>
          }
        />

        <SectionCard>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <StageChip stage={app.stage} />
              {app.outcome && (
                <Typography variant="captionMuted">Outcome: {app.outcome}</Typography>
              )}
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ flexWrap: "wrap" }}>
              <Field label="Board" value={app.board ?? ""} />
              <Field label="Source" value={app.source} />
              <Field label="Location" value={app.location ?? ""} />
              <Field
                label="Match score"
                value={app.matchScore !== null ? `${app.matchScore}/100` : ""}
              />
              <Field label="Applied at" value={new Date(app.appliedAt).toLocaleString()} />
              {app.campaignId && <Field label="Campaign" value={app.campaignId} />}
            </Stack>
            {app.matchReason && (
              <Box>
                <Typography variant="overlineMuted">Match reason</Typography>
                <Typography variant="body2">{app.matchReason}</Typography>
              </Box>
            )}
            {app.failReason && (
              <Box>
                <Typography variant="overlineMuted">Fail reason</Typography>
                <Typography variant="body2">{app.failReason}</Typography>
              </Box>
            )}
          </Stack>
        </SectionCard>

        <SectionCard title="Stage history">
          <StageTimeline events={app.stageEvents} />
        </SectionCard>
      </Container>

      <StageTransitionDialog
        open={stageDialogOpen}
        currentStage={app.stage}
        onClose={() => setStageDialogOpen(false)}
        onSubmit={(values) => updateStage.mutate(values)}
        submitting={updateStage.isPending}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete application?"
        description="This removes the record and its stage history. The duplicate-check API will no longer match this URL."
        confirmLabel="Delete"
        destructive
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

interface FieldProps {
  label: string;
  value: string;
}

function Field(props: FieldProps): ReactElement {
  const { label, value } = props;
  return (
    <Box>
      <Typography variant="overlineMuted">{label}</Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}
