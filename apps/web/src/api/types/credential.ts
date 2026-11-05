import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

export type CredentialDto = Data<typeof api.credentials.get>[number];
