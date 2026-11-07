"use client";

import type { ReactElement, ReactNode } from "react";
import { UPWORK_DOMAIN } from "@jobpilot/contracts/upwork";
import { OpenInNew } from "@mui/icons-material";
import { Box, Button, Divider, Link, Stack, Typography } from "@mui/material";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/api/client";
import { pipelineQueries } from "@/api/queries";
import type { PipelineJobDto } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { LinkButton } from "@/components/ui/buttons";
import { StatusChip } from "@/components/ui/display";
import { proposalHref } from "@/utils/routes";

/** "mustHaves" → "Must haves". */
function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function briefValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(briefValue).join(", ");
  }
  if (value !== null && typeof value === "object") {
    return JSON.stringify(value);
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
}

function JobActions(props: JobActionsProps): ReactNode {
  const { job } = props;
  const request = useCreateRequest();
  const router = useRouter();
  const onPilot = usePathname().startsWith("/pilot");
  const endpoint = api.feeds({ id: job.feedId }).jobs({ key: job.key });
  const invalidate = [pipelineQueries.all];

  const setStatus = useApiMutation((status: "approved" | "pending") => endpoint.patch({ status }), {
    invalidate,
  });
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
      // Pilot shows the job beside its question, so the next step there is applying.
      return onPilot ? (
        <Button variant="contained" loading={request.isPending} onClick={applyNow}>
          Apply now
        </Button>
      ) : (
        <LinkButton href="/pilot" variant="contained">
          Answer in Pilot
        </LinkButton>
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
  /** Sits beside the title: a close button in the drawer, nothing inline. */
  action?: ReactNode;
}

/** One job: its brief, why it scored what it did, why it stopped, and what to do next. */
export function JobDetail(props: JobDetailProps): ReactElement {
  const { job, action } = props;
  const brief = Object.entries(job.brief ?? {}).filter(([, value]) => briefValue(value) !== "");
  const reason = job.failReason ?? job.skipReason ?? null;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h3" component="h2">
            {job.title}
          </Typography>
          <Typography variant="body2Muted">
            {[job.company, job.location, job.board?.name].filter(Boolean).join(" · ")}
          </Typography>
        </Box>
        {action}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <StatusChip domain="job" value={job.status} />
        <Link
          href={job.url}
          target="_blank"
          rel="noopener"
          variant="body2"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
        >
          Open posting
          <OpenInNew fontSize="sm" />
        </Link>
      </Stack>
      <Box>
        <JobActions job={job} />
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
