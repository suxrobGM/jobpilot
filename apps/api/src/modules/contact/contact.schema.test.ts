import { contactSchema } from "./contact.schema";
import { describe, expect, it } from "bun:test";

const row = {
  id: "6f1f0b6c-6d1e-4f2e-9a3a-2c1d4b5e6f70",
  userId: "1b2c3d4e-5f60-4718-8293-a4b5c6d7e8f9",
  name: "Dana Lee",
  title: null,
  company: null,
  linkedinUrl: null,
  email: null,
  emailSource: null,
  emailConfidence: null,
  linkedinConnection: "none" as const,
  discoverySource: "company_site" as const,
  matchConfidence: null,
  relatedAppId: null,
  relatedJobUrl: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("contactSchema", () => {
  // A rejected row fails response validation for the whole page, not just itself.
  it("accepts a Prisma row verbatim", () => {
    expect(contactSchema.safeParse(row).success).toBe(true);
  });
});
