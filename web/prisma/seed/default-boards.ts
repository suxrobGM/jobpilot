import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../../src/generated/prisma/client";

const dbPath = path.resolve(process.cwd(), "prisma", "dev.db");

const db = new PrismaClient({
  adapter: new PrismaLibSql({ url: `file:${dbPath}` }),
});

interface BoardSeed {
  name: string;
  domain: string;
  searchUrl: string | null;
  type: "search" | "ats";
  sortOrder: number;
}

const DEFAULT_BOARDS: BoardSeed[] = [
  { name: "LinkedIn",     domain: "linkedin.com",   searchUrl: "https://www.linkedin.com/jobs/search/", type: "search", sortOrder: 10 },
  { name: "Indeed",       domain: "indeed.com",     searchUrl: "https://www.indeed.com/jobs",            type: "search", sortOrder: 20 },
  { name: "Glassdoor",    domain: "glassdoor.com",  searchUrl: "https://www.glassdoor.com/Job/",         type: "search", sortOrder: 30 },
  { name: "Hiring Cafe",  domain: "hiring.cafe",    searchUrl: "https://hiring.cafe/jobs",               type: "search", sortOrder: 40 },
  { name: "Greenhouse",   domain: "greenhouse.io",  searchUrl: null,                                     type: "ats",    sortOrder: 50 },
  { name: "Lever",        domain: "lever.co",       searchUrl: null,                                     type: "ats",    sortOrder: 60 },
  { name: "Workday",      domain: "workday.com",    searchUrl: null,                                     type: "ats",    sortOrder: 70 },
];

async function main() {
  for (const board of DEFAULT_BOARDS) {
    await db.jobBoard.upsert({
      where: { domain: board.domain },
      create: { ...board, enabled: true },
      update: {},
    });
  }
  const count = await db.jobBoard.count();
  console.log(`Seeded job boards. Total: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
