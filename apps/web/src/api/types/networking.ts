import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";
import type { CampaignConfigDto } from "./campaign";

export type ContactDto = Data<typeof api.contacts.get>["items"][number];

export type NetworkingMessageDto = Data<
  ReturnType<typeof api.campaigns>["networking"]["messages"]["get"]
>["items"][number];

export type NetworkingConfigDto = NonNullable<CampaignConfigDto["networking"]>;
