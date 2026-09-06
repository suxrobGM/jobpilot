import { db } from "@/common/database/prisma.client";
import { env } from "@/env";

/** Reconciles both ways, so changing SUPER_ADMIN_EMAIL *moves* the role. Unset = leave roles alone. */
export async function seedSuperAdmin(): Promise<void> {
  const email = env.SUPER_ADMIN_EMAIL;
  if (!email) {
    console.log("⚠️  SUPER_ADMIN_EMAIL is unset - leaving roles untouched.");
    return;
  }

  const { count: demoted } = await db.user.updateMany({
    where: { role: "SUPER_ADMIN", email: { not: email } },
    data: { role: "USER" },
  });
  if (demoted > 0) {
    console.log(`🗑️  Demoted ${demoted} stale super admin(s) to USER.`);
  }

  const user = await db.user.findUnique({ where: { email }, select: { role: true } });
  if (!user) {
    console.log(`⚠️  ${email} has not registered yet - the role is granted at signup.`);
    return;
  }
  if (user.role === "SUPER_ADMIN") {
    console.log(`✅ ${email} is already SUPER_ADMIN.`);
    return;
  }
  await db.user.update({ where: { email }, data: { role: "SUPER_ADMIN" } });
  console.log(`✅ Promoted ${email} to SUPER_ADMIN.`);
}
