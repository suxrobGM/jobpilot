# Browser Tips

## Snapshot Mode

Playwright MCP is configured with `--snapshot-mode none`. This means **actions do NOT return snapshots automatically**. You must explicitly call `browser_snapshot` when you need to read the page. This saves significant context tokens.

### When to snapshot

- **After navigation** (`browser_navigate`) -- to assess the page type
- **After login** -- to confirm success
- **Before filling a form** -- to identify fields
- **After filling a form** -- to verify fields are filled correctly
- **After clicking submit** -- to confirm submission

### When NOT to snapshot

- After every single `browser_click` or `browser_type` -- only snapshot when you need to read the result
- After clicking "Next" on a multi-page form -- one snapshot after the new page loads is enough
- After closing a popup -- just proceed with the next action

### Targeted snapshots

Always try `browser_snapshot` with a `ref` parameter first to get only a specific element's subtree (e.g., the form container, the results list) instead of the entire page. This dramatically reduces token usage on large pages.

## Handling Token Overflow

If a snapshot still exceeds token limits:

1. The result is saved to a file. Use the `Read` tool with `offset` and `limit` to read portions, or use `Grep` to search for specific content (e.g., job titles, form fields).
2. **Do NOT use inline Python/Node scripts to parse these files** -- always use the built-in `Read` and `Grep` tools instead.
3. Try a more targeted `browser_snapshot` with a `ref` to a smaller element.

## General Best Practices

1. **Handle popups and modals** -- close cookie banners, notification prompts, and overlays that block forms.
2. **Be patient with page loads** -- use `browser_wait_for` after navigation and form submissions.
3. **If something goes wrong** (unexpected page, error, crashed form), take a snapshot and report to the user with what you see rather than guessing.
4. **For file uploads**, verify the resume file exists. If not, tell the user.
5. **Never guess passwords** -- always read from profile.json credentials.
