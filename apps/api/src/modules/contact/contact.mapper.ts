import type {
  CreateContactInput,
  ContactDiscoverySource as WireContactDiscoverySource,
} from "@jobpilot/contracts/networking";
import type { Contact, ContactDiscoverySource, Prisma } from "@/generated/prisma/client";

const DISCOVERY_SOURCE_TO_WIRE: Record<ContactDiscoverySource, WireContactDiscoverySource> = {
  google: "google",
  company_site: "company-site",
  web: "web",
  linkedin: "linkedin",
  manual: "manual",
};

/**
 * Map a validated contact payload to Prisma `Contact` create fields (sans
 * `userId`). Shared by the manual contacts route and the campaign-discovery
 * route so the optional-field defaulting lives in one place. Callers may
 * override individual fields after spreading (e.g. `discoverySource`).
 */
export function createContactPayload(c: CreateContactInput) {
  const discoverySource: ContactDiscoverySource | null =
    c.discoverySource === "company-site" ? "company_site" : (c.discoverySource ?? null);
  return {
    name: c.name,
    title: c.title ?? null,
    company: c.company ?? null,
    linkedinUrl: c.linkedinUrl ?? null,
    email: c.email ?? null,
    emailSource: c.emailSource ?? null,
    emailConfidence: c.emailConfidence ?? null,
    linkedinConnection: c.linkedinConnection ?? "none",
    discoverySource,
    matchConfidence: c.matchConfidence ?? null,
    relatedAppId: c.relatedAppId ?? null,
    relatedJobUrl: c.relatedJobUrl ?? null,
    notes: c.notes ?? null,
  };
}

/** Prisma's `company_site` is not the wire value. Every read path owes this translation. */
export function toWireDiscoverySource(
  source: ContactDiscoverySource | null,
): WireContactDiscoverySource | null {
  return source ? DISCOVERY_SOURCE_TO_WIRE[source] : null;
}

/** A `Contact` row with its enums in wire form, which every contact response schema requires. */
export function toContactRow(contact: Contact) {
  return { ...contact, discoverySource: toWireDiscoverySource(contact.discoverySource) };
}

export function toNetworkingMessageRow(
  message: Prisma.NetworkingMessageGetPayload<{ include: { contact: true } }>,
) {
  return { ...message, contact: toContactRow(message.contact) };
}
