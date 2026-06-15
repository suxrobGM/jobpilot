import type { AddQueueEntry, PatchQueueEntry, QueueStatus } from "@jobpilot/contracts/queue";
import { singleton } from "tsyringe";
import { findOwned } from "@/common/errors";
import { pipelineChannel } from "@/common/sse/channels/pipeline";
import { publish } from "@/common/sse";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";

type QueueEntryRow = Prisma.QueueEntryGetPayload<{}> & { status: QueueStatus };

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

  list(profileId: number, status?: string): Promise<QueueEntryRow[]> {
    const where: Prisma.QueueEntryWhereInput = { profileId };
    if (status) {
      where.status = status;
    }
    return this.prisma.queueEntry.findMany({ where, orderBy: { createdAt: "asc" } }) as Promise<
      QueueEntryRow[]
    >;
  }

  listPending(profileId: number): Promise<QueueEntryRow[]> {
    return this.prisma.queueEntry.findMany({
      where: { profileId, status: "pending" },
      orderBy: { createdAt: "asc" },
    }) as Promise<QueueEntryRow[]>;
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
    return { inserted: created.length, items: created as QueueEntryRow[] };
  }

  async patch(profileId: number, id: number, input: PatchQueueEntry): Promise<QueueEntryRow> {
    await this.findEntry(id, profileId);
    return this.prisma.queueEntry.update({
      where: { id },
      data: {
        status: input.status,
        consumedAt: input.status === "consumed" ? new Date() : null,
      },
    }) as Promise<QueueEntryRow>;
  }

  async remove(profileId: number, id: number) {
    await this.findEntry(id, profileId);
    await this.prisma.queueEntry.delete({ where: { id } });
    return { deleted: id };
  }
}
