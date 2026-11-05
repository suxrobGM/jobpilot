import { inject, injectable } from "@needle-di/core";
import { unprocessable } from "@/common/errors";
import { PrismaClient } from "@/generated/prisma/client";
import { CampaignService } from "@/modules/campaign/campaign.service";

/** The one open networking campaign, for outreach that belongs to no job. */
@injectable()
export class StandingNetworkingService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly campaigns = inject(CampaignService),
  ) {}

  /** Networking campaigns need a resume; the primary one, else the newest. */
  async getOrCreate(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { primaryResumeId: true },
    });
    const newest = user.primaryResumeId
      ? null
      : await this.prisma.resume.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
    const resumeId = user.primaryResumeId ?? newest?.id;
    if (!resumeId) throw unprocessable("Upload a resume before finding contacts.");
    return this.campaigns.create(userId, {
      query: "Networking",
      source: "networking",
      feed: "networking",
      createdBy: "user",
      config: { resumeId },
    });
  }
}
