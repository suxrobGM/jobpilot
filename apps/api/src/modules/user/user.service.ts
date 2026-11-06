import type { PortfolioSettingsPatch, UserUpdateInput } from "@jobpilot/contracts/user";
import { inject, injectable } from "@needle-di/core";
import { conflict, emailNotVerified, findOwned, notFound } from "@/common/errors";
import { resumePath } from "@/common/storage/storage";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { PORTFOLIO_SETTINGS_SELECT, PROFILE_SELECT, withProfile } from "./user.mapper";

const USER_SELECT = {
  id: true,
  primaryResumeId: true,
  profile: { select: PROFILE_SELECT },
} satisfies Prisma.UserSelect;

@injectable()
export class UserService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  /**
   * Gate for outward-facing actions (creating feeds, composing networking messages):
   * email verification is otherwise non-blocking, so this is the only enforcement.
   */
  async requireVerifiedEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true },
    });
    if (!user?.emailVerifiedAt) {
      throw emailNotVerified();
    }
  }

  async get(userId: string) {
    const user = withProfile(
      await findOwned(
        (where) => this.prisma.user.findFirst({ where, select: USER_SELECT }),
        { id: userId },
        "User",
      ),
    );

    const [primarySource, resumeRows, withContent, references, salaryPreferences] =
      await Promise.all([
        user.primaryResumeId
          ? this.prisma.resume.findUnique({
              where: { id: user.primaryResumeId },
              select: { sourceFilename: true },
            })
          : Promise.resolve(null),
        this.prisma.resume.findMany({
          where: { userId },
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
          where: { userId, content: { not: Prisma.DbNull } },
          select: { id: true },
        }),
        this.prisma.professionalReference.findMany({
          where: { userId },
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
        this.prisma.salaryPreference.findMany({
          where: { userId },
          orderBy: { position: "asc" },
          select: {
            id: true,
            appliesTo: true,
            minAmount: true,
            maxAmount: true,
            currency: true,
            period: true,
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
      isPrimary: r.id === user.primaryResumeId,
      updatedAt: r.updatedAt,
    }));

    return {
      user: { ...user, references, salaryPreferences },
      primaryResumeSourceAbsolutePath: primarySource?.sourceFilename
        ? resumePath(primarySource.sourceFilename)
        : null,
      resumes,
    };
  }

  async update(userId: string, body: UserUpdateInput) {
    const { preferredLocations, primaryResumeId, references, salaryPreferences, ...profileFields } =
      body;
    // Replace the reference and salary-preference sets wholesale - the settings form submits the full lists.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { primaryResumeId: primaryResumeId ?? null },
      }),
      this.prisma.profile.update({
        where: { userId },
        data: { ...profileFields, preferredLocations },
      }),
      this.prisma.professionalReference.deleteMany({ where: { userId } }),
      this.prisma.professionalReference.createMany({
        data: references.map((r, i) => ({
          userId,
          name: r.name,
          relationship: r.relationship ?? null,
          company: r.company ?? null,
          email: r.email ?? null,
          phone: r.phone ?? null,
          position: i,
        })),
      }),
      this.prisma.salaryPreference.deleteMany({ where: { userId } }),
      this.prisma.salaryPreference.createMany({
        data: salaryPreferences.map((s, i) => ({
          userId,
          appliesTo: s.appliesTo,
          minAmount: s.minAmount ?? null,
          maxAmount: s.maxAmount ?? null,
          currency: s.currency,
          period: s.period,
          position: i,
        })),
      }),
    ]);

    return { id: userId };
  }

  /** Point the user at one of their own resumes (or clear it with `null`). */
  async setPrimaryResume(userId: string, resumeId: string | null) {
    if (resumeId !== null) {
      await findOwned(
        (where) => this.prisma.resume.findFirst({ where, select: { id: true } }),
        { id: resumeId, userId },
        "Resume",
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { primaryResumeId: resumeId },
    });

    return { primaryResumeId: resumeId };
  }

  async getPortfolioSettings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PORTFOLIO_SETTINGS_SELECT,
    });
    if (!user) throw notFound("User not found");
    return withProfile(user);
  }

  /** Free when no other user holds it; the caller's own current username also reads as free.
   *  `username` arrives already normalized by `usernameSchema` on the route. */
  async checkUsername(userId: string, username: string) {
    const owner = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    return { available: !owner || owner.id === userId };
  }

  async updatePortfolioSettings(userId: string, body: PortfolioSettingsPatch) {
    if (body.username !== undefined) {
      const taken = await this.prisma.user.findUnique({
        where: { username: body.username },
        select: { id: true },
      });
      if (taken && taken.id !== userId) {
        throw conflict("That username is already taken.");
      }
    }

    const { username, ...visibility } = body;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { username, profile: { update: visibility } },
      select: PORTFOLIO_SETTINGS_SELECT,
    });

    return withProfile(updated);
  }
}
