import type { Prisma } from "@/generated/prisma/client";

/** The `users` columns behind `portfolioSettingsSchema`. */
export const PORTFOLIO_SETTINGS_SELECT = {
  username: true,
  availability: true,
  showResume: true,
  showWebsite: true,
  showLinkedin: true,
  showGithub: true,
} satisfies Prisma.UserSelect;
