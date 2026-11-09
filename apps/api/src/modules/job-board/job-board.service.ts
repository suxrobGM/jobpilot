import type { JobBoardInput } from "@jobpilot/contracts/job-board";
import { inject, injectable } from "@needle-di/core";
import { findOwned, unprocessable } from "@/common/errors";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import { dropFromRotation } from "@/modules/pilot/rotation";
import { boardDomain } from "./board-host";

/** How a board appears inside another resource's response. */
export const BOARD_REF_SELECT = {
  id: true,
  domain: true,
  name: true,
} satisfies Prisma.JobBoardSelect;

export type BoardRef = Prisma.JobBoardGetPayload<{ select: typeof BOARD_REF_SELECT }>;

interface NewBoardFields {
  name?: string;
  searchUrl?: string;
}

/** A link is identity plus the catalog fields it exposes; `id` is the link's, for DELETE. */
const LINK_SELECT = {
  id: true,
  board: { select: { name: true, domain: true, searchUrl: true } },
} satisfies Prisma.UserJobBoardSelect;

type LinkRow = Prisma.UserJobBoardGetPayload<{ select: typeof LINK_SELECT }>;

function project(row: LinkRow) {
  return { id: row.id, ...row.board };
}

@injectable()
export class JobBoardService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  /** Unpaginated: a user's boards are bounded by the catalog, and selects read the whole list. */
  async list(userId: string) {
    const rows = await this.prisma.userJobBoard.findMany({
      where: { userId },
      select: LINK_SELECT,
      // Curated boards in catalog order, then the user's own additions as they were added.
      orderBy: [
        { board: { listed: "desc" } },
        { board: { sortOrder: "asc" } },
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

  /** The catalog row a board string names, or null. Read-only, so a typo never adds a row. */
  async find(input: string): Promise<BoardRef | null> {
    const domain = boardDomain(input);
    if (!domain) {
      return null;
    }
    return this.prisma.jobBoard.findUnique({ where: { domain }, select: BOARD_REF_SELECT });
  }

  /** `find`, else a new unlisted row: every write that takes a board string goes through this. */
  async resolve(input: string, fields: NewBoardFields = {}): Promise<BoardRef> {
    const domain = boardDomain(input);
    if (!domain) {
      throw unprocessable(`"${input}" is not a board domain.`);
    }
    // An unknown domain enters the catalog unlisted: admins see it, other users are not offered it.
    // Upsert, since two agents can report the same new board at once.
    return this.prisma.jobBoard.upsert({
      where: { domain },
      create: { domain, name: fields.name || domain, searchUrl: fields.searchUrl || null },
      update: {},
      select: BOARD_REF_SELECT,
    });
  }

  /** `resolve` for a nullable board field; a label that is no hostname stores no board. */
  async resolveId(input: string | null): Promise<string | null> {
    if (input === null || !boardDomain(input)) {
      return null;
    }
    return (await this.resolve(input)).id;
  }

  /** The boards with the most applications matching `where`, by name. */
  async topBoards(where: Prisma.ApplicationWhereInput, take = 5) {
    const rows = await this.prisma.application.groupBy({
      by: ["boardId"],
      where: { ...where, boardId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take,
    });
    const boards = await this.prisma.jobBoard.findMany({
      where: { id: { in: rows.flatMap((row) => (row.boardId ? [row.boardId] : [])) } },
      select: { id: true, name: true },
    });
    const names = new Map(boards.map((board) => [board.id, board.name]));
    return rows.flatMap((row) => {
      const board = row.boardId ? names.get(row.boardId) : null;
      return board ? [{ board, count: row._count._all }] : [];
    });
  }

  /** Links by domain. A second link to the same board is a 409 from the unique index. */
  async create(userId: string, input: JobBoardInput) {
    const board = await this.resolve(input.domain, input);
    const row = await this.prisma.userJobBoard.create({
      data: { userId, boardId: board.id },
      select: LINK_SELECT,
    });
    return project(row);
  }

  /** Unlinks the board from this user. The global row survives - other users still use it. */
  async remove(userId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const link = await findOwned(
        (where) =>
          tx.userJobBoard.findFirst({ where, select: { board: { select: { domain: true } } } }),
        { id, userId },
        "Board",
      );
      await tx.userJobBoard.delete({ where: { id } });
      await dropFromRotation(tx, { userId }, link.board.domain);
    });
    return { deleted: id };
  }
}
