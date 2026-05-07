import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";

const dbPath = path.resolve(process.cwd(), "prisma", "dev.db");

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaLibSql({ url: `file:${dbPath}` }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
