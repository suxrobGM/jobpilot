import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Authenticated symmetric encryption for secret column values. AES-256-GCM with a
 * random 12-byte IV per write; the field context (e.g. "credential:password") is
 * bound as additional authenticated data so a ciphertext can't be silently moved
 * to a different column and still verify. Envelope: `iv.tag.ciphertext` (base64url).
 */
const ALG = "aes-256-gcm";

export function encrypt(key: Buffer, ctx: string, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  cipher.setAAD(Buffer.from(ctx, "utf8"));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ct].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(key: Buffer, ctx: string, blob: string): string {
  const [ivB64, tagB64, ctB64] = blob.split(".");
  if (!ivB64 || !tagB64 || ctB64 === undefined) {
    throw new Error("Malformed secret envelope");
  }
  const decipher = createDecipheriv(ALG, key, Buffer.from(ivB64, "base64url"));
  decipher.setAAD(Buffer.from(ctx, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** A fresh 32-byte data-encryption key. */
export function generateDek(): Buffer {
  return randomBytes(32);
}

/** Wrap a DEK under the master key for storage (uses the same AEAD envelope). */
export function wrapDek(masterKey: Buffer, dek: Buffer): string {
  return encrypt(masterKey, "dek", dek.toString("base64"));
}

export function unwrapDek(masterKey: Buffer, wrapped: string): Buffer {
  return Buffer.from(decrypt(masterKey, "dek", wrapped), "base64");
}
