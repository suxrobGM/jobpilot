import { z } from "zod/v4";

/** Captcha-solving services whose API key can be stored as a service credential. */
export const SERVICE_PROVIDERS = ["2captcha", "capsolver"] as const;
export type ServiceProvider = (typeof SERVICE_PROVIDERS)[number];

/**
 * A credential is one of two shapes, discriminated by which fields are filled:
 * - login: `scope` (domain or "default") + `email` + `password`.
 * - service: `scope` (a provider name, e.g. "2captcha") + `apiKey`.
 */
export const credentialSchema = z
  .object({
    scope: z.string().min(1),
    email: z.string().optional(),
    password: z.string().optional(),
    apiKey: z.string().optional(),
  })
  .refine(
    (c) => {
      const present = (v: string | undefined): boolean => (v ?? "").trim().length > 0;
      const login = present(c.email) && present(c.password);
      const service = present(c.apiKey);
      // Exactly one shape, and a service credential carries no login fields.
      return service ? !present(c.email) && !present(c.password) : login;
    },
    { message: "Provide an email + password, or an API key — not both." },
  );

export const credentialPatchSchema = z.object({
  scope: z.string().min(1).optional(),
  email: z.string().optional(),
  password: z.string().optional(),
  apiKey: z.string().optional(),
});

export type CredentialInput = z.infer<typeof credentialSchema>;
export type CredentialPatch = z.infer<typeof credentialPatchSchema>;
