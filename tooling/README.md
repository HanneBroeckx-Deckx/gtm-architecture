# Tooling

Four files. Zero dependencies. Node 18+.

```bash
node tooling/validate.mjs                 # validate the plan — exit 1 on error
node tooling/generate-types.mjs > out.ts  # generate TypeScript from the plan
node tooling/check-links.mjs              # resolve every relative doc link
make check                                # everything CI runs
```

---

## `tracking-plan.json`

The source of truth. Prose documentation is generated from it, types are generated from it, CI validates against it. Nothing else in this repository is authoritative.

| Block | Contains |
|---|---|
| `conventions` | Name patterns, the approved verb list, forbidden patterns, reserved prefixes, property caps |
| `platform_limits` | GA4 ceilings, with the date they were last verified |
| `budgets` | Custom-dimension budgets and cardinality rules — deliberately below the platform caps |
| `tiers` | What each tier obliges: source, monitoring, approvals, reconciliation |
| `enums` | Every closed value set, in one place, referenced by `enum_ref` |
| `feature_registry` | The feature catalogue. Adding a feature is a row here, not a new event |
| `events` | The plan itself |
| `definitions` | Versioned business definitions — activation, adoption, abandonment |

### Why a registry instead of per-feature events

Twenty features a year at four events each is eighty new events a year, permanently. The registry answers every one of those requests with the same four events (`feature_used`, `feature_configured`, `feature_adopted`, `feature_abandoned`) and one new row.

Adding a feature becomes a data change: no tag, no trigger, no dimension, no QA cycle, no migration.

---

## `validate.mjs`

A convention that is not enforced is a preference. This is the enforcement.

**Structural**
- Name grammar, length against the GA4 40-character cap, reserved prefixes and platform-reserved names
- Final token must be in `conventions.approved_verbs`, unless the name is a GA4 recommended event listed in `name_exceptions`
- Forbidden patterns: version suffixes, UI element names, test artifacts, double underscores
- Duplicate event and property names
- Property caps: soft 8, hard 12; a warning as the total approaches GA4's 25 parameters per event

**Typing**
- `*_id` properties must be `string` — even numeric ones
- `is_*` / `has_*` must be `boolean`
- `*_ms`, `*_s`, `*_days`, `*_bytes`, `*_pct` must be numeric
- `*_at` must be a `date-time` string
- Every `enum_ref` must resolve to a declared enum
- Enum values must be lowercase snake_case, unique, and free of placeholders like `n_a`

**Governance**
- Every event has an owner, a description, a trigger, and a stated decision
- Tier 0 cannot be client-only
- Tier 0 and 1 require freshness monitoring; Tier 0 requires a paged anomaly alert
- Tier 3 requires an expiry date, and warns once past it
- Deprecated events require a sunset date, and a valid `superseded_by` if present

**Correctness traps**
- A monetary property without a `currency` sibling — GA4 discards revenue with missing currency, silently
- An unbounded property registered as a GA4 dimension — past its cardinality ceiling GA4 aggregates the tail into `(other)`, irreversibly
- Unbounded non-identifier properties, which are free text in disguise
- Property names matching PII heuristics, with an allowlist for classifiers such as `email_domain_type`
- Custom-dimension budget consumption against both the budget and the platform cap
- Activation definitions that are unversioned, unbounded in time, single-criterion, or lack a stated derivation

Exit `0` clean or with warnings. Exit `1` on any error, which blocks the pull request.

---

## `generate-types.mjs`

Emits TypeScript from the plan:

- A union type per enum
- A `FeatureId` union from the registry
- A typed property interface per event, carrying the description, tier, owner and trigger as JSDoc
- `EventName`, `EventPropertyMap`, and a discriminated `TrackedEvent` union
- Runtime metadata: `EVENT_TIER`, `SERVER_ONLY_EVENTS`, `DEPRECATED_EVENTS`

Deprecated events are emitted with `@deprecated`, so every existing call site surfaces as an editor warning the day the deprecation lands.

```ts
import { track } from '@acme/analytics';

track({
  event: 'workspace_created',      // ✗ not in the plan — build error
  properties: { workspace_id: 42 } // ✗ ids are strings — build error
});
```

Wire it into the build so the generated file is never edited by hand:

```json
{ "scripts": { "prebuild": "node tooling/generate-types.mjs > src/analytics/generated.ts" } }
```

---

## `schemas/tracking-plan.schema.json`

The structural contract for `tracking-plan.json`, for editor autocomplete and inline validation. It enforces shape; `validate.mjs` enforces the semantic rules a JSON Schema cannot express — verb vocabulary, PII heuristics, tier obligations, budget arithmetic, currency pairing.

---

## `check-links.mjs`

Resolves every relative link across every markdown file in the repository, including `#anchor` fragments against the target's actual headings.

Documentation that links to files which do not exist is worse than documentation with no links: it teaches people not to trust the map.

---

## CI

[`.github/workflows/tracking-plan.yml`](../.github/workflows/tracking-plan.yml) runs on every pull request touching the plan, the schemas, or the tooling: it validates the plan, parses every JSON Schema, checks the generator produces output, resolves every internal link, and posts the plan summary to the job step summary so the diff's effect on the dimension budget is visible in the PR.

---

## Extending

**A new event** → PR against `tracking-plan.json` using [`../governance/event-rfc-template.md`](../governance/event-rfc-template.md).
**A new enum value** → add it to `enums`; announce it, because downstream filters may silently exclude it.
**A new verb** → PR adding it to `conventions.approved_verbs`, with the reason. The friction is deliberate: it is the only thing standing between you and eleven synonyms for "created".
**A new check** → add it to `validate.mjs`. Every post-mortem should add exactly one.
