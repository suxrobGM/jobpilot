import { z } from "zod/v4";

export const domainResolveQuery = z.object({ domain: z.string().trim().min(1) });

// ── Response schemas ──────────────────────────────────────────────────────────

/** A stored credential row with its secret fields decrypted (mirrors the `Credential` model). */
export const credentialRecordSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  scope: z.string(),
  email: z.string().nullable(),
  password: z.string().nullable(),
  apiKey: z.string().nullable(),
});

export const credentialListSchema = z.array(credentialRecordSchema);

/** Effective login resolved for a board domain (mirrors `ResolvedCredential`), or null. */
export const resolvedCredentialSchema = z
  .object({
    email: z.string(),
    password: z.string(),
    source: z.enum(["board", "domain", "default"]),
    scope: z.string(),
  })
  .nullable();
