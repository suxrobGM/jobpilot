import type { ApplicationStatus } from "@jobpilot/contracts/application";
import type { PrismaClient } from "@/generated/prisma/client";
import { statusChangeOps } from "@/modules/application/status-change";

/** Accepts the client or an interactive-transaction client: only these three delegates are used. */
type VerdictClient = Pick<PrismaClient, "application" | "applicationEvent" | "emailMessage">;

interface VerdictArgs {
  messageId: string;
  applicationId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  /** Subject of the deciding message; becomes the event note unless `note` overrides it. */
  subject: string;
  note?: string | null;
}

/** The activity-event note for a status the inbox applied. */
export function emailStatusNote(subject: string): string {
  return `From email: ${subject}`;
}

/**
 * The status transition plus marking the message reviewed, as ops to spread into a `$transaction`.
 * `scanMessage` cannot use this - its verdict rides along with the scan fields in one message write -
 * so it calls `statusChangeOps` with `emailStatusNote` directly.
 */
export function verdictOps(prisma: VerdictClient, args: VerdictArgs) {
  return [
    ...statusChangeOps(prisma, {
      applicationId: args.applicationId,
      fromStatus: args.fromStatus,
      toStatus: args.toStatus,
      source: "email",
      note: args.note ?? emailStatusNote(args.subject),
    }),
    prisma.emailMessage.update({
      where: { id: args.messageId },
      data: { reviewStatus: "approved", resultingStatus: args.toStatus },
    }),
  ];
}
