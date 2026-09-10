# Worked Example — Container Structure

The GTM container that implements [`example-event-taxonomy.md`](example-event-taxonomy.md), asset by asset.

**Container:** `GTM-ARCLGHT` (web) + `GTM-ARCSRV` (server)
**Totals:** 41 tags · 27 triggers · 33 variables · 2 Custom HTML tags
**Container size:** 214 KB of a 1 MB cap

> Arclight is fictional. IDs are placeholders.

---

## Folder inventory

### `00 — Core Infrastructure` · 6 tags

| Asset | Type | Trigger | Priority | Consent |
|---|---|---|---|---|
| `HTML — consent defaults` | Custom HTML | `INIT — consent defaults` | 1000 | none |
| `HTML — data layer sanitiser` | Custom HTML | `INIT — all` | 950 | none |
| `GA4 CFG — base configuration` | GA4 Configuration | `INIT — all` | 800 | `analytics_storage` |
| `LI INSIGHT — base` | LinkedIn Insight | `PV — all pages — production only` | 700 | `ad_storage` |
| `META PIXEL — base` | Meta Pixel | `PV — all pages — production only` | 700 | `ad_storage`, `ad_user_data` |
| `SGTM CLIENT — transport config` | GA4 Config override | `INIT — all` | 790 | `analytics_storage` |

**Only two Custom HTML tags in the whole container**, and neither contains business logic. `consent defaults` issues the `gtag('consent','default',…)` call before anything else evaluates. `data layer sanitiser` strips PII-bearing and click-id parameters from every URL before any tag reads one. Both are safety controls, and both are unconditional.

### `01 — Consent & Privacy` · 3 tags

| Asset | Type | Trigger | Consent |
|---|---|---|---|
| `HTML — consent state listener` | Custom HTML → dataLayer | `INIT — consent defaults` | none |
| `GA4 EV — consent_state_set` | GA4 Event | `CE — consent_state_set — dl event` | `analytics_storage` |
| `SGTM BRIDGE — consent forward` | GA4 Event | `CE — consent_state_set — dl event` | none |

### `10 — Product Events` · 11 tags

| Asset | Trigger | Tier |
|---|---|---|
| `GA4 EV — signup_completed` | `CE — signup_completed — dl event` | 0 |
| `GA4 EV — account_created` | `CE — account_created — dl event` | 0 |
| `GA4 EV — trial_started` | `CE — trial_started — dl event` | 0 |
| `GA4 EV — subscription_started` | `CE — subscription_started — dl event` | 0 |
| `GA4 EV — subscription_upgraded` | `CE — subscription_upgraded — dl event` | 0 |
| `GA4 EV — subscription_cancelled` | `CE — subscription_cancelled — dl event` | 0 |
| `GA4 EV — pipeline_created` | `CE — pipeline_created — dl event` | 1 |
| `GA4 EV — deal_created` | `CE — deal_created — dl event` | 1 |
| `GA4 EV — deal_stage_changed` | `CE — deal_stage_changed — dl event` | 1 |
| `GA4 EV — member_added` | `CE — member_added — dl event` | 1 |
| `GA4 EV — integration_connected` | `CE — integration_connected — dl event` | 1 |

**All Tier 0 tags here are the client mirror, not the source of truth.** The authoritative emission comes from the backend directly to `GTM-ARCSRV`, and the two are deduplicated on a shared `event_id`. If every one of these client tags were blocked, revenue reporting would be unaffected.

### `11 — Marketing Events` · 7 tags

| Asset | Trigger |
|---|---|
| `GA4 EV — page_view enriched` | `PV — all pages — production only` |
| `GA4 EV — content_engaged` | `CE — content_engaged — dl event` |
| `GA4 EV — cta_clicked` | `CLICK — cta — [data-analytics-id] exists` |
| `GA4 EV — form_started` | `CE — form_started — dl event` |
| `GA4 EV — form_abandoned` | `CE — form_abandoned — dl event` |
| `GA4 EV — lead_captured` | `CE — lead_captured — dl event` |
| `GADS CONV — lead_captured` | `CE — lead_captured — dl event` |

One CTA tag for the entire estate. `CLICK — cta — [data-analytics-id] exists` matches on the attribute contract, so a redesign that changes classes, layout, or copy breaks nothing.

### `12 — Onboarding & Activation` · 4 tags

| Asset | Trigger |
|---|---|
| `GA4 EV — onboarding_started` | `CE — onboarding_started — dl event` |
| `GA4 EV — onboarding_step_completed` | `CE — onboarding_step_completed — dl event` |
| `GA4 EV — onboarding_completed` | `CE — onboarding_completed — dl event` |
| `GA4 EV — activation_reached` | `CE — activation_reached — dl event` |

