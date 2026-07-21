# Pilot learning - the self-improvement flywheel

Status: **todo** · Companion to [pilot.md](pilot.md). Design for the Pilot's learning subsystem.

## Premise

Model weights are fixed, so ALL improvement lives in the artifacts the Pilot feeds itself each
cycle. Self-improvement = a disciplined pipeline that turns experience into better artifacts,
with a validation gate in front of every change and a rollback behind it.

## The flywheel

**Capture → Reflect → Commit → Validate → Adopt & Measure → Share**

### 1. Capture (episodic memory)

What happened, kept raw and cheap: pilot journal entries, worker traces
([t5-failures-become-fixtures.md](t5-failures-become-fixtures.md)), receipts
([t3-formir-answer-ledger.md](t3-formir-answer-ledger.md)), telemetry
([t1-step-telemetry.md](t1-step-telemetry.md)) - **and user corrections**: every override
(rejected proposed job, edited cover letter, cancelled action, changed status) is a labeled
training signal, recorded with context.

### 2. Reflect (the consolidation cycle)

A scheduled reflection pass during quiet hours - the Pilot's "sleep": review the day's episodes
and distill candidate lessons. "Greenhouse forms now have a demographics page 4." "User rejected
5 high-scoring jobs; all were hybrid." "Cover letters mentioning open source got 3× replies."
Episodes are then pruned; lessons persist. Reflection is a normal agenda item - no new loop.

### 3. Commit (memory tiers, each with provenance)

- **Semantic facts** - board quirks, recruiter patterns, market observations. Every fact carries
  confidence + a decay/expiry (boards change; stale facts are worse than no facts) and the
  episode ids it came from.
- **Procedures** - ATS playbooks ([t3-ats-playbooks.md](t3-ats-playbooks.md)), refreshed or
  patched from successful/failed traces.
- **Strategy parameters** - score calibration, board yield priors, query effectiveness
  ([t3-outcome-calibration.md](t3-outcome-calibration.md)).
- **Instructions amendments - proposed, never self-applied**: when corrections reveal a preference
  the instructions don't state, the Pilot proposes a one-tap amendment: "You rejected 5 hybrid
  roles I scored highly - add 'remote only, no hybrid'?" The user's charter co-evolves with
  their revealed preferences, but only with explicit approval.

### 4. Validate (the immune system)

Every artifact class has a gate proportional to its blast radius:

- Facts: confidence thresholds; contradicting episodes lower confidence before anything breaks.
- Procedures/skill patches: the eval lab ([t1-eval-lab.md](t1-eval-lab.md)) must pass -
  including the fixture minted from the very failure that motivated the patch.
- Strategy changes: **shadow validation** - score/rank with the new parameters alongside the old
  for a period; adopt only if the shadow would have done measurably better.
- Instructions changes: user approval, always.

### 5. Adopt & measure (with auto-rollback)

Every adopted artifact is versioned. Post-adoption, telemetry watches the metrics the change
was supposed to move; regression → automatic revert + a journal entry. Nothing the learning
system does is unrecoverable.

**Staged trust for self-patching** (graduated autonomy applied to self-modification): skill and
playbook patches start life as proposals the user reviews. A patch class with a track record of
clean eval passes + no post-adoption regressions earns auto-merge for low-risk changes. The
Pilot earns the right to edit itself the same way it earns board autonomy.

### 6. Share (fleet learning)

Structure-only knowledge pools across users - playbooks, board health, ghost-job signals,
calibration priors ([t4-shared-job-index.md](t4-shared-job-index.md) territory). Personal data
never leaves the user's account: answers, preferences, instructions, correction history stay private.
Fleet learning is why user #1000's Pilot is smarter on day one than user #1's was after a month.

## Mechanics - storage, update, staleness

**Storage** - one Postgres table via the API (never local files), e.g. `AgentKnowledge`:
`scope` (`user:<profileId>` | `fleet`), `subjectKey` (`board:<domain>` | `ats:<domain>` |
`question:<normalized-hash>` | …), `kind` (form_structure | login_flow | board_quirk |
preference | strategy_prior | market_fact), `body` (JSON), `confidence` (0–1),
`halfLifeDays` (per kind), `status` (candidate | active | quarantined | retired), `version`,
`evidence` (episode/receipt ids, for and against), `lastConfirmedAt`, `expiresAt?`.
Unique on `(scope, subjectKey, kind, version)`.

**Retrieval** - deterministic keyed lookup, no vector infra: the claim/delegation payload
includes a `knowledge` block - server selects active facts for the job's board/ATS keys
(user scope first, then fleet), ranked by effective confidence, capped (~2KB). Each fact is
rendered with its age + confidence ("confirmed 2d ago, high confidence") and the prompt rule is:
**facts are priors to verify cheaply, not truths.**

**Effective confidence at read time** = `confidence × 2^(−daysSince(lastConfirmedAt)/halfLife)`
- staleness is computed, not stored. Volatile kinds (form_structure) get short half-lives;
stable kinds (company facts) long ones. Below a floor → excluded from retrieval.

**Write paths** - (1) workers return an optional `observations[]` in their compact JSON;
(2) the reflection pass distills episodes into `candidate` facts; (3) outcomes adjust
strategy-tier confidence. Upsert by `(scope, subjectKey, kind)`.

**Staleness awareness - three timescales:**

1. **Passive decay** (above) - unused knowledge fades on its own.
2. **Verify-on-use** - the main mechanism. Every fact is a prediction; playbook replay is
   verify-first (each step asserts expected page state). Use either *re-confirms*
   (`lastConfirmedAt = now`, confidence bumps) or *falsifies* (confidence penalty; below floor →
   `quarantined`, worker falls back to exploration, and the divergence itself becomes a new
   candidate). Usage IS the freshness test - hot knowledge stays verified, cold knowledge decays.
3. **Fleet corroboration** - for `fleet` scope, confirmations/refutations across users settle
   disputes (and detect A/B'd board redesigns via a version split).

**Contradictions** - a conflicting observation creates `version N+1` as candidate rather than
overwriting; next use tests it in careful mode; two confirmations promote it (`N` → retired).
Retired/quarantined rows are kept for audit - every fact is traceable to the episodes for and
against it.

## The never-touch list (immutable by learning)

The learning system may improve knowledge and procedures, never boundaries:

- Server-enforced hard limits (caps, budgets, autonomy ceilings)
- The prompt-injection boundary ([t0-prompt-injection.md](t0-prompt-injection.md))
- Payment refusal, credential handling, crypto
- The eval gate itself and this never-touch list

## What this absorbs

[t4-self-healing-skills.md](t4-self-healing-skills.md) = steps 2–5 applied to procedures.
[t5-failures-become-fixtures.md](t5-failures-become-fixtures.md) = step 1 + the gate's fuel.
[t3-outcome-calibration.md](t3-outcome-calibration.md) = the strategy tier of step 3.
New here: correction capture, instructions co-evolution, consolidation cycle, memory decay,
shadow validation, auto-rollback, staged trust for self-patching, the never-touch list.

## Done when

After a month of use, the Pilot demonstrably: asks fewer questions (ledger + facts), applies
faster and cheaper on repeat ATSes (procedures), targets better (calibration), and has proposed
at least one instructions amendment the user accepted - with every learned artifact traceable to the
episodes that taught it, and one rollback proven in anger.

## Notes

- (add dated notes here)
