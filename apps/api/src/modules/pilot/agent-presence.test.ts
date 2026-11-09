import type { AuthUser } from "@/common/auth/types";
import type { AgentOfflineAlert } from "./agent-offline-alert";
import { AgentPresence } from "./agent-presence";
import { describe, expect, it } from "bun:test";

const host: AuthUser = {
  id: "u1",
  role: "user",
  email: "u1@example.com",
  tokenId: "t1",
  tokenKind: "terminal",
};

async function* idle(): AsyncGenerator<string, void, unknown> {
  yield "connected";
  await new Promise(() => {});
}

async function open(presence: AgentPresence) {
  const stream = presence.track(host, idle());
  await stream.next();
  return stream;
}

function make(): AgentPresence {
  return new AgentPresence({ presenceChanged: () => {} } as unknown as AgentOfflineAlert);
}

describe("AgentPresence", () => {
  it("stays connected while any of the user's host streams is open", async () => {
    const presence = make();
    const first = await open(presence);
    const second = await open(presence);
    await first.return();
    expect(presence.isConnected(host.id)).toBe(true);
    await second.return();
    // Still inside the reconnect grace.
    expect(presence.isConnected(host.id)).toBe(true);
  });

  it("ignores a web session's stream", async () => {
    const presence = make();
    const stream = presence.track({ ...host, tokenKind: "session" }, idle());
    await stream.next();
    expect(presence.isConnected(host.id)).toBe(false);
  });
});
