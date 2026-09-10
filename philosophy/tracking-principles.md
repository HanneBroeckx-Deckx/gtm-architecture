# Tracking Principles

Fourteen rules. Each one exists because I have watched its absence cost a team a quarter.

They are ordered by leverage: the earlier a principle sits, the more expensive it is to retrofit.

---

## 1. The tracking plan is the product. The tag is a build artifact.

A Google Tag Manager container is a compiler output. It can be rebuilt in a week from a good spec, and it cannot be recovered in a quarter from a bad one.

So the spec — event names, properties, types, owners, destinations — lives in version control, gets reviewed in pull requests, and is the thing you argue about. The container is downstream. If your only source of truth is inside the GTM UI, you do not have an architecture, you have a configuration.

**Failure mode without it:** the person who built the container leaves and nobody can say what `ga_event_23` was supposed to mean.

---

## 2. Design from the decision backwards, never from the interface forwards.

Every event answers a question, and every question changes a decision someone is going to make.

```
Decision  →  Question  →  Metric  →  Event + properties  →  Implementation
```

Run it in that direction. If you cannot name the decision, you are not designing measurement, you are producing exhaust.

The interface-forwards version — "let's track all button clicks and figure it out later" — feels productive for two weeks and produces a dataset nobody can query for two years.

**Test:** for any proposed event, complete this sentence in one line. *"When this number moves, `<role>` will do `<action>` differently."* No completion, no event.

---

## 3. Model state transitions, not clicks.

A click is an input device event. It tells you a mouse moved. It does not tell you the world changed.

Track the transition the click causes, at the moment the system confirms it:

| Instead of | Track | Because |
|---|---|---|
| `signup_button_clicked` | `signup_completed` | The click can fail. The account either exists or it does not. |
| `invite_modal_submitted` | `member_invited` | Retries inflate the click. The invite is idempotent. |
| `upgrade_cta_clicked` | `subscription_started` | Only one of these appears in the revenue reconciliation. |

Intent events (`checkout_started`, `upgrade_viewed`) are legitimate — they are how you measure drop-off — but they are *paired* with an outcome event, never a substitute for one.

---

## 4. One event, many properties. Never many events.

The single most common taxonomy failure is name explosion.

```
❌  export_csv_clicked
    export_pdf_clicked
    export_xlsx_clicked
    export_csv_clicked_from_dashboard
    export_csv_clicked_from_report

✅  export_completed
    ├─ export_format: csv | pdf | xlsx
    ├─ export_surface: dashboard | report | api
    ├─ row_count: integer
    └─ duration_ms: integer
```

Five names that need five queries and five dashboard tiles collapse into one name with two dimensions. The rule: **variation goes in properties, not in names.** If two candidate events differ only by an adjective, they are one event with a property.

---

## 5. Cardinality is a design decision, not an accident.

Every property you add is a promise about its value space. Make the promise explicit before you ship.

- **Enum** — closed set, documented in the plan, validated in CI. Default choice.
- **Bounded** — open but small (< 200 values expected), e.g. `country_code`.
- **Unbounded** — IDs, free text, URLs. These are *joins*, not *dimensions*. They belong in the warehouse, not in a GA4 custom dimension where high cardinality silently triggers `(other)` row aggregation and quietly destroys your reports.

**Failure mode without it:** someone registers `user_email` as a custom dimension, the property blows past its cardinality ceiling, and three months of reports collapse into an `(other)` bucket that cannot be un-collapsed retroactively.

---

## 6. Names are immutable. Meaning is versioned.

Once an event name has been in production for one full reporting cycle, it is a public API. You do not rename it, you do not silently change what it counts.

Changing meaning requires a new name and a migration window in which both fire:

```
subscription_started        → deprecated 2026-04-01, sunset 2026-07-01
subscription_activated      → introduced 2026-04-01  (now excludes trials)
```

Never `subscription_started_v2`. Version numbers in names are an admission that the name was wrong; fix the name.

**Failure mode without it:** a metric steps 30% on a Tuesday, three teams spend two weeks arguing about whether it is a market signal, and the answer is that someone changed a trigger condition.

---

