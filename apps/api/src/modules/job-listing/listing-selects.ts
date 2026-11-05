import type { Prisma } from "@/generated/prisma/client";

const SOURCE_BOARD_SELECT = { select: { name: true, domain: true, listed: true } } as const;

// Fields are listed, never spread, so a column added to the table later cannot leak out.
export const SUMMARY_SELECT = {
  id: true,
  slug: true,
  title: true,
  company: true,
  location: true,
  remote: true,
  salary: true,
  employmentType: true,
  skills: true,
  descriptionExcerpt: true,
  firstSeenAt: true,
  lastSeenAt: true,
  sources: { select: { board: SOURCE_BOARD_SELECT }, orderBy: { lastSeenAt: "desc" } },
} satisfies Prisma.JobListingSelect;

export const DETAIL_SELECT = {
  ...SUMMARY_SELECT,
  requirements: true,
  responsibilities: true,
  yearsExperience: true,
  sources: {
    select: { board: SOURCE_BOARD_SELECT, url: true, lastSeenAt: true },
    orderBy: { lastSeenAt: "desc" },
  },
} satisfies Prisma.JobListingSelect;

export const ADMIN_SELECT = {
  ...SUMMARY_SELECT,
  status: true,
} satisfies Prisma.JobListingSelect;

interface SourceBoard {
  name: string;
  domain: string;
  listed: boolean;
}

export interface SummaryRow {
  sources: { board: SourceBoard | null }[];
}

/** An unlisted row's name is whatever one user typed, so the public pages show its domain. */
export function publicBoardName(board: SourceBoard | null): string | null {
  if (!board) {
    return null;
  }
  return board.listed ? board.name.trim() : board.domain;
}

/** One name per board, in source order: a posting reposted six times on LinkedIn is one board. */
function distinctBoardNames(sources: SummaryRow["sources"]): string[] {
  const names = sources.map((source) => publicBoardName(source.board));
  return [...new Set(names.filter((name) => name !== null))];
}

export function toSummary<T extends SummaryRow>({ sources, ...row }: T) {
  return { ...row, sourceCount: sources.length, boards: distinctBoardNames(sources) };
}
