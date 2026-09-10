# Feature Usage Events

Feature usage is where taxonomies go to die. It is the section with the most stakeholders, the least governance, and the fastest growth — and it is the reason plans reach 400 events.

This file specifies a **feature registry pattern** that scales to hundreds of features with a fixed number of events.

---

## The problem, stated plainly

Every new feature ships with a request: *"can we track it?"* Answered naively, each feature adds three to six events. Twenty features a year is a hundred new events a year, permanently, forever.

The registry pattern answers every one of those requests with the same four events and a new row in a lookup table.

```
❌  Per-feature events (grows without bound)
    automation_builder_opened
    automation_builder_rule_added
    automation_builder_saved
    dashboard_widget_added
    dashboard_widget_configured
    dashboard_shared
    ... × 20 features per year

✅  Registry pattern (fixed)
    feature_used
    feature_configured
    feature_adopted
    feature_abandoned
    + one row per feature in the registry
```

---

## The feature registry

A versioned lookup table, maintained in `tracking-plan.json`, joined at query time. Adding a feature is a data change, not a schema change — which means it needs no tag, no trigger, no dimension, no QA cycle, and no migration.

| Field | Type | Notes |
|---|---|---|
| `feature_id` | string | Stable slug. Never reused, never renamed |
| `feature_name` | string | Human label for reporting |
| `feature_category` | enum | `authoring` · `automation` · `analytics` · `collaboration` · `admin` · `integration` · `ai` |
| `feature_tier_required` | enum | `free` · `starter` · `growth` · `enterprise` |
| `released_at` | date | Enables adoption-since-release curves without a per-feature event |
| `is_core` | boolean | Part of the activation definition |
| `owner` | string | Product owner accountable for its metrics |
| `depth_levels` | array | Ordered usage-depth ladder, e.g. `["viewed","used","configured","automated"]` |

Registry rows are versioned in git. Renaming `feature_name` is fine; changing `feature_id` is a breaking change requiring a migration.

---

## The four events

### `feature_used`
**Tier 2 · Src S+C · Owner: Feature owner (from registry)**
A feature performed its core action. **Not** opening a panel, not hovering a menu — the thing the feature exists to do.

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `feature_id` | enum | ✓ | Must exist in the registry. CI enforces this |
| `feature_surface` | enum | ✓ | `web` · `ios` · `android` · `api` · `automation` · `integration` |
| `usage_depth` | enum | ✓ | From the feature's `depth_levels` ladder |
| `usage_index` | integer | ✓ | Nth use by this user. `1` is first use — no separate `first_used` event needed |
| `account_usage_index` | integer | ✓ | Nth use by this account. Separates individual from organisational adoption |
| `entry_point` | enum | ✓ | `nav` · `command_palette` · `keyboard_shortcut` · `empty_state` · `contextual_prompt` · `automation` · `api` · `deep_link` |
| `duration_ms` | integer | – | Time to complete, where the action is bounded |
| `outcome` | enum | ✓ | `success` · `partial` · `failed` · `cancelled` |
| `failure_reason` | enum | – | Required when `outcome = failed` |

`usage_index` doing the work of a `first_used` event is the pattern worth internalising. `usage_index = 1` is a first-use cohort, `usage_index >= 10` is a power-user cohort, and both come free from one integer.

### `feature_configured`
**Tier 2 · Src S · Owner: Feature owner**
A user changed a feature's settings — a genuine investment signal, and a strong retention predictor. Configuration is switching cost.

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `feature_id` | enum | ✓ | |
| `config_action` | enum | ✓ | `enabled` · `disabled` · `settings_changed` · `reset` |
| `settings_changed_count` | integer | ✓ | |
| `settings_changed_keys` | string | – | Comma-joined setting **names**. Never values |
| `config_scope` | enum | ✓ | `user` · `workspace` · `account` |
| `is_default_override` | boolean | ✓ | Moving off a default is a stronger signal than accepting one |

### `feature_adopted`
**Tier 1 · Src S · Owner: Growth**
A derived event, emitted server-side when a feature crosses its adoption threshold. Adoption is a *pattern*, not a moment, and this event is what makes that pattern queryable without every analyst re-deriving it.

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `feature_id` | enum | ✓ | |
| `adoption_criteria` | string | ✓ | The rule that fired, e.g. `3_uses_in_14_days` |
| `days_to_adoption` | integer | ✓ | From first exposure |
| `adoption_scope` | enum | ✓ | `user` · `account` |
| `users_adopted_in_account` | integer | ✓ | Spread within the organisation |

