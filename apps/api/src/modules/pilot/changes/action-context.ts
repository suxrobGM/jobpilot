import type { PilotChangeAction } from "@jobpilot/contracts/pilot";
import type { Prisma } from "@/generated/prisma/client";

export type ChangeTx = Pick<
  Prisma.TransactionClient,
  "pilotState" | "feed" | "job" | "profileAnswer" | "pilotRun"
>;

/** What one action needs: the transaction, the boards resolved before it, and work for after commit. */
export interface ActionContext {
  tx: ChangeTx;
  userId: string;
  now: Date;
  /** Board domain → catalog id, resolved outside the transaction since resolving may insert. */
  boardIds: ReadonlyMap<string, string | null>;
  /** Events to publish once the transaction commits. */
  afterCommit: (() => void)[];
}

export type ActionOf<T extends PilotChangeAction["type"]> = Extract<PilotChangeAction, { type: T }>;
