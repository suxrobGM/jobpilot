import { workspaceChannel } from "@jobpilot/contracts/sse";
import { publish } from "@/common/sse";

export function publishFeedUpdated(userId: string, feedId: string): void {
  publish(workspaceChannel, { userId }, { type: "feed.updated", feedId });
}
