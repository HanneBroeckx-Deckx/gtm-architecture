# GTM Audit Checklist

The technical inspection. 96 checks across nine domains, each with a pass condition and a severity.

This is the instrument. The deliverable it produces is [`../audits/gtm-audit-template.md`](../audits/gtm-audit-template.md).

**Severity scale**

| | Meaning | Response |
|---|---|---|
| **P0** | Legal exposure, revenue misreporting, or data loss in progress | Same day |
| **P1** | Decisions are being made on wrong numbers | Same week |
| **P2** | Correct but fragile, expensive, or unmaintainable | This quarter |
| **P3** | Improvement opportunity | Backlog |

Access required: GTM container (read), GA4 property (editor), BigQuery export if present, ad platform conversion settings, the CMP admin, and a staging environment.

---

## 1 — Governance & documentation

| # | Check | Pass | Sev |
|---|---|---|---|
| 1.1 | A written tracking plan exists outside the GTM UI | Present, version-controlled | P1 |
| 1.2 | The plan matches the container | ≤ 5% drift between plan and implementation | P1 |
| 1.3 | Every event has a named owner | 100% | P2 |
| 1.4 | Every event has a written definition | 100% | P1 |
| 1.5 | Naming convention documented and applied | ≥ 95% conformance | P2 |
| 1.6 | Change process exists and is followed | Evidence in the last 3 changes | P2 |
| 1.7 | Container access reviewed in the last 6 months | Documented review | P2 |
| 1.8 | Publish rights limited to named individuals | ≤ 4 publishers | P1 |
| 1.9 | Container versions are named and described | ≥ 90% of the last 20 | P2 |
| 1.10 | An event deleted in the last 12 months | ≥ 1 | P3 |
| 1.11 | Deprecated assets carry removal dates | 100% | P3 |
| 1.12 | Onboarding documentation for a new analyst | Exists and is current | P3 |

---

## 2 — Privacy, consent & legal

Every finding in this section is at least P1. Several are P0 by default.

| # | Check | Pass | Sev |
|---|---|---|---|
| 2.1 | Consent defaults set before any measurement tag evaluates | Consent Initialization, priority 1000 | **P0** |
| 2.2 | All four Consent Mode v2 signals implemented | `ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization` | **P0** |
| 2.3 | No cookie written before consent in a deny-first region | Verified in a clean browser profile | **P0** |
| 2.4 | No PII in the data layer | Full inspection across 10 journeys | **P0** |
| 2.5 | No PII in URLs reaching any destination | Query-parameter audit | **P0** |
| 2.6 | Every tag declares its consent requirements | 100% | P1 |
| 2.7 | Consent withdrawal takes effect immediately | Tested | P1 |
| 2.8 | Consent state stored with the CMP version | Present in `consent_state_set` | P2 |
| 2.9 | Data retention configured deliberately in GA4 | Not left at the default | P1 |
| 2.10 | IP anonymisation / regional controls appropriate | Configured | P1 |
| 2.11 | Data Processing Terms accepted with every vendor | Documented | P1 |
| 2.12 | Deletion / erasure pipeline covers analytics stores | Documented and tested | P1 |
| 2.13 | Enhanced Conversions hashing happens server-side | No client-side hashing | **P0** |
| 2.14 | Ads data redaction enabled when ad consent is denied | Configured | P1 |
| 2.15 | A DPIA exists where required | Present | P1 |
| 2.16 | Consent grant rate is measured and trended | Reported | P2 |

---

## 3 — Container hygiene

| # | Check | Pass | Sev |
|---|---|---|---|
| 3.1 | Total tag count | < 150 | P2 |
| 3.2 | Tags fired in the last 30 days | > 85% | P2 |
| 3.3 | Custom HTML tags | < 10 | P2 |
| 3.4 | Custom HTML tags containing business logic | 0 | P1 |
| 3.5 | All assets are foldered | 100% | P3 |
| 3.6 | Naming convention applied to tags | ≥ 95% | P2 |
| 3.7 | Naming convention applied to triggers and variables | ≥ 95% | P3 |
| 3.8 | Tag notes completed | ≥ 70% | P3 |
| 3.9 | Container size | < 800 KB | P2 |
| 3.10 | Open workspaces older than 30 days | 0 | P2 |
| 3.11 | Debug and diagnostic tags paused in production | 100% | P1 |
| 3.12 | No test or placeholder assets in the live container | 0 | P2 |
| 3.13 | Duplicate tags firing the same event | 0 | P1 |
| 3.14 | Environment-specific IDs resolved by lookup, not hardcoded | 100% | P1 |
| 3.15 | Deprecated folder reviewed in the last quarter | Evidence | P3 |

