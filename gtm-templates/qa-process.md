# QA Process

Four gates. Binary outcomes. The person who built the tag never passes their own gate.

Everything that reaches a production container passes all four. There are no exceptions for small changes — "it's just one parameter" is the preamble to most measurement incidents.

---

## Gate overview

| Gate | When | Owner | Blocks | Typical duration |
|---|---|---|---|---|
| **1 — Spec review** | Before implementation | Data architect | Implementation | 30 min |
| **2 — Implementation review** | Before versioning | Second engineer | Versioning | 45 min |
| **3 — Pre-publish** | Before publishing to live | Architect or lead | Publishing | 20 min |
| **4 — Post-publish** | 24h after publishing | Event owner | Closing the change | 15 min |

---

## Gate 1 — Spec review

Runs against the pull request to `tracking-plan.json`, before anyone writes a line of implementation.

| # | Check | Pass condition |
|---|---|---|
| 1.1 | Naming grammar | `object_past_tense_verb`, snake_case, ≤ 40 chars, verb from the approved list |
| 1.2 | Decision test | The PR states the decision this event will change, in one sentence |
| 1.3 | Duplication test | Not answerable from an existing event plus a new property |
| 1.4 | Reconstruction test | Definition is complete enough for a stranger to reconstruct in six months |
| 1.5 | Tier assigned | 0–3, with the justification stated |
| 1.6 | Owner named | A person, not a team. They have acknowledged in the PR |
| 1.7 | Property types declared | Every property has a type; enums have their full member list |
| 1.8 | PII review | No property can carry personal data. URL sanitisation confirmed for any URL field |
| 1.9 | Consent classification | Required consent types stated per destination |
| 1.10 | Destinations declared | Each destination has a named consumer |
| 1.11 | Budget check | GA4 custom dimension consumption within budget after this change |
| 1.12 | Sunset date | Tier 3 events carry an expiry date |
| 1.13 | CI green | `node tooling/validate.mjs` passes |

**Gate 1 rejects more work than the other three combined, and that is the point.** Rejecting an event here costs 30 minutes; discovering it was unnecessary after implementation costs a sprint and leaves a dimension registered forever.

---

## Gate 2 — Implementation review

Runs in GTM Preview mode plus GA4 DebugView, against a real user journey — not a synthetic click on a staging page nobody uses.

### 2A — Data layer

| # | Check | Method |
|---|---|---|
| 2A.1 | Event fires on the correct trigger | Preview mode, walk the journey |
| 2A.2 | Fires exactly once per occurrence | Repeat the action 3× and count |
| 2A.3 | Object validates against the schema | Dev-build runtime validator, console clean |
| 2A.4 | All required properties present | Inspect the push in Preview |
| 2A.5 | Types correct | `"3"` vs `3`, `"true"` vs `true` — inspect, do not assume |
| 2A.6 | Enum values are members of the declared set | Trigger each branch that can produce a different value |
| 2A.7 | `event_id` present and unique per occurrence | Compare across three repetitions |
| 2A.8 | `_clear` present before nested payloads | Ecommerce and any other nested push |
| 2A.9 | No PII anywhere in the object | Read the full object. Every key. Including the URL |
| 2A.10 | URL sanitised | Test with `?email=`, `?token=`, `?gclid=` appended |

### 2B — Tag configuration

| # | Check | Method |
|---|---|---|
| 2B.1 | Tag naming follows the grammar | Container review |
| 2B.2 | Tag is in the correct folder | Container review |
| 2B.3 | Notes field completed — purpose, owner, spec link, change | Container review |
| 2B.4 | Consent settings declared explicitly | Tag → Advanced → Consent Settings |
| 2B.5 | Correct measurement ID via environment lookup, not a constant | Variable inspection |
| 2B.6 | Trigger conditions are as narrow as possible | Trigger review |
| 2B.7 | Blocking triggers applied — internal traffic, non-production | Trigger review |
| 2B.8 | Firing priority correct for its layer | Tag → Advanced |
| 2B.9 | No Custom HTML where a native template exists | Container review |
| 2B.10 | Parameters mapped 1:1 to the spec — no renames in the tag | Tag → Parameters |

### 2C — Destination verification

| # | Check | Method |
|---|---|---|
| 2C.1 | Event appears in GA4 DebugView within 60s | DebugView |
| 2C.2 | All parameters arrive, none truncated | DebugView — inspect every value |
| 2C.3 | Custom dimensions registered and populating | GA4 Admin → Custom definitions |
| 2C.4 | Server container receives the event | sGTM Preview |
| 2C.5 | Row lands in BigQuery with correct types | Query the streaming table |
| 2C.6 | Ad platform receives it with `event_id` for dedup | Platform's own diagnostic tool |
| 2C.7 | No parameter exceeds its length limit | Compare against the GA4 limits table |

### 2D — Consent matrix

Run the full journey **four times**, once per consent state. This is the step teams skip and the one that produces compliance findings.

| Consent state | Expected behaviour |
|---|---|
| All denied | Analytics: cookieless pings only. Ads: nothing sent. No `_ga` cookie written |
| Analytics only | GA4 full. Ads suppressed. `dispatch_status: dropped_no_consent` logged |
| Ads only | GA4 cookieless. Ad platforms receive conversions |
| All granted | Everything fires. All cookies written |

For each: inspect actual network requests and actual cookies. Not the CMP's own status display — the CMP reporting "denied" while a tag writes a cookie anyway is exactly the failure you are looking for.

---

## Gate 3 — Pre-publish