## 7. Money, identity, and contracts are collected server-side.

Client-side collection is best-effort by construction. Ad blockers, ITP, network drops, and users closing the tab mid-request all take a bite — typically 10–30% on consumer web, less on B2B SaaS but never zero.

That loss rate is acceptable for `feature_used`. It is unacceptable for `subscription_started`.

**Tier 0 events — anything that reconciles against a bank statement, a contract, or a legal obligation — are emitted from the backend**, from the same transaction that wrote the row. The client may *also* fire a version for real-time UX; the server version is the one that counts.

---

## 8. Consent is an input to the architecture, not a banner on top of it.

Consent state must be resolved *before* the first tag evaluates, and it must be readable by every tag as a first-class variable.

Practically:
- Consent defaults are set in a dedicated, highest-priority initialisation tag.
- No tag fires "if the banner has been seen"; tags fire on explicit consent signals.
- Every tag declares its required consent types. Nothing inherits by default.
- `analytics_storage: denied` means cookieless pings — not silence, and not a cookie written anyway.

Retrofitting consent onto a live container is a two-week job with a legal deadline attached. Designing it in costs an afternoon.

---

## 9. No PII in the data layer. Ever. Not hashed, not "internal only".

The data layer is world-readable by any script on the page, including every third-party tag you have ever installed and every tag they load.

Never in the data layer: email addresses, names, phone numbers, addresses, raw IPs, free-text fields users typed, session tokens, URL parameters that carry any of the above.

Allowed: opaque identifiers minted for analytics (`user_id` as a UUID or a salted, server-side hash that is not reversible client-side), coarse attributes (`plan_tier`, `account_age_days`, `industry`).

If a destination genuinely requires an email hash for matching — Enhanced Conversions, CAPI — that hash is produced **server-side** and sent **server-side**. It does not transit `window.dataLayer`.

---

## 10. Every event has one named human owner.

Not a team. Not "Growth". A person, in the plan file, who is paged when the event breaks and who signs off when it changes.

Ownerless events are the ones that rot: no one notices when they stop firing, no one can say what they mean, and no one has authority to delete them. Ownership is the mechanism that makes principle 12 enforceable.

---

## 11. If it is not monitored, it is not implemented.

An event that stops firing is worse than an event that never existed, because dashboards keep rendering and people keep trusting them.

Minimum viable monitoring, by tier:

| Tier | Freshness check | Volume anomaly | Schema violation |
|---|---|---|---|
| 0 — Revenue / contractual | Hourly | ±20% vs 7-day baseline, paged | Blocks deploy |
| 1 — Activation loop | Daily | ±35%, alerts channel | Blocks deploy |
| 2 — Feature usage | Weekly | Dashboard only | Warns |
| 3 — Experimental | None | None | Warns |

---

## 12. Events expire.

Default TTL for a Tier 3 event is 90 days. At the end of it, the event is promoted with evidence of use, or it is deleted.

Evidence of use means: a query, a dashboard, or a documented decision within the window. "Someone might want it" is not evidence, it is a maintenance liability with good manners.

The same review applies annually to Tiers 1–2. Tracking plans do not shrink on their own.

---

## 13. QA is a gate, not a phase.

Nothing reaches a production container without passing four gates: spec review, implementation review in preview mode, a pre-publish diff, and a post-publish confirmation in live data.

The full procedure is in [`../gtm-templates/qa-process.md`](../gtm-templates/qa-process.md). The principle is that the gate is binary and the person who built the tag is not the person who passes it.

---

## 14. Optimise for the analyst who joins in eighteen months.

They will not read your Notion page. They will read your event names in a schema browser at 16:40 on a Thursday with a question from the CEO.

Everything in this repository is designed against that moment: names that are self-describing, properties that are typed, enums that are enumerated, and a plan that explains not just what is collected but why it was worth collecting.

---

## The short version

> Track fewer things, name them properly, own them explicitly, and delete them on schedule.

Everything else is detail.

---

**See also:** [How to think about events](how-to-think-about-events.md) · [Data minimalism](data-minimalism.md) · [Naming conventions](../event-taxonomy/event-naming-conventions.md)
