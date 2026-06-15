import "reflect-metadata";
import { container } from "tsyringe";
import { prisma } from "@/common/database";
import { PrismaClient } from "@/generated/prisma/client";

// Register the Prisma singleton so tsyringe resolves PrismaClient by class
// reference in service constructors.
container.registerInstance(PrismaClient, prisma);

export { container };
