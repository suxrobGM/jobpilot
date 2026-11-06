import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

export type ContactDto = Data<typeof api.contacts.get>["items"][number];

export type NetworkingMessageDto = Data<
  ReturnType<typeof api.feeds>["networking"]["messages"]["get"]
>["items"][number];