**Four tags for a six-step flow across three variants.** The generic step model means reordering steps, adding a seventh, or launching a fourth flow variant requires no container change at all.

### `20 — Advertising Platforms` · 5 tags

| Asset | Trigger | Consent |
|---|---|---|
| `GADS CONV — trial_started` | `CE — trial_started — dl event` | `ad_storage`, `ad_user_data` |
| `GADS CONV — subscription_started` | `CE — subscription_started — dl event` | `ad_storage`, `ad_user_data` |
| `LI CONV — lead_captured` | `CE — lead_captured — dl event` | `ad_storage` |
| `LI CONV — demo_requested` | `CE — demo_requested — dl event` | `ad_storage` |
| `META EV — lead_captured` | `CE — lead_captured — dl event` | `ad_storage`, `ad_user_data`, `ad_personalization` |

Every one carries an explicit consent declaration. None inherits.

### `30 — Server-Side Bridge` · 3 tags

| Asset | Trigger |
|---|---|
| `SGTM BRIDGE — product events` | `CE — tier 0 or 1 — trigger group` |
| `SGTM BRIDGE — marketing events` | `CE — marketing family — trigger group` |
| `SGTM BRIDGE — ecommerce` | `CE — ecommerce family — trigger group` |

### `90 — Diagnostics` · 2 tags · **all paused**

| Asset | State |
|---|---|
| `HTML — dataLayer console logger` | Paused |
| `HTML — schema validator` | Paused |

Unpaused only in the development environment, and Gate 3 verifies they are paused before any publish.

### `99 — Deprecated` · 0 tags

Empty as of the last quarterly review, 2026-08-14.

---

## Trigger inventory

| Trigger | Type | Condition |
|---|---|---|
| `INIT — consent defaults` | Consent Initialization | All pages |
| `INIT — all` | Initialization | All pages |
| `PV — all pages — production only` | Page View | `environment equals production` |
| `CE — signup_completed — dl event` | Custom Event | `event equals signup_completed` |
| `CE — subscription_started — dl event` | Custom Event | `event equals subscription_started` |
| `CE — tier 0 or 1 — trigger group` | Trigger Group | 24 Tier 0/1 custom event triggers |
| `CE — marketing family — trigger group` | Trigger Group | 7 marketing triggers |
| `CE — ecommerce family — trigger group` | Trigger Group | 9 GA4 ecommerce triggers |
| `CLICK — cta — [data-analytics-id] exists` | Click — All Elements | `Click Element matches CSS [data-analytics-id]` |
| `HIST — spa route change` | History Change | `New History Fragment does not equal Old` |
| `EXC — internal traffic` | Blocking | `is_internal equals true` |
| `EXC — non-production` | Blocking | `environment does not equal production` |
| `EXC — bot user agent` | Blocking | `User Agent matches bot regex` |

**Trigger groups** are what keep the bridge tags to three instead of forty. One tag, one group, twenty-four events.

**Three blocking triggers apply to every measurement tag** — internal traffic, non-production, and bots — applied once at the tag level rather than repeated as conditions across twenty-seven triggers.

---

## Variable inventory · selected

### Data Layer Variables · 19

```
DLV — event_id                              → event_id
DLV — event_ts                              → event_ts
DLV — user_id                               → user.user_id
DLV — account_id                            → account.account_id
DLV — plan_tier                             → account.plan_tier
DLV — seat_count                            → account.seat_count
DLV — is_internal                           → user.is_internal
DLV — consent_analytics                     → context.consent.analytics_storage
DLV — consent_ads                           → context.consent.ad_storage
DLV — page_type                             → context.page.page_type
DLV — environment                           → context.environment
DLV — properties.integration_slug           → properties.integration_slug
DLV — properties.gate_id                    → properties.gate_id
DLV — properties.step_id                    → properties.step_id
DLV — properties.flow_version               → properties.flow_version
DLV — properties.mrr                        → properties.mrr
DLV — properties.currency                   → properties.currency
DLV — ecommerce                             → ecommerce
DLV — attribution.first_touch_source        → attribution.first_touch_source
```

Every one maps 1:1 to a schema path. No renaming, no transformation, no computed values — the container transports what the application declared.

### Lookup Tables · 4

