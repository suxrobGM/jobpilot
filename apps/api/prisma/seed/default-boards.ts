import { db } from "@/common/database";
import { DEFAULT_BOARDS } from "@/modules/job-board/default-boards";

/**
 * Backfill the default board catalog onto existing profiles. New profiles get the
 * catalog inline at signup (see `AuthService.register`); run this only to push a
 * catalog change onto profiles that predate it. A fresh DB has no profiles yet,
 * so this is a no-op until the first user registers.
 */
async function main() {
  const profiles = await db.profile.findMany({ select: { id: true } });
  if (profiles.length === 0) {
    console.log("No profiles to backfill. New profiles seed the board catalog at signup.");
    return;
  }

  for (const profile of profiles) {
    for (const board of DEFAULT_BOARDS) {
      await db.jobBoard.upsert({
        where: { profileId_domain: { profileId: profile.id, domain: board.domain } },
        create: { ...board, profileId: profile.id },
        update: {
          name: board.name,
          searchUrl: board.searchUrl,
          sortOrder: board.sortOrder,
        },
      });
    }
  }
  const count = await db.jobBoard.count();
  console.log(`Backfilled board catalog onto ${profiles.length} profile(s). Total boards: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
