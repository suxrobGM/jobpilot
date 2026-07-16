/**
 * A user's wrapped DEK won't unwrap under the current master key (stale row / wrong
 * SECRET_MASTER_KEY): their at-rest secrets are unrecoverable. Recovery is a deliberate
 * per-user reset, never an auto re-provision (a globally-wrong key would shred everyone).
 */
export class KeyUnrecoverableError extends Error {
  constructor(
    readonly userId: string,
    options?: { cause?: unknown },
  ) {
    super(`Encryption key unrecoverable for user ${userId}`, options);
    this.name = "KeyUnrecoverableError";
  }
}
