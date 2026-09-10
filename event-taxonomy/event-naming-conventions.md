# Event Naming Conventions

The canonical naming law for this architecture. Every event, property, and value in this repository conforms to it, and CI enforces the mechanical parts.

Read this once. Everything else in `/event-taxonomy` is an application of it.

---

## 1. The event name grammar

```
<object>_<past_tense_verb>[_<qualifier>]
```

```
✅  workspace_created
✅  subscription_upgraded
✅  invite_accepted
✅  export_completed
✅  payment_failed
✅  onboarding_step_completed
```

| Rule | Specification |
|---|---|
| Case | `snake_case`, lowercase ASCII only |
| Character set | `[a-z][a-z0-9_]*` — must start with a letter |
| Length | ≤ 40 characters (GA4 hard limit; longer names are not reported) |
| Verb tense | **Past tense**, always. Events are facts, not commands |
| Word order | **Object first**, verb second |
| Language | US English, singular nouns |
| Separator | Underscore only. No dots, hyphens, spaces, or camelCase |

### Why object-first

Object-first names sort into coherent groups in every schema browser, autocomplete dropdown, BigQuery `INFORMATION_SCHEMA` listing, and GA4 event report your team will ever open:

```
subscription_cancelled       vs.       cancelled_subscription
subscription_downgraded                created_workspace
subscription_started                   downgraded_subscription
subscription_upgraded                  started_subscription
workspace_archived                     upgraded_subscription
workspace_created                      archived_workspace
```

The left column is a data model. The right column is an alphabetised list of verbs.

> **Note on Segment's "Object Action" spec.** If you are on Segment and committed to `Title Case Object Action` (`Workspace Created`), that is internally consistent and fine — but pick one and enforce it globally. This repository standardises on `snake_case` because it survives GA4, BigQuery column naming, and gtag without transformation. Mixed conventions in one estate are the actual failure.

---

## 2. Verb vocabulary

A closed verb list prevents the `created` / `added` / `made` / `new` drift that makes taxonomies unsearchable.

| Verb | Use for | Do not use for |
|---|---|---|
| `created` | An object came into existence | Adding an existing object to a collection → `added` |
| `added` | An existing object joined a collection | First creation → `created` |
| `removed` | An object left a collection, still exists | Destruction → `deleted` |
| `deleted` | An object was destroyed | Soft-delete / hide → `archived` |
| `archived` | Object hidden, recoverable | Hard delete → `deleted` |
| `updated` | One or more fields changed | Renaming only → `renamed` |
| `renamed` | The display name changed | Any other field → `updated` |
| `viewed` | Content was rendered and seen | Page loads handled by `page_view` |
| `opened` | A surface became active (modal, panel, session) | Navigation → `viewed` |
| `started` | A multi-step process began | Single-step actions → the outcome verb |
| `completed` | A multi-step process finished successfully | Partial success → `status` property |
| `abandoned` | A started process ended without completion | Explicit cancel → `cancelled` |
| `cancelled` | A user or system explicitly terminated | Timeout / drop-off → `abandoned` |
| `failed` | An attempted operation errored | User chose not to proceed → `cancelled` |
| `submitted` | Input was sent for processing | Confirmed result → `completed` |
| `accepted` / `declined` | A binary response to an offer or invitation | — |
| `shared` | Access was granted to another party | Adding a team member → `member_added` |
| `invited` | An invitation was dispatched | Acceptance → `invite_accepted` |
| `upgraded` / `downgraded` | Movement between plan tiers | Same-tier changes → `updated` |
| `connected` / `disconnected` | An integration link changed state | — |
| `searched` | A query was executed | — |
| `exported` / `imported` | Data crossed the system boundary | — |

**Additional approved verbs** in this architecture, for cases the table above does not cover: `identified`, `reached`, `blocked`, `hit`, `progressed`, `engaged`, `performed`, `captured`, `requested`, `used`, `adopted`, `succeeded`, `expired`, `reactivated`, `extended`, `set`, `returned`, `thrown`, `viewed`.

The **enforced** list lives in [`../tooling/tracking-plan.json`](../tooling/tracking-plan.json) under `conventions.approved_verbs`, and CI rejects any event whose final token is not a member of it.

