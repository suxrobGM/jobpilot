import { notFound } from "./http.error";

/**
 * Load a profile-owned row or throw a 404. Takes a `find` closure instead of a
 * Prisma model so `T` infers cleanly from the call site.
 *
 *   await findOwned((w) => db.credential.findFirst({ where: w }), { id, profileId }, "Credential");
 */
export async function findOwned<T>(
  find: (where: Record<string, unknown>) => Promise<T | null>,
  where: Record<string, unknown>,
  label: string,
): Promise<T> {
  const row = await find(where);
  if (!row) {
    throw notFound(`${label} not found`);
  }
  return row;
}
