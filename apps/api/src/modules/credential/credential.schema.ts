import { z } from "zod/v4";

export const domainResolveQuery = z.object({ domain: z.string().trim().min(1) });
