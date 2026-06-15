import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/eden";

/** A stored credential, inferred from `GET /api/credentials`. */
export type CredentialDto = Data<typeof api.credentials.get>[number];
