// Contracts is zod-only, so this test pulls in no env and no Prisma.
import { hasRole } from "@jobpilot/contracts/role";
import { describe, expect, it } from "bun:test";

describe("role ladder", () => {
  it("lets super_admin satisfy every requirement", () => {
    expect(hasRole("super_admin", "super_admin")).toBe(true);
    expect(hasRole("super_admin", "admin")).toBe(true);
    expect(hasRole("super_admin", "user")).toBe(true);
  });

  it("lets admin satisfy admin and user but never super_admin", () => {
    expect(hasRole("admin", "admin")).toBe(true);
    expect(hasRole("admin", "user")).toBe(true);
    // The old guard short-circuited on `user.role !== "admin"`, so an admin passed requireRole("super_admin").
    expect(hasRole("admin", "super_admin")).toBe(false);
  });

  it("lets user satisfy nothing above user", () => {
    expect(hasRole("user", "user")).toBe(true);
    expect(hasRole("user", "admin")).toBe(false);
    expect(hasRole("user", "super_admin")).toBe(false);
  });

  it("rejects a role that is not on the ladder", () => {
    // An unknown role string must never satisfy a requirement.
    expect(hasRole(undefined, "user")).toBe(false);
    expect(hasRole("", "user")).toBe(false);
    expect(hasRole("root", "user")).toBe(false);
    expect(hasRole("SUPER_ADMIN", "admin")).toBe(false);
  });
});
