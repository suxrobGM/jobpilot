import {
  type CreatePilotRequestInput,
  createPilotRequestSchema,
  type PilotRequest,
  type RequestableTaskType,
} from "@jobpilot/contracts/pilot";
import type {
  PilotRequest as PilotRequestModel,
  PilotRunOutcome,
  PilotSubjectType,
  Prisma,
} from "@/generated/prisma/client";
import { jobSubjectId } from "../runs/run-history";

interface RequestSubject {
  subjectType: PilotSubjectType;
  subjectId: string;
}

/** The subject the request's task will carry, so the run that starts on it can be matched back. */
export function requestSubject(input: CreatePilotRequestInput, requestId: string): RequestSubject {
  switch (input.taskType) {
    case "job.apply":
      return {
        subjectType: "job",
        subjectId: jobSubjectId({
          feedId: input.payload.feedId,
          key: input.payload.jobKey,
        }),
      };
    case "job.rescanSkipped":
    case "job.retryFailed":
      return { subjectType: "feed", subjectId: input.payload.feedId };
    case "inbox.review":
      return { subjectType: "inbox", subjectId: "inbox" };
    case "upwork.syncInbox":
      return { subjectType: "upwork", subjectId: "inbox" };
    case "inbox.jobAlerts":
      return { subjectType: "inbox", subjectId: "jobAlerts" };
    case "research.explore":
      return { subjectType: "pilot", subjectId: "research" };
    case "search.discover":
      return { subjectType: "feed", subjectId: input.payload.searchId };
    case "resume.extract":
      return { subjectType: "resume", subjectId: input.payload.resumeId };
    case "resume.tailor":
    case "networking.find":
    case "networking.rewrite":
      return { subjectType: "request", subjectId: requestId };
    case "upwork.profile":
      return { subjectType: "upwork", subjectId: "profile" };
    case "upwork.proposal":
    case "upwork.submit":
      return { subjectType: "upwork", subjectId: input.payload.proposalId };
  }
}

const REQUEST_TITLES: Record<RequestableTaskType, string> = {
  "job.apply": "Apply to a job",
  "job.rescanSkipped": "Rescan skipped jobs",
  "job.retryFailed": "Retry failed jobs",
  "inbox.review": "Review the inbox",
  "upwork.syncInbox": "Refresh the Upwork inbox",
  "search.discover": "Run a search now",
  "inbox.jobAlerts": "Import job alert emails",
  "research.explore": "Research jobs beyond your boards",
  "resume.extract": "Read a resume",
  "resume.tailor": "Tailor a resume",
  "networking.find": "Find contacts",
  "networking.rewrite": "Rewrite outreach drafts",
  "upwork.profile": "Work on the Upwork profile",
  "upwork.proposal": "Write an Upwork proposal",
  "upwork.submit": "Submit an Upwork proposal",
};

/** The stored row read back as the request it was created from. */
export function parseRequest(row: Pick<PilotRequestModel, "taskType" | "payload">) {
  return createPilotRequestSchema.parse({ taskType: row.taskType, payload: row.payload });
}

export function toPilotRequest(row: PilotRequestModel): PilotRequest {
  const taskType = parseRequest(row).taskType;
  return {
    id: row.id,
    taskType,
    title: REQUEST_TITLES[taskType],
    status: row.status,
    source: row.source,
    runId: row.runId,
    createdAt: row.createdAt,
    finishedAt: row.finishedAt,
  };
}

/** An expired run failed its request: the agent never finished. */
const REQUEST_OUTCOMES: Record<PilotRunOutcome, PilotRequestModel["status"]> = {
  done: "done",
  failed: "failed",
  cancelled: "cancelled",
  expired: "failed",
};

/** Closes whatever request the run picked up, in the caller's transaction. */
export async function finishRequests(
  tx: Pick<Prisma.TransactionClient, "pilotRequest">,
  runIds: string[],
  outcome: PilotRunOutcome,
  now: Date,
): Promise<PilotRequestModel[]> {
  if (runIds.length === 0) return [];
  return tx.pilotRequest.updateManyAndReturn({
    where: { runId: { in: runIds }, status: "running" },
    data: { status: REQUEST_OUTCOMES[outcome], finishedAt: now },
  });
}
