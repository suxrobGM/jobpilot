"use client";

import { type ReactElement, useState } from "react";
import { Delete, Launch } from "@mui/icons-material";
import { Button, Link, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { applicationQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { TooltipIconButton } from "@/components/ui/buttons";
import { LabelValue, StatusChip, statusLabel } from "@/components/ui/display";
import { DetailLoadFailure, DetailSkeleton } from "@/components/ui/feedback";
import { PageHeader, PageShell, SectionCard } from "@/components/ui/layout";
import { useConfirm } from "@/providers/confirm-provider";
import { formatAbsoluteTime } from "@/utils/format";
import { campaignHref } from "@/utils/routes";
import { ActivityTimeline } from "./activity-timeline";
import { StatusTransitionDialog } from "./status-transition-dialog";
import { SubmissionDetails } from "./submission-details";

interface ApplicationDetailProps {
  applicationId: string;
}

export function ApplicationDetail(props: ApplicationDetailProps): ReactElement {
  const { applicationId: id } = props;

  const router = useRouter();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const confirm = useConfirm();

  const detail = useQuery(applicationQueries.detail(id));

  const remove = useApiMutation(() => api.applications({ id }).delete(), {
    successMessage: "Application deleted",
    invalidate: [applicationQueries.all],
    onSuccess: () => router.replace("/workspace/applications"),
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

  if (detail.isPending) {
    return <DetailSkeleton />;
  }

  const app = detail.data;

  if (!app) {
    return (
      <PageShell maxWidth="lg">
        <DetailLoadFailure
          noun="application"
          error={detail.error}
          onRetry={() => void detail.refetch()}
        />
      </PageShell>
    );
  }

  return (
    <>
      <PageShell maxWidth="lg">
        <PageHeader
          eyebrow={app.company}
          title={app.title}
          actions={
            <>
              <Button variant="outlined" startIcon={<Launch fontSize="md" />} href={app.url}>
                Open posting
              </Button>
              <Button variant="contained" onClick={() => setStatusDialogOpen(true)}>
                Update status
              </Button>
              <TooltipIconButton title="Delete application" onClick={() => void handleDelete()}>
                <Delete fontSize="md" />
              </TooltipIconButton>
            </>
          }
        />

        <SectionCard>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <StatusChip domain="application" value={app.status} />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ flexWrap: "wrap" }}>
              <LabelValue label="Board">{app.board?.name ?? ""}</LabelValue>
              <LabelValue label="Source">{statusLabel("source", app.source)}</LabelValue>
              <LabelValue label="Location">{app.location ?? ""}</LabelValue>
              <LabelValue label="Match score">
                {app.matchScore !== null ? `${app.matchScore}/100` : ""}
              </LabelValue>
              <LabelValue label="Applied at">{formatAbsoluteTime(app.appliedAt)}</LabelValue>
              {app.campaignId && (
                <LabelValue label="Campaign">
                  <Link href={campaignHref(app.campaignId)}>Open campaign</Link>
                </LabelValue>
              )}
            </Stack>
            {app.matchReason && <LabelValue label="Match reason">{app.matchReason}</LabelValue>}
          </Stack>
        </SectionCard>

        <SubmissionDetails application={app} />

        <SectionCard title="Activity">
          <ActivityTimeline events={app.events} />
        </SectionCard>
      </PageShell>

      <StatusTransitionDialog
        // Remounts after each change, so the form starts from the new status.
        key={app.status}
        applicationId={app.id}
        open={statusDialogOpen}
        currentStatus={app.status}
        onClose={() => setStatusDialogOpen(false)}
      />
    </>
  );
}
