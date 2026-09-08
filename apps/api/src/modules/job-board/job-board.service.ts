import type { JobBoardInput, JobBoardPatch } from "@jobpilot/contracts/job-board";
import { singleton } from "tsyringe";
import { CryptoService, SECRET_CONTEXTS } from "@/common/crypto";
import { findOwned } from "@/common/errors";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";

/** A link plus the catalog fields it exposes. The stored password only feeds `hasPassword`. */
const LINK_SELECT = {
  id: true,
  jobBoardId: true,
  email: true,
  password: true,
  jobBoard: { select: { name: true, domain: true, searchUrl: true } },
} satisfies Prisma.UserJobBoardSelect;

type LinkRow = Prisma.UserJobBoardGetPayload<{ select: typeof LINK_SELECT }>;

function project(row: LinkRow) {
  return {
    id: row.id,
    jobBoardId: row.jobBoardId,
    name: row.jobBoard.name,
    domain: row.jobBoard.domain,
    searchUrl: row.jobBoard.searchUrl,
    email: row.email,
    hasPassword: Boolean(row.password),
  };
}

/** Blank form text means "not set"; `undefined` stays `undefined` so a patch leaves the column alone. */
function blankToNull(value: string | null | undefined): string | null | undefined {
  return value === "" ? null : value;
}

@singleton()
export class JobBoardService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly crypto: CryptoService,
  ) {}

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
        searchUrl: blankToNull(input.searchUrl),
      },
      update: {},
      select: { id: true },
    });
    const row = await this.prisma.userJobBoard.create({
      data: {
        userId,
        jobBoardId: board.id,
        email: blankToNull(input.email),
        password: await this.encrypt(userId, input.password),
      },
      select: LINK_SELECT,
    });
    return project(row);
  }

  private findLink(userId: string, id: string) {
    return findOwned(
      (where) => this.prisma.userJobBoard.findFirst({ where, select: { id: true } }),
      { id, userId },
      "Board",
    );
  }

  async update(userId: string, id: string, patch: JobBoardPatch) {
    await this.findLink(userId, id);
    const row = await this.prisma.userJobBoard.update({
      where: { id },
      data: {
        email: blankToNull(patch.email),
        password: await this.encrypt(userId, patch.password),
      },
      select: LINK_SELECT,
    });
    return project(row);
  }

  /** Unlinks the board from this user. The global row survives - other users still use it. */
  async remove(userId: string, id: string) {
    await this.findLink(userId, id);
    await this.prisma.userJobBoard.delete({ where: { id } });
    return { deleted: id };
  }

  private encrypt(userId: string, password: string | null | undefined) {
    return this.crypto.encryptField(userId, SECRET_CONTEXTS.boardPassword, blankToNull(password));
  }
}
