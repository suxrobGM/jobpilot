import type { CreateContactInput } from "@jobpilot/contracts/networking";

/**
 * Map a validated contact payload to Prisma `Contact` create fields (sans
 * `profileId`). Shared by the manual contacts route and the campaign-discovery
 * route so the optional-field defaulting lives in one place. Callers may
 * override individual fields after spreading (e.g. `discoverySource`).
 */
export function createContactPayload(c: CreateContactInput) {
  return {
    name: c.name,
    title: c.title ?? null,
    company: c.company ?? null,
    linkedinUrl: c.linkedinUrl ?? null,
    email: c.email ?? null,
    emailSource: c.emailSource ?? null,
    emailConfidence: c.emailConfidence ?? null,
    linkedinConnection: c.linkedinConnection ?? "none",
    discoverySource: c.discoverySource ?? null,
    matchConfidence: c.matchConfidence ?? null,
    relatedAppId: c.relatedAppId ?? null,
    relatedJobUrl: c.relatedJobUrl ?? null,
    notes: c.notes ?? null,
  };
}
