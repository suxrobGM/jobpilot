import { pilotConfigSchema } from "@jobpilot/contracts/pilot";
import { allowedToday } from "./allowed-today";
import { describe, expect, it } from "bun:test";

const config = (over: Record<string, unknown> = {}) => pilotConfigSchema.parse(over);

describe("allowedToday", () => {
  it("reads a cap of 0 as reached and never goes negative", () => {
    const allowed = allowedToday(config({ dailyApplyCap: 0 }), {
      appliedToday: 2,
      networkingSentToday: 0,
    });
    expect(allowed.appliesLeft).toBe(0);
  });

  it("leaves the remaining sends of today's networking cap", () => {
    const allowed = allowedToday(config({ networking: { dailyCap: 5 } }), {
      appliedToday: 0,
      networkingSentToday: 3,
    });
    expect(allowed.sendsLeft).toBe(2);
  });

  it("closes email work when the email channel is off", () => {
    const off = config({ networking: { email: "off", linkedIn: "off" } });
    const allowed = allowedToday(off, { appliedToday: 0, networkingSentToday: 0 });
    expect(allowed.emailAutonomy).toBeNull();
    expect(allowed.outreach).toBeNull();
  });
});
