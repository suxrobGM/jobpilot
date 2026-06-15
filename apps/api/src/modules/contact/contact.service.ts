import { singleton } from "tsyringe";
import { PrismaClient } from "@/generated/prisma/client";

@singleton()
export class ContactService {
  constructor(private readonly prisma: PrismaClient) {}

  /** List the profile's contacts (newest first) for the networking page. */
  list(profileId: number) {
    return this.prisma.contact.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
    });
  }
}
