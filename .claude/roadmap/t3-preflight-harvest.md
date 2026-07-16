# Pre-flight question harvesting (batch dry-run)

Tier 3 — Intelligence & Efficiency · Status: **todo**

## What

Before an auto-apply batch, walk each form up to (not through) submit, collect FormIR + unknown
questions, present ONE consolidated form ("7 answers needed for these 23 applications"), then
apply the whole batch pause-free. Answers seed the ledger
([t3-formir-answer-ledger.md](t3-formir-answer-ledger.md)).

## Why

Converts N mid-loop interruptions into 1 up-front decision — the complement to
[t2-needs-user-escalation.md](t2-needs-user-escalation.md): questions handle surprises,
pre-flight prevents most of them.

## Done when

A 20-job batch runs with zero mid-loop questions after the up-front form is answered.

## Notes

- (add dated notes here)
