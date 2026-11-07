import path from "node:path";
import { Container } from "@needle-di/core";
import { db } from "@/common/database/prisma.client";
import { ConsoleMailer, MAILER, ResendMailer } from "@/common/mail";
import { STORAGE_ROOT } from "@/common/storage/resume.storage";
import { env } from "@/env";
import { PrismaClient } from "@/generated/prisma/client";
import { VAPID_CONFIG } from "@/modules/web-push/web-push.service";

// Services are `@injectable()` and bind themselves on first `get`; only values and interface
// tokens are bound here. env is read only here, so services stay testable without a full env.
export const container = new Container();

const vapid =
  env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
    ? {
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
        subject: env.VAPID_SUBJECT,
      }
    : null;

container.bindAll(
  { provide: PrismaClient, useValue: db },
  // Resend when an API key is configured, otherwise a mailer that logs magic links for local dev.
  { provide: MAILER, useClass: env.RESEND_API_KEY ? ResendMailer : ConsoleMailer },
  { provide: VAPID_CONFIG, useValue: vapid },
  { provide: STORAGE_ROOT, useValue: path.resolve(env.STORAGE_ROOT) },
);
