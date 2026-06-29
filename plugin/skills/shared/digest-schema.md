# Job Digest Schema

The canonical job digest. Build it from the posting body (a narrowed `browser_snapshot`, per `./browser-tips.md`) or a pasted JD, then pass it to `POST /api/score-fit` and to the `tailor-resume` skill.

```json
{
  "title": "...",
  "company": "...",
  "location": "...",
  "salary": "...",
  "employmentType": "...",
  "remote": true,
  "techStack": ["..."],
  "requirements": ["..."],
  "responsibilities": ["..."],
  "yearsExperience": 5,
  "descriptionExcerpt": "..."
}
```

- **Always populate `techStack`** - it drives the score; empty → low score/confidence.
- A first-pass score from a results row needs only `title`, `company`, `techStack`, and a short excerpt. A thin/generic row is **not** a skip - open the posting and enrich the digest before scoring it out.
- Omit optional fields the posting doesn't state; never invent values.