**Extending the list** requires a PR against this file. That friction is deliberate — it is the only thing standing between you and eleven synonyms for "created".

---

## 3. Forbidden patterns

| ❌ Anti-pattern | Example | ✅ Correct form |
|---|---|---|
| Value in the name | `plan_pro_upgraded` | `subscription_upgraded` + `plan_tier: pro` |
| Surface in the name | `export_clicked_dashboard` | `export_completed` + `surface: dashboard` |
| Version in the name | `signup_completed_v2` | New semantic name + deprecation of the old |
| UI element in the name | `blue_button_clicked` | `cta_clicked` + `cta_id`, `cta_label` |
| Present/imperative tense | `create_workspace` | `workspace_created` |
| Verb-first | `clicked_signup` | `signup_completed` |
| camelCase / PascalCase | `workspaceCreated` | `workspace_created` |
| Namespace prefixing | `app_workspace_created` | `workspace_created` (put the app in a property) |
| Abbreviations | `ws_crtd`, `sub_upg` | Spell it out; you have 40 characters |
| Vendor/tool names | `hubspot_form_submitted` | `form_submitted` + `destination` handled downstream |
| Test artifacts in prod | `test_event`, `asdf`, `tmp_check` | Use a dedicated GTM environment |
| Reserved GA4 names | `session_start`, `first_visit`, `user_engagement`, `purchase`* | Pick a distinct name, or use the reserved event as intended |
| PII anywhere in the name | `hanne_signed_up` | Never |

\* `purchase` is an allowed GA4 recommended event and *should* be used for ecommerce — the rule is not to redefine reserved names to mean something else.

**Reserved prefixes.** `ga_`, `google_`, `firebase_`, `gtm_`, `dl_`, `_` are reserved by platforms or by this architecture. Never mint an event or parameter starting with these.

---

## 4. Property naming

```
<qualifier>_<noun>[_<unit>]
```

| Rule | Specification | Example |
|---|---|---|
| Case | `snake_case`, ≤ 40 characters | `export_format` |
| Booleans | Prefix `is_` or `has_` | `is_trial`, `has_payment_method` |
| Identifiers | Suffix `_id`, always type `string` | `workspace_id`, `account_id` |
| Counts | Suffix `_count` | `member_count`, `row_count` |
| Timestamps | Suffix `_at`, ISO 8601 UTC | `trial_ends_at` |
| Durations | Suffix with the unit | `duration_ms`, `session_length_s` |
| Monetary | `value` + separate `currency` (ISO 4217) | `value: 49.00`, `currency: "EUR"` |
| Sizes | Suffix with the unit | `file_size_bytes` |
| Enums | Lowercase snake_case values, closed set | `status: "partial"` |
| Percentages | Suffix `_pct`, stored 0–100 not 0–1 | `scroll_depth_pct: 75` |

**Never in a property value:** raw email, name, phone, street address, IP, free-text user input, session token, or any URL query string carrying the above. See [`../data-layer/naming-rules.md`](../data-layer/naming-rules.md) §PII.

**IDs are strings.** Always. An `account_id` of `00042` is not the integer 42, BigQuery will not thank you for the ambiguity, and the day you migrate to UUIDs you will not have to rewrite every downstream cast.

**Currency is never inferred.** A `value` without a `currency` sibling is a bug, and CI treats it as one.

---

## 5. Enum value conventions

```
✅  "credit_card"   "bank_transfer"   "past_due"   "self_serve"
❌  "Credit Card"   "BANK_TRANSFER"   "pastDue"    "Self-Serve"
```

- Lowercase `snake_case`, matching `^[a-z0-9][a-z0-9_]*$`. A leading digit is permitted **only** for banded ranges (`1_10`, `5k_25k`); everything else starts with a letter.
- Closed sets are declared in `tracking-plan.json` and validated in CI.
- Add `"other"` to any enum whose source is a third party you do not control — and log the raw value to the warehouse only, never to GA4.
- Never use `null`, `""`, `"undefined"`, `"N/A"` as a member. Absent means absent: omit the key.
- Never reuse a retired enum value for a new meaning.

---

## 6. Platform limits you must design inside

Verified against Google's published limits, September 2026. Re-check before you architect against a ceiling — these move.

### GA4 (standard property)

