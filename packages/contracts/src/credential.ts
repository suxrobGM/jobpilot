import { z } from "zod/v4";

export const CREDENTIAL_KINDS = ["board", "default", "service"] as const;
export type CredentialKind = (typeof CREDENTIAL_KINDS)[number];

/** Captcha-solving services whose API key can be stored as a service credential. */
export const CAPTCHA_PROVIDERS = ["two_captcha", "capsolver"] as const;
export type CaptchaProvider = (typeof CAPTCHA_PROVIDERS)[number];

const login = { email: z.string().trim().min(1), password: z.string().min(1) };

/**
 * A board login (`board` is the board's domain), the default login tried on boards without one,
 * or a captcha service's API key.
 */
export const credentialSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("board"), board: z.string().trim().min(1), ...login }),
  z.object({ kind: z.literal("default"), ...login }),
  z.object({
    kind: z.literal("service"),
    provider: z.enum(CAPTCHA_PROVIDERS),
    apiKey: z.string().trim().min(1),
  }),
]);

/** The kind never changes; a field that doesn't belong to the row's kind is a 422. */
export const credentialPatchSchema = z.object({
  board: z.string().trim().min(1).optional(),
  email: z.string().trim().min(1).optional(),
  password: z.string().min(1).optional(),
  apiKey: z.string().trim().min(1).optional(),
});

export type CredentialInput = z.infer<typeof credentialSchema>;
export type CredentialPatch = z.infer<typeof credentialPatchSchema>;
