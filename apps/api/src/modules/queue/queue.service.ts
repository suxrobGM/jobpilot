import type { AddQueueEntry, PatchQueueEntry, QueueStatus } from "@jobpilot/contracts/queue";
import { singleton } from "tsyringe";
import { findOwned } from "@/common/errors";
import { pipelineChannel } from "@/common/sse/channels/pipeline";
import { publish } from "@/common/sse";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";

type QueueEntryRow = Omit<Prisma.QueueEntryGetPayload<{}>, "status" | "createdAt" | "consumedAt"> & {
  status: QueueStatus;
  createdAt: string;
  consumedAt: string | null;
};

function serializeQueueEntry(row: Prisma.QueueEntryGetPayload<{}>): QueueEntryRow {
  return {
    ...row,
    status: row.status as QueueStatus,
    createdAt: row.createdAt.toISOString(),
    consumedAt: row.consumedAt?.toISOString() ?? null,
  };
}

@singleton()
export class QueueService {
  constructor(private readonly prisma: PrismaClient) {}

  private findEntry(id: number, profileId: number) {
    return findOwned(
      (where) => this.prisma.queueEntry.findFirst({ where, select: { id: true } }),
      { id, profileId },
      "Queue entry",
    );
  }

  async list(profileId: number, status?: string): Promise<QueueEntryRow[]> {
    const where: Prisma.QueueEntryWhereInput = { profileId };
    if (status) {
      where.status = status;
    }
    const rows = await this.prisma.queueEntry.findMany({ where, orderBy: { createdAt: "asc" } });
    return rows.map(serializeQueueEntry);
  }

  async listPending(profileId: number): Promise<QueueEntryRow[]> {
    const rows = await this.prisma.queueEntry.findMany({
      where: { profileId, status: "pending" },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(serializeQueueEntry);
  }

  async add(profileId: number, input: AddQueueEntry) {
    const created = await this.prisma.$transaction(
      input.urls.map((u) =>
        this.prisma.queueEntry.upsert({
          where: { profileId_url: { profileId, url: u } },
          create: { profileId, url: u, note: input.note ?? null, status: "pending" },
          update: { note: input.note ?? null, status: "pending" },
        }),
      ),
    );
    publish(pipelineChannel, { profileId }, { type: "queue.updated" });
    return { inserted: created.length, items: created.map(serializeQueueEntry) };
  }

  async patch(profileId: number, id: number, input: PatchQueueEntry): Promise<QueueEntryRow> {
    await this.findEntry(id, profileId);
    const updated = await this.prisma.queueEntry.update({
      where: { id },
      data: {
        status: input.status,
        consumedAt: input.status === "consumed" ? new Date() : null,
      },
    });
    return serializeQueueEntry(updated);
  }

  async remove(profileId: number, id: number) {
    await this.findEntry(id, profileId);
    await this.prisma.queueEntry.delete({ where: { id } });
    return { deleted: id };
  }
}
