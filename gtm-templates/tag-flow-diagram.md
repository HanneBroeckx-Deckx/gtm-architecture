# Tag Flow Diagrams

Reference architecture, drawn. Every diagram here is implementable as-is and maps directly to the naming in [`container-structure.md`](container-structure.md).

---

## 1. End-to-end architecture

The four layers. Most estates fail because they conflate two of them.

```mermaid
flowchart TB
    subgraph L1["① Semantic layer — the contract"]
        SPEC["tracking-plan.json<br/>events · properties · tiers · owners"]
        TYPES["Generated TypeScript types"]
        SPEC --> TYPES
    end

    subgraph L2["② Emission layer — sources of truth"]
        APP["Web app<br/>track helper → dataLayer"]
        BE["Backend services<br/>post-commit emission"]
        MOB["Mobile clients"]
        WH["Webhooks<br/>billing · CRM · support"]
    end

    subgraph L3["③ Collection layer — governance"]
        CMP["Consent Management Platform"]
        GTMW["GTM web container<br/>consent gates · enrichment"]
        SGTM["Server-side GTM<br/>PII handling · fan-out"]
        CMP --> GTMW
        GTMW --> SGTM
        BE --> SGTM
        WH --> SGTM
    end

    subgraph L4["④ Consumption layer"]
        GA4["GA4"]
        BQ[("BigQuery<br/>source of record")]
        ADS["Ad platforms<br/>Google · Meta · LinkedIn"]
        CRM["CRM"]
        PA["Product analytics"]
        BI["BI / dashboards"]
    end

    TYPES -.compile-time check.-> APP
    TYPES -.compile-time check.-> BE
    APP --> GTMW
    MOB --> SGTM
    SGTM --> GA4
    SGTM --> BQ
    SGTM --> ADS
    SGTM --> CRM
    SGTM --> PA
    GA4 --> BQ
    BQ --> BI

    style L1 fill:#f8f8f8,stroke:#333,stroke-width:2px
    style L3 fill:#f8f8f8,stroke:#333,stroke-width:2px
    style BQ fill:#e8e8e8,stroke:#333,stroke-width:2px
```

**The dotted lines are the point.** The plan is not documentation *about* the implementation; it *generates* the types the implementation is checked against. That is what makes the contract enforceable rather than aspirational.

---

## 2. Consent gate

<a id="consent-gate"></a>

The order here is not a preference. It is the difference between a compliant implementation and a finding.

```mermaid
flowchart TD
    A["Page begins loading"] --> B["Consent Initialization trigger"]
    B --> C["HTML — consent defaults · priority 1000<br/>gtag consent default"]
    C --> D{"Region rule"}
    D -->|EEA / UK / CH| E["All storage: denied<br/>ads_data_redaction: true<br/>url_passthrough: true"]
    D -->|Other| F["Per local policy"]
    E --> G["CMP loads and reads stored choice"]
    F --> G
    G --> H{"Prior choice stored?"}
    H -->|Yes| I["gtag consent update<br/>with stored state"]
    H -->|No| J["Render banner"]
    J --> K{"User decides"}
    K -->|Accept all| L["All: granted"]
    K -->|Reject all| M["Defaults hold"]
    K -->|Custom| N["Per-purpose grant"]
    L --> O["gtag consent update"]
    N --> O
    M --> P["dataLayer.push consent_state_set"]
    I --> P
    O --> P
    P --> Q["Tags re-evaluate consent"]
    Q --> R{"Per-tag required types satisfied?"}
    R -->|Yes| S["Tag fires with full storage"]
    R -->|No, analytics| T["Cookieless ping<br/>GA4 models the gap"]
    R -->|No, advertising| U["Suppressed<br/>dispatch_status: dropped_no_consent"]

    style C fill:#e8e8e8,stroke:#333,stroke-width:2px
    style P fill:#e8e8e8,stroke:#333,stroke-width:2px
```

**Three failure modes this design eliminates:**

- **Defaults set too late.** Anything evaluating before the default is a cookie written without a basis. Priority 1000 on Consent Initialization is the only correct placement.
- **Denied ≠ silent.** `analytics_storage: denied` sends cookieless pings that feed GA4's modelling. Blocking the tag entirely throws that away.
- **Consent state unmeasured.** `consent_state_set` plus per-event `consent_*` snapshots mean a consent shift is visible as a consent shift, not as a mysterious 18% traffic drop.

---

