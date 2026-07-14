"use client";

import { type ReactElement, useState } from "react";
import type { ApplicationStatus, StatusTransitionInput } from "@jobpilot/contracts/application";
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
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { applicationQueries } from "@/api/queries";
import { invalidations } from "@/api/query-keys";
import { EmptyState } from "@/components/ui/data/empty-state";
import { StatusChip } from "@/components/ui/display";
import { PageHeader, SectionCard } from "@/components/ui/layout";
import { useConfirm } from "@/providers/confirm-provider";
import { ActivityTimeline } from "./activity-timeline";
import { StatusTransitionDialog } from "./status-transition-dialog";

interface ApplicationDetailProps {
  applicationId: string;
}

export function ApplicationDetail(props: ApplicationDetailProps): ReactElement {
  const { applicationId: id } = props;

  const router = useRouter();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const confirm = useConfirm();

  const detail = useApiQuery(applicationQueries.detail(id));

  const updateStatus = useApiMutation<
    { id: string; status: ApplicationStatus },
    StatusTransitionInput
  >((vars) => api.applied({ id }).status.post(vars), {
    successMessage: "Status updated",
    invalidate: invalidations.application,
    onSuccess: () => setStatusDialogOpen(false),
  });

  const remove = useApiMutation<{ deleted: string }, void>(() => api.applied({ id }).delete(), {
    successMessage: "Application deleted",
    invalidate: invalidations.application,
    onSuccess: () => router.replace("/"),
  });

  const handleDelete = async (): Promise<void> => {
    const confirmed = await confirm({
      title: "Delete application?",
      description:
        "This removes the record and its activity history. The duplicate-check API will no longer match this URL.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (confirmed) {
      remove.mutate();
    }
  };

  if (detail.isLoading) {
    return <LinearProgress />;
  }

  const app = detail.data;

  if (!app) {
    return (
      <Container maxWidth="lg">
        <EmptyState
          title="Application not found"
          description="It may have been deleted, or the link is incorrect."
        />
      </Container>
    );
  }

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
              <Button variant="contained" onClick={() => setStatusDialogOpen(true)}>
                Update status
              </Button>
              <IconButton onClick={() => void handleDelete()} aria-label="Delete application">
                <Delete fontSize="md" />
              </IconButton>
            </>
          }
        />

        <SectionCard>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <StatusChip status={app.status} />
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

        <SectionCard title="Activity">
          <ActivityTimeline events={app.events} />
        </SectionCard>
      </Container>

      <StatusTransitionDialog
        open={statusDialogOpen}
        currentStatus={app.status}
        onClose={() => setStatusDialogOpen(false)}
        onSubmit={(values) => updateStatus.mutate(values)}
        submitting={updateStatus.isPending}
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
