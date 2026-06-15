import type { ResumeData } from "@jobpilot/contracts/resume";
import { singleton } from "tsyringe";
import { PrismaClient } from "@/generated/prisma/client";
import { scoreFit, type FitProfile, type FitResult, type JobDigest } from "./fit";
import { deriveProfileFitInputs } from "./profile-fit";

interface ScoreJobFitInput {
  digest: JobDigest;
  profile?: Partial<FitProfile>;
}

@singleton()
export class ScoringService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Loads the profile's primary resume, derives fit inputs from it, merges any
   * caller-provided profile overrides, and scores the job digest.
   */
  async scoreJobFit(profileId: number, { digest, profile }: ScoreJobFitInput): Promise<FitResult> {
    const found = await this.prisma.profile.findUnique({
      where: { id: profileId },
      select: { primaryResumeId: true },
    });

    let derived = { techStack: [] as string[], yearsExperience: null as number | null };

    if (found?.primaryResumeId) {
      const resume = await this.prisma.resume.findUnique({
        where: { id: found.primaryResumeId },
        select: { content: true },
      });

      if (resume?.content) {
        try {
          derived = deriveProfileFitInputs(JSON.parse(resume.content) as ResumeData);
        } catch {
          // resume content malformed — fall back to caller-provided profile only
        }
      }
    }

    const fitProfile = {
      techStack: profile?.techStack ?? derived.techStack,
      yearsExperience:
        profile?.yearsExperience !== undefined ? profile.yearsExperience : derived.yearsExperience,
    };

    return scoreFit(digest, fitProfile);
  }
}