## 3. Event lifecycle — from push to destinations

```mermaid
sequenceDiagram
    autonumber
    participant APP as Application
    participant DL as window.dataLayer
    participant GTM as GTM web container
    participant SGTM as Server container
    participant GA4 as GA4
    participant BQ as BigQuery
    participant ADS as Ad platform

    APP->>APP: User completes action
    APP->>APP: track() enriches with<br/>event_id · event_ts · context · consent
    Note over APP: Dev build validates<br/>against JSON Schema
    APP->>DL: push(event object)
    DL->>GTM: Custom Event trigger fires
    GTM->>GTM: Evaluate consent per tag
    alt analytics_storage granted
        GTM->>SGTM: Transport to server container
        SGTM->>SGTM: Global PII transform
        SGTM->>SGTM: Enrich from internal systems
        par Fan-out
            SGTM->>GA4: Measurement Protocol
            SGTM->>BQ: Streaming insert
        end
    else analytics_storage denied
        GTM->>GA4: Cookieless ping
        Note over GA4: Behavioural modelling
    end
    alt ad_storage AND ad_user_data granted
        SGTM->>SGTM: Hash match keys server-side
        SGTM->>ADS: Conversion API + event_id
        ADS-->>SGTM: Ack
        SGTM->>BQ: Log ad_conversion_reported
    else denied
        SGTM->>BQ: Log dispatch_status=dropped_no_consent
    end
    GA4-->>BQ: Daily export
    Note over BQ: Reconciliation:<br/>server truth vs GA4 vs platform
```

**Step 2 is where most implementations go wrong.** Enrichment happens in one helper, once. Enriching inside GTM means the server pipeline and the client pipeline disagree about what an event contains, and nobody notices until reconciliation.

**The final note is the discipline that keeps everyone honest.** Three systems will report three numbers. Reconciling them monthly turns "the platforms disagree" from an argument into a diagnosis.

---

## 4. Client/server deduplication

Tier 0 events fire from both sides on purpose: the client for real-time UX, the server for truth. Deduplication is what stops that from doubling your revenue.

```mermaid
flowchart TD
    A["Purchase completes"] --> B["Server mints event_id<br/>deterministic: sha256(order_id + 'purchase')"]
    B --> C["Server returns event_id<br/>in the API response"]
    C --> D["Client pushes purchase<br/>with the SAME event_id"]
    B --> E["Server emits purchase<br/>post-commit"]
    D --> F["GTM web → server container"]
    E --> G["Direct to server container"]
    F --> H{"Dedup window<br/>event_id seen in last 24h?"}
    G --> H
    H -->|First| I["Forward to all destinations"]
    H -->|Duplicate| J["Drop · increment dedup counter"]
    I --> K["GA4 · BigQuery · CAPI"]
    J --> L["Metric: dedup_rate<br/>expected 40–60% on Tier 0"]

    style B fill:#e8e8e8,stroke:#333,stroke-width:2px
    style H fill:#e8e8e8,stroke:#333,stroke-width:2px
```

**A deterministic `event_id` is what makes this work under replay.** `sha256(order_id + event_name)` is stable across a retried webhook, a page refresh, and a backfill. A random UUID minted independently on each side deduplicates nothing.

**Watch `dedup_rate` as a health metric.** On a Tier 0 event with dual emission it should sit near 50%. A sudden drop to 5% means the client stopped firing — before any dashboard shows a change in totals, because the server side is still covering.

---

## 5. Ecommerce funnel

```mermaid
flowchart LR
    A["view_item_list"] --> B["select_item"]
    B --> C["view_item"]
    C --> D["add_to_cart"]
    D --> E["view_cart"]
    E --> F["begin_checkout"]
    F --> G["add_shipping_info"]
    G --> H["add_payment_info"]
    H --> I["purchase"]
    I --> J["refund"]
    C -.-> D
    C -.-> K["add_to_wishlist"]
    D -.abandon.-> L["Remarketing audience"]
    F -.abandon.-> M["Abandoned checkout flow"]

    style I fill:#e8e8e8,stroke:#333,stroke-width:2px
```

Every solid transition requires `ecommerce: null, _clear: true` on the push immediately before it. Every one. The dataLayer merges, and a stale `items` array attributed to the next event is the single most common cause of inflated ecommerce revenue.

---

## 6. Server-side tagging topology

