"use client";

import type { ReactElement, ReactNode } from "react";
import { UPWORK_DOMAIN } from "@jobpilot/contracts/upwork";
import { OpenInNew } from "@mui/icons-material";
import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { pipelineQueries } from "@/api/queries";
import type { PipelineJobDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { LinkButton } from "@/components/ui/buttons";
import { StatusChip } from "@/components/ui/display";
import { humanizeKey } from "@/utils/format";
import { proposalHref } from "@/utils/routes";

function briefValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(briefValue).join(", ");
  }
  if (value !== null && typeof value === "object") {
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value ?? "");
}

interface FieldProps {
  label: string;
  children: ReactNode;
}

function Field(props: FieldProps): ReactElement {
  const { label, children } = props;
  return (
    <Stack spacing={0.25}>
      <Typography variant="captionMuted">{label}</Typography>
      <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
        {children}
      </Typography>
    </Stack>
  );
}

interface JobActionsProps {
  job: PipelineJobDto;
  parked: boolean;
}

function JobActions(props: JobActionsProps): ReactNode {
  const { job, parked } = props;
  const request = useCreateRequest();
  const router = useRouter();
  const endpoint = api.feeds({ id: job.feedId }).jobs({ key: job.key });
  const invalidate = [pipelineQueries.all];

  const setStatus = useApiMutation((status: "approved" | "pending") => endpoint.patch({ status }), {
    invalidate,
  });
  const skip = useApiMutation(
    () => api.pipeline.jobs.bulk.post({ action: "skip", ids: [job.id] }),
    { invalidate, successMessage: "Skipped. The pilot won't apply to this job." },
  );
  const draftProposal = useApiMutation(
    () =>
      api.upwork.proposals.post({
        jobTitle: job.title,
        clientName: job.company || null,
        jobUrl: job.url,
        jobDescription: job.description ?? "",
        source: "search",
        jobId: job.id,
      }),
    {
      onSuccess: ({ id }) => {
        request.mutate({ taskType: "upwork.proposal", payload: { proposalId: id } });
        router.push(proposalHref(id));
      },
    },
  );

  if (job.board?.domain === UPWORK_DOMAIN) {
    return (
      <Button
        variant="contained"
        loading={draftProposal.isPending}
        onClick={() => draftProposal.mutate()}
      >
        Draft proposal
      </Button>
    );
  }

  const applyNow = () =>
    request.mutate({ taskType: "job.apply", payload: { feedId: job.feedId, jobKey: job.key } });

  switch (job.status) {
    case "pending":
      return (
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            loading={setStatus.isPending}
            onClick={() => setStatus.mutate("approved")}
          >
            Approve
          </Button>
          <Button loading={request.isPending} onClick={applyNow}>
            Apply now
          </Button>
        </Stack>
      );
    case "approved":
      return (
        <Stack direction="row" spacing={1}>
          <Button variant="contained" loading={request.isPending} onClick={applyNow}>
            Apply now
          </Button>
          <Button loading={setStatus.isPending} onClick={() => setStatus.mutate("pending")}>
            Move back to To review
          </Button>
        </Stack>
      );
    case "needs_user":
      return (
        <Stack direction="row" spacing={1}>
          {parked ? (
            <Button variant="contained" loading={request.isPending} onClick={applyNow}>
              Apply now
            </Button>
          ) : (
            <LinkButton href="/pilot" variant="contained">
              Answer in Pilot
            </LinkButton>
          )}
          <Button color="inherit" loading={skip.isPending} onClick={() => skip.mutate()}>
            Skip
          </Button>
        </Stack>
      );
    case "failed":
      return (
        <Button
          variant="contained"
          loading={request.isPending}
          onClick={() =>
            request.mutate({ taskType: "job.retryFailed", payload: { feedId: job.feedId } })
          }
        >
          Retry
        </Button>
      );
    case "skipped":
      return (
        <Button
          variant="outlined"
          loading={request.isPending}
          onClick={() =>
            request.mutate({
              taskType: "job.rescanSkipped",
              payload: { feedId: job.feedId, jobKeys: [job.key] },
            })
          }
        >
          Rescan
        </Button>
      );
    default:
      return null;
  }
}

interface JobDetailProps {
  job: PipelineJobDto;
  /** On the parked-job page, where answering means applying. */
  parked?: boolean;
}

/** Brief keys the header and fields above already show. */
const SHOWN_ABOVE = new Set(["title", "company", "location", "salary"]);

/** One job: its brief, why it scored what it did, why it stopped, and what to do next. */
export function JobDetail(props: JobDetailProps): ReactElement {
  const { job, parked = false } = props;
  const brief = Object.entries(job.brief ?? {}).filter(
    ([key, value]) => !SHOWN_ABOVE.has(key) && briefValue(value) !== "",
  );
  const reason = job.failReason ?? job.skipReason ?? null;

  return (
    <Stack spacing={2}>
      <Typography variant="body2Muted">
        {[job.company, job.location, job.board?.name].filter(Boolean).join(" · ")}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <StatusChip domain="job" value={job.status} />
        <Button
          href={job.url}
          target="_blank"
          rel="noopener"
          size="small"
          endIcon={<OpenInNew fontSize="sm" />}
        >
          Open posting
        </Button>
      </Stack>
      <Box>
        <JobActions job={job} parked={parked} />
      </Box>
      <Divider />
      {job.matchScore !== null && (
        <Field label={`Score ${job.matchScore}`}>{job.matchReason ?? "No reason given."}</Field>
      )}
      {reason && <Field label={job.status === "failed" ? "Why it failed" : "Why"}>{reason}</Field>}
      {job.retryNotes && <Field label="Retry notes">{job.retryNotes}</Field>}
      {job.salary && <Field label="Salary">{job.salary}</Field>}
      <Field label="From">{job.feed.name}</Field>
      {brief.length > 0 && (
        <>
          <Divider />
          <Typography variant="overlineMuted">Job brief</Typography>
          {brief.map(([key, value]) => (
            <Field key={key} label={humanizeKey(key)}>
              {briefValue(value)}
            </Field>
          ))}
        </>
      )}
    </Stack>
  );
}
