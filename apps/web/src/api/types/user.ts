import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

export type UserAggregateResponse = Data<typeof api.user.get>;
