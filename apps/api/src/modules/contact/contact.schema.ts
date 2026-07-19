import {
  contactDiscoverySourceSchema,
  contactEmailSourceSchema,
  contactLinkedinConnectionSchema,
} from "@jobpilot/contracts/networking";
import { z } from "zod/v4";

// ── Response schemas ──────────────────────────────────────────────────────────

/** A networking contact row as returned by the list route (dates stringified). */
export const contactSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
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
  relatedAppId: z.string().nullable(),
  relatedJobUrl: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/** The active profile's contacts, newest first. */
export const contactListSchema = z.array(contactSchema);
