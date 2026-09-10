# Data Layer Naming Rules

The implementation contract between the frontend team, the backend team, and the measurement layer. Where [`../event-taxonomy/event-naming-conventions.md`](../event-taxonomy/event-naming-conventions.md) governs *what things are called*, this file governs *how they are structured, pushed, and protected*.

Three schemas enforce it: [`saas-schema.json`](saas-schema.json), [`ecommerce-schema.json`](ecommerce-schema.json), [`product-schema.json`](product-schema.json).

---

## 1. The push contract

**One push. One event. One complete object.**

```js
// ✅ Correct — self-contained, complete, one event
window.dataLayer.push({
  event: 'workspace_created',
  event_id: crypto.randomUUID(),
  event_ts: new Date().toISOString(),
  context: { /* ... */ },
  user:    { /* ... */ },
  account: { /* ... */ },
  properties: {
    workspace_id: 'ws_71ad3c',
    creation_method: 'template',
    workspace_index: 1
  }
});
```

```js
// ❌ Wrong — state seeding, then a bare event.
// The tag reads whatever the dataLayer merged into, which is
// whatever the last five pushes left behind.
window.dataLayer.push({ workspace_id: 'ws_71ad3c' });
window.dataLayer.push({ event: 'workspace_created' });
```

The second pattern works in development, passes QA, and fails in production the moment a user does two things on one page. The dataLayer is a **merged, persistent** object — GTM's model, not a queue of independent messages — so anything you push stays visible to every later event until something overwrites it.

### The `_clear` discipline

Because of that merge behaviour, nested payloads must be explicitly cleared:

```js
window.dataLayer.push({ ecommerce: null, _clear: true });   // clear first
window.dataLayer.push({ event: 'purchase', ecommerce: { /* ... */ } });
```

**Omitting this is the single most common cause of inflated ecommerce revenue.** The previous `items` array persists and gets attributed to the next event. It looks like growth. It is not.

---

## 2. Structure rules

| Rule | Specification |
|---|---|
| Nesting depth | Maximum 2 levels (`context.page.page_type`). Deeper structures do not survive GA4 parameter flattening |
| `properties` values | Scalars only — string, number, integer, boolean, null |
| Arrays | Only `ecommerce.items`. Everywhere else, use a comma-joined string with a documented delimiter |
| Absent values | **Omit the key.** Never `null`, `""`, `"undefined"`, `"N/A"`, `0` as a stand-in for missing |
| Key naming | `snake_case`, `^[a-z][a-z0-9_]{1,39}$`, matching the schema exactly |
| Unknown keys | `additionalProperties: false` on every object. An undeclared key is a defect, not a feature |
| Types | Stable forever. `"1"` and `1` are different values in BigQuery and a type change breaks every downstream cast |

**Why no arrays outside `items`.** GA4 flattens parameters; an array becomes an unparseable string or is dropped. `roles: ["admin","editor"]` becomes `roles: "admin,editor"` with a documented delimiter, or it becomes three booleans. Decide once, write it in the plan.

**Why omit rather than null.** `null` and absent are the same thing to a human and different things to `COUNT()`, `IS NULL`, and every BI tool's default filter behaviour. Pick the one that carries no information: absence.

---

## 3. Type discipline

| Concept | Type | Format | Example |
|---|---|---|---|
| Identifiers | `string` | Always. Even numeric ones | `"00042"` not `42` |
| Counts | `integer` | ≥ 0 | `member_count: 3` |
| Money | `number` | Decimal in major units, always with `currency` | `value: 49.00`, `currency: "EUR"` |
| Currency | `string` | ISO 4217, uppercase | `"EUR"` |
| Country | `string` | ISO 3166-1 alpha-2, uppercase | `"BE"` |
| Locale | `string` | BCP 47 | `"nl-BE"` |
| Timestamps | `string` | ISO 8601 UTC, ms precision, `Z` suffix | `"2026-09-09T14:32:11.482Z"` |
| Durations | `integer` | Unit in the key name | `duration_ms: 4820` |
| Booleans | `boolean` | Not `"true"`, not `1`, not `"yes"` | `is_trial: true` |
| Percentages | `integer` | 0–100 scale, suffix `_pct` | `scroll_depth_pct: 75` |
| Enums | `string` | Lowercase snake_case, closed set | `"bank_transfer"` |

