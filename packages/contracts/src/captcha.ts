import { z } from "zod/v4";
import { SERVICE_PROVIDERS } from "./credential";

/** CAPTCHA families a configured solving service can handle. */
export const CAPTCHA_TYPES = ["recaptcha", "hcaptcha", "turnstile"] as const;
export type CaptchaType = (typeof CAPTCHA_TYPES)[number];

export const captchaSolveSchema = z.object({
  type: z.enum(CAPTCHA_TYPES).default("recaptcha"),
  /** The widget's site key (reCAPTCHA `data-sitekey` / iframe `k=`, hCaptcha `sitekey`, Turnstile `data-sitekey`). */
  sitekey: z.string().min(1),
  /** The page hosting the widget. */
  pageurl: z.url(),
  /** Force a specific provider; otherwise the first configured key is used (2captcha preferred). */
  provider: z.enum(SERVICE_PROVIDERS).optional(),
});

export type CaptchaSolveInput = z.infer<typeof captchaSolveSchema>;

export interface CaptchaSolveResult {
  token: string;
  provider: (typeof SERVICE_PROVIDERS)[number];
}
