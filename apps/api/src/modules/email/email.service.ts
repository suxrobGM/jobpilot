import type {
  ApproveInput,
  Classification,
  ReviewStatus,
  ScanMessageInput,
} from "@jobpilot/contracts/email";
import type { SendEmailInput } from "@jobpilot/contracts/outreach";
import { randomBytes } from "node:crypto";
import { singleton } from "tsyringe";
import {
  badRequest,
  ErrorCodes,
  findOwned,
  HttpError,
  notFound,
} from "@/common/errors";
import { publish } from "@/common/sse";
import { inboxChannel } from "@/common/sse/channels/inbox";
import {
  type EmailAccount,
  type EmailMessage,
  PrismaClient,
  type Prisma,
} from "@/generated/prisma/client";
import { accountCanSend, getProvider } from "./gmail.provider";

/** The fields the reply-linker needs from a freshly-synced inbound message. */
interface InboundForLinking {
  threadId: string | null;
  fromAddress: string;
  receivedAt: Date;
}

interface MessageQuery {
  reviewStatus?: string;
  classification?: string;
  since?: string;
  domainHint?: string;
  verificationDomain?: string;
}

/** An inbox message row with its union fields narrowed off plain `string`. */
type EmailMessageRow = Prisma.EmailMessageGetPayload<{
  include: {
    matchedApp: { select: { id: true; title: true; company: true; stage: true } };
  };
}> & { reviewStatus: ReviewStatus; classification: Classification | null };

const POSITIVE_STAGES = new Set([
  "recruiter_screen",
  "assessment",
  "hiring_manager_screen",
  "technical_interview",
  "onsite",
  "offer",
]);

const CLASSIFICATION_TO_STAGE: Record<string, string> = {
  interviewing: "recruiter_screen",
  rejected: "rejected",
  offer: "offer",
};

@singleton()
export class EmailService {
  constructor(private readonly prisma: PrismaClient) {}

  // --- Account ---------------------------------------------------------------

  async accountStatus(profileId: number) {
    const account = await this.prisma.emailAccount.findUnique({ where: { profileId } });

    if (!account) {
      return { connected: false, canSend: false };
    }

    return {
      connected: true,
      provider: account.provider,
      email: account.email,
      lastSyncAt: account.lastSyncAt,
      canSend: accountCanSend(account),
    };
  }

  async disconnectAccount(profileId: number) {
    await this.prisma.emailAccount.deleteMany({ where: { profileId } });
    return { disconnected: true };
  }

  /**
   * Load the profile's connected email account, refreshing its access token
   * first when expired. Returns `null` when no account is connected. Mirrors the
   * refresh dance the sync route performs, so callers that need a usable token
   * (e.g. the send route) don't duplicate it.
   */
  private async loadFreshAccount(profileId: number): Promise<EmailAccount | null> {
    const account = await this.prisma.emailAccount.findUnique({ where: { profileId } });
    if (!account) {
      return null;
    }

    const now = new Date();
    if (account.refreshToken && account.tokenExpiresAt && account.tokenExpiresAt <= now) {
      const provider = getProvider(account.provider);
      const refreshed = await provider.refresh(account.refreshToken);

      return this.prisma.emailAccount.update({
        where: { id: account.id },
        data: {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken ?? account.refreshToken,
          tokenExpiresAt: refreshed.expiresAt ?? null,
          scope: refreshed.scope ?? account.scope,
        },
      });
    }

    return account;
  }

  // --- Messages --------------------------------------------------------------