**Default rule:** three uses across two distinct days within fourteen days of first use. Tune per feature category — a monthly reporting feature needs a different window than a daily authoring tool — and record the rule in the registry so the number in the dashboard has a definition attached.

### `feature_abandoned`
**Tier 2 · Src S · Owner: Growth**
Derived, server-side. A previously adopted feature has not been used within its abandonment window. The most under-instrumented signal in SaaS, and the earliest churn indicator most products have.

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `feature_id` | enum | ✓ | |
| `days_since_last_use` | integer | ✓ | |
| `lifetime_usage_count` | integer | ✓ | |
| `was_adopted` | boolean | ✓ | Distinguishes lapsed adopters from triers who never adopted |
| `abandonment_window_d` | integer | ✓ | Rule that classified it |

---

## Depth ladders

`usage_depth` is what stops "adoption" from meaning "someone opened it once".

Each feature declares an ordered ladder in the registry. Four rungs is usually right:

```
viewed      →  the surface rendered
used        →  the core action completed once
configured  →  settings changed from default
automated   →  running without human initiation
```

Examples:

| Feature | viewed | used | configured | automated |
|---|---|---|---|---|
| Automation builder | Builder opened | Rule saved | Multi-condition rule | Rule fired ≥ 10× unattended |
| Dashboards | Dashboard opened | Widget added | Custom date + filters | Scheduled email delivery |
| CRM integration | Settings page opened | First sync run | Field mapping customised | Bidirectional sync live |
| AI assistant | Panel opened | Prompt submitted | Custom instructions set | Triggered by workflow |

The depth distribution is a far better health metric than a usage count. A feature with 10,000 `viewed` and 40 `configured` has an activation problem, not a demand problem — and no monthly-active-users chart will ever tell you that.

---

## PLG-specific patterns

### Power-user identification
No separate event. A power user is a query:

```sql
-- Accounts with ≥3 features at 'configured' depth or deeper, last 28 days
SELECT account_id, COUNT(DISTINCT feature_id) AS deep_features
FROM events
WHERE event_name = 'feature_used'
  AND usage_depth IN ('configured', 'automated')
  AND event_ts >= CURRENT_DATE - 28
GROUP BY account_id
HAVING COUNT(DISTINCT feature_id) >= 3;
```

If your taxonomy requires a new event to answer a question like this, the taxonomy is wrong.

### Breadth vs depth
Two accounts, both at 500 monthly events:

- **Broad and shallow** — 12 features, all at `used`. Exploring. Expansion candidate; also flight risk if nothing sticks.
- **Narrow and deep** — 3 features, all at `automated`. Embedded. High retention, low expansion without a nudge.

The same MAU number, two entirely different plays. Breadth and depth come free from `feature_id` × `usage_depth`.

### Expansion signals
Three events, ranked by intent:

1. `feature_gate_blocked` — tried, was stopped. **Highest intent in the entire plan.**
2. `rate_limit_hit` — outgrowing the plan mechanically.
3. `feature_used` with `feature_tier_required` above current tier during a trial — experiencing value they will lose.

Wire all three to lifecycle automation. Sending a generic upgrade email while a user is being blocked by a paywall they just hit is a waste of the strongest signal you will ever get.

---

## Governance

Feature usage is Tier 2 by default, which means it is subject to annual review and deletion. Specifically:

- **A feature retired from the product** → its registry row is marked `retired`, not deleted. Historical data keeps its meaning.
- **A feature never reaching 100 monthly `feature_used` events after two quarters** → review. Either the feature is dead or the instrumentation is broken; both need a decision.
- **`feature_id` values are permanent.** Never reuse a slug from a retired feature for a new one. Two years later, someone will union those cohorts and get a wrong answer that looks right.
- **New feature, new registry row, no new events.** If someone opens a PR adding `newthing_clicked`, the review comment is a link to this file.

---

## Anti-patterns

| Anti-pattern | Cost |
|---|---|
| One event family per feature | Plan grows linearly with the roadmap, forever |
| Tracking opens as usage | Adoption metrics that overstate reality by an order of magnitude |
| No depth dimension | "Adoption" means "clicked once" and nobody trusts it |
| `feature_id` not validated against a registry | Typos become permanent orphan dimensions |
| Free-text `feature_name` as the key | `Automation Builder`, `automation builder`, `Automations` — three features, one product |
| No abandonment tracking | Churn is discovered in the billing system instead of predicted in the product |
| Client-side derived events | Adoption and abandonment need a scheduler; browsers do not have one |

---

**See also:** [Product events](product-events.md) · [Onboarding events](onboarding-events.md) · [Data minimalism](../philosophy/data-minimalism.md) · [Product data layer schema](../data-layer/product-schema.json)
