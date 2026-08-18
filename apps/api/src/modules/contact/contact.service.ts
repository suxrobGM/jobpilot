import { type PaginationQuery, pageSlice, paginate } from "@jobpilot/contracts/pagination";
import { singleton } from "tsyringe";
import { PrismaClient } from "@/generated/prisma/client";
import { toContactRow } from "./contact.mapper";

@singleton()
export class ContactService {
  constructor(private readonly prisma: PrismaClient) {}

  /** One page of the profile's contacts (newest first) for the networking page. */
  async list(userId: string, query: PaginationQuery) {
    const where = { userId };
    const [rows, total] = await Promise.all([
      this.prisma.contact.findMany({ where, orderBy: { createdAt: "desc" }, ...pageSlice(query) }),
      this.prisma.contact.count({ where }),
    ]);
    return paginate(rows.map(toContactRow), query, total);
  }
}