```
LT — environment by hostname
    localhost, *.local                  → development
    staging.arclight.app                → staging
    arclight.app, app.arclight.app      → production
    (default)                           → development

LT — ga4 measurement id by environment
    development                         → G-DEVXXXXXXX
    staging                             → G-STGXXXXXXX
    production                          → G-PRDXXXXXXX

LT — consent region by country
    BE,NL,LU,DE,FR,ES,IT,PT,AT,IE,...   → eea_strict
    GB                                  → uk_strict
    CH                                  → ch_strict
    US-CA,US-VA,US-CO,US-CT             → us_state
    (default)                           → standard

LT — gads conversion label by event
    trial_started                       → AW-XXXXXXXXX/aaaaaaaa
    subscription_started                → AW-XXXXXXXXX/bbbbbbbb
    lead_captured                       → AW-XXXXXXXXX/cccccccc
```

**`LT — ga4 measurement id by environment` is the single control that prevents staging traffic reaching the production property.** Not a convention — a mechanism.

### Custom JavaScript · 2

```
CJS — sanitised page location     Strips PII and click-id parameters, removes the fragment
CJS — templated page path         Replaces id segments with {placeholders}
```

Two, both pure functions over the URL, both under twenty lines. Everything else is native.

---

## Server container · `GTM-ARCSRV`

**Endpoint:** `https://m.arclight.app` — an owned subdomain, so cookies it sets survive Safari ITP's 7-day cap on JS-set cookies.

### Clients

| Client | Purpose |
|---|---|
| `GA4 Client` | Receives web container traffic |
| `Measurement Protocol Client` | Receives backend and webhook events |

### Transformations · order matters

| # | Transformation | Applies to | Action |
|---|---|---|---|
| 1 | `strip pii from all events` | All | Removes any field matching PII patterns, unconditionally |
| 2 | `normalise currency` | Monetary events | Uppercases ISO 4217; drops the value if no currency present |
| 3 | `enrich account traits` | Authenticated events | Joins `plan_tier`, `seat_count`, `account_health_band` from the internal API |
| 4 | `dedup by event_id` | Tier 0 | Drops events with an `event_id` seen in the last 24h |

**Transformation 1 runs first and unconditionally.** It is the control that holds when every other control has failed — a misconfigured client tag, a rogue integration, a developer's temporary push. Defence in depth means the last line does not depend on the first.

### Server tags

| Tag | Destination | Consent required |
|---|---|---|
| `SGTM TAG — GA4` | GA4 | `analytics_storage` |
| `SGTM TAG — BigQuery streaming` | BigQuery | none — first-party, contractual basis |
| `SGTM TAG — GADS enhanced conversions` | Google Ads | `ad_storage`, `ad_user_data` |
| `SGTM TAG — META CAPI` | Meta | `ad_storage`, `ad_user_data`, `ad_personalization` |
| `SGTM TAG — LI CAPI` | LinkedIn | `ad_storage` |
| `SGTM TAG — HubSpot sync` | HubSpot | none — contractual basis |

Hashing for Enhanced Conversions and CAPI happens here, in `SGTM VAR — hashed email`, reading from the request body. The raw value already legitimately exists on the backend; it never enters a browser.

---

## Health metrics

Measured 2026-09-01.

| Metric | Value | Threshold | |
|---|---|---|---|
| Total tags | 41 | < 150 | ✅ |
| Tags fired in the last 30 days | 41 / 41 · 100% | > 85% | ✅ |
| Custom HTML tags | 2 | < 10 | ✅ |
| Custom HTML with business logic | 0 | 0 | ✅ |
| Unfoldered assets | 0 | 0 | ✅ |
| Naming conformance | 100% | ≥ 95% | ✅ |
| Tags with completed notes | 41 / 41 · 100% | ≥ 70% | ✅ |
| Tags with explicit consent declaration | 41 / 41 · 100% | 100% | ✅ |
| Container size | 214 KB | < 800 KB | ✅ |
| Open workspaces > 30 days | 0 | 0 | ✅ |
| Deprecated assets without a removal date | 0 | 0 | ✅ |

---

## Why 41 tags and not 150

| Consolidation | Naive count | Actual | Mechanism |
|---|---|---|---|
| Onboarding across 3 flows × 6 steps | 18 | 4 | Generic step model |
| Integrations across 19 providers | 19 | 1 | `integration_slug` property |
| CTAs across the estate | ~25 | 1 | `data-analytics-id` contract |
| Pipeline stage transitions | 7 | 1 | `stage_from` / `stage_to` |
| Export variants | 12 | 1 | `export_format` / `export_surface` |
| Server bridge per event | 24 | 3 | Trigger groups |
| **Total** | **105** | **11** | |

**Nothing was sacrificed.** Every question the naive container could answer, this one answers with less code, fewer failure points, and no change required when the product adds a stage, a format, or an integration.

That is what the architecture is for.

---

**See also:** [Container structure](../gtm-templates/container-structure.md) · [Example taxonomy](example-event-taxonomy.md) · [Tag flow diagrams](../gtm-templates/tag-flow-diagram.md)
