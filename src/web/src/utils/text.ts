// Built from escapes so this source file stays free of literal replacement chars.
const REPLACEMENT_ARTIFACT = new RegExp("(?:\\uFFFD|\\u00EF\\u00BF\\u00BD)+", "g");
const EM_DASH = "—";

/**
 * Restores an em-dash from replacement-char artifacts left when an agent's typed
 * em-dash is mangled by the provider shell's encoding (raw U+FFFD, or its
 * Latin-1 misread `EF BF BD`). The original char is lost; it was always a dash.
 */
export function cleanReplacementChars(value: string): string {
  return value.replace(REPLACEMENT_ARTIFACT, EM_DASH);
}

/** {@link cleanReplacementChars} that passes `null`/`undefined` through unchanged. */
export function cleanReplacementCharsNullable<T extends string | null | undefined>(value: T): T {
  return (typeof value === "string" ? cleanReplacementChars(value) : value) as T;
}
