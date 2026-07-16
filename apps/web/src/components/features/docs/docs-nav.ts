import type { Route } from "next";

export interface DocsNavEntry {
  title: string;
  href: Route;
  description: string;
}

/** Ordered docs pages - drives the sidebar, the index cards, and the sitemap. */
export const DOCS_NAV: DocsNavEntry[] = [
  {
    title: "Getting started",
    href: "/docs/getting-started",
    description: "Install the plugin, run setup, and launch your first campaign.",
  },
  {
    title: "Campaigns & skills",
    href: "/docs/campaigns-and-skills",
    description: "The four campaign modes, every skill, and how statuses work.",
  },
  {
    title: "The Pilot",
    href: "/docs/pilot",
    description: "Autonomous mode: write your instructions, close the lid, wake to a journal.",
  },
  {
    title: "Email setup",
    href: "/docs/email-setup",
    description: "Connect Gmail with your own Google OAuth client.",
  },
  {
    title: "Credentials",
    href: "/docs/credentials",
    description: "Board logins, captcha services, and how your secrets are stored.",
  },
  {
    title: "FAQ",
    href: "/docs/faq",
    description: "Common questions about the agent, boards, and your data.",
  },
];
