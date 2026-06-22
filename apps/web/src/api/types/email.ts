import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

/** Connected mailbox status, inferred from `GET /api/email/account`. */
export type EmailAccountStatus = Data<typeof api.email.account.get>;

/** Per-user Google OAuth client config status, from `GET /api/email/oauth/client`. */
export type OAuthClientStatus = Data<typeof api.email.oauth.client.get>;

/** An inbox message, from `GET /api/email/messages`. */
export type EmailMessageDto = Data<typeof api.email.messages.get>[number];

/** A single inbox message with its matched application, from `GET /api/email/messages/:id`. */
export type EmailMessageDetailDto = Data<ReturnType<typeof api.email.messages>["get"]>;

/** Sync result, from `POST /api/email/sync`. */
export type SyncResultDto = Data<typeof api.email.sync.post>;