---

## 4 — Data layer implementation

| # | Check | Pass | Sev |
|---|---|---|---|
| 4.1 | A documented data layer schema exists | Present | P1 |
| 4.2 | Pushes are self-contained — one push, one complete event | 100% | P1 |
| 4.3 | `_clear` used before nested payloads | 100% of ecommerce pushes | **P0** if ecommerce |
| 4.4 | Types are consistent across occurrences | No type drift | P1 |
| 4.5 | Absent values are omitted, not `null`/`""`/`"undefined"` | 100% | P2 |
| 4.6 | `event_id` present and unique per occurrence | 100% on Tier 0/1 | P1 |
| 4.7 | Timestamps are ISO 8601 UTC | 100% | P2 |
| 4.8 | Monetary values always paired with a currency | 100% | **P0** if ecommerce |
| 4.9 | Nesting depth ≤ 2 | 100% | P3 |
| 4.10 | A typed push helper is used, not raw `dataLayer.push` | In use | P2 |
| 4.11 | `data-analytics-id` contract in place for click tracking | In use | P2 |
| 4.12 | No CSS-selector-based click triggers | 0 | P2 |
| 4.13 | SPA route changes emit exactly one page view | Verified | P1 |
| 4.14 | No dataLayer key bleed between events | Verified over a 5-action journey | P1 |

---

## 5 — Event taxonomy

| # | Check | Pass | Sev |
|---|---|---|---|
| 5.1 | Naming grammar consistent across all events | ≥ 95% | P2 |
| 5.2 | No values encoded in event names | 0 violations | P2 |
| 5.3 | No version suffixes in names | 0 | P2 |
| 5.4 | Events tiered | 100% | P2 |
| 5.5 | Tier 0 events collected server-side | 100% | **P0** |
| 5.6 | Reserved GA4 names not redefined | 0 violations | P1 |
| 5.7 | Enums documented with full member lists | 100% | P2 |
| 5.8 | No high-cardinality property registered as a GA4 dimension | 0 | P1 |
| 5.9 | Events fired in the last 30 days | > 80% of registered | P2 |
| 5.10 | No name-explosion pattern | Reviewed | P2 |
| 5.11 | Activation event defined and versioned | Present | P1 |
| 5.12 | Error and failure events instrumented | `payment_failed` etc. present | P1 |

---

## 6 — GA4 configuration

| # | Check | Pass | Sev |
|---|---|---|---|
| 6.1 | Exactly one configuration tag per property | 1 | P1 |
| 6.2 | Key events configured and matching the business definition | Verified | P1 |
| 6.3 | Custom dimensions registered for all reported parameters | 100% | P1 |
| 6.4 | Custom dimension budget consumption | < 80% of 50 event-scoped | P2 |
| 6.5 | Internal traffic filter active | Active, not "testing" | P1 |
| 6.6 | Developer traffic excluded | Configured | P2 |
| 6.7 | Unwanted referrals list complete — payment, SSO, own domains | Complete | P1 |
| 6.8 | Cross-domain measurement configured where needed | Configured | P1 |
| 6.9 | Session timeout deliberately set | Reviewed | P3 |
| 6.10 | Attribution model and lookback window deliberate | Reviewed | P2 |
| 6.11 | BigQuery export enabled | Enabled, daily + streaming | P1 |
| 6.12 | Data retention set to the maximum available | 14 months standard | P1 |
| 6.13 | Google Signals decision made deliberately | Documented either way | P2 |
| 6.14 | No parameter exceeding its length limit | 0 truncations | P1 |
| 6.15 | `(other)` row not appearing in key reports | Absent | P1 |
| 6.16 | Enhanced measurement settings reviewed, not left at default | Reviewed | P2 |

---

## 7 — Server-side & advertising

