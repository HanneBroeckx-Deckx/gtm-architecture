# Common Risks

Twenty-four failure patterns, ordered by how much damage they do before anyone notices.

Each carries a symptom, a mechanism, a detection method, and a fix. The detection column is the useful part — most of these are invisible in the reports they corrupt.

---

## Legend

| | |
|---|---|
| **P0** | Legal exposure, revenue misreporting, or active data loss |
| **P1** | Decisions are being made on wrong numbers |
| **P2** | Correct but fragile, expensive, or unmaintainable |

---

## R-01 · Consent defaults set after tags evaluate · **P0**

**Symptom** Cookies appear in a clean browser profile before any banner interaction.
**Mechanism** The consent default tag fires on All Pages or Initialization instead of Consent Initialization, or at a priority below the measurement tags. GTM evaluates in priority order within a trigger, and Consent Initialization is a separate, earlier phase.
**Detection** Clean browser profile → load the site → open Application → Cookies before touching the banner. Any `_ga`, `_fbp`, `_gcl_au` is a finding.
**Fix** Move the default tag to the Consent Initialization trigger at priority 1000. Verify all four Consent Mode v2 signals are set in the same call.
**Cost of not fixing** A regulatory finding, and every EU visitor's data collected without a lawful basis.

---

## R-02 · PII in the data layer · **P0**

**Symptom** Email addresses, names, or tokens visible in `window.dataLayer` or in outbound tag payloads.
**Mechanism** A developer needed a value for a form integration and pushed it "temporarily". Or a URL with `?email=` reaches `page_location` unsanitised. Or a `DOM` variable scrapes a node containing user content.
**Detection** `JSON.stringify(window.dataLayer)` in the console, searched for `@`. Then repeat across ten journeys, and check every outbound request payload in DevTools.
**Fix** Remove it, sanitise URLs in the collection layer, add a `SGTM TRANSFORM — strip pii from all events` global transformation as defence in depth, and add a runtime PII check to the dev build.
**Cost of not fixing** Personal data shared with every third-party tag on the page, indefinitely, with no way to recall it.

---

## R-03 · Missing `_clear` on ecommerce pushes · **P0** where ecommerce exists

**Symptom** Revenue is 10–40% higher in GA4 than in the order system. Item counts inflate over a session.
**Mechanism** The dataLayer is a merged persistent object. Without `{ ecommerce: null, _clear: true }` before the next push, the previous `items` array is still present and gets attributed to the following event.
**Detection** Add three items to a cart, view the cart, then inspect the `view_cart` push. If it contains items from the `view_item` events, you have it.
**Fix** A clearing push before every ecommerce push, in the shared helper so nobody has to remember.
**Cost of not fixing** Overstated revenue, corrupted ROAS, and paid media budgets allocated against inflated returns.

---

## R-04 · Client-side-only Tier 0 collection · **P0**

**Symptom** Analytics revenue is 10–30% below the billing system, consistently.
**Mechanism** Ad blockers, ITP, closed tabs mid-request, and network failures each take a slice of client-side collection. On consumer traffic this reaches 30%.
**Detection** Reconcile 90 days of `purchase` or `subscription_started` against the source of record. Then repeat the journey with uBlock Origin enabled and watch the event vanish.
**Fix** Emit Tier 0 events from the backend, post-commit, with a deterministic `event_id`. Keep the client event for real-time UX and deduplicate.
**Cost of not fixing** Every revenue-linked decision is made on a number that is systematically wrong by an unknown and drifting amount.

---

## R-05 · Client-side hashing for Enhanced Conversions / CAPI · **P0**

**Symptom** SHA-256 hashes of email addresses present in browser network requests.
**Mechanism** Someone followed a platform quickstart that assumed a simpler compliance context.
**Detection** Search outbound tag payloads for 64-character hex strings.
**Fix** Move hashing server-side. The raw value already legitimately exists on your backend; that is where it should be hashed and dispatched.
**Cost of not fixing** Hashed personal data is still personal data. A client-side hash is reversible by dictionary attack for any common address, and it is visible to every script on the page.

---

## R-06 · No client/server deduplication · **P0**

**Symptom** Conversions roughly double after server-side tagging is introduced.
**Mechanism** Both sides emit the same event with independently minted identifiers, so nothing can match them.
**Detection** Compare event volume before and after the server-side rollout. Check whether `event_id` is identical across the two paths for the same action.
**Fix** Derive `event_id` deterministically server-side — `sha256(order_id + event_name)` — return it in the API response, and have the client use the same value. Monitor `dedup_rate`.
**Cost of not fixing** Doubled revenue in every destination, and ad platforms optimising against phantom conversions.

---

## R-07 · Currency missing or mixed · **P0** in multi-currency estates

