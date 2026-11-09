import { type GithubEmail, pickGithubEmail } from "./github.provider";
import { describe, expect, it } from "bun:test";

function email(overrides: Partial<GithubEmail>): GithubEmail {
  return { email: "a@example.com", primary: false, verified: false, ...overrides };
}

describe("pickGithubEmail", () => {
  it("prefers the primary verified address", () => {
    const picked = pickGithubEmail([
      email({ email: "old@example.com", verified: true }),
      email({ email: "main@example.com", primary: true, verified: true }),
    ]);
    expect(picked).toBe("main@example.com");
  });

  it("falls back to any verified address when the primary is unverified", () => {
    const picked = pickGithubEmail([
      email({ email: "main@example.com", primary: true }),
      email({ email: "backup@example.com", verified: true }),
    ]);
    expect(picked).toBe("backup@example.com");
  });

  it("returns null when no address is verified", () => {
    expect(pickGithubEmail([email({ primary: true })])).toBeNull();
    expect(pickGithubEmail([])).toBeNull();
  });
});
