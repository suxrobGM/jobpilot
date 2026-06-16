import type { ReactElement } from "react";

/** A transactional email: a subject plus a React-rendered body. */
export interface MailMessage {
  to: string;
  subject: string;
  react: ReactElement;
}

/** Sends transactional account emails (verification, password reset). */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** DI token for the active {@link Mailer} implementation. */
export const MAILER = Symbol("Mailer");
