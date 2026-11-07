import { z } from "zod/v4";

export const approvedJobCountSchema = z.object({ count: z.number().int() });
