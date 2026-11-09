"use client";

import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { pipelineQueries } from "@/api/queries";
import { LinkButton } from "@/components/ui/buttons";
import { DetailSkeleton, EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/layout";
import { JobDetail } from "./job-detail";

interface JobPageProps {
  jobId: string;
}

/** One job, whatever its status; the pilot's thread and its Needs you cards link here. */
export function JobPage(props: JobPageProps): ReactElement {
  const { jobId } = props;
  const query = useQuery(pipelineQueries.job(jobId));

  if (query.isPending) {
    return <DetailSkeleton heights={[120, 320]} />;
  }
  if (!query.data) {
    return (
      <>
        <PageHeader title="Job" backHref="/pilot" backLabel="Pilot" />
        <EmptyState
          title="This job is no longer in your pipeline."
          description="Old jobs that were never applied to are cleared out over time."
          action={
            <LinkButton href="/pipeline" variant="outlined">
              Open the pipeline
            </LinkButton>
          }
        />
      </>
    );
  }
  const job = query.data;
  return (
    <>
      <PageHeader title={job.title} backHref="/pilot" backLabel="Pilot" />
      <JobDetail job={job} parked={job.status === "needs_user"} />
    </>
  );
}
