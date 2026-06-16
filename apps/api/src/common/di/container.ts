import "reflect-metadata";
import { container } from "tsyringe";
import { prisma } from "@/common/database";
import { ConsoleMailer, MAILER, ResendMailer } from "@/common/mail";
import { env } from "@/env";
import { PrismaClient } from "@/generated/prisma/client";

// Register the Prisma singleton so tsyringe resolves PrismaClient by class
// reference in service constructors.
container.registerInstance(PrismaClient, prisma);

// Bind the Mailer token: Resend when an API key is configured, otherwise a console
// mailer that logs magic links for local dev. Registered here so it exists before
// controllers resolve services (e.g. AuthService) at import.
container.registerSingleton(MAILER, env.RESEND_API_KEY ? ResendMailer : ConsoleMailer);

export { container };