```mermaid
flowchart TB
    subgraph CLIENT["Client sources"]
        W["Web · GTM web container"]
        M["Mobile SDKs"]
        A["Backend services"]
        H["Webhooks · Stripe, CRM, support"]
    end

    subgraph SGTM["Server container — analytics.yourdomain.com"]
        CL["Clients<br/>GA4 · Measurement Protocol · custom"]
        TR["Transformations<br/>① strip PII ② normalise ③ enrich"]
        VAR["Variables<br/>hashing · lookups · secrets"]
        TAGS["Tags<br/>GA4 · CAPI · BigQuery · CRM"]
        CL --> TR --> TAGS
        VAR -.-> TAGS
    end

    subgraph DEST["Destinations"]
        G["GA4"]
        B[("BigQuery")]
        AD["Ad platforms"]
        C["CRM"]
    end

    W --> CL
    M --> CL
    A --> CL
    H --> CL
    TAGS --> G
    TAGS --> B
    TAGS --> AD
    TAGS --> C

    style TR fill:#e8e8e8,stroke:#333,stroke-width:2px
```

**Three things this topology buys you that a web-only container cannot:**

1. **A same-site first-party endpoint.** Cookies set from `analytics.yourdomain.com` survive Safari ITP's 7-day cap on JS-set cookies. A subdomain of your own domain, not a vendor's.
2. **PII never touches the browser.** Hashing for Enhanced Conversions and CAPI happens where the raw value already legitimately lives.
3. **One emission, many destinations.** Adding a platform is a tag in the server container, not a script on every page and another 40 KB of client payload.

Transformation ① runs first and unconditionally. It is the control that holds when everything upstream fails.

---

## 7. Degradation model

What actually reaches your reports, and what each mitigation recovers.

```mermaid
flowchart TD
    A["100 real events occur"] --> B{"Client-side JS runs?"}
    B -->|"No — blocker, 5–30%"| C["Lost to client collection"]
    B -->|Yes| D{"Consent granted?"}
    D -->|"No — 20–50% in EEA"| E["Cookieless ping<br/>GA4 models the gap"]
    D -->|Yes| F{"Request reaches endpoint?"}
    F -->|"No — network, ~1–3%"| G["Lost"]
    F -->|Yes| H["Collected client-side"]

    C --> I{"Server-side emission exists?"}
    G --> I
    I -->|Yes| J["Recovered — full fidelity"]
    I -->|No| K["Permanently lost"]

    H --> L["Reported"]
    E --> M["Modelled — directional only"]
    J --> L

    style J fill:#e8e8e8,stroke:#333,stroke-width:2px
    style K fill:#f0f0f0,stroke:#999,stroke-dasharray: 4 4
```

**The architectural conclusion is one sentence:** Tier 0 events are emitted server-side, because that is the only branch that ends at "full fidelity".

**The reporting conclusion is the other sentence:** report the collection rate alongside the metric. "Signups down 12%" and "measured signups down 12% while consent grant fell 9 points" are different findings, and only one of them is true.

---

## 8. Change deployment flow

```mermaid
flowchart LR
    A["Event RFC<br/>governance/event-rfc-template.md"] --> B["PR to tracking-plan.json"]
    B --> C{"CI validation"}
    C -->|Fail| B
    C -->|Pass| D["Spec review<br/>owner + architect"]
    D --> E["Implementation<br/>app code + GTM workspace"]
    E --> F["Preview mode<br/>+ GA4 DebugView"]
    F --> G{"QA gate 2<br/>see qa-process.md"}
    G -->|Fail| E
    G -->|Pass| H["Version + name<br/>publish to staging"]
    H --> I["Staging soak · 24h"]
    I --> J{"QA gate 3<br/>pre-publish diff"}
    J -->|Fail| E
    J -->|Pass| K["Publish to live"]
    K --> L["Gate 4 · 24h live confirmation"]
    L -->|Anomaly| M["Roll back to named version"]
    L -->|Clean| N["Close · update CHANGELOG"]

    style C fill:#e8e8e8,stroke:#333,stroke-width:2px
    style M fill:#f0f0f0,stroke:#999,stroke-dasharray: 4 4
```

Rollback is a named version, restored in under a minute. That is the entire reason every version gets a description — it is the only thing that makes the rollback decision fast enough to be useful.

---

**See also:** [Container structure](container-structure.md) · [QA process](qa-process.md) · [Marketing events — consent](../event-taxonomy/marketing-events.md#4-consent)
