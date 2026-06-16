import type { Prisma } from "@/generated/prisma/client";

/**
 * The board catalog every new profile starts with. Seeded inline when a profile
 * is created (see `AuthService.register`); the `prisma/seed/default-boards.ts`
 * script reuses this list to backfill profiles that predate a catalog change.
 *
 * Typed as the Prisma nested-create input so the catalog stays compile-checked
 * against the `JobBoard` schema (a new required column breaks the build here).
 */
export const DEFAULT_BOARDS: Prisma.JobBoardCreateManyProfileInput[] = [
  {
    name: "LinkedIn",
    domain: "linkedin.com",
    searchUrl: "https://www.linkedin.com/jobs/search/",
    sortOrder: 1,
  },
  {
    name: "Indeed",
    domain: "indeed.com",
    searchUrl: "https://www.indeed.com/jobs",
    sortOrder: 2,
  },
  {
    name: "Glassdoor",
    domain: "glassdoor.com",
    searchUrl: "https://www.glassdoor.com/Job/",
    sortOrder: 3,
  },
  {
    name: "Hiring Cafe",
    domain: "hiring.cafe",
    searchUrl: "https://hiring.cafe",
    sortOrder: 4,
  },
  {
    name: "Wellfound",
    domain: "wellfound.com",
    searchUrl: "https://wellfound.com/jobs",
    sortOrder: 5,
  },
  {
    name: "Y Combinator",
    domain: "workatastartup.com",
    searchUrl: "https://www.workatastartup.com/companies",
    sortOrder: 6,
  },
  {
    name: "Welcome to the Jungle",
    domain: "welcometothejungle.com",
    searchUrl: "https://www.welcometothejungle.com/en/jobs",
    sortOrder: 7,
  },
  {
    name: "Hacker News Who's Hiring",
    domain: "news.ycombinator.com",
    searchUrl: "https://news.ycombinator.com/submitted?id=whoishiring",
    sortOrder: 8,
  },
  {
    name: "We Work Remotely",
    domain: "weworkremotely.com",
    searchUrl: "https://weworkremotely.com/remote-jobs",
    sortOrder: 9,
  },
  {
    name: "Remote OK",
    domain: "remoteok.com",
    searchUrl: "https://remoteok.com/",
    sortOrder: 10,
  },
  {
    name: "4 Day Week",
    domain: "4dayweek.io",
    searchUrl: "https://4dayweek.io/remote-jobs",
    sortOrder: 11,
  },
  {
    name: "Upwork",
    domain: "upwork.com",
    searchUrl: "https://www.upwork.com/nx/search/jobs/",
    sortOrder: 12,
  },
];
