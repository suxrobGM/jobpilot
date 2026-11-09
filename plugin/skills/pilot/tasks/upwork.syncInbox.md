# `upwork.syncInbox`

Payload `{lastSyncedAt, unreadCount}`: the Upwork mirror is stale. Run the `upwork-sync` skill and
ask nothing. When the Upwork MCP isn't connected (`../../_shared/upwork-mcp.md`), don't retry: the
user connects it after reading the summary.

Summary: "Upwork inbox refreshed - 2 invitations, 1 offer, 68 connects." / "Upwork inbox not
synced - the Upwork MCP is not connected."
