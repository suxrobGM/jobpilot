"use client";

import type { ReactElement } from "react";
import { JobDetail } from "@/components/features/pipeline/jobs/job-detail";
import { LinkButton } from "@/components/ui/buttons";
import { DetailSkeleton, EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/layout";
import { useParkedJob } from "./attention/use-needs-you";

interface ParkedJobPageProps {
  jobId: string;
}

/** A job the pilot parked for the user, with what to do about it. */
export function ParkedJobPage(props: ParkedJobPageProps): ReactElement {
  const { jobId } = props;
  const { job, isPending } = useParkedJob(jobId);

  if (isPending) {
    return <DetailSkeleton heights={[120, 320]} />;
  }
  if (!job) {
    // Applying or dismissing it from here takes it out of the queue, so this is the usual end.
    return (
      <>
        <PageHeader title="Parked job" backHref="/pilot" backLabel="Pilot" />
        <EmptyState
          title="This job isn't waiting on you anymore."
          description="It was applied to, dismissed, or the pilot picked it back up."
          action={
            <LinkButton href="/pilot" variant="outlined">
              Back to Pilot
            </LinkButton>
          }
        />
      </>
    );
  }
  return (
    <>
      <PageHeader title={job.title} backHref="/pilot" backLabel="Pilot" />
      <JobDetail job={job} parked />
    </>
  );
}
