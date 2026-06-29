# Eligibility - what is (and isn't) a skip

**Valid skip reasons (exact phrasing):**

- `Already applied (<kind>)` - dedupe.
- `Below minimum match score (X < Y)` - only after reading the actual posting.
- A hard requirement **the JD itself states** the user can't meet, e.g. `US citizenship required`, `Active security clearance required`. Never infer from industry or company name.
- `CAPTCHA - apply manually via the apply skill` / `Payment required` - surface during apply, not scoring.

**Never skip for:** onsite/hybrid/other city when `willingToRelocate` is true or `preferredLocations` is empty/`"Anywhere"` (score on fit, not geography); a sparse JD (read and rescore first); 1099/contractor work; defense/federal industry absent a JD-stated citizenship/clearance requirement; **a role below your level** (Junior/Mid when your résumé is Senior) or one asking fewer years than you have - over-qualification is full marks on experience; judge on tech-stack fit.

**Never skip silently** - every `skipped` write carries a non-empty `skipReason`. No valid reason → not a skip.
