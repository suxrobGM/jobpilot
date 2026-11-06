# `networking.find`

Payload `{requestId, criteria}`: the user wants contacts that match the criteria, with no job behind
them. Get the standing networking feed, then run the `networking` skill's procedure
(`../../networking/SKILL.md`) with the criteria and `--feed` set to its id:

```bash
jobpilot-api POST /api/networking/feed
```

Summary: "Found 6 contacts for 'ML managers at robotics startups in Pittsburgh' - 6 drafts to review."
