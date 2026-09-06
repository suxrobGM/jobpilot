import { db } from "@/common/database/prisma.client";
import { emailNotVerified } from "@/common/errors";

/**
 * Gate for outward-facing actions (creating campaigns, composing networking messages):
 * email verification is otherwise non-blocking, so this is the only enforcement.
 */
export async function requireVerifiedEmail(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });
  if (!user?.emailVerified) {
    throw emailNotVerified();
  }
}
