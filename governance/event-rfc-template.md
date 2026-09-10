# Event RFC

Required for every Tier 0 and Tier 1 event, and for any change to an existing event's meaning. Tier 2 and 3 go through PR review using the same headings, informally.

Copy this file into the pull request description. Delete the `>` guidance.

---

## RFC-`<nnn>` · `<event_name>`

| | |
|---|---|
| **Author** | |
| **Date** | |
| **Proposed tier** | 0 / 1 / 2 / 3 |
| **Proposed owner** | `<a person, not a team>` |
| **Status** | Draft / In review / Accepted / Rejected / Superseded |

---

### 1. The decision

> One sentence, no hedging. *"When this number moves, `<role>` will do `<action>` differently."*
>
> If you cannot complete that sentence, stop here. This is where most proposals should die, and killing one costs thirty minutes instead of a sprint.

---

### 2. Why existing events cannot answer this

> The gate that catches most proposals. Before adding an event, prove that adding a **property** to an existing one does not work.
>
> Name the events you considered and why each fails. "I looked and there wasn't one" is not an answer — the plan is at `tooling/tracking-plan.json` and it is searchable.

| Existing event considered | Why it does not answer the question |
|---|---|
| | |

---

### 3. Specification

**Name:** `<object>_<past_tense_verb>`

**Definition**
> What must be true for this to fire. Precise enough that someone who has never seen the code can tell you whether a given moment qualifies.

**Trigger**
> The exact technical condition. `POST /v1/x returns 201 and the transaction commits`, not "when the user creates a thing".

**Source:** server / client / both
> Tier 0 must be server. If you are proposing Tier 0 on a client, explain how you intend to survive ad blockers.

**Fires:** once per `<what>` / every `<what>`
**Idempotency key:** `<what makes a retry safe>`

**Properties**

| Name | Type | Required | Enum ref | Cardinality | Register as GA4 dimension | Notes |
|---|---|---|---|---|---|---|
| | | | | | | |

> Eight properties is the soft budget, twelve the hard cap. Every property must appear in a filter, a breakdown, or a join you can name.

---

### 4. Privacy

| | |
|---|---|
| **Carries personal data** | No |
| **Free-text fields** | None |
| **URL fields** | `<none, or: sanitised by the collection layer>` |
| **Lawful basis** | consent / legitimate interest / contract / legal obligation |
| **Retention** | `<days>` |
| **In the erasure pipeline** | Yes / No, with reason |

> "Carries personal data: yes" means this RFC does not proceed as written. Classify, band, or enumerate instead — and route any genuine match key through the server, never the data layer.

---

### 5. Destinations

| Destination | Consumer | Required consent |
|---|---|---|
| ga4 | | `analytics_storage` |
| warehouse | | — |
| crm | | |
| ads | | `ad_storage`, `ad_user_data` |

> Every destination needs a named consumer. "It might be useful in the CRM" is not a consumer.

---

### 6. Monitoring

| | |
|---|---|
| **Freshness check** | hourly / daily / weekly / none |
| **Volume anomaly threshold** | ±`<n>`% vs 7-day baseline |
| **Paged** | Yes / No |
| **Expected daily volume** | `<n>` — the baseline the anomaly alert is built on |
| **Reconciliation source** | `<system>`, `<tolerance>`%, `<cadence>` |

> Tier 0 and 1 cannot ship without monitoring configured **before** publish. Monitoring added "next sprint" is monitoring that does not exist during the window when the change is most likely to break.

---

### 7. Lifecycle

| | |
|---|---|
| **Expiry** | Tier 3 only: `<date, default +90 days>` |
| **Review date** | `<annual for Tier 0–2>` |
| **Deprecates** | `<event name, or none>` |
| **Migration window** | `<if deprecating something: dual-run period>` |

---

### 8. Implementation

| | |
|---|---|
| **Emitting service** | |
| **Dependencies** | |
| **Backfill possible** | Yes / No — from where |
| **Estimated effort** | |
| **QA journeys** | `<which regression suite entries cover this>` |

---

### 9. Budget impact

| | Before | After | Budget | Cap |
|---|---|---|---|---|
| Event-scoped GA4 dimensions | | | 30 | 50 |
| User-scoped GA4 dimensions | | | 15 | 25 |
| Events in plan | | | — | — |

> `node tooling/validate.mjs` prints these. Paste the output.

---

### 10. Review

| Role | Name | Verdict | Date |
|---|---|---|---|
| Data architect | | | |
| Event owner | | | |
| Second approver (Tier 0 only) | | | |
| Privacy (if any field is borderline) | | | |

**Decision:** Accepted / Rejected / Deferred
**Rationale:**

> Record rejections. A rejected RFC is the most reusable document in the repository — the next person who proposes the same event gets an answer in two minutes instead of a meeting.

---

**See also:** [Ownership & versioning](ownership-and-versioning.md) · [How to think about events](../philosophy/how-to-think-about-events.md) · [QA process](../gtm-templates/qa-process.md)
