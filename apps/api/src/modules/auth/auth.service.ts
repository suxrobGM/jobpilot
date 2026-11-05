import type { LoginInput, RegisterInput } from "@jobpilot/contracts/auth";
import { inject, injectable } from "@needle-di/core";
import { hashPassword, verifyPassword } from "@/common/auth";
import { conflict, isPrismaError, notFound, PRISMA_ERRORS, unauthorized } from "@/common/errors";
import { normalizeEmail } from "@/common/utils/email";
import { randomUsername } from "@/common/utils/username";
import { env } from "@/env";
import { PrismaClient, type User, type UserRole } from "@/generated/prisma/client";
import { meUser, publicUser } from "./auth.mapper";
import { AuthTokenService } from "./auth-token.service";

/** Email/password accounts and the sessions they open. */
@injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly tokens = inject(AuthTokenService),
  ) {}

  /** The public user plus a new session token for the controller to set as the cookie. */
  async issueSession(user: User) {
    return { user: publicUser(user), token: await this.tokens.createSession(user.id) };
  }

  async register(input: RegisterInput) {
    // Dev signups skip the verification round-trip; elsewhere the controller emails the link.
    const user = await this.createUserAccount({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      emailVerified: env.NODE_ENV === "development",
    });
    return this.issueSession(user);
  }

  /** Shared by password registration and OAuth signup (null hash, provider-verified email). */
  async createUserAccount(input: {
    email: string;
    passwordHash: string | null;
    emailVerified: boolean;
  }): Promise<User> {
    const email = normalizeEmail(input.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw conflict("Email already registered");
    }

    const role: UserRole = env.SUPER_ADMIN_EMAIL?.toLowerCase() === email ? "super_admin" : "user";

    // An unseeded catalog yields zero links rather than a failed signup.
    const defaults = await this.prisma.jobBoard.findMany({
      where: { isDefault: true },
      select: { id: true },
    });

    try {
      return await this.prisma.user.create({
        data: {
          email,
          passwordHash: input.passwordHash,
          role,
          emailVerifiedAt: input.emailVerified ? new Date() : null,
          username: await this.uniqueUsername(),
          contactEmail: email,
          jobBoards: {
            createMany: { data: defaults.map((board) => ({ boardId: board.id })) },
          },
        },
      });
    } catch (error) {
      // Concurrent signup slipped past the pre-check; keep the friendly message.
      if (isPrismaError(error, PRISMA_ERRORS.UNIQUE_VIOLATION)) {
        throw conflict("Email already registered");
      }
      throw error;
    }
  }

  /** A random username not already taken. The unique constraint is the final backstop. */
  private async uniqueUsername(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const candidate = randomUsername();
      const taken = await this.prisma.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    return `pilot-${crypto.randomUUID().slice(0, 8)}`;
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(input.email) },
    });
    // Null hash = OAuth-only account; the generic message keeps that unenumerable.
    if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
      throw unauthorized("Invalid email or password");
    }
    return this.issueSession(user);
  }

  async logout(rawSession: string | null): Promise<void> {
    if (rawSession) {
      await this.tokens.revoke(rawSession);
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { oauthAccounts: { select: { provider: true } } },
      // One joined statement - the proxy hits /me on every gated navigation.
      relationLoadStrategy: "join",
    });
    if (!user) {
      throw notFound("User not found");
    }
    return meUser(user);
  }
}
