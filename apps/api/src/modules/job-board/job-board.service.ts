import type { JobBoardInput, JobBoardPatch } from "@jobpilot/contracts/job-board";
import { singleton } from "tsyringe";
import { findOwned } from "@/common/errors";
import { PrismaClient } from "@/generated/prisma/client";

@singleton()
export class JobBoardService {
  constructor(private readonly prisma: PrismaClient) {}

  list(profileId: number) {
    return this.prisma.jobBoard.findMany({
      where: { profileId },
      orderBy: { sortOrder: "asc" },
    });
  }

  create(profileId: number, input: JobBoardInput) {
    return this.prisma.jobBoard.create({ data: { ...input, profileId } });
  }

  private findBoard(profileId: number, id: number) {
    return findOwned(
      (where) => this.prisma.jobBoard.findFirst({ where, select: { id: true } }),
      { id, profileId },
      "Board",
    );
  }

  async update(profileId: number, id: number, input: JobBoardPatch) {
    await this.findBoard(profileId, id);
    return this.prisma.jobBoard.update({ where: { id }, data: input });
  }

  async remove(profileId: number, id: number) {
    await this.findBoard(profileId, id);
    await this.prisma.jobBoard.delete({ where: { id } });
    return { deleted: id };
  }
}
