import { z } from "zod/v4";

// Bun loads `apps/api/.env` itself, so there is no dotenv.
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4101),

  DATABASE_URL: z.string().min(1),

  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // Wraps per-user DEKs, so rotating it re-wraps the keys, not the data.
  SECRET_MASTER_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "must be base64 of 32 bytes"),

  // The only account that grants ADMIN; no route assigns it.
  SUPER_ADMIN_EMAIL: z.email().optional(),

  // Comma-separated; credentialed CORS can't use a wildcard.
  CORS_ORIGINS: z.string().default("http://localhost:4100"),
  APP_URL: z.string().default("http://localhost:4100"),

  STORAGE_ROOT: z.string().default("./storage"),

  LOG_LEVEL: z.string().default("info"),

  // Gmail clients are per user; only their shared callback lives here.
  GOOGLE_OAUTH_REDIRECT_URI: z.string().default("http://localhost:4101/api/email/oauth/callback"),

  // Sign-in providers, separate from the Gmail clients; unset disables one.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  AUTH_OAUTH_REDIRECT_BASE: z.string().default("http://localhost:4101"),

  // Unset logs account emails, magic links included, instead of sending them.
  RESEND_API_KEY: z.string().optional(),
  // The default only delivers to the Resend account owner; production needs a verified domain.
  EMAIL_FROM: z.string().default("JobPilot <onboarding@resend.dev>"),

  // Unset disables Web Push.
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z
    .string()
    .refine(
      (v) => v.startsWith("mailto:") || v.startsWith("https://"),
      "must be a mailto: or https:// URL",
    )
    .optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function validateEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${messages}`);
  }
  return parsed.data;
}

export const env: Env = validateEnv();
