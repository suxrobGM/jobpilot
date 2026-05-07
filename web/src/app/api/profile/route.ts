import { err, ErrorCodes, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { profileWithAutopilotSchema } from "@/lib/schemas/profile";
import { resumePath } from "@/lib/storage";

const SINGLETON_ID = 1;

export async function GET() {
  const profile = await db.profile.findUnique({
    where: { id: SINGLETON_ID },
    include: {
      defaultResume: true,
      resumes: { orderBy: { createdAt: "desc" } },
      autopilot: true,
    },
  });

  if (!profile) {
    return ok({
      profile: null,
      autopilot: null,
      defaultResumeAbsolutePath: null,
    });
  }

  return ok({
    profile: {
      ...profile,
      preferredLocations: JSON.parse(profile.preferredLocations) as string[],
    },
    autopilot: profile.autopilot
      ? {
          ...profile.autopilot,
          skipCompanies: JSON.parse(profile.autopilot.skipCompanies) as string[],
          skipTitleKeywords: JSON.parse(profile.autopilot.skipTitleKeywords) as string[],
        }
      : null,
    defaultResumeAbsolutePath: profile.defaultResume
      ? resumePath(profile.defaultResume.filename)
      : null,
  });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const parsed = profileWithAutopilotSchema.safeParse(body);

  if (!parsed.success) {
    return err(ErrorCodes.UNPROCESSABLE, "Invalid profile payload", 422, parsed.error.issues);
  }

  const { autopilot, preferredLocations, ...profileFields } = parsed.data;
  const preferredLocationsJson = JSON.stringify(preferredLocations);

  const profile = await db.profile.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      ...profileFields,
      preferredLocations: preferredLocationsJson,
    },
    update: {
      ...profileFields,
      preferredLocations: preferredLocationsJson,
    },
  });

  if (autopilot) {
    await db.autopilotSettings.upsert({
      where: { profileId: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        profileId: SINGLETON_ID,
        ...autopilot,
        skipCompanies: JSON.stringify(autopilot.skipCompanies),
        skipTitleKeywords: JSON.stringify(autopilot.skipTitleKeywords),
      },
      update: {
        ...autopilot,
        skipCompanies: JSON.stringify(autopilot.skipCompanies),
        skipTitleKeywords: JSON.stringify(autopilot.skipTitleKeywords),
      },
    });
  }

  return ok({ id: profile.id });
}
