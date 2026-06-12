import "server-only";
import type { PortfolioProject, UpdateUpworkProfileInput } from "@/api/contracts/upwork";
import type { UpworkProfileDto } from "@/api/types";
import type { UpworkProfile } from "@/generated/prisma/client";
import { db } from "@/server/db";

/** Plain column writes — shared by upsert's create and update (no Prisma field-op wrappers). */
interface UpworkProfileFields {
  currentTitle?: string | null;
  currentOverview?: string | null;
  currentHourlyRate?: string | null;
  currentPortfolio?: string;
  suggestedTitle?: string | null;
  suggestedOverview?: string | null;
  suggestedHourlyRate?: string | null;
  suggestedPortfolio?: string;
  status?: string;
  appliedAt?: Date | null;
}

function parsePortfolio(json: string): PortfolioProject[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as PortfolioProject[]) : [];
  } catch {
    return [];
  }
}

function toDto(row: UpworkProfile): UpworkProfileDto {
  return {
    id: row.id,
    currentTitle: row.currentTitle,
    currentOverview: row.currentOverview,
    currentHourlyRate: row.currentHourlyRate,
    currentPortfolio: parsePortfolio(row.currentPortfolio),
    suggestedTitle: row.suggestedTitle,
    suggestedOverview: row.suggestedOverview,
    suggestedHourlyRate: row.suggestedHourlyRate,
    suggestedPortfolio: parsePortfolio(row.suggestedPortfolio),
    status: row.status as UpworkProfileDto["status"],
    updatedAt: row.updatedAt.toISOString(),
    appliedAt: row.appliedAt?.toISOString() ?? null,
  };
}

export async function getUpworkProfile(profileId: number): Promise<UpworkProfileDto | null> {
  const row = await db.upworkProfile.findUnique({ where: { profileId } });
  return row ? toDto(row) : null;
}

/**
 * Create or update the profile-enhancement record. Only provided fields are
 * written; portfolio arrays are JSON-encoded. Moving to `applied` stamps
 * `appliedAt` (set by the skill after it writes the live Upwork profile).
 */
export async function upsertUpworkProfile(
  profileId: number,
  input: UpdateUpworkProfileInput,
): Promise<UpworkProfileDto> {
  const fields: UpworkProfileFields = {};

  if (input.currentTitle != null) fields.currentTitle = input.currentTitle;
  if (input.currentOverview != null) fields.currentOverview = input.currentOverview;
  if (input.currentHourlyRate != null) fields.currentHourlyRate = input.currentHourlyRate;
  if (input.currentPortfolio != null) {
    fields.currentPortfolio = JSON.stringify(input.currentPortfolio);
  }
  if (input.suggestedTitle != null) fields.suggestedTitle = input.suggestedTitle;
  if (input.suggestedOverview != null) fields.suggestedOverview = input.suggestedOverview;
  if (input.suggestedHourlyRate != null) {
    fields.suggestedHourlyRate = input.suggestedHourlyRate;
  }
  if (input.suggestedPortfolio != null) {
    fields.suggestedPortfolio = JSON.stringify(input.suggestedPortfolio);
  }
  if (input.status != null) {
    fields.status = input.status;
    fields.appliedAt = input.status === "applied" ? new Date() : null;
  }

  const row = await db.upworkProfile.upsert({
    where: { profileId },
    create: { profileId, ...fields },
    update: fields,
  });

  return toDto(row);
}
