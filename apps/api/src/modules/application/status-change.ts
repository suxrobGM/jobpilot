import type { ApplicationEventSource, ApplicationStatus } from "@jobpilot/contracts/application";
import type { PrismaClient } from "@/generated/prisma/client";

interface StatusChangeArgs {
  applicationId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  source: ApplicationEventSource;
  note?: string | null;
}

/** Accepts the client or an interactive-transaction client: only these two delegates are used. */
type StatusChangeClient = Pick<PrismaClient, "application" | "applicationEvent">;

/**
 * The paired writes for a status transition - update the application and log a
 * `status_change` activity event. Returns the ops to spread into a `$transaction`
 * so callers can append their own (e.g. the inbox marking a message reviewed).
 */
export function statusChangeOps(prisma: StatusChangeClient, args: StatusChangeArgs) {
  const { applicationId, fromStatus, toStatus, source, note } = args;
  return [
    prisma.application.update({
      where: { id: applicationId },
      data: { status: toStatus },
    }),
    prisma.applicationEvent.create({
      data: {
        applicationId,
        kind: "status_change",
        fromStatus,
        toStatus,
        source,
        note: note ?? null,
      },
    }),
  ];
}
