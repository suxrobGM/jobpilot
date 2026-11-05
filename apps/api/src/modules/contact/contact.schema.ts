import {
  contactDiscoverySourceSchema,
  contactEmailSourceSchema,
  contactLinkedinConnectionSchema,
} from "@jobpilot/contracts/networking";
import { paginatedSchema } from "@jobpilot/contracts/pagination";
import { z } from "zod/v4";

// Response schemas

/** A networking contact row as returned by the list route (dates stringified). */
export const contactSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  name: z.string(),
  title: z.string().nullable(),
  company: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  email: z.string().nullable(),
  emailSource: contactEmailSourceSchema.nullable(),
  emailConfidence: z.number().nullable(),
  linkedinConnection: contactLinkedinConnectionSchema,
  discoverySource: contactDiscoverySourceSchema.nullable(),
  matchConfidence: z.number().nullable(),
  applicationId: z.string().nullable(),
  jobUrl: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/** The user's contacts, newest first. */
export const contactListSchema = paginatedSchema(contactSchema);
