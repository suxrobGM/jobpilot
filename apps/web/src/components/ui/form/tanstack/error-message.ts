// `meta.errors` may hold Zod issues, plain strings, or other thrown values.
export function firstErrorMessage(errors: ReadonlyArray<unknown>): string | undefined {
  const first = errors[0];
  if (!first) {
    return undefined;
  }
  if (typeof first === "string") {
    return first;
  }
  return (first as { message?: string }).message ?? String(first);
}