**Symptom** GA4 revenue is far below expectation, or wildly inconsistent between reports.
**Mechanism** A `value` without a `currency` sibling, or a currency code in the wrong case or format. GA4 discards revenue it cannot attribute to a currency, silently.
**Detection** Query BigQuery for events with a value and no currency. Check the case of every currency code.
**Fix** Enforce the pairing in the schema (`dependentRequired`) and in CI. ISO 4217, uppercase, always.
**Cost of not fixing** Revenue reporting that is quietly incomplete, in a way no dashboard indicates.

---

## R-08 · Attribution re-derived at conversion time · **P1**

**Symptom** Direct and branded search take an implausible share of conversions. Paid channels appear to underperform.
**Mechanism** The conversion tag reads the current session's source rather than a stored first-touch envelope. A user who arrives from LinkedIn, returns three days later by typing the URL, and converts is credited to Direct.
**Detection** Compare the direct share of conversions to the direct share of sessions. A large gap in favour of conversions indicates this.
**Fix** Capture the attribution envelope at first touch, persist it on the account row, attach it server-side at conversion.
**Cost of not fixing** Paid budget cut on channels that are actually working.

---

## R-09 · Self-referrals and payment-gateway referrals · **P1**

**Symptom** Your own domain, or Stripe/PayPal/Adyen/an SSO provider, appears as a top traffic source.
**Mechanism** A cross-domain hop starts a new session and attributes it to the referrer.
**Detection** GA4 → Traffic acquisition → look for your own domains and payment providers in the source list.
**Fix** Add every owned domain, payment provider, and identity provider to the unwanted referrals list. Configure cross-domain measurement for genuinely owned properties.
**Cost of not fixing** Sessions fragmented at exactly the moment of conversion, and attribution assigned to your own checkout.

---

## R-10 · CSS-selector click tracking · **P2**

**Symptom** A conversion metric drops to zero after a frontend release. Nobody notices for a fortnight.
**Mechanism** GTM matches on a class or DOM position that the redesign changed.
**Detection** Diff tag firing volume against release dates. Search the container for triggers matching `.class` or `#id`.
**Fix** The `data-analytics-id` contract, owned by the component library. The attribute is code; breaking it shows up in code review.
**Cost of not fixing** Silent, recurring breakage on a cycle you do not control.

---

## R-11 · Duplicate page views in SPAs · **P1**

**Symptom** Pageviews roughly double, bounce rate collapses to near zero, session duration inflates.
**Mechanism** Both GA4's enhanced measurement and a History Change trigger fire on route changes.
**Detection** Navigate three routes in Preview mode and count `page_view` events. Expect three.
**Fix** Pick one mechanism. For SPAs, disable enhanced measurement page views and fire explicitly on route change, after the route has settled.
**Cost of not fixing** Every engagement metric is wrong by roughly 2×, in a direction that flatters.

---

## R-12 · High-cardinality property as a GA4 custom dimension · **P1**

**Symptom** Reports show a large `(other)` row. Historical detail is unrecoverable.
**Mechanism** GA4 aggregates beyond its cardinality thresholds. Once aggregated, the underlying values are gone from the reporting layer.
**Detection** GA4 exploration on the dimension. Look for `(other)`.
**Fix** Unregister the dimension. Route the identifier to BigQuery, where cardinality is not a constraint. Register a banded or classified version instead.
**Cost of not fixing** A permanently degraded dimension, and a slot from your 50 consumed by it.

---

## R-13 · Internal and bot traffic included · **P1**

**Symptom** Engagement metrics that flatter. Conversion rates that do not match reality. Traffic spikes matching your own release schedule.
**Mechanism** Internal traffic filter left in "testing" mode after setup — GA4's default state, and it does nothing until activated.
**Detection** GA4 → Admin → Data filters. Check the state, not just the existence.
**Fix** Activate the filter. Add an `is_internal` flag set server-side from the user record, which survives VPNs and home working in a way IP ranges do not.
**Cost of not fixing** Every rate metric is inflated by your own team's activity.

---

## R-14 · Silent event redefinition · **P1**

**Symptom** A metric steps on a specific date with no corresponding business event.
**Mechanism** Someone changed a trigger condition, a filter, or a parameter mapping while keeping the event name.
**Detection** Overlay the container's version history on the metric's time series. Steps that align with publish dates are this.
**Fix** Retroactively: annotate the break and never compare across it without a note. Prospectively: a change to an event's meaning requires a new name and a dual-running period.
**Cost of not fixing** Trust in the entire dataset, which is much harder to rebuild than any pipeline.

---

## R-15 · No event ownership · **P2**

**Symptom** An event stops firing. Nobody notices for six weeks. Nobody can say what it meant.
**Mechanism** Events accumulate through ad-hoc requests without an owner ever being recorded.
**Detection** Ask for the owner of five randomly chosen events. Count how many produce a name.
**Fix** An owner column in the plan, enforced by CI. Unclaimed events are deprecated.
**Cost of not fixing** A tracking plan that decays continuously with no mechanism to stop it.

---

## R-16 · Business logic in Custom HTML tags · **P2**

