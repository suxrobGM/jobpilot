import { singleton } from "tsyringe";
import type { z } from "zod/v4";
import {
  contactDiscoverySourceSchema,
  contactEmailSourceSchema,
  contactLinkedinConnectionSchema,
} from "@jobpilot/contracts/outreach";
import { PrismaClient } from "@/generated/prisma/client";

type ContactLinkedinConnection = z.infer<typeof contactLinkedinConnectionSchema>;
type ContactEmailSource = z.infer<typeof contactEmailSourceSchema>;
type ContactDiscoverySource = z.infer<typeof contactDiscoverySourceSchema>;

@singleton()
export class ContactService {
  constructor(private readonly prisma: PrismaClient) {}

  /** List the profile's contacts (newest first) for the networking page. */
  async list(profileId: string) {
    const rows = await this.prisma.contact.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
      ...row,
      linkedinConnection: row.linkedinConnection as ContactLinkedinConnection,
      emailSource: row.emailSource as ContactEmailSource | null,
      discoverySource: row.discoverySource as ContactDiscoverySource | null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }
}
