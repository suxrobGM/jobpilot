import { err, ErrorCodes, ok } from "@/lib/api";
import { parseQueryParams } from "@/lib/api/request";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const { domain, sinceMinutes: sinceMinutesRaw } = parseQueryParams(req, [
    "domain",
    "sinceMinutes",
  ] as const);
  const sinceMinutes = Number(sinceMinutesRaw ?? "5");

  if (!domain) {
    return err(ErrorCodes.INVALID_REQUEST, "domain is required", 400);
  }

  const cutoff = new Date(Date.now() - Math.max(1, sinceMinutes) * 60_000);

  const message = await db.emailMessage.findFirst({
    where: {
      classification: "verification",
      verificationDomain: domain,
      receivedAt: { gte: cutoff },
    },
    orderBy: { receivedAt: "desc" },
  });

  if (!message) {
    return err(ErrorCodes.NOT_FOUND, "No verification code found", 404);
  }

  return ok({
    code: message.verificationCode,
    link: message.verificationLink,
    receivedAt: message.receivedAt,
  });
}