| Limit | Value | Consequence of breaching |
|---|---|---|
| Event name length | 40 chars | Not reported if marked as a key event |
| Parameters per event | 25 | Excess silently dropped |
| Parameter name length | 40 chars | Silently truncated |
| Parameter value length | 100 chars (300 `page_title`, 420 `page_referrer`, 1000 `page_location`) | Silently truncated |
| User properties | 25 per property | Excess rejected |
| User property name / value | 24 / 36 chars | Silently truncated |
| Event-scoped custom dimensions | 50 (125 on 360) | Cannot register more |
| Event-scoped custom metrics | 50 (125 on 360) | Cannot register more |
| User-scoped custom dimensions | 25 (100 on 360) | Cannot register more |
| Item-scoped custom dimensions | 10 (25 on 360) | Cannot register more |
| Distinct event names | Unlimited on web; 500 per app instance | App events beyond 500 dropped |
| Events per user per day | 100,000 | Excess dropped |

**The dangerous word in that table is "silently".** GA4 truncates rather than errors. Nothing in the UI tells you it happened. This is precisely why the constraints are enforced in CI against `tracking-plan.json` instead of discovered in a report six weeks later.

### Practical consequences

- **Budget 30 of 50 event-scoped dimensions**, 15 of 25 user-scoped. You will need the headroom, and you cannot recover a dimension slot without losing its history.
- **High-cardinality properties do not belong in GA4 custom dimensions.** Past roughly 500 distinct daily values, GA4 aggregates the tail into `(other)` and the detail is unrecoverable. Route IDs and URLs to BigQuery.
- **The 40-character event-name cap is your real naming budget.** `onboarding_step_completed` is 25. `workspace_integration_disconnected` is 34. If you are approaching 40, the name is describing too much and a property is missing.

---

## 7. Naming across destinations

One canonical name, deterministic transforms at the edge. The mapping table lives in the plan; the transform lives in the collection layer.

| Destination | Convention | Transform from canonical |
|---|---|---|
| **Canonical (this repo, warehouse)** | `workspace_created` | — |
| GA4 | `workspace_created` | Identity |
| BigQuery export | `workspace_created` | Identity |
| Segment (if in estate) | `Workspace Created` | `snake_case` → `Title Case` |
| Meta CAPI | `WorkspaceCreated` / mapped standard event | Lookup table; standard events take priority |
| LinkedIn / Google Ads | Conversion action ID | Lookup table |
| HubSpot | `pe<portalId>_workspace_created` | Prefix per HubSpot spec |

Rules:
1. The canonical name is the one humans discuss. Everything else is generated.
2. Transforms are **deterministic and declared** — a lookup table in the container or the server, never per-tag improvisation.
3. Where a destination has a standard event with matching semantics (`purchase`, `generate_lead`), map to it. Do not invent a parallel custom event that fragments the platform's own reporting.

---

## 8. Naming for GTM assets

Container assets follow their own grammar so the container stays navigable at 200+ tags. Full specification in [`../gtm-templates/container-structure.md`](../gtm-templates/container-structure.md).

```
Tags:      <PLATFORM> <TYPE> — <descriptor> — <scope>
           GA4 EV — workspace_created — All Pages
           META CAPI — purchase — Checkout

Triggers:  <TYPE> — <descriptor> — <condition>
           CE — workspace_created — dl event
           CLICK — cta — [data-analytics-id] exists

Variables: <TYPE> — <descriptor>
           DLV — workspace_id
           LT — consent to region map
           CJS — hashed user id
```

---

## 9. The validator

Every mechanical rule above is enforced by [`../tooling/validate.mjs`](../tooling/validate.mjs), which runs in CI on every pull request touching the plan.

```bash
node tooling/validate.mjs
```

It checks: name grammar and length, verb-list membership, forbidden patterns, property typing, enum syntax, `value`/`currency` pairing, PII flags, tier/owner requirements, GA4 budget consumption, duplicate names, and sunset dates on deprecated events.

**A convention that is not enforced is a preference.** Enforce it.

---

**See also:** [Naming rules for the data layer](../data-layer/naming-rules.md) · [Product events](product-events.md) · [Marketing events](marketing-events.md) · [Onboarding events](onboarding-events.md) · [Feature usage events](feature-usage-events.md)
