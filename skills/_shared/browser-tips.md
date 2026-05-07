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

### Targeted snapshots (CRITICAL)

**ALWAYS use `browser_snapshot` with a `ref` parameter.** Never call `browser_snapshot` without `ref` unless it's the very first snapshot after navigating to a completely new page and you don't know any element refs yet.

Strategy:

1. **First visit to a page** -- call `browser_snapshot` without `ref` once. Immediately identify the key container refs (form, results list, main content area).
2. **All subsequent snapshots** -- use `ref` to target only the element you need:
   - Form filling: snapshot the form container, not the whole page
   - Search results: snapshot the results list element, not the whole page
   - After clicking a button: snapshot the relevant section that changed, not the whole page
   - Login verification: snapshot the header/nav area to check for logged-in state
3. **If even a targeted snapshot is too large** (e.g., a massive form), narrow further -- snapshot individual form sections or fieldsets.

Example flow:

```text
browser_snapshot()                          # First visit: get full page, find refs
browser_snapshot(ref: "form-container")     # Target the form only
browser_fill_form(...)                      # Fill fields
browser_snapshot(ref: "form-container")     # Verify form state
browser_click(ref: "submit-btn")            # Submit
browser_snapshot(ref: "main-content")       # Check result
```

### Why this matters

Full-page snapshots on job boards can be 50,000-120,000 tokens. A targeted form snapshot is typically 2,000-5,000 tokens. In autopilot mode, this is the difference between applying to 3 jobs vs 15+ jobs before context runs out.

## Handling Token Overflow

If a snapshot still exceeds token limits even with `ref`:

1. Narrow the `ref` further -- target a smaller child element (a single fieldset, a single result card).
2. If the result is saved to a file, use the `Read` tool with `offset` and `limit` to read portions, or use `Grep` to search for specific content (e.g., job titles, form fields).
3. **Do NOT use inline Python/Node scripts to parse these files** -- use the built-in `Read` and `Grep` tools, or `jq` against the JobPilot API responses.

## General Best Practices

1. **Handle popups and modals** -- close cookie banners, notification prompts, and overlays that block forms.
2. **Be patient with page loads** -- use `browser_wait_for` after navigation and form submissions.
3. **If something goes wrong** (unexpected page, error, crashed form), take a snapshot and report to the user with what you see rather than guessing.
4. **For file uploads**, verify the resume file exists. If not, tell the user.
5. **Never guess passwords** -- always read from `/api/credentials` (see `_shared/setup.md` § Credential lookup).
