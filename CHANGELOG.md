# Changelog

Changes to the architecture and to the reference tracking plan.

The plan follows `YYYY.N.P`: **year.cycle** for breaking changes, **minor** for additive ones, **patch** for clarification. See [Ownership & versioning](governance/ownership-and-versioning.md#versioning).

---

## [2026.2.0] — 2026-09-09

### Added
- Activation definition **v2026.2**: `crm_connected` added as a fourth criterion, after CRM-connected accounts showed a 22-point retention gap at matched usage levels
- `feature_gate_blocked` promoted to Tier 1 and wired to lifecycle automation — the highest-intent expansion signal in the plan
- `consent_state_set` now persisted server-side as well as captured client-side: a consent record is a legal artifact you must be able to produce
- Reconciliation declarations on every Tier 0 event, with a named source of record, tolerance and cadence
- `tooling/check-links.mjs` — resolves every relative documentation link, including anchors

### Changed
- Enum value pattern permits a leading digit **only** for banded ranges (`1_10`, `5k_25k`)
- Unbounded-property budget refined: `*_id` join keys are exempt; anything else unbounded is free text in disguise
- Thirteen properties unregistered as GA4 custom dimensions and routed to the warehouse instead, bringing consumption from 43 to 29 of a 30 budget

### Deprecated
- `workspace_created` → `pipeline_created`. The product settled on "pipeline" as the user-facing term. Dual-running until **2026-10-01**; do not add new references

---

## [2026.1.0] — 2026-03-01

### Added
- Activation definition **v2026.1**, first versioned definition of activation
- The feature registry pattern: `feature_used` / `feature_configured` / `feature_adopted` / `feature_abandoned` replace per-feature event families
- Tier 3 lifecycle with a 90-day default expiry

### Changed
- Onboarding moved to the generic step model. Eighteen per-step events across three flows collapsed into four
- All Tier 0 events moved to server-side emission with deterministic `event_id` deduplication

### Removed
- 56 events consolidated into 4 through the property-over-name principle. Nothing lost; every original question still answerable

---

## [2025.1.0] — 2025-01-15

### Added
- First machine-readable tracking plan
- CI validation on every pull request
- Ownership recorded per event and enforced

---

**Format:** [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
