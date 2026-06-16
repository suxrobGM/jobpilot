import type { JobBoardInput, JobBoardPatch } from "@jobpilot/contracts/job-board";
import { singleton } from "tsyringe";
import { CryptoService, SECRET_CONTEXTS } from "@/common/crypto";
import { findOwned } from "@/common/errors";
import { PrismaClient } from "@/generated/prisma/client";

@singleton()
export class JobBoardService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly crypto: CryptoService,
  ) {}

  private async decryptRow<T extends { password: string | null }>(
    userId: string,
    row: T,
  ): Promise<T> {
    return {
      ...row,
      password: await this.crypto.decryptField(userId, SECRET_CONTEXTS.boardPassword, row.password),
    };
  }

  async list(userId: string, profileId: string) {
    const rows = await this.prisma.jobBoard.findMany({
      where: { profileId },
      orderBy: { sortOrder: "asc" },
    });
    return Promise.all(rows.map((row) => this.decryptRow(userId, row)));
  }

  async create(userId: string, profileId: string, input: JobBoardInput) {
    const row = await this.prisma.jobBoard.create({
      data: {
        ...input,
        profileId,
        password: await this.crypto.encryptField(
          userId,
          SECRET_CONTEXTS.boardPassword,
          input.password,
        ),
      },
    });
    return this.decryptRow(userId, row);
  }

  private findBoard(profileId: string, id: string) {
    return findOwned(
      (where) => this.prisma.jobBoard.findFirst({ where, select: { id: true } }),
      { id, profileId },
      "Board",
    );
  }

  async update(userId: string, profileId: string, id: string, input: JobBoardPatch) {
    await this.findBoard(profileId, id);
    const row = await this.prisma.jobBoard.update({
      where: { id },
      data: {
        ...input,
        password: await this.crypto.encryptField(
          userId,
          SECRET_CONTEXTS.boardPassword,
          input.password,
        ),
      },
    });
    return this.decryptRow(userId, row);
  }

  async remove(profileId: string, id: string) {
    await this.findBoard(profileId, id);
    await this.prisma.jobBoard.delete({ where: { id } });
    return { deleted: id };
  }
}
