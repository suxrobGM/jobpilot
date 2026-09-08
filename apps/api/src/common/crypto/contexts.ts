/**
 * AEAD field-context tags, bound as additional authenticated data when a secret
 * column value is encrypted (see {@link CryptoService}). They prevent a ciphertext
 * from being moved to a different column and still verifying, so encrypt and
 * decrypt sites for the same field MUST use the same tag - keeping them here stops
 * the literals drifting across services.
 *
 * Changing a tag invalidates every ciphertext previously stored for that field.
 */
export const SECRET_CONTEXTS = {
  credentialPassword: "credential:password",
  credentialApiKey: "credential:apiKey",
  gmailTokens: "gmail:tokens",
  emailOAuthClient: "email:oauthClient",
  apiTokenTerminal: "apiToken:terminal",
} as const;