| # | Check | Pass condition |
|---|---|---|
| 3.1 | Workspace diff reviewed line by line | Every change is intentional and in scope |
| 3.2 | No unrelated changes in the workspace | Anything unexpected is removed or split into its own change |
| 3.3 | Version named and described | `YYYY-MM-DD — summary — scope`. Not "Version 47" |
| 3.4 | All diagnostic and debug tags paused | Folder `90 — Diagnostics` is fully paused |
| 3.5 | No test or placeholder assets remain | Container search for `test`, `tmp`, `asdf`, `xxx` returns nothing |
| 3.6 | Container size within budget | < 800 KB against GTM's 1 MB cap |
| 3.7 | Staging soak completed, minimum 24h | Staging property shows the expected volume |
| 3.8 | Rollback target identified | The named version to restore, written into the change ticket |
| 3.9 | Monitoring configured for Tier 0/1 | Freshness and volume alerts exist before publish, not after |
| 3.10 | Second approver signed off | Not the implementer |

**3.9 is the one that gets skipped and matters most.** Monitoring added "next sprint" is monitoring that does not exist during the window when the change is most likely to break.

---

## Gate 4 — Post-publish

Runs 24 hours after publishing. The change is not closed until this passes.

| # | Check | Pass condition |
|---|---|---|
| 4.1 | Event volume within expected range | Within ±20% of forecast |
| 4.2 | No unexpected volume change on adjacent events | Neighbours in the same funnel are stable |
| 4.3 | Property fill rates as specified | Required properties at 100%; optionals within expectation |
| 4.4 | No new `(not set)` or `(other)` values | GA4 exploration by the new dimensions |
| 4.5 | Cardinality within the declared band | Distinct value count per property |
| 4.6 | Server/client dedup rate is sane | Near 50% on dual-emitted Tier 0 events |
| 4.7 | Ad platform conversion counts reconcile | Within 10% of first-party counts |
| 4.8 | No console errors introduced | Real-user monitoring, error rate flat |
| 4.9 | Page performance unchanged | Container size and LCP unchanged |
| 4.10 | Reconciliation against source of record | Tier 0 only: within 0.5% of the billing system |

**Failing 4.10 is an incident, not a ticket.** A Tier 0 event that disagrees with the billing system by more than half a percent means either the pipeline is dropping events or the billing system is, and both need an answer today.

---

## Regression suite

Run monthly, and after any release touching authentication, routing, consent, or the checkout.

| # | Journey | Expected events, in order |
|---|---|---|
| R1 | Anonymous → pricing → signup → activation | `page_view` ×3 → `cta_clicked` → `signup_completed` → `account_created` → `onboarding_started` → `workspace_created` → `activation_reached` |
| R2 | Trial → paid conversion | `trial_started` → `feature_gate_blocked` → `subscription_started` → `payment_succeeded` |
| R3 | Full ecommerce purchase | `view_item_list` → `view_item` → `add_to_cart` → `begin_checkout` → `add_shipping_info` → `add_payment_info` → `purchase` |
| R4 | Consent reject → browse → accept | `consent_state_set` ×2, cookieless before, full after, no cookies in between |
| R5 | Invite → accept → team activation | `invite_sent` → `invite_accepted` → `member_added` → `signup_completed` with `is_new_account: false` |
| R6 | Payment failure → dunning → recovery | `payment_failed` ×2 with incrementing `retry_number` → `payment_succeeded` |
| R7 | Cancellation | `subscription_cancelled` → `subscription_expired` at period end |
| R8 | Cross-device: mobile browse → desktop convert | Identity resolves; attribution envelope carries first touch |
| R9 | SPA deep-link → route change ×3 | One `page_view` per route, none duplicated, no bleed of properties |
| R10 | Ad-blocked session | Server-side Tier 0 events still arrive; client-side Tier 2 absent |

R10 is the one people forget to build. Run it in a browser with uBlock Origin enabled. If your Tier 0 events disappear, your revenue reporting is a function of your users' browser extensions.

---

## Monitoring, per tier

| Tier | Freshness | Volume anomaly | Schema violation | Reconciliation |
|---|---|---|---|---|
| **0** | Hourly, page after 2 missed | ±20% vs 7-day baseline, paged | Blocks deploy | Monthly vs billing, 0.5% tolerance |
| **1** | Daily, alert channel | ±35%, alert | Blocks deploy | Quarterly |
| **2** | Weekly | Dashboard only | Warns | None |
| **3** | None | None | Warns | None |

**Alert on the leading indicator, not the lagging one.** Alerting on "conversions dropped" tells you at the end of the day. Alerting on "the `purchase` event has not fired in 90 minutes during business hours" tells you at the beginning of the problem.

---

## Incident response

When a Tier 0 or Tier 1 event breaks:

```
T+0     Alert fires
T+5     Acknowledge. Assess blast radius: which reports, which decisions, which platforms
T+15    Roll back to the last known-good named version. Do not debug in production
T+30    Post in the data channel: what broke, what is affected, what the workaround is
T+60    Root cause identified
T+4h    Fix implemented and through Gates 2 and 3
T+24h   Gate 4 confirmation
T+48h   Written post-mortem: cause, why QA missed it, which gate gains a check
```

**Every post-mortem adds exactly one check to exactly one gate.** That is how these checklists were built, and it is why they are worth following.

**Backfill honestly.** If the gap is recoverable from server logs, backfill it with `source.is_backfill = true` and annotate the dashboards. If it is not, annotate the gap and say so. Silently patching a hole with an estimate is how a dataset loses its credibility permanently.

---

**See also:** [Audit checklist](audit-checklist.md) · [Container structure](container-structure.md) · [Common risks](../audits/common-risks.md) · [Tag flow diagrams](tag-flow-diagram.md)
