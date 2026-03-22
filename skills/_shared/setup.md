# Setup: Load Profile and Resume

1. Read `${CLAUDE_PLUGIN_ROOT}/profile.json`.
   - If it does not exist, copy `${CLAUDE_PLUGIN_ROOT}/profile.example.json` to `${CLAUDE_PLUGIN_ROOT}/profile.json` and ask the user to fill in their details. **STOP** until filled.
2. Read `personal.resumePath`. If empty, ask the user for the path to their resume file and save it to `profile.json`.
3. Read the resume file to extract candidate details (education, experience, skills, projects, technologies).

## Credential Lookup

When credentials are needed for a domain:

1. Find the matching entry in the `jobBoards` array where `domain` matches or is contained in the URL.
2. If the board entry has `email` and `password` set, use those.
3. Otherwise, fall back to `credentials.default`.
4. If no credentials are found at all, report it -- do not guess.
