# Eligibility

A skip needs one of these reasons, worded exactly:

- `Already applied (<kind>)`: the applied check matched.
- `Below minimum match score (<score> < <min>)`: only after reading the actual posting.
- From `POST /api/fit-scores` `eligibilityBlocked.kind`, raised only when the posting states it:
  - `sponsorship`: `No visa sponsorship (JD: "<evidence>")`, quoting the posting. Raised only when
    `user.requiresSponsorship` is true.
  - `citizenship`: `US citizenship required`.
  - `clearance`: `Active security clearance required`.
- `Deal-breaker: <rule>`: the posting clearly states something in `GET /api/pilot`
  `config.dealBreakers`.
- `Payment required`: only while applying.

The fit score reads `requirements` and `descriptionExcerpt` from the brief, so fill them.

Never skip for:

- another city, onsite or hybrid, when `user.willingToRelocate` is true or `preferredLocations` is
  empty or `"Anywhere"`;
- a sparse posting: read it and score again;
- contract or 1099 work;
- a defense or federal employer without a stated citizenship or clearance bar;
- a role below the user's level or asking fewer years: over-qualification counts as a full match;
- a posting silent on sponsorship. Proceed and append `sponsorship unstated in JD` to
  `matchReason`; the question usually comes up on the application form.
