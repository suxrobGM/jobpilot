import {
  type CredentialInput,
  type CredentialKind,
  type CredentialPatch,
  SERVICE_PROVIDERS,
  type ServiceProvider,
} from "@jobpilot/contracts/credential";
import { inject, injectable } from "@needle-di/core";
import { CryptoService, SECRET_CONTEXTS } from "@/common/crypto";
import { findOwned, unprocessable } from "@/common/errors";
import { type Credential, type Prisma, PrismaClient } from "@/generated/prisma/client";
import { BOARD_REF_SELECT, JobBoardService } from "@/modules/job-board/job-board.service";

interface Login {
  email: string;
  password: string;
}

export interface ResolvedCredential extends Login {
  /** The credential row - the target for `PATCH /credentials/<id>` after a password reset. */
  id: string;
  kind: Exclude<CredentialKind, "service">;
}

interface ServiceKey {
  provider: ServiceProvider;
  apiKey: string;
}

const CREDENTIAL_INCLUDE = {
  board: { select: BOARD_REF_SELECT },
} satisfies Prisma.CredentialInclude;

type CredentialRow = Prisma.CredentialGetPayload<{ include: typeof CREDENTIAL_INCLUDE }>;

/** Secrets never leave through the list: only whether each one is set. */
function toRecord(row: CredentialRow) {
  return {
    id: row.id,
    kind: row.kind,
    board: row.board,
    provider: row.provider,
    email: row.email,
    hasPassword: row.password !== null,
    hasApiKey: row.apiKey !== null,
  };
}

@injectable()
export class CredentialService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly crypto = inject(CryptoService),
    private readonly boards = inject(JobBoardService),
  ) {}

  /** Unpaginated: an account stores a handful of logins plus a default and service keys. */
  async list(userId: string) {
    const rows = await this.prisma.credential.findMany({
      where: { userId },
      include: CREDENTIAL_INCLUDE,
      orderBy: [{ kind: "asc" }, { board: { domain: "asc" } }, { provider: "asc" }],
    });
    return rows.map(toRecord);
  }

  async create(userId: string, input: CredentialInput) {
    const data: Prisma.CredentialUncheckedCreateInput = { userId, kind: input.kind };
    if (input.kind === "service") {
      data.provider = input.provider;
      data.apiKey = await this.encryptApiKey(userId, input.apiKey);
    } else {
      data.email = input.email;
      data.password = await this.encryptPassword(userId, input.password);
    }
    if (input.kind === "board") {
      data.boardId = (await this.boards.resolve(input.board)).id;
    }
    // A second credential for the same board, provider or default is a 409 from a unique index.
    const row = await this.prisma.credential.create({ data, include: CREDENTIAL_INCLUDE });
    return toRecord(row);
  }

  async update(userId: string, id: string, patch: CredentialPatch) {
    const existing = await findOwned(
      (where) => this.prisma.credential.findFirst({ where, select: { kind: true } }),
      { id, userId },
      "Credential",
    );
    const isService = existing.kind === "service";
    if (patch.board !== undefined && existing.kind !== "board") {
      throw unprocessable("Only a board credential has a board.");
    }
    if (isService && (patch.email !== undefined || patch.password !== undefined)) {
      throw unprocessable("A service credential holds an API key, not a login.");
    }
    if (!isService && patch.apiKey !== undefined) {
      throw unprocessable("A login credential holds an email and password, not an API key.");
    }

    const data: Prisma.CredentialUncheckedUpdateInput = { email: patch.email };
    if (patch.board !== undefined) {
      data.boardId = (await this.boards.resolve(patch.board)).id;
    }
    if (patch.password !== undefined) {
      data.password = await this.encryptPassword(userId, patch.password);
    }
    if (patch.apiKey !== undefined) {
      data.apiKey = await this.encryptApiKey(userId, patch.apiKey);
    }
    const row = await this.prisma.credential.update({
      where: { id },
      data,
      include: CREDENTIAL_INCLUDE,
    });
    return toRecord(row);
  }

  async remove(userId: string, id: string) {
    await findOwned(
      (where) => this.prisma.credential.findFirst({ where, select: { id: true } }),
      { id, userId },
      "Credential",
    );
    await this.prisma.credential.delete({ where: { id } });
    return { deleted: id };
  }

  /**
   * The effective login for a board domain: the board's own credential, else the default. Returns
   * `null` when neither holds a complete email + password pair.
   */
  async resolveCredential(userId: string, domain: string): Promise<ResolvedCredential | null> {
    const board = await this.boards.find(domain);
    const creds = await this.prisma.credential.findMany({
      where: {
        userId,
        OR: [{ kind: "default" }, ...(board ? [{ boardId: board.id }] : [])],
      },
      select: { id: true, kind: true, email: true, password: true },
    });

    for (const kind of ["board", "default"] as const) {
      const cred = creds.find((c) => c.kind === kind);
      if (!cred) {
        continue;
      }
      const login = await this.toLogin(userId, cred);
      if (login) {
        return { id: cred.id, ...login, kind };
      }
    }
    return null;
  }

  /** The decrypted key for `provider`, or for the first provider with a key in preference order. */
  async resolveServiceKey(
    userId: string,
    provider: ServiceProvider | null,
  ): Promise<ServiceKey | null> {
    const rows = await this.prisma.credential.findMany({
      where: { userId, kind: "service", apiKey: { not: null } },
      select: { provider: true, apiKey: true },
    });
    const order: readonly ServiceProvider[] = provider ? [provider] : SERVICE_PROVIDERS;
    for (const p of order) {
      const row = rows.find((r) => r.provider === p);
      if (row?.apiKey) {
        const apiKey = await this.crypto.decryptFor(
          userId,
          SECRET_CONTEXTS.credentialApiKey,
          row.apiKey,
        );
        return { provider: p, apiKey };
      }
    }
    return null;
  }

  private encryptPassword(userId: string, password: string): Promise<string> {
    return this.crypto.encryptFor(userId, SECRET_CONTEXTS.credentialPassword, password);
  }

  private encryptApiKey(userId: string, apiKey: string): Promise<string> {
    return this.crypto.encryptFor(userId, SECRET_CONTEXTS.credentialApiKey, apiKey);
  }

  /** A row with both login fields present and the password decrypted - or null. */
  private async toLogin(
    userId: string,
    row: Pick<Credential, "email" | "password">,
  ): Promise<Login | null> {
    const email = row.email?.trim();
    const stored = row.password?.trim();
    if (!email || !stored) {
      return null;
    }
    const password = (
      await this.crypto.decryptFor(userId, SECRET_CONTEXTS.credentialPassword, stored)
    ).trim();
    return password ? { email, password } : null;
  }
}
