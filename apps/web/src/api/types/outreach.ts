import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/eden";
import type { CampaignConfigDto } from "./campaign";

/** A networking contact, inferred from `GET /api/contacts`. */
export type ContactDto = Data<typeof api.contacts.get>[number];

/** An outreach message with its contact, from `GET /api/campaigns/:id/outreach`. */
export type OutreachMessageDto = Data<ReturnType<typeof api.campaigns>["outreach"]["get"]>[number];

/** The outreach sub-config carried inside a campaign config. */
export type OutreachConfigDto = NonNullable<CampaignConfigDto["outreach"]>;
