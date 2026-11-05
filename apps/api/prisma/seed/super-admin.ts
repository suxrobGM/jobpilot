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
    where: { role: "super_admin", email: { not: email } },
    data: { role: "user" },
  });
  if (demoted > 0) {
    console.log(`🗑️  Demoted ${demoted} stale super admin(s) to USER.`);
  }

  const user = await db.user.findUnique({ where: { email }, select: { role: true } });
  if (!user) {
    console.log(`⚠️  ${email} has not registered yet - the role is granted at signup.`);
    return;
  }
  if (user.role === "super_admin") {
    console.log(`✅ ${email} is already super_admin.`);
    return;
  }
  await db.user.update({ where: { email }, data: { role: "super_admin" } });
  console.log(`✅ Promoted ${email} to super_admin.`);
}
