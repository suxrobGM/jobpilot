import "reflect-metadata";
import { container } from "tsyringe";
import { prisma } from "@/common/database";
import { ConsoleMailer, MAILER, ResendMailer } from "@/common/mail";
import { VAPID_CONFIG, type VapidConfigHolder } from "@/common/push";
import { env } from "@/env";
import { PrismaClient } from "@/generated/prisma/client";

// Register the Prisma singleton so tsyringe resolves PrismaClient by class
// reference in service constructors.
container.registerInstance(PrismaClient, prisma);

// Bind the Mailer token: Resend when an API key is configured, otherwise a console
// mailer that logs magic links for local dev. Registered here so it exists before
// controllers resolve services (e.g. AuthService) at import.
container.registerSingleton(MAILER, env.RESEND_API_KEY ? ResendMailer : ConsoleMailer);

// Web push VAPID config, or null when unconfigured. Wrapped in a holder so PushService gets a value
// (not undefined) either way, and so env - which validates at load - is only touched here, never in
// push.service.ts (keeping that module unit-testable without a full env).
const vapid =
  env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
    ? {
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
        subject: env.VAPID_SUBJECT,
      }
    : null;
container.register<VapidConfigHolder>(VAPID_CONFIG, { useValue: { vapid } });

export { container };
