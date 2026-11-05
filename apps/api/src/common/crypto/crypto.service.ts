import { inject, injectable } from "@needle-di/core";
import { HOUR_MS } from "@/common/date/buckets";
import { MemoryCache } from "@/common/memory-cache";
import { env } from "@/env";
import { PrismaClient } from "@/generated/prisma/client";
import type { SecretContext } from "./contexts";
import { KeyUnrecoverableError } from "./errors";
import { decrypt, decryptDataKey, encrypt, encryptDataKey, generateDataKey } from "./secret";

const MASTER_KEY = Buffer.from(env.SECRET_MASTER_KEY, "base64");

/**
 * Per-user, at-rest encryption of secret column values. Each user owns a random
 * data key, stored encrypted under the master key on `User.encryptedDataKey`, that encrypts
 * their secrets (board logins, captcha keys, Gmail tokens). Deleting the user drops the key,
 * crypto-shredding their secrets.
 */
@injectable()
export class CryptoService {
  /**
   * Decrypted data keys per user. Bounded and expiring so a deleted user's key leaves memory; a shared
   * in-flight load also stops two first requests from provisioning two keys.
   */
  private readonly dataKeys = new MemoryCache<string, Buffer>({ ttlMs: HOUR_MS, maxEntries: 1000 });

  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  private getDataKey(userId: string): Promise<Buffer> {
    return this.dataKeys.getOrLoad(userId, async () => {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { encryptedDataKey: true },
      });
      if (!user) {
        throw new Error(`Cannot resolve encryption key: no user ${userId}`);
      }
      return user.encryptedDataKey
        ? this.readDataKey(userId, user.encryptedDataKey)
        : this.provisionDataKey(userId);
    });
  }

  /** Decrypt a stored data key, translating an AES-GCM auth failure into `KeyUnrecoverableError`. */
  private readDataKey(userId: string, stored: string): Buffer {
    try {
      return decryptDataKey(MASTER_KEY, stored);
    } catch (cause) {
      throw new KeyUnrecoverableError(userId, { cause });
    }
  }

  /** Generate, persist (encrypted), and return a new data key for a user that lacks one. */
  private async provisionDataKey(userId: string): Promise<Buffer> {
    const dataKey = generateDataKey();
    // First-write-wins: a concurrent provision must not overwrite an already-used data key.
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, encryptedDataKey: null },
      data: { encryptedDataKey: encryptDataKey(MASTER_KEY, dataKey) },
    });
    if (count === 0) {
      const winner = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { encryptedDataKey: true },
      });
      if (!winner?.encryptedDataKey) {
        throw new Error(`Cannot resolve encryption key: no user ${userId}`);
      }
      return this.readDataKey(userId, winner.encryptedDataKey);
    }
    return dataKey;
  }

  async encryptFor(userId: string, ctx: SecretContext, plain: string): Promise<string> {
    return encrypt(await this.getDataKey(userId), ctx, plain);
  }

  async decryptFor(userId: string, ctx: SecretContext, blob: string): Promise<string> {
    return decrypt(await this.getDataKey(userId), ctx, blob);
  }

  /** Encrypt an optional secret column value, passing null/undefined/empty through unchanged. */
  encryptField(
    userId: string,
    ctx: SecretContext,
    value: string | null | undefined,
  ): Promise<string | null | undefined> {
    if (value == null || value === "") {
      return Promise.resolve(value);
    }
    return this.encryptFor(userId, ctx, value);
  }

  /** Decrypt a stored secret column value, passing null/empty through unchanged. */
  decryptField(userId: string, ctx: SecretContext, value: string | null): Promise<string | null> {
    return value ? this.decryptFor(userId, ctx, value) : Promise.resolve(value);
  }
}
