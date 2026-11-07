import { inject, injectable } from "@needle-di/core";
import { unprocessable } from "@/common/errors";
import { PrismaClient } from "@/generated/prisma/client";
import { FeedService } from "@/modules/feed/feed.service";

/** The networking feed, for outreach that belongs to no job. */
@injectable()
export class StandingNetworkingService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly feeds = inject(FeedService),
  ) {}

  /** Outreach is drafted from a resume, so finding contacts needs one first. */
  async getOrCreate(userId: string) {
    const resumes = await this.prisma.resume.count({ where: { userId } });
    if (resumes === 0) {
      throw unprocessable("Upload a resume before finding contacts.");
    }
    return this.feeds.ensure(userId, "networking");
  }
}
