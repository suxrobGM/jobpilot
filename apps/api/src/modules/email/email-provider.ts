import type { EmailProvider } from "@jobpilot/contracts/email";
import { inject, injectable } from "@needle-di/core";
import { SECRET_CONTEXTS } from "@/common/crypto";
import type { MailboxSession, OAuthClientConfig, SendMessageInput } from "./email.types";
import { GmailClient, scopeCanRead, scopeCanSend } from "./gmail.client";
import { MicrosoftClient, microsoftCanRead, microsoftCanSend } from "./microsoft.client";

export function mailboxCanRead(
  provider: EmailProvider,
  scope: string | null | undefined,
  shared: boolean,
): boolean {
  return provider === "microsoft" ? microsoftCanRead(scope, shared) : scopeCanRead(scope);
}

export function mailboxCanSend(
  provider: EmailProvider,
  scope: string | null | undefined,
  shared: boolean,
): boolean {
  return provider === "microsoft" ? microsoftCanSend(scope, shared) : scopeCanSend(scope);
}

export function tokenContext(provider: EmailProvider) {
  return provider === "microsoft" ? SECRET_CONTEXTS.microsoftTokens : SECRET_CONTEXTS.gmailTokens;
}

@injectable()
export class EmailProviders {
  constructor(
    private readonly gmail = inject(GmailClient),
    private readonly microsoft = inject(MicrosoftClient),
  ) {}
  private client(provider: EmailProvider) {
    return provider === "microsoft" ? this.microsoft : this.gmail;
  }
  authorizeUrl(
    provider: EmailProvider,
    config: OAuthClientConfig,
    state: string,
    verifier: string,
  ) {
    if (provider === "microsoft") {
      return this.microsoft.authorizeUrl(config, state, verifier);
    }
    return this.gmail.authorizeUrl(config, state);
  }
  exchangeCode(provider: EmailProvider, config: OAuthClientConfig, code: string, verifier: string) {
    if (provider === "microsoft") {
      return this.microsoft.exchangeCode(config, code, verifier);
    }
    return this.gmail.exchangeCode(config, code);
  }
  refresh(provider: EmailProvider, config: OAuthClientConfig, token: string) {
    return this.client(provider).refresh(config, token);
  }
  send(provider: EmailProvider, session: MailboxSession, input: SendMessageInput) {
    return this.client(provider).send(session, input);
  }
}
