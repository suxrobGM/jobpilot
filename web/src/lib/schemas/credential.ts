import { z } from "zod/v4";

export const credentialSchema = z.object({
  scope: z.string().min(1),
  email: z.string().min(1),
  password: z.string().min(1),
});

export type CredentialInput = z.infer<typeof credentialSchema>;

export const credentialPatchSchema = credentialSchema.partial();
export type CredentialPatch = z.infer<typeof credentialPatchSchema>;
