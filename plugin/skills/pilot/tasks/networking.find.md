# `networking.find`

Payload `{requestId, criteria}`: the user wants contacts matching the criteria, with no job behind
them. Get the standing networking feed (`POST /api/networking/feed`, read `.id`), then run the
`networking` skill's procedure (`../../networking/SKILL.md`) with the criteria and `--feed <id>`.

Summary: "Found 6 contacts for 'ML managers at robotics startups in Pittsburgh' - 6 drafts to review."
