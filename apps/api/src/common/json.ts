import { Prisma } from "@/generated/prisma/client";

/** Validates a value for use in a Prisma JSON write. */
export function toInputJson(value: unknown): Prisma.InputJsonValue {
  const converted = toJsonChild(value);
  if (converted === null) throw new TypeError("Top-level JSON null is not supported.");
  return converted;
}

function toJsonChild(value: unknown): Prisma.InputJsonValue | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(toJsonChild);
  if (typeof value === "object") {
    const result: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [key, child] of Object.entries(value)) {
      if (child !== undefined) result[key] = toJsonChild(child);
    }
    return result;
  }
  throw new TypeError(`Value of type ${typeof value} cannot be stored as JSON.`);
}

/** A nullable JSON column write: undefined leaves the column alone, null clears it. */
export function toNullableInputJson(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return toInputJson(value);
}
