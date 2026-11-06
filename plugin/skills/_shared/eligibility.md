# Eligibility - what is (and isn't) a skip

**Valid skip reasons (exact phrasing):**

- `Already applied (<kind>)` - dedupe.
- `Below minimum match score (X < Y)` - only after reading the actual posting.
- A hard requirement **the JD itself states** the user can't meet. Never infer from industry or
  company name.
  - **`POST /api/fit-scores` detects these for you**, returning `eligibilityBlocked: { kind, evidence
    }` when the brief states one. Present ⇒ skip, with the reason its `kind` calls for:
    - `sponsorship` → `No visa sponsorship (JD: "<evidence>")` - only raised when
      `user.requiresSponsorship` is true.
    - `citizenship` → `US citizenship required` - raised for everyone; nobody can acquire
      citizenship for a posting.
    - `clearance` → `Active security clearance required` - raised for everyone.
  - Quote the JD's words verbatim in a sponsorship reason. It reads the brief you sent, so populate
    `descriptionExcerpt` and `requirements` or it finds nothing. Absent means the posting
    is **silent**, not that sponsorship is offered - see the never-skip list.
- `CAPTCHA - apply manually via the apply skill` / `Payment required` - surface during apply, not
  scoring.
- `Deal-breaker: <rule>` - the posting clearly hits one of the user's deal-breakers
  (`GET /api/pilot` → `config.dealBreakers`, plain-language rules). Only on what the
  posting states, never on a guess.

**Never skip for:** onsite/hybrid/other city when `willingToRelocate` is true or
`preferredLocations` is empty/`"Anywhere"` (score on fit, not geography); a sparse JD (read and
rescore first); 1099/contractor work; defense/federal industry absent a JD-stated
citizenship/clearance requirement; **a role below your level** (Junior/Mid when your résumé is
Senior) or one asking fewer years than you have - over-qualification is full marks on experience;
judge on skills fit; a JD that is **silent** on sponsorship when the profile requires it - proceed,
and append a short risk note to `matchReason` (e.g. `sponsorship unstated in JD`) - the question
usually surfaces on the application form, not the posting.

**Never skip silently** - every `skipped` write carries a non-empty `skipReason`. No valid reason →
not a skip.
