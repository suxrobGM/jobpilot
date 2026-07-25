# Eligibility - what is (and isn't) a skip

**Valid skip reasons (exact phrasing):**

- `Already applied (<kind>)` - dedupe.
- `Below minimum match score (X < Y)` - only after reading the actual posting.
- A hard requirement **the JD itself states** the user can't meet, e.g. `US citizenship required`, `Active security clearance required`. Never infer from industry or company name.
- `No visa sponsorship (JD: "<exact quoted phrase>")` - only when `user.requiresSponsorship` is true **and the JD itself states it**, e.g. "will not sponsor", "unable to sponsor", "must be authorized to work without sponsorship", "US citizens or permanent residents only". Quote the JD's words in the reason. Never infer from industry or company name.
- `CAPTCHA - apply manually via the apply skill` / `Payment required` - surface during apply, not scoring.

**Never skip for:** onsite/hybrid/other city when `willingToRelocate` is true or `preferredLocations` is empty/`"Anywhere"` (score on fit, not geography); a sparse JD (read and rescore first); 1099/contractor work; defense/federal industry absent a JD-stated citizenship/clearance requirement; **a role below your level** (Junior/Mid when your résumé is Senior) or one asking fewer years than you have - over-qualification is full marks on experience; judge on tech-stack fit; a JD that is **silent** on sponsorship when the profile requires it - proceed, and append a short risk note to `matchReason` (e.g. `sponsorship unstated in JD`) - the question usually surfaces on the application form, not the posting.

**Never skip silently** - every `skipped` write carries a non-empty `skipReason`. No valid reason → not a skip.
