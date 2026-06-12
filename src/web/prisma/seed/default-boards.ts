import { db } from "@/server/db";

interface BoardSeed {
  name: string;
  domain: string;
  searchUrl: string | null;
  sortOrder: number;
}

const DEFAULT_BOARDS: BoardSeed[] = [
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

async function main() {
  const profiles = await db.profile.findMany({ select: { id: true } });
  if (profiles.length === 0) {
    console.log(
      "No profiles found. Skipping job board seed (boards seed per profile after onboarding).",
    );
    return;
  }

  for (const profile of profiles) {
    for (const board of DEFAULT_BOARDS) {
      await db.jobBoard.upsert({
        where: { profileId_domain: { profileId: profile.id, domain: board.domain } },
        create: { ...board, profileId: profile.id },
        update: {
          name: board.name,
          searchUrl: board.searchUrl,
          sortOrder: board.sortOrder,
        },
      });
    }
  }
  const count = await db.jobBoard.count();
  console.log(`Seeded job boards for ${profiles.length} profile(s). Total: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