**Money, specifically.** Decimal major units (`49.00`) rather than integer minor units (`4900`), because that is what GA4, Google Ads, and Meta all expect, and one conversion at the boundary beats a conversion in every destination. A monetary value without a sibling `currency` is a CI failure, not a warning — GA4 discards revenue with missing or mixed currency and does so without telling you.

**Local time is never acceptable.** A timestamp without a timezone is a defect that surfaces twice a year at the DST boundary and is nearly impossible to diagnose after the fact.

---

## 4. PII rules

**The data layer is world-readable.** Every third-party script on the page can read `window.dataLayer`, including tags loaded by the tags you installed. Treat it as a public log.

### Never, under any circumstances

```
✗ Email address (raw, encoded, or hashed)
✗ Full name, first name, last name
✗ Phone number
✗ Street address, postcode, precise geolocation
✗ IP address
✗ Date of birth, national identifiers
✗ Payment details, including last four digits
✗ Session tokens, API keys, CSRF tokens
✗ Free-text user input — search queries, comments, form messages, file names
✗ Any URL parameter carrying the above
```

**Hashing does not make it safe.** A client-side hash is reversible by dictionary attack for any common value, it is still personal data under GDPR, and it still ends up in every third-party tag's payload. If a destination requires a hashed match key — Enhanced Conversions, Meta CAPI — that hash is produced server-side and dispatched server-side.

### Allowed

```
✓ Opaque analytics identifiers (user_id, account_id) with no personal meaning
✓ Domain classifications  (email_domain_type: "business")
✓ Banded values  (company_size_band: "51_200", ltv_band: "501_2000")
✓ Coarse geography  (billing_country: "BE")
✓ Enumerated attributes  (plan_tier, user_role, industry)
✓ Field NAMES  (settings_changed_keys: "notify_email,notify_slack")
```

The pattern throughout: **classify, band, or enumerate — never transmit the raw value.**

### URL sanitisation

Before any URL reaches the data layer:

```js
const STRIP = new Set([
  // PII-bearing
  'email','e','mail','user','username','name','phone','tel','token','auth',
  'session','key','password','pwd','otp','code','reset','invite_email',
  // Click ids — consent-gated, handled server-side
  'gclid','wbraid','gbraid','fbclid','msclkid','li_fat_id','ttclid','twclid',
  // Session-splitting noise
  '_ga','_gl','mc_eid','mc_cid','vero_id','hsa_cam'
]);

function sanitizeUrl(raw) {
  const url = new URL(raw);
  [...url.searchParams.keys()].forEach(k => {
    if (STRIP.has(k.toLowerCase())) url.searchParams.delete(k);
  });
  url.hash = '';                     // fragments carry tokens in SPA auth flows
  return url.toString();
}
```

Run this in the collection layer, not in individual tags. A sanitiser applied in twelve places is a sanitiser missing from one.

### Path templating

```
❌  /workspaces/ws_71ad3c/items/it_9f2b/edit
✅  /workspaces/{workspace_id}/items/{item_id}/edit
```

Populated paths carry identifiers, explode cardinality, and produce a `page_path` dimension with a million distinct values and no analytical use. Template them at the source.

---

## 5. Naming across the boundary

The frontend must not invent names. Three contracts make that enforceable:

### The `data-analytics-id` contract

Every trackable element carries a stable attribute, owned by the component library:

```html
<button
  data-analytics-id="cta_start_trial"
  data-analytics-location="hero"
  data-analytics-variant="b">
  Start free trial
</button>
```

GTM reads the attribute. It never reads a CSS class, a DOM position, or the button's text.

