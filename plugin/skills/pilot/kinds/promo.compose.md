# `promo.compose`

Payload `{platform, target?}`. Compose a self-promotion post from profile + primary resume (`../../_shared/setup.md`). Platform rules:

- `"hn-whoishiring"` - the monthly "Ask HN: Who wants to be hired?" format: `Location:` / `Remote:` / `Willing to relocate:` / `Technologies:` / `Résumé:` / `Email:` lines + a 2-3 sentence pitch.
- `"reddit:<sub>"` - read the subreddit's posting rules from its sidebar/wiki **before** composing and follow its title format (e.g. r/forhire wants a `[For Hire]` title prefix).
- `"linkedin-post"` - first-person 100-150 word post, <=3 hashtags.

Run `humanizer` in embedded mode on the body, then save the draft:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/pilot/promotions" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg p "$PLATFORM" --arg t "$TARGET" --arg ti "$TITLE" --arg b "$BODY" \
    '{platform:$p, target:(if $t=="" then null else $t end), title:(if $ti=="" then null else $ti end), body:$b}')"
```

**Never post anywhere** - drafts await user review in the dashboard. Journal e.g. "Drafted hn-whoishiring post - awaiting your review."
