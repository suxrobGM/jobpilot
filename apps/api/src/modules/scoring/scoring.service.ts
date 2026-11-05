import { inject, injectable } from "@needle-di/core";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import { readContent } from "@/modules/resume/content";
import { type FitResult, scoreFit } from "./fit";
import { deriveProfileFitInputs } from "./profile-fit";
import type { FitProfile, JobBrief } from "./scoring.schema";

interface ScoreJobFitInput {
  brief: JobBrief;
  profile?: Partial<FitProfile>;
  resumeId?: string;
  minScore?: number;
}

@injectable()
export class ScoringService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  /**
   * Loads the user's primary resume, derives fit inputs from it, merges any
   * caller-provided profile overrides, and scores the job brief.
   */
  async scoreJobFit(
    userId: string,
    { brief, profile, resumeId, minScore }: ScoreJobFitInput,
  ): Promise<FitResult> {
    // Prefer an explicit, owned resume override; otherwise the user's primary.
    const [content, user] = await Promise.all([
      this.resolveBaseResumeContent(userId, resumeId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          profile: { select: { requiresSponsorship: true } },
          autoApply: { select: { minMatchScore: true } },
        },
      }),
    ]);

    let derived = { skills: [] as string[], yearsExperience: null as number | null };

    if (content !== null) {
      derived = deriveProfileFitInputs(readContent(content));
    }

    const fitProfile = {
      skills: profile?.skills ?? derived.skills,
      yearsExperience:
        profile?.yearsExperience !== undefined ? profile.yearsExperience : derived.yearsExperience,
      // From the profile, not the caller: omitting the flag must not skip the eligibility check.
      requiresSponsorship: user?.profile?.requiresSponsorship ?? false,
    };

    // A caller that omits the threshold gets the user's own auto-apply bar, not a global constant.
    return scoreFit(brief, fitProfile, minScore ?? user?.autoApply?.minMatchScore);
  }

  /**
   * Resolve the scoring base resume's content in a single query per path: an
   * owned `resumeId` override, else the user's primary (via relation).
   */
  private async resolveBaseResumeContent(
    userId: string,
    resumeId?: string,
  ): Promise<Prisma.JsonValue> {
    if (resumeId) {
      const override = await this.prisma.resume.findFirst({
        where: { id: resumeId, userId },
        select: { content: true },
      });
      if (override) return override.content;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { primaryResume: { select: { content: true } } },
    });
    return user?.primaryResume?.content ?? null;
  }
}
