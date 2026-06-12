import { api } from "@/server/api/route";
import { db } from "@/server/db";

/** List the active profile's contacts (newest first) for the networking page. */
export const GET = api.route({}, ({ profileId }) =>
  db.contact.findMany({ where: { profileId }, orderBy: { createdAt: "desc" } }),
);
