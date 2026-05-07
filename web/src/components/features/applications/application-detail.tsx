"use client";

import { useState, type ReactElement } from "react";
import { Delete, Launch } from "@mui/icons-material";
import {
  Box,
  Button,
  Container,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { StageChip } from "@/components/ui/display/stage-chip";
import { ConfirmDialog } from "@/components/ui/feedback/confirm-dialog";
import { PageHeader } from "@/components/ui/layout/page-header";
import { SectionCard } from "@/components/ui/layout/section-card";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Stage, StageTransitionInput } from "@/lib/schemas/application";
import type { ApplicationDetailDto } from "@/types/api";
import { StageTimeline } from "./stage-timeline";
import { StageTransitionDialog } from "./stage-transition-dialog";

interface ApplicationDetailProps {
  id: number;
}

export function ApplicationDetail(props: ApplicationDetailProps): ReactElement {
  const { id } = props;
  const router = useRouter();
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const detail = useApiQuery<ApplicationDetailDto>(queryKeys.applications.detail(id), () =>
    apiClient.get<ApplicationDetailDto>(`/api/applied/${id}`),
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
      onSuccess: () => router.replace("/applications"),
    },
  );

  if (detail.isLoading || !detail.data) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <LinearProgress />
      </Container>
    );
  }

  const app = detail.data;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
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
              <Field label="Board" value={app.board ?? "—"} />
              <Field label="Source" value={app.source} />
              <Field label="Location" value={app.location ?? "—"} />
              <Field
                label="Match score"
                value={app.matchScore !== null ? `${app.matchScore}/100` : "—"}
              />
              <Field label="Applied at" value={new Date(app.appliedAt).toLocaleString()} />
              {app.runId && <Field label="Run" value={app.runId} />}
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
      </Stack>

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
        message="This removes the record and its stage history. The duplicate-check API will no longer match this URL."
        confirmLabel="Delete"
        destructive
        onConfirm={() => remove.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </Container>
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
