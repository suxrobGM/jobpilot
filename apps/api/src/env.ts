import { z } from "zod/v4";

/**
 * Backend environment contract. Bun auto-loads `src/backend/.env` for `bun --cwd`,
 * so no dotenv is needed. `validateEnv()` is called once at boot in `app.ts`.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4101),

  DATABASE_URL: z.string().min(1),

  JWT_SECRET: z.string().min(1),
  JWT_EXPIRY: z.string().default("1d"),
  REFRESH_TOKEN_EXPIRY: z.string().default("30d"),

  // Master key wrapping per-user DEKs (`openssl rand -base64 32`); rotating it re-wraps DEKs, not the data.
  SECRET_MASTER_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "must be base64 of 32 bytes"),

  // The one account that can grant/revoke ADMIN. Granted at register + reconciled by `db:seed`;
  // no API route assigns it. Unset = nobody holds the role.
  SUPER_ADMIN_EMAIL: z.email().optional(),

  // CSV of allowed browser origins for CORS (credentials mode - no wildcard).
  CORS_ORIGINS: z.string().default("http://localhost:4100"),
  // Public web origin, used for OAuth redirects back to the app.
  APP_URL: z.string().default("http://localhost:4100"),

  // Filesystem root for resumes / generated PDFs.
  STORAGE_ROOT: z.string().default("./storage"),

  LOG_LEVEL: z.string().default("info"),

  // Google OAuth (Gmail) callback URL. Client id/secret are per-user (entered in the
  // app); only this shared callback is configured here - users register it in their own client.
  GOOGLE_OAUTH_REDIRECT_URI: z.string().default("http://localhost:4101/api/email/oauth/callback"),

  // Transactional email (Resend). Optional: when unset, the app logs the email
  // body (incl. magic links) instead of sending - fine for local dev.
  RESEND_API_KEY: z.string().optional(),
  // Sender of account emails. `onboarding@resend.dev` is Resend's no-domain test
  // sender (only delivers to the Resend account owner); production needs a verified domain.
  EMAIL_FROM: z.string().default("JobPilot <onboarding@resend.dev>"),

  // Web Push (VAPID). All three optional: unset silently disables push (never crashes startup).
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${messages}`);
  }
  return parsed.data;
}

/** Validated, typed env. Import this everywhere instead of touching process.env. */
export const env: Env = validateEnv();