**Symptom** Nobody can explain what a tag does. It cannot be tested, reviewed, or safely changed.
**Mechanism** GTM makes it easy to ship JavaScript without code review, so business logic migrates there.
**Detection** Count Custom HTML tags. Read them. Any with conditionals, loops, or calculations are findings.
**Fix** Move logic into the application, where it is versioned, tested, and reviewed. GTM should transport, not compute.
**Cost of not fixing** Unversioned, untested, invisible logic that determines what your numbers mean.

---

## R-17 · Name explosion · **P2**

**Symptom** 300+ events. Most fired fewer than ten times last month. Nobody can find the ones that matter.
**Mechanism** Every request answered with a new event instead of a new property.
**Detection** Query 90 days of events by name. Count how many are below 100 occurrences.
**Fix** Consolidate variants into one event with properties. Deprecate the originals with a dual-running period.
**Cost of not fixing** An unusable schema and analysts who take three times as long to answer anything.

---

## R-18 · Hardcoded environment identifiers · **P1**

**Symptom** Staging and development traffic in the production property. Test purchases in revenue reports.
**Mechanism** A measurement ID written as a constant instead of resolved from hostname.
**Detection** Search the container for `G-` and `AW-` constants. Check GA4 for hostnames that are not production.
**Fix** A hostname lookup table resolving the environment, and a second table resolving IDs per environment.
**Cost of not fixing** Production data permanently contaminated with test activity.

---

## R-19 · No monitoring on Tier 0 events · **P1**

**Symptom** An event stops firing on a Friday. Discovered on Tuesday. Four days of revenue data lost.
**Mechanism** No freshness or volume alerting exists, so absence is invisible — dashboards keep rendering with fewer rows.
**Detection** Ask what would happen if `purchase` stopped firing right now. Time the answer.
**Fix** Hourly freshness checks and volume anomaly alerts on every Tier 0 event, configured before the change ships.
**Cost of not fixing** Data loss measured in days, and it is never fully recoverable.

---

## R-20 · Consent-denied traffic invisible rather than measured · **P1**

**Symptom** An unexplained traffic drop after a CMP change. No way to tell whether behaviour or measurement changed.
**Mechanism** Tags are fully blocked on denial instead of using Consent Mode's cookieless pings, and consent state is not snapshotted onto events.
**Detection** Ask for the consent grant rate trend. If it does not exist, this is present.
**Fix** Enable Consent Mode properly, fire `consent_state_set`, snapshot `consent_analytics` and `consent_ads` onto every event.
**Cost of not fixing** Every trend line confounds a consent shift with a behaviour change, permanently and invisibly.

---

## R-21 · Reserved GA4 names redefined · **P1**

**Symptom** `purchase` or `session_start` behaves unexpectedly. Standard reports show numbers nobody recognises.
**Mechanism** A reserved or recommended event name reused for a different meaning.
**Detection** Compare the event list against GA4's reserved and recommended names, then check the definitions.
**Fix** Rename the custom usage. Where a recommended event genuinely fits, map to it properly.
**Cost of not fixing** GA4's built-in reporting silently misrepresents your business.

---

## R-22 · Parameter values silently truncated · **P1**

**Symptom** Dimension values cut off at 100 characters. No error anywhere.
**Mechanism** GA4 truncates rather than rejects, and reports nothing.
**Detection** Query BigQuery for string parameters of exactly 100 characters.
**Fix** Enforce length limits in CI against the plan. Move long values to BigQuery; register classified or banded versions in GA4.
**Cost of not fixing** Dimensions that look populated and are quietly wrong.

---

## R-23 · Publish rights held by too many people · **P2**

**Symptom** Changes appear in production that nobody in the meeting made.
**Mechanism** Publish permissions granted broadly during a project and never revoked.
**Detection** GTM → Admin → User Management. Count users with Publish rights.
**Fix** Reduce to four or fewer named publishers. Review access every six months.
**Cost of not fixing** Unreviewed changes to production measurement, with no gate and no audit trail anyone reads.

---

## R-24 · Activation defined but never versioned · **P1**

**Symptom** The activation rate trend shows steps that correlate with nothing. Two teams quote different numbers.
**Mechanism** The definition was refined three times and the metric was recomputed historically each time, or was not.
**Detection** Ask two people to state the activation definition. Compare.
**Fix** Version the definition, carry `activation_definition_version` on the event, and never compare across versions without an annotation.
**Cost of not fixing** The single most-quoted number in a PLG company means something different in every deck it appears in.

---

## The pattern underneath

Nineteen of these twenty-four fail **silently**. Nothing errors, no dashboard shows a gap, and the numbers keep rendering with confident precision.

That is the argument for the whole discipline in this repository: schema validation in CI, monitoring before publish, reconciliation against a source of record, and a QA gate the implementer does not pass themselves. Not because measurement is fragile — because it fails quietly, and quiet failures are the expensive ones.

---

**See also:** [Audit checklist](../gtm-templates/audit-checklist.md) · [Quick wins](quick-wins.md) · [QA process](../gtm-templates/qa-process.md) · [Tracking principles](../philosophy/tracking-principles.md)
