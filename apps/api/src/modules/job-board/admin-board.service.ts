import type { AdminBoardInput, AdminBoardPatch } from "@jobpilot/contracts/job-board";
import { type PaginationQuery, pageSlice, paginate } from "@jobpilot/contracts/pagination";
import { inject, injectable } from "@needle-di/core";
import { conflict, isPrismaError, PRISMA_ERRORS, unprocessable } from "@/common/errors";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import { boardDomain } from "./board-host";

/** Stored in resolver form, so an agent reporting any spelling of it lands on this row. */
function catalogDomain(input: string): string {
  const domain = boardDomain(input);
  if (!domain) {
    throw unprocessable(`"${input}" is not a board domain.`);
  }
  return domain;
}

/** How many profiles have linked the board - the only thing the catalog view adds to the row. */
const WITH_ADOPTION = { _count: { select: { userBoards: true } } } as const;

type BoardRow = Prisma.JobBoardGetPayload<{ include: typeof WITH_ADOPTION }>;

/**
 * CRUD on the global board catalog. No existence pre-checks - the error middleware already maps
 * Prisma P2002 -> 409 and P2025 -> 404.
 */
@injectable()
export class AdminBoardService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  private project(row: BoardRow) {
    const { _count, ...board } = row;
    return { ...board, adoption: _count.userBoards };
  }

  async list(query: PaginationQuery & { q?: string }) {
    const where: Prisma.JobBoardWhereInput = query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { domain: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {};

    const [rows, total] = await Promise.all([
      this.prisma.jobBoard.findMany({
        where,
        include: WITH_ADOPTION,
        orderBy: [{ listed: "desc" }, { sortOrder: "asc" }],
        ...pageSlice(query),
      }),
      this.prisma.jobBoard.count({ where }),
    ]);
    return paginate(
      rows.map((row) => this.project(row)),
      query,
      total,
    );
  }

  async create(input: AdminBoardInput) {
    const board = await this.prisma.jobBoard.create({
      data: { ...input, domain: catalogDomain(input.domain) },
    });
    if (board.isDefault) {
      await this.backfillDefault(board.id);
    }
    return this.read(board.id);
  }

  async update(id: string, input: AdminBoardPatch) {
    const before = await this.prisma.jobBoard.findUniqueOrThrow({
      where: { id },
      select: { isDefault: true },
    });
    await this.prisma.jobBoard.update({
      where: { id },
      data: { ...input, domain: input.domain && catalogDomain(input.domain) },
    });
    if (!before.isDefault && input.isDefault) {
      await this.backfillDefault(id);
    }
    return this.read(id);
  }

  private async read(id: string) {
    return this.project(
      await this.prisma.jobBoard.findUniqueOrThrow({ where: { id }, include: WITH_ADOPTION }),
    );
  }

  /**
   * A board becoming default links to every existing user here, exactly once. After this moment a
   * missing link means the user removed the board, so nothing may ever re-create it for them.
   */
  private async backfillDefault(boardId: string) {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    await this.prisma.userJobBoard.createMany({
      data: users.map((user) => ({ userId: user.id, boardId })),
      // Races with concurrent signups; whoever wins, the link exists.
      skipDuplicates: true,
    });
  }

  /**
   * Cascades to every user's link row - the board disappears from those users' boards - and clears
   * it on jobs and applications. A board someone stored a login for is refused.
   */
  async remove(id: string) {
    try {
      await this.prisma.jobBoard.delete({ where: { id } });
    } catch (error) {
      if (isPrismaError(error, PRISMA_ERRORS.FOREIGN_KEY_VIOLATION)) {
        throw conflict("Users have saved logins for this board; it cannot be deleted.");
      }
      throw error;
    }
    return { deleted: id };
  }
}
