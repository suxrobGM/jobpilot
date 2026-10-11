import type { PrismaClient } from "@/generated/prisma/client";
import { PortfolioService } from "./portfolio.service";
import { expect, test } from "bun:test";

test("public portfolio omits private location while retaining the profile record", async () => {
  const user = {
    id: "profile-1",
    username: "example-user",
    firstName: "Example",
    lastName: "Candidate",
    city: "Private City",
    state: "Private Region",
    availability: "open",
    primaryResumeId: null,
    showResume: false,
    showWebsite: false,
    showLinkedin: false,
    showGithub: false,
  };
  const db = {
    user: { findFirst: async () => user },
    application: { count: async () => 0, findMany: async () => [] },
    networkingMessage: { count: async () => 0, findMany: async () => [] },
  } as unknown as PrismaClient;

  const portfolio = await new PortfolioService(db).byUsername(user.username);
  expect(portfolio.displayName).toBe("Example Candidate");
  expect(portfolio.location).toBeNull();
  expect(user.city).toBe("Private City");
  expect(user.state).toBe("Private Region");
});
