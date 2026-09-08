import { paginatedSchema, paginationQuerySchema } from "@jobpilot/contracts/pagination";
import { z } from "zod/v4";

/** The admin catalog is searchable by name or domain; the filter runs server-side, not per page. */
export const adminBoardListQuery = paginationQuerySchema.extend({
  q: z.string().trim().min(1).optional(),
});

/** A catalog row as one profile sees it. `id` is the link's, not the board's. */
export const jobBoardRecordSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  domain: z.string(),
  searchUrl: z.string().nullable(),
});

/** The profile's boards: listed catalog boards in catalog order, then its own additions. */
export const jobBoardListSchema = z.array(jobBoardRecordSchema);

/** Listed global boards the profile has not linked yet - the add-board picker. `id` is the board's. */
export const jobBoardCatalogSchema = z.array(jobBoardRecordSchema);

/** A global catalog row plus `adoption` - how many profiles have linked it. Admin view. */
export const adminBoardRecordSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  domain: z.string(),
  searchUrl: z.string().nullable(),
  listed: z.boolean(),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  adoption: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const adminBoardListSchema = paginatedSchema(adminBoardRecordSchema);
