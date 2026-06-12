import { z } from "zod/v4";
import { api } from "@/server/api/route";
import { resolveCredential } from "@/server/credentials";

const resolveQuery = z.object({ domain: z.string().trim().min(1) });

export const GET = api.route({ query: resolveQuery }, ({ query, profileId }) =>
  resolveCredential(profileId, query.domain),
);
