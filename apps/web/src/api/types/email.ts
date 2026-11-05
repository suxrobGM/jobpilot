import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

export type OAuthClientStatus = Data<typeof api.email.oauth.client.get>;

export type EmailMessageDto = Data<typeof api.email.messages.get>["items"][number];
