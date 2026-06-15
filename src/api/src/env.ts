import { z } from "zod/v4";

/**
 * Backend environment contract. Bun auto-loads `src/backend/.env` for `bun --cwd`,
 * so no dotenv is needed. `validateEnv()` is called once at boot in `app.ts`.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(8002),

  DATABASE_URL: z.string().min(1),

  JWT_SECRET: z.string().min(1),
  JWT_EXPIRY: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRY: z.string().default("30d"),

  // CSV of allowed browser origins for CORS (credentials mode — no wildcard).
  CORS_ORIGINS: z.string().default("http://localhost:8000"),
  // Public web origin, used for OAuth redirects back to the app.
  APP_URL: z.string().default("http://localhost:8000"),

  // Filesystem root for resumes / generated PDFs / backups (moved off process.cwd()).
  STORAGE_ROOT: z.string().default("./storage"),

  LOG_LEVEL: z.string().default("info"),

  // Google OAuth (Gmail). Optional so the app boots without email configured.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z
    .string()
    .default("http://localhost:8002/api/email/oauth/callback"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function validateEnv(): Env {
  if (cached) {
    return cached;
  }
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const messages = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${messages}`);
  }
  cached = parsed.data;
  return cached;
}

/** Validated, typed env. Import this everywhere instead of touching process.env. */
export const env: Env = validateEnv();
