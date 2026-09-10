# Product Events

The core object lifecycle: accounts, subscriptions, workspaces, collaboration, integrations, and reliability.

These are the events that reconcile against the revenue system. Everything in [`marketing-events.md`](marketing-events.md) describes how someone arrives; everything here describes what the product is actually worth.

**Conventions:** all names follow [`event-naming-conventions.md`](event-naming-conventions.md). `Req` = required. `Src` = collection source (`S` server, `C` client, `S+C` both, server authoritative). Tier definitions in [`../philosophy/how-to-think-about-events.md`](../philosophy/how-to-think-about-events.md#step-5--assign-a-tier).

---

## Global context

Attached to **every** event by the collection layer. Never re-declared in an individual event spec.

| Property | Type | Req | Notes |
|---|---|---|---|
| `event_id` | string | ✓ | UUIDv4, minted at emission. The deduplication key across client/server and across retries |
| `event_ts` | string | ✓ | ISO 8601 UTC, millisecond precision, from the emitting system's clock |
| `anonymous_id` | string | ✓ | First-party cookie, UUIDv4, 13-month TTL |
| `user_id` | string | – | Opaque, stable, never an email or username. Absent when unauthenticated |
| `account_id` | string | – | Resolved server-side. Present for all authenticated events |
| `session_id` | string | ✓ | Client session identifier |
| `app_surface` | enum | ✓ | `web` · `ios` · `android` · `api` · `email` · `server` |
| `app_version` | string | ✓ | Semver or build SHA |
| `page_location` | string | – | Absolute URL, query string stripped of PII and click IDs |
| `page_referrer` | string | – | Absolute URL |
| `consent_analytics` | boolean | ✓ | Snapshot of `analytics_storage` at emission |
| `consent_ads` | boolean | ✓ | Snapshot of `ad_storage` at emission |
| `environment` | enum | ✓ | `production` · `staging` · `development` |

**Account traits** (user-scoped, set on identify and on change, not repeated per event): `plan_tier`, `account_created_at`, `seat_count`, `industry`, `company_size_band`, `is_internal`, `billing_country`.

---

## 1. Account & identity

### `signup_completed`
**Tier 0 · Src S · Owner: Growth Engineering**
Fires once when the user row is committed and the account is usable. Not on form submit, not on email dispatch. Idempotent on `user_id`.

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `signup_method` | enum | ✓ | `email` · `google` · `microsoft` · `saml` · `invite` · `api` |
| `account_id` | string | ✓ | Newly created or joined |
| `is_new_account` | boolean | ✓ | `false` when joining an existing account via invite |
| `invite_id` | string | – | Present when `signup_method = invite`; joins to `invite_sent` |
| `signup_surface` | enum | ✓ | `web` · `ios` · `android` · `api` |
| `attribution_source` | string | – | First-touch source, resolved server-side from the stored attribution envelope |
| `email_domain_type` | enum | ✓ | `business` · `freemail` · `edu` · `disposable`. **Domain classification only — never the address** |

### `login_completed`
**Tier 2 · Src S · Owner: Platform**
Successful authentication. One per session establishment, not per token refresh.

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `login_method` | enum | ✓ | `password` · `google` · `microsoft` · `saml` · `magic_link` · `passkey` |
| `is_mfa_used` | boolean | ✓ | |
| `days_since_last_login` | integer | – | Null on first login |

### `login_failed`
**Tier 2 · Src S · Owner: Platform**
Authentication rejected. Feeds both the friction analysis and the security dashboard.

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `failure_reason` | enum | ✓ | `bad_credentials` · `mfa_failed` · `account_locked` · `sso_misconfigured` · `rate_limited` |
| `login_method` | enum | ✓ | As above |
| `attempt_number` | integer | ✓ | Within the current lockout window |

### `account_created`
**Tier 0 · Src S · Owner: Growth Engineering**
A billable entity came into existence. Distinct from `signup_completed`: one account may accumulate many users, and in a self-serve flow both fire together while in a sales-led flow the account is provisioned first.

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `account_id` | string | ✓ | |
| `creation_path` | enum | ✓ | `self_serve` · `sales_provisioned` · `partner` · `migration` |
| `plan_tier` | enum | ✓ | `free` · `starter` · `growth` · `enterprise` |
| `is_trial` | boolean | ✓ | |
| `trial_ends_at` | string | – | ISO 8601 UTC. Required when `is_trial = true` |

### `user_identified`
**Tier 1 · Src S · Owner: Data Engineering**
The alias event. Binds `anonymous_id` to `user_id`. **Fires once per binding, server-side.** Firing this per page load merges unrelated users through shared devices and corrupts every cohort you will ever build.

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `anonymous_id` | string | ✓ | The identifier being bound |
| `binding_trigger` | enum | ✓ | `signup` · `login` · `invite_accept` · `sso_provision` |

### `account_deleted`
**Tier 0 · Src S · Owner: Platform**
Hard deletion. Triggers the downstream erasure pipeline; this event is itself an audit record and is exempt from that pipeline.

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `account_id` | string | ✓ | |
| `deletion_reason` | enum | ✓ | `user_requested` · `gdpr_erasure` · `non_payment` · `tos_violation` · `internal_cleanup` |
| `account_age_days` | integer | ✓ | |
| `lifetime_value` | number | – | Paired with `currency` |
| `currency` | string | – | ISO 4217. Required when `lifetime_value` present |

---

## 2. Subscription & billing

Every event in this section is **Tier 0, server-side, and reconciled monthly against the billing system.** A discrepancy above 0.5% is an incident, not a data-quality ticket.

### `subscription_started`
**Tier 0 · Src S · Owner: Revenue Engineering**
First paid subscription on the account. Fires on the billing provider's confirmed activation webhook, not on checkout submit.

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `subscription_id` | string | ✓ | Billing-system identifier |
| `plan_tier` | enum | ✓ | `starter` · `growth` · `enterprise` |
| `billing_interval` | enum | ✓ | `monthly` · `annual` |
| `value` | number | ✓ | Net of discount, excluding tax |
| `currency` | string | ✓ | ISO 4217 |
| `mrr` | number | ✓ | Normalised monthly recurring revenue in `currency` |
| `seat_count` | integer | ✓ | |
| `converted_from_trial` | boolean | ✓ | |
| `trial_length_days` | integer | – | Required when `converted_from_trial = true` |
| `discount_code` | string | – | Enum-like in practice; keep to warehouse if cardinality grows |
| `payment_method` | enum | ✓ | `card` · `sepa_debit` · `bank_transfer` · `invoice` |
| `sales_assisted` | boolean | ✓ | Drives the PLG-vs-sales-led split in every board deck |

### `subscription_upgraded` / `subscription_downgraded`
**Tier 0 · Src S · Owner: Revenue Engineering**
Movement between tiers, or a seat change that alters MRR. Two names because the analysis and the alerting differ; one shared property set.

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `subscription_id` | string | ✓ | |
| `plan_tier_previous` | enum | ✓ | |
| `plan_tier` | enum | ✓ | New tier |
| `mrr_previous` | number | ✓ | |
| `mrr` | number | ✓ | New MRR |
| `mrr_delta` | number | ✓ | Signed. Positive on upgrade, negative on downgrade |
| `currency` | string | ✓ | |
| `seat_count_previous` | integer | ✓ | |
| `seat_count` | integer | ✓ | |
| `change_trigger` | enum | ✓ | `self_serve` · `sales` · `usage_threshold` · `seat_true_up` |

### `subscription_cancelled`
**Tier 0 · Src S · Owner: Revenue Engineering**
Cancellation *requested*. The subscription usually remains active until period end — that is `subscription_expired`, a separate event. Conflating the two is the single most common churn-reporting error.

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `subscription_id` | string | ✓ | |
| `cancellation_reason` | enum | ✓ | `too_expensive` · `missing_features` · `switched_competitor` · `no_longer_needed` · `poor_experience` · `company_closed` · `not_specified` |
| `cancellation_type` | enum | ✓ | `voluntary` · `involuntary` · `sales_initiated` |
| `mrr_lost` | number | ✓ | |
| `currency` | string | ✓ | |
| `subscription_age_days` | integer | ✓ | |
| `effective_at` | string | ✓ | ISO 8601 UTC — when access actually ends |
| `has_save_offer_shown` | boolean | ✓ | |

### `subscription_expired`
**Tier 0 · Src S · Owner: Revenue Engineering**
Access actually ended. This is the event that decrements active subscriptions. Properties mirror `subscription_cancelled` plus `days_between_cancel_and_expiry`.

### `subscription_reactivated`
**Tier 0 · Src S · Owner: Revenue Engineering**
A previously expired subscription became active again. Properties as `subscription_started` plus `days_churned`.

### `payment_succeeded`
**Tier 0 · Src S · Owner: Revenue Engineering**

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `invoice_id` | string | ✓ | |
| `subscription_id` | string | – | Absent for one-off charges |
| `value` | number | ✓ | Amount captured, excluding tax |
| `tax_amount` | number | ✓ | |
| `currency` | string | ✓ | |
| `payment_method` | enum | ✓ | |
| `is_first_payment` | boolean | ✓ | |

### `payment_failed`
**Tier 0 · Src S · Owner: Revenue Engineering**
The highest-ROI event in most SaaS plans. Involuntary churn is typically 20–40% of total churn and it is the only kind that is fully recoverable.

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `invoice_id` | string | ✓ | |
| `failure_reason` | enum | ✓ | `insufficient_funds` · `card_expired` · `card_declined` · `3ds_failed` · `sca_required` · `processor_error` · `fraud_suspected` |
| `retry_number` | integer | ✓ | 0 on first attempt |
| `value` | number | ✓ | |
| `currency` | string | ✓ | |
| `next_retry_at` | string | – | ISO 8601 UTC |
| `is_terminal` | boolean | ✓ | `true` when dunning is exhausted |

### `trial_started` / `trial_extended` / `trial_expired`
**Tier 0 · Src S · Owner: Growth**
Shared properties: `trial_length_days`, `plan_tier`, `requires_payment_method` (boolean), `trial_source` (`self_serve` · `sales` · `partner`). `trial_extended` additionally carries `extension_days` and `extension_reason`. `trial_expired` carries `converted` (boolean) and `activation_reached` (boolean) — the two together are your entire trial-conversion diagnostic.

---

## 3. Core objects

### `workspace_created`
**Tier 1 · Src S · Owner: Product — Core**
A workspace row was committed. In most PLG products this is the first meaningful value moment and belongs in the activation definition.

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `workspace_id` | string | ✓ | |
| `creation_method` | enum | ✓ | `blank` · `template` · `import` · `duplicate` · `api` |
| `template_id` | string | – | Required when `creation_method = template` |
| `workspace_index` | integer | ✓ | 1 for the account's first workspace. The `= 1` cohort is your activation cohort |
| `time_since_signup_s` | integer | – | Null when created by an existing account |

### `workspace_archived` / `workspace_deleted` / `workspace_renamed`
**Tier 2 · Src S · Owner: Product — Core**
Shared: `workspace_id`, `workspace_age_days`, `item_count`, `member_count`. `workspace_archived` adds `archive_reason` (`completed` · `obsolete` · `duplicate` · `not_specified`).

### `item_created` / `item_updated` / `item_deleted`
**Tier 1 · Src S · Owner: Product — Core**
The atomic unit of work in your product — record, document, task, campaign, whatever your users call it. One event family with a `item_type` property, **not** one event per type. This is principle 4 in practice.

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `item_id` | string | ✓ | |
| `item_type` | enum | ✓ | Your closed set of object types |
| `workspace_id` | string | ✓ | |
| `creation_method` | enum | ✓ | `manual` · `template` · `import` · `api` · `automation` · `duplicate` |
| `field_count` | integer | – | Proxy for depth of use |
| `is_first_of_type_for_account` | boolean | ✓ | Powers feature-adoption curves without a separate event |

---

## 4. Collaboration

Collaboration events are the leading indicator of account expansion. In B2B, single-player accounts churn; multi-player accounts renew.

### `invite_sent`
**Tier 1 · Src S · Owner: Growth**

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `invite_id` | string | ✓ | Join key to `invite_accepted` |
| `invite_count` | integer | ✓ | Number sent in this batch |
| `invite_role` | enum | ✓ | `admin` · `editor` · `commenter` · `viewer` |
| `invite_surface` | enum | ✓ | `onboarding` · `settings` · `share_modal` · `empty_state` · `api` |
| `recipient_domain_matches_account` | boolean | ✓ | Internal vs external expansion. **Domain comparison only — no addresses** |

### `invite_accepted`
**Tier 1 · Src S · Owner: Growth**
Carries `invite_id`, `hours_to_accept`, `invite_role`, `is_new_user`.

### `member_added` / `member_removed` / `member_role_changed`
**Tier 1 · Src S · Owner: Product — Core**
Shared: `member_id`, `member_role`, `seat_count_after`, `change_source` (`invite` · `sso_provisioning` · `admin_action` · `scim`). `member_role_changed` adds `member_role_previous`.

### `item_shared`
**Tier 2 · Src S · Owner: Product — Collaboration**
Access granted to another party. Carries `item_id`, `item_type`, `share_scope` (`workspace` · `account` · `public_link` · `specific_users`), `share_permission`, `recipient_count`, `is_external`.

### `comment_created` / `mention_created`
**Tier 2 · Src S · Owner: Product — Collaboration**
Carries `item_id`, `item_type`, `thread_id`, `mention_count`, `is_reply`.

---

## 5. Integrations

### `integration_connected`
**Tier 1 · Src S · Owner: Platform — Integrations**
Integration depth is the strongest single retention predictor in most B2B SaaS. Track it as a Tier 1 citizen.

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `integration_id` | string | ✓ | |
| `integration_slug` | enum | ✓ | Closed set: your published integration catalogue |
| `integration_category` | enum | ✓ | `crm` · `messaging` · `storage` · `identity` · `billing` · `automation` |
| `auth_method` | enum | ✓ | `oauth2` · `api_key` · `webhook` · `saml` |
| `scopes_granted_count` | integer | – | |
| `connection_index` | integer | ✓ | Nth integration on this account |
| `time_to_connect_s` | integer | – | From flow start to confirmed connection |

### `integration_disconnected`
**Tier 1 · Src S · Owner: Platform — Integrations**
Carries `integration_slug`, `disconnect_reason` (`user_action` · `auth_expired` · `permission_revoked` · `error_threshold` · `account_deleted`), `connection_age_days`, `sync_count_lifetime`.

### `integration_sync_failed`
**Tier 1 · Src S · Owner: Platform — Integrations**
Carries `integration_slug`, `failure_reason`, `consecutive_failure_count`, `records_affected`, `is_user_actionable` (boolean). The last property is what separates a support ticket from an engineering page.

---

## 6. Data in / out

### `import_completed`
**Tier 2 · Src S · Owner: Product — Data**
Carries `import_source` (`csv` · `api` · `integration` · `paste`), `record_count`, `error_count`, `duration_ms`, `status` (`success` · `partial` · `failed`), `file_size_bytes`.

### `export_completed`
**Tier 2 · Src S · Owner: Product — Data**
The canonical example of collapsing a name explosion into one event.

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `export_format` | enum | ✓ | `csv` · `xlsx` · `pdf` · `json` · `api` |
| `export_surface` | enum | ✓ | `dashboard` · `report` · `item_detail` · `settings` · `api` |
| `row_count` | integer | ✓ | |
| `duration_ms` | integer | ✓ | |
| `status` | enum | ✓ | `success` · `partial` · `failed` |
| `is_scheduled` | boolean | ✓ | Recurring exports are a strong stickiness signal |

### `search_performed`
**Tier 2 · Src C · Owner: Product — Core**
Carries `search_scope`, `result_count`, `filter_count`, `has_zero_results` (boolean), `time_to_first_result_ms`. **Never the query string** — free text is an uncontrolled PII channel. If you need query analysis, route it to the warehouse through a separate, consented, purpose-limited pipeline.

---

## 7. Reliability & error events

The least glamorous section and the one that pays for the whole plan.

### `api_error_returned`
**Tier 1 · Src S · Owner: Platform**
Carries `error_code`, `error_class` (`client` · `server` · `upstream` · `rate_limit`), `endpoint_pattern` (templated path, never the populated path), `http_status`, `latency_ms`, `is_retryable`.

### `client_error_thrown`
**Tier 2 · Src C · Owner: Frontend**
Carries `error_type`, `error_boundary`, `route_pattern`, `is_fatal`. **Never the raw error message** — stack traces and messages leak user content and belong in your error monitor, which is a different system with a different legal basis.

### `rate_limit_hit`
**Tier 1 · Src S · Owner: Platform**
Carries `limit_type`, `endpoint_pattern`, `plan_tier`, `overage_pct`. A Tier 1 event because it is simultaneously a reliability signal and a live upsell trigger.

### `feature_gate_blocked`
**Tier 1 · Src S+C · Owner: Growth**
A user attempted something their plan does not permit. The single highest-intent expansion signal in the entire plan.

| Property | Type | Req | Values / notes |
|---|---|---|---|
| `gate_id` | enum | ✓ | Closed set of gated capabilities |
| `plan_tier` | enum | ✓ | Current tier |
| `required_plan_tier` | enum | ✓ | Minimum tier that unlocks it |
| `gate_surface` | enum | ✓ | Where the block was rendered |
| `upgrade_prompt_shown` | boolean | ✓ | |

---

## Event budget

| Section | Events | Cumulative |
|---|---|---|
| Account & identity | 6 | 6 |
| Subscription & billing | 11 | 17 |
| Core objects | 6 | 23 |
| Collaboration | 7 | 30 |
| Integrations | 3 | 33 |
| Data in / out | 3 | 36 |
| Reliability | 4 | 40 |

Forty events covering the entire product surface of a mature B2B SaaS. If your product plan is at 300, the difference is not complexity — it is missing properties.

---

**See also:** [Naming conventions](event-naming-conventions.md) · [Onboarding events](onboarding-events.md) · [Feature usage events](feature-usage-events.md) · [SaaS data layer schema](../data-layer/saas-schema.json)
