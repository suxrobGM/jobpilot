# `promo.post`

Payload `{promotionId, platform, target, title, body}` - a post the user approved in the dashboard. Post the content **verbatim** (the user approved this exact text; never rewrite it):

1. Log in to the platform per `../../_shared/auth.md` (credentials resolver; CAPTCHA via the `solve-captcha` skill). No credentials → result `skipped` with note.
2. Navigate to `target`. For `hn-whoishiring`, if `target` is stale or empty, find the current month's "Ask HN: Who wants to be hired?" thread first.
3. Submit `title`/`body` per the platform's form, then capture the permalink of the new post.

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/pilot/promotions/$PROMO_ID/result" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg u "$POSTED_URL" '{outcome:"posted", postedUrl:$u}')"
```

`{outcome:"failed"|"skipped", note}` when the thread is locked, rules forbid the post, or login fails. Journal with the URL: "Posted to hn-whoishiring - <url>."
