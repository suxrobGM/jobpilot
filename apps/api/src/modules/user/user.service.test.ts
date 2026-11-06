import type { UserWithAutoApplyInput } from "@jobpilot/contracts/user";
import type { PrismaClient } from "@/generated/prisma/client";
import { userAggregateSchema } from "./user.schema";
import { UserService } from "./user.service";
import { describe, expect, it } from "bun:test";

const baseBody = (over: Record<string, unknown> = {}) =>
  ({
    firstName: "Ava",
    lastName: "Ng",
    contactEmail: "ava@example.com",
    usAuthorized: true,
    requiresSponsorship: false,
    willingToRelocate: true,
    preferredLocations: [],
    references: [],
    salaryPreferences: [],
    ...over,
  }) as UserWithAutoApplyInput;

function updateService() {
  let updateData: Record<string, unknown> | undefined;
  const db = {
    user: {
      update: async (a: { data: Record<string, unknown> }) => {
        updateData = a.data;
        return { id: "u1" };
      },
    },
    reference: { deleteMany: async () => ({}), createMany: async () => ({}) },
    salaryPreference: { deleteMany: async () => ({}), createMany: async () => ({}) },
    autoApplySettings: { upsert: async () => ({}) },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  return { svc: new UserService(db as unknown as PrismaClient), updateData: () => updateData };
}

describe("update agentNotes", () => {
  it("leaves the column untouched when the key is absent", async () => {
    const { svc, updateData } = updateService();
    await svc.update("u1", baseBody());
    expect("agentNotes" in updateData()!).toBe(false);
  });

  it("writes the column when the key is present", async () => {
    const { svc, updateData } = updateService();
    await svc.update("u1", baseBody({ agentNotes: "3 years of experience" }));
    expect(updateData()!.agentNotes).toBe("3 years of experience");
  });
});

describe("get agentNotes", () => {
  it("selects agent_notes for the user aggregate", async () => {
    let select: Record<string, unknown> | undefined;
    const db = {
      user: {
        findFirst: async (a: { select: Record<string, unknown> }) => {
          select = a.select;
          return {
            id: "u1",
            primaryResumeId: null,
            preferredLocations: "[]",
            updatedAt: new Date(),
          };
        },
      },
      autoApplySettings: { findUnique: async () => null },
      resume: { findMany: async () => [] },
      reference: { findMany: async () => [] },
      salaryPreference: { findMany: async () => [] },
    };
    const svc = new UserService(db as unknown as PrismaClient);
    await svc.get("u1");
    expect(select!.agentNotes).toBe(true);
  });
});

describe("userAggregateSchema", () => {
  it("keeps agentNotes through the response schema", () => {
    const user = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      firstName: "Ava",
      lastName: "Ng",
      contactEmail: "ava@example.com",
      phone: null,
      website: null,
      linkedin: null,
      github: null,
      street: null,
      aptUnit: null,
      city: null,
      state: null,
      zipCode: null,
      country: null,
      usAuthorized: true,
      requiresSponsorship: false,
      visaStatus: null,
      optExtension: null,
      willingToRelocate: true,
      preferredLocations: [],
      eeoGender: null,
      eeoRace: null,
      eeoEthnicity: null,
      eeoHispanicOrLatino: null,
      eeoVeteranStatus: null,
      eeoDisabilityStatus: null,
      primaryResumeId: null,
      agentNotes: "3 years of experience",
      references: [],
      salaryPreferences: [],
      updatedAt: new Date(),
    };
    const parsed = userAggregateSchema.parse({
      user,
      autoApply: null,
      primaryResumeSourceAbsolutePath: null,
      resumes: [],
    });
    expect(parsed.user.agentNotes).toBe("3 years of experience");
  });
});
