import type { JobBoardInput } from "@jobpilot/contracts/job-board";
import { singleton } from "tsyringe";
import { findOwned } from "@/common/errors";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";

/** A link is identity plus the catalog fields it exposes; `id` is the link's, for DELETE. */
const LINK_SELECT = {
  id: true,
  jobBoard: { select: { name: true, domain: true, searchUrl: true } },
} satisfies Prisma.UserJobBoardSelect;

type LinkRow = Prisma.UserJobBoardGetPayload<{ select: typeof LINK_SELECT }>;

function project(row: LinkRow) {
  return { id: row.id, ...row.jobBoard };
}

@singleton()
export class JobBoardService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Unpaginated: a profile's boards are bounded by the catalog, and selects read the whole list. */
  async list(userId: string) {
    const rows = await this.prisma.userJobBoard.findMany({
      where: { userId },
      select: LINK_SELECT,
      // Curated boards in catalog order, then the profile's own additions as they were added.
      orderBy: [
        { jobBoard: { listed: "desc" } },
        { jobBoard: { sortOrder: "asc" } },
        { createdAt: "asc" },
      ],
    });
    return rows.map(project);
  }

  /** Listed boards the user has not linked yet - the picker in the add-board dialog. */
  catalog(userId: string) {
    return this.prisma.jobBoard.findMany({
      where: { listed: true, userBoards: { none: { userId } } },
      select: { id: true, name: true, domain: true, searchUrl: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  /** Links by domain. A second link to the same board is a 409 from the unique index. */
  async create(userId: string, input: JobBoardInput) {
    // An unknown domain enters the catalog unlisted: admins see it, other users are not offered it.
    const board = await this.prisma.jobBoard.upsert({
      where: { domain: input.domain },
      create: {
        domain: input.domain,
        name: input.name || input.domain,
        searchUrl: input.searchUrl || null,
      },
      update: {},
      select: { id: true },
    });
    const row = await this.prisma.userJobBoard.create({
      data: { userId, jobBoardId: board.id },
      select: LINK_SELECT,
    });
    return project(row);
  }

  /** Unlinks the board from this user. The global row survives - other users still use it. */
  async remove(userId: string, id: string) {
    await findOwned(
      (where) => this.prisma.userJobBoard.findFirst({ where, select: { id: true } }),
      { id, userId },
      "Board",
    );
    await this.prisma.userJobBoard.delete({ where: { id } });
    return { deleted: id };
  }
}
