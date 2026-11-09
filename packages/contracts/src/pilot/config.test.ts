import { updatePilotSettingsSchema } from "./config";
import { describe, expect, it } from "bun:test";

describe("updatePilotSettingsSchema", () => {
  it("keeps a one-key patch to that key, so the rest of the saved config survives", () => {
    expect(updatePilotSettingsSchema.parse({ boards: ["linkedin.com"] })).toEqual({
      boards: ["linkedin.com"],
    });
  });
});
