import type { ProfileWithAutoApplyInput } from "@jobpilot/contracts/profile";
import { singleton } from "tsyringe";
import { findOwned } from "@/common/errors";
import { resumePath } from "@/common/storage";
import { PrismaClient } from "@/generated/prisma/client";

const PROFILE_SCALAR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  website: true,
  linkedin: true,
  github: true,
  street: true,
  aptUnit: true,
  city: true,
  state: true,
  zipCode: true,
  country: true,
  usAuthorized: true,
  requiresSponsorship: true,
  visaStatus: true,
  optExtension: true,
  willingToRelocate: true,
  preferredLocations: true,
  eeoGender: true,
  eeoRace: true,
  eeoEthnicity: true,
  eeoHispanicOrLatino: true,
  eeoVeteranStatus: true,
  eeoDisabilityStatus: true,
  primaryResumeId: true,
  updatedAt: true,
} as const;

@singleton()
export class ProfileService {
  constructor(private readonly prisma: PrismaClient) {}

  async get(profileId: string) {
    const profile = await findOwned(
      (where) => this.prisma.profile.findFirst({ where, select: PROFILE_SCALAR_SELECT }),
      { id: profileId },
      "Profile",
    );

    const [autoApply, primarySource, resumeRows, withContent, references] = await Promise.all([
      this.prisma.autoApplySettings.findUnique({ where: { profileId } }),
      profile.primaryResumeId
        ? this.prisma.resume.findUnique({
            where: { id: profile.primaryResumeId },
            select: { sourceFilename: true },
          })
        : Promise.resolve(null),
      this.prisma.resume.findMany({
        where: { profileId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          label: true,
          sourceFilename: true,
          updatedAt: true,
          _count: { select: { variants: true } },
        },
      }),
      this.prisma.resume.findMany({
        where: { profileId, content: { not: null } },
        select: { id: true },
      }),
      this.prisma.reference.findMany({
        where: { profileId },
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          relationship: true,
          company: true,
          email: true,
          phone: true,
        },
      }),
    ]);

    const hasContentIds = new Set(withContent.map((r) => r.id));
    const resumes = resumeRows.map((r) => ({
      id: r.id,
      label: r.label,
      sourceFilename: r.sourceFilename,
      hasData: hasContentIds.has(r.id),
      variantCount: r._count.variants,
      isPrimary: r.id === profile.primaryResumeId,
      updatedAt: r.updatedAt,
    }));

    return {
      profile: {
        ...profile,
        preferredLocations: JSON.parse(profile.preferredLocations) as string[],
        references,
        updatedAt: profile.updatedAt,
      },
      autoApply,
      primaryResumeSourceAbsolutePath: primarySource?.sourceFilename
        ? resumePath(primarySource.sourceFilename)
        : null,
      resumes,
    };
  }

  async update(profileId: string, body: ProfileWithAutoApplyInput) {
    const { autoApply, preferredLocations, primaryResumeId, references, ...profileFields } = body;
    const preferredLocationsJson = JSON.stringify(preferredLocations);

    await this.prisma.profile.update({
      where: { id: profileId },
      data: {
        ...profileFields,
        preferredLocations: preferredLocationsJson,
        primaryResumeId: primaryResumeId ?? null,
      },
    });

    // Replace the reference set wholesale — the settings form submits the full list.
    await this.prisma.$transaction([
      this.prisma.reference.deleteMany({ where: { profileId } }),
      this.prisma.reference.createMany({
        data: references.map((r, i) => ({
          profileId,
          name: r.name,
          relationship: r.relationship ?? null,
          company: r.company ?? null,
          email: r.email ?? null,
          phone: r.phone ?? null,
          position: i,
        })),
      }),
    ]);

    if (autoApply) {
      await this.prisma.autoApplySettings.upsert({
        where: { profileId },
        create: { profileId, ...autoApply },
        update: autoApply,
      });
    }

    return { id: profileId };
  }

  /** Point the profile at one of its own resumes (or clear it with `null`). */
  async setPrimaryResume(profileId: string, resumeId: string | null) {
    if (resumeId !== null) {
      await findOwned(
        (where) => this.prisma.resume.findFirst({ where, select: { id: true } }),
        { id: resumeId, profileId },
        "Resume",
      );
    }

    await this.prisma.profile.update({
      where: { id: profileId },
      data: { primaryResumeId: resumeId },
    });

    return { primaryResumeId: resumeId };
  }
}
