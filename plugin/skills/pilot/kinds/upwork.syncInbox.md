# `upwork.syncInbox`

Payload `{lastSyncedAt, unreadCount}` - the Upwork mirror in JobPilot is stale or empty, so the web app is showing the user old invitations and offers. Run the `upwork-sync` skill.

It is read-only against Upwork and finishes in a couple of calls. Then journal one line naming what landed ("Upwork inbox refreshed - 2 invitations, 1 offer, 68 connects."). Nothing to ask.

The Upwork MCP may not be connected on this machine (`../../_shared/upwork-mcp.md`). That is not a failure to retry: journal "Upwork inbox not synced - the Upwork MCP is not connected." and move on. The user reads it and connects it themselves.