  listMessages(profileId: number, query: MessageQuery) {
    const { reviewStatus, classification, since, domainHint, verificationDomain } = query;

    const where: Prisma.EmailMessageWhereInput = { account: { profileId } };

    if (reviewStatus) {
      where.reviewStatus = reviewStatus;
    }
    if (classification === "null") {
      where.classification = null;
    } else if (classification) {
      where.classification = classification;
    }
    if (since) {
      const date = new Date(since);
      if (!Number.isNaN(date.getTime())) where.receivedAt = { gte: date };
    }
    if (verificationDomain) {
      where.verificationDomain = verificationDomain;
    }
    if (domainHint) {
      where.OR = [
        { fromDomain: { contains: domainHint } },
        { subject: { contains: domainHint } },
        { rawBody: { contains: domainHint } },
      ];
    }

    return this.prisma.emailMessage.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: 200,
      include: {
        matchedApp: { select: { id: true, title: true, company: true, stage: true } },
      },
    }) as Promise<EmailMessageRow[]>;
  }

  getMessage(profileId: number, id: number) {
    return findOwned(
      (where) =>
        this.prisma.emailMessage.findFirst({
          where,
          include: {
            matchedApp: { select: { id: true, title: true, company: true, stage: true } },
          },
        }),
      { id, account: { profileId } },
      "Message",
    ) as Promise<EmailMessageRow>;
  }

  async scanMessage(profileId: number, id: number, body: ScanMessageInput) {
    await findOwned(
      (where) => this.prisma.emailMessage.findFirst({ where, select: { id: true } }),
      { id, account: { profileId } },
      "Message",
    );

    const message = (await this.prisma.emailMessage.update({
      where: { id },
      data: {
        classification: body.classification,
        confidence: body.confidence,
        reasoning: body.reasoning,
        matchedAppId: body.matchedAppId,
        matchScore: body.matchScore,
        appliedStage: body.appliedStage,
        reviewStatus: body.reviewStatus,
        verificationCode: body.verificationCode,
        verificationLink: body.verificationLink,
        verificationDomain: body.verificationDomain,
        scannedAt: body.classification ? new Date() : undefined,
      },
    })) as EmailMessage & { reviewStatus: ReviewStatus; classification: Classification | null };

    publish(inboxChannel, undefined, { type: "message.scanned", id });

    return message;
  }

  async denyMessage(profileId: number, id: number) {
    await findOwned(
      (where) => this.prisma.emailMessage.findFirst({ where, select: { id: true } }),
      { id, account: { profileId } },
      "Message",
    );

    await this.prisma.emailMessage.update({
      where: { id },
      data: { reviewStatus: "denied" },
    });

    publish(inboxChannel, undefined, { type: "message.reviewed", id, status: "denied" });

    return { id, status: "denied" as const };
  }

  async approveMessage(profileId: number, id: number, body: ApproveInput) {
    const message = await findOwned(
      (where) => this.prisma.emailMessage.findFirst({ where }),
      { id, account: { profileId } },
      "Message",
    );

    if (!message.matchedAppId) {
      throw new HttpError(ErrorCodes.UNPROCESSABLE, "Message has no matched application", 422);
    }

    const inferred =
      body.toStage ??
      message.appliedStage ??
      (message.classification ? CLASSIFICATION_TO_STAGE[message.classification] : undefined);

    if (!inferred) {
      throw new HttpError(ErrorCodes.UNPROCESSABLE, "No target stage available", 422);
    }

    const app = await this.prisma.application.findFirst({
      where: { id: message.matchedAppId, profileId },
    });
    if (!app) {
      throw notFound("Application not found");
    }

    const fromStage = app.stage;
    const toStage = inferred;
    const outcome =
      toStage === "rejected" ? "negative" : POSITIVE_STAGES.has(toStage) ? "positive" : null;
    const rejectedAt = toStage === "rejected" ? new Date() : null;

    await this.prisma.$transaction([
      this.prisma.application.update({
        where: { id: app.id },
        data: { stage: toStage, outcome, rejectedAt },
      }),
      this.prisma.stageEvent.create({
        data: {
          applicationId: app.id,
          fromStage,
          toStage,
          note: body.note ?? `From email: ${message.subject}`,
        },
      }),
      this.prisma.emailMessage.update({
        where: { id },
        data: { reviewStatus: "approved", appliedStage: toStage },
      }),
    ]);

    publish(inboxChannel, undefined, { type: "message.reviewed", id, status: "approved" });

    return { id, applicationId: app.id, stage: toStage };
  }

  // --- Send ------------------------------------------------------------------

  /**
   * Send an outbound email from the profile's connected mailbox. Used by the
   * outreach skill (and the outreach board's "approve & send" action). Refreshes
   * an expired token first and 4xxs with an actionable message when the account
   * lacks send scope (needs reconnecting).
   */
  async send(profileId: number, body: SendEmailInput) {
    const account = await this.loadFreshAccount(profileId);
    if (!account) {
      throw new HttpError(ErrorCodes.NOT_FOUND, "No email account connected", 404);
    }
    if (!accountCanSend(account)) {
      throw new HttpError(
        ErrorCodes.UNPROCESSABLE,
        "Connected mailbox lacks send access. Reconnect it from email settings to enable sending.",
        422,
      );
    }

    try {
      return await getProvider(account.provider).sendMessage(account, {
        to: body.to,
        subject: body.subject,
        body: body.body,
        threadId: body.threadId,
        attachments: body.attachments,
      });
    } catch (e) {
      throw new HttpError(
        ErrorCodes.UNPROCESSABLE,
        e instanceof Error ? e.message : "Failed to send message",
        502,
      );
    }
  }

  // --- Sync ------------------------------------------------------------------

  async syncInbox(profileId: number) {
    let active;
    try {
      active = await this.loadFreshAccount(profileId);
    } catch (e) {
      throw new HttpError(
        ErrorCodes.UNPROCESSABLE,
        e instanceof Error ? e.message : "Token refresh failed",
        401,
      );
    }
    if (!active) {
      throw notFound("No email account connected");
    }

    const provider = getProvider(active.provider);

    publish(inboxChannel, undefined, { type: "sync.started" });

    const result = await provider.syncMessages(active);

    let inserted = 0;
    const insertedForLinking: InboundForLinking[] = [];
    for (const m of result.newMessages) {
      try {
        await this.prisma.emailMessage.create({
          data: {
            accountId: active.id,
            providerId: m.providerId,
            threadId: m.threadId,
            subject: m.subject,
            fromAddress: m.fromAddress,
            fromName: m.fromName,
            fromDomain: m.fromDomain,
            snippet: m.snippet,
            rawBody: m.rawBody,
            receivedAt: m.receivedAt,
          },
        });
        inserted += 1;
        insertedForLinking.push({
          threadId: m.threadId,
          fromAddress: m.fromAddress,
          receivedAt: m.receivedAt,
        });
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") {
          continue;
        }
        throw e;
      }
    }

    // Flip any sent outreach messages to "replied" when their reply just arrived.
    await this.linkOutreachReplies(profileId, insertedForLinking);

    await this.prisma.emailAccount.update({
      where: { id: active.id },
      data: {
        historyId: result.historyId ?? active.historyId,
        lastSyncAt: new Date(),
      },
    });

    publish(inboxChannel, undefined, {
      type: "sync.progress",
      fetched: result.fetched,
      new: inserted,
    });

    return { fetched: result.fetched, new: inserted };
  }

  /**
   * Flip `sent` outreach messages to `replied` when a matching inbound email
   * arrives. Matches first by Gmail `threadId` (the thread the outreach was sent
   * on), then falls back to the sender address equalling a contact's email.
   * Returns the number of outreach messages newly marked replied.
   */
  private async linkOutreachReplies(
    profileId: number,
    messages: InboundForLinking[],
  ): Promise<number> {
    let linked = 0;

    for (const m of messages) {
      if (m.threadId) {
        const byThread = await this.prisma.outreachMessage.updateMany({
          where: { profileId, status: "sent", threadId: m.threadId },
          data: { status: "replied", repliedAt: m.receivedAt },
        });
        linked += byThread.count;
        if (byThread.count > 0) continue;
      }

      if (m.fromAddress) {
        const contacts = await this.prisma.contact.findMany({
          where: { profileId, email: m.fromAddress },
          select: { id: true },
        });
        if (contacts.length > 0) {
          const byEmail = await this.prisma.outreachMessage.updateMany({
            where: { profileId, status: "sent", contactId: { in: contacts.map((c) => c.id) } },
            data: { status: "replied", repliedAt: m.receivedAt },
          });
          linked += byEmail.count;
        }
      }
    }

    return linked;
  }

  // --- OAuth -----------------------------------------------------------------

  buildAuthorizeUrl(providerName: string): { authorizeUrl: string; state: string } {
    if (providerName !== "gmail") {
      throw badRequest(`Unsupported provider: ${providerName}`);
    }

    const state = randomBytes(16).toString("hex");
    let authorizeUrl: string;
    try {
      authorizeUrl = getProvider(providerName).getAuthorizeUrl(state);
    } catch (e) {
      throw new HttpError(
        ErrorCodes.UNPROCESSABLE,
        e instanceof Error ? e.message : "Email provider unavailable",
        400,
      );
    }

    return { authorizeUrl, state };
  }

  async completeEmailOAuth(input: {
    providerName: string;
    code: string;
    profileId: number;
  }): Promise<{ email: string }> {
    const { providerName, code, profileId } = input;
    const provider = getProvider(providerName);
    const { tokens, email } = await provider.exchangeCode(code);

    await this.prisma.emailAccount.upsert({
      where: { profileId },
      create: {
        profileId,
        provider: providerName,
        email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? null,
        tokenExpiresAt: tokens.expiresAt ?? null,
        scope: tokens.scope ?? null,
      },
      update: {
        provider: providerName,
        email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? null,
        tokenExpiresAt: tokens.expiresAt ?? null,
        scope: tokens.scope ?? null,
      },
    });

    return { email };
  }
}
