import { CAPTCHA_PROVIDERS } from "@jobpilot/contracts/credential";
import { z } from "zod/v4";

export const captchaSolveResultSchema = z.object({
  token: z.string(),
  provider: z.enum(CAPTCHA_PROVIDERS),
});
