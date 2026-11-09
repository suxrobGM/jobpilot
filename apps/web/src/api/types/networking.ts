import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

export type NetworkingMessageDto = Data<
  ReturnType<typeof api.feeds>["networking"]["messages"]["get"]
>["items"][number];
