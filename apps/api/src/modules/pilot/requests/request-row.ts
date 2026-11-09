import {
  type CreatePilotRequestInput,
  createPilotRequestSchema,
  type PilotRequest,
  TASK_SUBJECT_TYPES,
  taskTypeLabel,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { publish } from "@/common/sse";
import type {
  PilotRequest as PilotRequestModel,
  PilotRunOutcome,
  PilotSubjectType,
  Prisma,
} from "@/generated/prisma/client";
import { jobSubjectId, toJobRef } from "../job-subject";

interface RequestSubject {
  subjectType: PilotSubjectType;
  subjectId: string;
}

/** Matches the subject id `TASK_DEFS` gives the task built from this request. */
function requestSubjectId(input: CreatePilotRequestInput, requestId: string): string {
  switch (input.taskType) {
    case "job.apply":
      return jobSubjectId(toJobRef(input.payload));
    case "job.rescanSkipped":
    case "job.retryFailed":
      return input.payload.feedId;
    case "inbox.review":
    case "upwork.syncInbox":
      return "inbox";
    case "inbox.jobAlerts":
      return "jobAlerts";
    case "search.setup":
      return "setup";
    case "research.explore":
      return "research";
    case "search.discover":
      return input.payload.searchId;
    case "resume.extract":
      return input.payload.resumeId;
    case "resume.tailor":
    case "networking.find":
    case "networking.rewrite":
      return requestId;
    case "upwork.profile":
      return "profile";
    case "upwork.proposal":
    case "upwork.submit":
      return input.payload.proposalId;
  }
}

/** The subject the request's task will carry, so the run that starts on it can be matched back. */
export function requestSubject(input: CreatePilotRequestInput, requestId: string): RequestSubject {
  return {
    subjectType: TASK_SUBJECT_TYPES[input.taskType],
    subjectId: requestSubjectId(input, requestId),
  };
}

/** The stored row read back as the request it was created from. */
export function parseRequest(row: Pick<PilotRequestModel, "taskType" | "payload">) {
  return createPilotRequestSchema.parse({ taskType: row.taskType, payload: row.payload });
}

/** The task's label, plus what the user narrowed it to. */
function requestTitle(input: CreatePilotRequestInput): string {
  const label = taskTypeLabel(input.taskType);
  if (input.taskType === "research.explore" && input.payload.focus) {
    return `${label}: ${input.payload.focus}`;
  }
  return label;
}

export function toPilotRequest(row: PilotRequestModel): PilotRequest {
  const input = parseRequest(row);
  return {
    id: row.id,
    taskType: input.taskType,
    title: requestTitle(input),
    status: row.status,
    source: row.source,
    runId: row.runId,
    createdAt: row.createdAt,
    finishedAt: row.finishedAt,
  };
}

export function publishRequest(
  userId: string,
  row: PilotRequestModel,
  type: "request.created" | "request.updated",
): PilotRequest {
  const request = toPilotRequest(row);
  publish(pilotChannel, { userId }, { type, request });
  return request;
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
  if (runIds.length === 0) {
    return [];
  }
  return tx.pilotRequest.updateManyAndReturn({
    where: { runId: { in: runIds }, status: "running" },
    data: { status: REQUEST_OUTCOMES[outcome], finishedAt: now },
  });
}
