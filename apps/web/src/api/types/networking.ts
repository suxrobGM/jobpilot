import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";
import type { CampaignConfigDto } from "./campaign";

/** A networking contact, inferred from `GET /api/contacts`. */
export type ContactDto = Data<typeof api.contacts.get>[number];

/** A networking message with its contact, from `GET /api/campaigns/:id/networking`. */
export type NetworkingMessageDto = Data<
  ReturnType<typeof api.campaigns>["networking"]["get"]
>["items"][number];

/** The networking sub-config carried inside a campaign config. */
export type NetworkingConfigDto = NonNullable<CampaignConfigDto["networking"]>;
