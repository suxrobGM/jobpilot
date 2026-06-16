import { render } from "@react-email/render";
import { singleton } from "tsyringe";
import { logger } from "@/common/logger";
import type { Mailer, MailMessage } from "./mailer";

/**
 * Logs the rendered email (incl. any magic links) instead of sending. Bound to
 * the {@link MAILER} token when RESEND_API_KEY is unset, so local dev can copy
 * links out of the API console without a real email provider.
 */
@singleton()
export class ConsoleMailer implements Mailer {
  async send({ to, subject, react }: MailMessage): Promise<void> {
    const text = await render(react, { plainText: true });
    logger.info({ to, subject }, `[mail] would send "${subject}" to ${to}\n${text}`);
  }
}
