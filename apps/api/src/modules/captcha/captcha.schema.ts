import { SERVICE_PROVIDERS } from "@jobpilot/contracts/credential";
import { z } from "zod/v4";

// ── Response schemas ──────────────────────────────────────────────────────────

/** Result of solving a CAPTCHA — the resolved token and the provider that solved it. */
export const captchaSolveResultSchema = z.object({
  token: z.string(),
  provider: z.enum(SERVICE_PROVIDERS),
});