**Why this matters more than it sounds.** CSS-selector-based tracking breaks silently on every redesign, and you find out weeks later when a conversion rate looks odd. The attribute contract costs the frontend team one line per element and moves the breakage into code review, where it belongs.

### The push helper

Nobody calls `dataLayer.push` directly. One typed helper, in the shared package:

```ts
type AnalyticsEvent = {
  event: EventName;                       // union type generated from tracking-plan.json
  properties?: Record<string, Scalar>;
};

export function track(evt: AnalyticsEvent): void {
  const enriched = {
    ...evt,
    event_id: crypto.randomUUID(),
    event_ts: new Date().toISOString(),
    context: buildContext(),              // page, device, consent, app version
    user: getUserContext(),               // undefined when unauthenticated
    account: getAccountContext()
  };
  if (process.env.NODE_ENV !== 'production') validateAgainstSchema(enriched);
  window.dataLayer.push(enriched);
}
```

Three things fall out of this for free: the event name is type-checked against the plan at compile time, context can never be forgotten, and the dev-mode validator catches schema violations before code review.

### Generated types

`EventName` and the property types are **generated from `tracking-plan.json`**, not maintained by hand. A typo becomes a build failure rather than a missing dimension discovered in a report six weeks later.

```bash
node tooling/generate-types.mjs > packages/analytics/src/generated.ts
```

---

## 6. Server-side rules

Server events do not use `window.dataLayer`. They POST to the collection endpoint directly.

| Rule | Reason |
|---|---|
| `event_id` derived deterministically from `(entity, id, transition)` | Makes replay idempotent. A retried webhook must not double-count revenue |
| `event_ts` = when the transition happened, not when it was dispatched | Queued and batched emission otherwise smears your funnels |
| Emit **after** the transaction commits | An event for a rolled-back write is worse than no event |
| Never emit from a client for a Tier 0 event | Blockers, ITP and closed tabs make client-side collection best-effort by construction |
| `source.is_backfill = true` on every historical replay | Every metric must be able to exclude backfills, or a migration looks like a growth spike |
| `actor_type = support_impersonation` excluded from all product metrics | Otherwise your support team inflates your engagement numbers |

---

## 7. Validation

Three gates, from fastest to slowest feedback:

| Gate | Where | What it catches | Blocking |
|---|---|---|---|
| **Type check** | Developer's editor / build | Unknown event names, wrong property types | ✓ |
| **Runtime validator** | Browser, dev + staging only | Schema violations, missing context, PII patterns | Console error |
| **CI schema check** | Pull request | Plan drift, undeclared events, budget breaches | ✓ |

The runtime validator is stripped from production builds. It exists to fail loudly in front of the developer who introduced the problem, at the moment they introduce it.

```js
// dev-only, ~30 lines with a JSON Schema validator
if (import.meta.env.DEV) {
  const errors = validate(payload, saasSchema);
  if (errors.length) {
    console.error('[analytics] schema violation', { event: payload.event, errors });
  }
}
```

---

## 8. Change management

The data layer is a **published API** with three consumers: the GTM container, the server-side pipeline, and the warehouse. Changes follow the same discipline as any other API.

| Change | Breaking? | Process |
|---|---|---|
| Adding an optional property | No | PR review |
| Adding a required property | **Yes** | RFC + dual-running period |
| Removing a property | **Yes** | Deprecate → 60-day sunset → remove |
| Changing a property's type | **Yes** | New property name; never mutate a type in place |
| Adding an enum value | No, but | Downstream filters may silently exclude it — announce it |
| Removing an enum value | **Yes** | Deprecate; keep historical values meaningful forever |
| Renaming anything | **Yes** | New name + dual-run + migration; never a rename in place |

Full process: [`../governance/ownership-and-versioning.md`](../governance/ownership-and-versioning.md).

---

**See also:** [Event naming conventions](../event-taxonomy/event-naming-conventions.md) · [QA process](../gtm-templates/qa-process.md) · [Common risks](../audits/common-risks.md)
