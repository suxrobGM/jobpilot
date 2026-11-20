import { userUpdateSchema } from "./user";
import { describe, expect, it } from "bun:test";

const body = (over: Record<string, unknown> = {}) => ({
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
});

describe("agentNotes", () => {
  // Optional by design: the onboarding wizard full-replaces from USER_DEFAULT_VALUES
  // without loading the profile, so a required field or a "" default would wipe stored notes.
  it("is optional with no default", () => {
    const result = userUpdateSchema.parse(body());
    expect("agentNotes" in result).toBe(false);
    expect(result.agentNotes).toBeUndefined();
  });

  it("trims the value", () => {
    expect(userUpdateSchema.parse(body({ agentNotes: "  3 YOE  " })).agentNotes).toBe(
      "3 YOE",
    );
  });

  it("caps at 2000 characters on the trimmed value", () => {
    expect(userUpdateSchema.safeParse(body({ agentNotes: "x".repeat(2000) })).success).toBe(
      true,
    );
    expect(userUpdateSchema.safeParse(body({ agentNotes: "x".repeat(2001) })).success).toBe(
      false,
    );
    expect(
      userUpdateSchema.safeParse(body({ agentNotes: `  ${"x".repeat(1999)} ` })).success,
    ).toBe(true);
  });
});
