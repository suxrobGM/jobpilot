import { z } from "zod/v4";

export const queueListQuery = z.object({ status: z.string().trim().min(1).optional() });
