import type { Prisma } from "@/generated/prisma/client";

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

const DATE_KEYS = new Set([
  "generatedAt",
  "expiresAt",
  "nextWakeAt",
  "resetsAt",
  "sentAt",
  "receivedAt",
]);

/** Restores ISO date fields after reading typed JSON snapshots. */
export function reviveJsonDates(value: unknown, key?: string): unknown {
  if (value instanceof Date) return value;
  if (typeof value === "string" && key && DATE_KEYS.has(key)) return new Date(value);
  if (Array.isArray(value)) return value.map((child) => reviveJsonDates(child));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [
        childKey,
        reviveJsonDates(child, childKey),
      ]),
    );
  }
  return value;
}
