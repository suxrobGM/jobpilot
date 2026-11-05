import { CAPTCHA_PROVIDERS, CREDENTIAL_KINDS } from "@jobpilot/contracts/credential";
import { boardRefSchema } from "@jobpilot/contracts/job-board";
import { z } from "zod/v4";

export const domainResolveQuery = z.object({ domain: z.string().trim().min(1) });

/** A stored credential without its secrets: the agent reads those through `/resolve` only. */
export const credentialRecordSchema = z.object({
  id: z.uuid(),
  kind: z.enum(CREDENTIAL_KINDS),
  board: boardRefSchema.nullable(),
  provider: z.enum(CAPTCHA_PROVIDERS).nullable(),
  email: z.string().nullable(),
  hasPassword: z.boolean(),
  hasApiKey: z.boolean(),
});

export const credentialListSchema = z.array(credentialRecordSchema);

/** Effective login resolved for a board domain (mirrors `ResolvedCredential`), or null. */
export const resolvedCredentialSchema = z
  .object({
    id: z.uuid(),
    email: z.string(),
    password: z.string(),
    kind: z.enum(["board", "default"]),
  })
  .nullable();