| # | Check | Pass | Sev |
|---|---|---|---|
| 7.1 | Server container present for Tier 0 events | Present | P1 |
| 7.2 | Server endpoint on an owned subdomain | Owned domain | P1 |
| 7.3 | Global PII-stripping transformation in place | Present | **P0** |
| 7.4 | Client/server deduplication via a shared `event_id` | Working; dedup rate sane | **P0** |
| 7.5 | Conversion APIs configured — Google, Meta, LinkedIn | Configured | P2 |
| 7.6 | Ad platform conversions reconcile with first-party | Within 15% | P1 |
| 7.7 | No duplicate conversion counting across platforms | Verified | P1 |
| 7.8 | Consent respected in server-side dispatch | Verified | **P0** |
| 7.9 | Server container monitored for errors and latency | Monitored | P2 |
| 7.10 | Secrets stored in the secret manager, not in variables | 100% | P1 |
| 7.11 | First-party cookies set server-side where ITP applies | Configured | P2 |
| 7.12 | Dispatch failures logged and alerted | Logged | P2 |

---

## 8 — Data quality & reconciliation

| # | Check | Pass | Sev |
|---|---|---|---|
| 8.1 | Tier 0 events reconcile with the source of record | Within 0.5% | **P0** |
| 8.2 | GA4 vs BigQuery row counts consistent | Within 2% | P1 |
| 8.3 | No unexplained volume steps in the last 90 days | Reviewed | P1 |
| 8.4 | Required property fill rates | 100% | P1 |
| 8.5 | Optional property fill rates within expectation | Reviewed | P2 |
| 8.6 | No unexpected enum values in production | 0 | P2 |
| 8.7 | Bot and internal traffic excluded | Verified | P1 |
| 8.8 | Timezone consistency across systems | Consistent | P2 |
| 8.9 | Currency handling correct in multi-currency estates | Verified | **P0** if multi-currency |
| 8.10 | Historical annotations exist for known breaks | Present | P2 |
| 8.11 | Freshness monitoring on Tier 0/1 | Configured | P1 |
| 8.12 | Volume anomaly alerting on Tier 0 | Configured | P1 |

---

## 9 — Performance & reliability

| # | Check | Pass | Sev |
|---|---|---|---|
| 9.1 | GTM container load does not block rendering | Async, verified | P2 |
| 9.2 | Container size within budget | < 800 KB | P2 |
| 9.3 | Third-party tag count | < 15 | P2 |
| 9.4 | No synchronous third-party scripts injected by tags | 0 | P1 |
| 9.5 | Measurable impact on LCP | < 100 ms | P2 |
| 9.6 | No console errors from tags | 0 | P2 |
| 9.7 | Tags fail gracefully when a destination is unreachable | Verified | P2 |
| 9.8 | Server-side collection tested with an ad blocker active | Tier 0 events survive | P1 |
| 9.9 | Tag firing does not block navigation | Verified | P2 |

---

## Scoring

Each domain scores 0–100: `(checks passed / checks applicable) × 100`, weighted.

| Domain | Weight | Rationale |
|---|---|---|
| 2 — Privacy & consent | 20% | Legal exposure and existential risk |
| 5 — Event taxonomy | 15% | Determines the ceiling on every analysis |
| 8 — Data quality | 15% | Determines whether anyone should trust the numbers |
| 4 — Data layer | 12% | The foundation everything sits on |
| 6 — GA4 configuration | 12% | Where correct data goes to be misconfigured |
| 7 — Server-side & ads | 10% | Revenue attribution accuracy |
| 1 — Governance | 8% | Determines whether the fix survives |
| 3 — Container hygiene | 5% | Maintenance cost |
| 9 — Performance | 3% | Real but rarely the binding constraint |

**Any P0 finding caps the total at 40, regardless of the weighted score.** An estate with one legal exposure and a perfect taxonomy is not a healthy estate.

| Score | Verdict |
|---|---|
| 85–100 | Mature. Governance is working. Optimise |
| 70–84 | Solid. Known gaps, managed |
| 55–69 | Functional but fragile. One redesign from a rebuild |
| 40–54 | Unreliable. Decisions are being made on wrong numbers |
| < 40 | Rebuild. Faster than remediating |

---

**See also:** [Audit report template](../audits/gtm-audit-template.md) · [Common risks](../audits/common-risks.md) · [Quick wins](../audits/quick-wins.md) · [QA process](qa-process.md)
