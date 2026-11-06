import { inject, injectable } from "@needle-di/core";
import { notFound } from "@/common/errors";
import { PrismaClient } from "@/generated/prisma/client";

const answerFields = { key: true, value: true, updatedAt: true } as const;

@injectable()
export class ProfileAnswerService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  list(userId: string) {
    return this.prisma.profileAnswer.findMany({
      where: { userId },
      orderBy: { key: "asc" },
      select: answerFields,
    });
  }

  save(userId: string, key: string, value: string) {
    return this.prisma.profileAnswer.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, value },
      update: { value },
      select: answerFields,
    });
  }

  async remove(userId: string, key: string) {
    const { count } = await this.prisma.profileAnswer.deleteMany({ where: { userId, key } });
    if (count === 0) throw notFound("Answer not found");
    return { ok: true as const };
  }
}
