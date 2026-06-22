import type { ResumeData } from "@jobpilot/contracts/resume";
import { singleton } from "tsyringe";
import { PrismaClient } from "@/generated/prisma/client";
import { scoreFit, type FitResult } from "./fit";
import { deriveProfileFitInputs } from "./profile-fit";
import type { FitProfile, JobDigest } from "./scoring.schema";

interface ScoreJobFitInput {
  digest: JobDigest;
  profile?: Partial<FitProfile>;
  resumeId?: string;
}

@singleton()
export class ScoringService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Loads the profile's primary resume, derives fit inputs from it, merges any
   * caller-provided profile overrides, and scores the job digest.
   */
  async scoreJobFit(
    profileId: string,
    { digest, profile, resumeId }: ScoreJobFitInput,
  ): Promise<FitResult> {
    // Prefer an explicit, owned resume override; otherwise the profile's primary.
    const content = await this.resolveBaseResumeContent(profileId, resumeId);

    let derived = { techStack: [] as string[], yearsExperience: null as number | null };

    if (content) {
      try {
        derived = deriveProfileFitInputs(JSON.parse(content) as ResumeData);
      } catch {
        // resume content malformed — fall back to caller-provided profile only
      }
    }

    const fitProfile = {
      techStack: profile?.techStack ?? derived.techStack,
      yearsExperience:
        profile?.yearsExperience !== undefined ? profile.yearsExperience : derived.yearsExperience,
    };

    return scoreFit(digest, fitProfile);
  }

  /**
   * Resolve the scoring base resume's content in a single query per path: an
   * owned `resumeId` override, else the profile's primary (via relation).
   */
  private async resolveBaseResumeContent(
    profileId: string,
    resumeId?: string,
  ): Promise<string | null> {
    if (resumeId) {
      const override = await this.prisma.resume.findFirst({
        where: { id: resumeId, profileId },
        select: { content: true },
      });
      if (override) return override.content;
    }

    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      select: { primaryResume: { select: { content: true } } },
    });
    return profile?.primaryResume?.content ?? null;
  }
}
