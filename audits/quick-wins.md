# Quick Wins

Eighteen changes that take under a day and move something measurable.

Ordered by impact-per-hour. Everything here is safe to do before the strategic work starts — and doing three of them in week one is usually what buys the mandate for the rest.

**Reading the table:** *Effort* is elapsed time for someone with access. *Impact* is what actually changes.

---

## Under an hour

### QW-01 · Activate the internal traffic filter
**Effort** 10 min · **Impact** Every rate metric becomes real

GA4 ships the internal traffic filter in "testing" mode, where it does nothing. Most estates never activate it.

**Do it:** GA4 → Admin → Data Settings → Data Filters → set to Active. Verify the IP ranges are current — remote work has made most of them stale.
**Better:** add an `is_internal` boolean set server-side from the user record. It survives VPNs, home offices, and mobile networks in a way IP ranges do not.

---

### QW-02 · Complete the unwanted referrals list
**Effort** 15 min · **Impact** Attribution stops crediting your own checkout

Payment gateways, SSO providers, and your own subdomains each start a new session and steal the conversion.

**Do it:** GA4 → Admin → Data Streams → Configure tag settings → List unwanted referrals. Add every payment provider (Stripe, PayPal, Adyen, Mollie, Bancontact), every identity provider, every owned domain, and any help-desk or docs subdomain.
**Check first:** Traffic acquisition → Session source. Anything in that list that you own or pay for is the finding.

---

### QW-03 · Set data retention to the maximum
**Effort** 2 min · **Impact** Recovers 12 months of explorable history

GA4's default retention on standard properties is 2 months. Almost nobody wants that, and it cannot be recovered retroactively.

**Do it:** GA4 → Admin → Data Settings → Data Retention → 14 months. Enable "Reset user data on new activity".
**Note:** this affects explorations and the Data API, not standard aggregate reports. It is still the single cheapest change in this document.

---

### QW-04 · Enable the BigQuery export
**Effort** 20 min · **Impact** Your data stops being GA4's and starts being yours

Free on standard properties, and the export only ever contains data from the day it was enabled forward. Every day you wait is a day you cannot get back.

**Do it:** GA4 → Admin → Product Links → BigQuery → link, choose daily **and** streaming, select event-level export.
**Even if you have no immediate use for it.** Enable it today, decide what to do with it later.

---

### QW-05 · Name your last container version
**Effort** 5 min · **Impact** You gain a rollback target

`Version 47` is not something anyone will restore under pressure at 17:00 on a Friday.

**Do it:** GTM → Versions → rename the current live version to `YYYY-MM-DD — summary — scope`. Then do it for every version from here on.

---

### QW-06 · Pause debug tags in production
**Effort** 10 min · **Impact** Removes console noise, weight, and occasionally a data leak

**Do it:** search the container for `debug`, `test`, `console`, `tmp`, `temp`. Pause anything that is not intentionally live. Move it to a `90 — Diagnostics` folder so it stays findable.

---

### QW-07 · Verify consent defaults fire first
**Effort** 20 min · **Impact** Closes the most common compliance gap

**Do it:** open a clean browser profile → load the site → open DevTools → Application → Cookies **before touching the banner**. Any `_ga`, `_fbp`, or `_gcl_au` present is a P0 finding.
**Fix:** move the consent default tag to the Consent Initialization trigger, priority 1000.

---

### QW-08 · Reduce publish permissions
**Effort** 15 min · **Impact** Unreviewed production changes stop happening

**Do it:** GTM → Admin → User Management. Count Publish rights. Reduce to four named individuals. Everyone else gets Edit and Approve.

---

## Under half a day

### QW-09 · Find your zombie events
**Effort** 1 h · **Impact** Reveals the real size of the plan

```sql
SELECT event_name,
       COUNT(*)                     AS events_90d,
       COUNT(DISTINCT user_pseudo_id) AS users_90d,
       MAX(event_date)              AS last_seen
FROM `project.analytics_XXXXXX.events_*`
WHERE _TABLE_SUFFIX BETWEEN
      FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY))
  AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
GROUP BY event_name
ORDER BY events_90d ASC;
```

Everything under 100 events in 90 days is either broken or unnecessary. Both need a decision. This query is usually the most uncomfortable slide in the audit deck, and the most persuasive.

---

### QW-10 · Reconcile one Tier 0 event
**Effort** 2 h · **Impact** Establishes whether anyone should trust the numbers

Pick `purchase` or `subscription_started`. Count 90 days in the analytics stack. Count 90 days in the billing system. Compare.

| Gap | Verdict |
|---|---|
| < 2% | Healthy |
| 2–10% | Client-side collection loss. Fixable with server-side emission |
| 10–30% | Blockers and consent. Server-side is required, not optional |
| > 30% | Something structural is broken. Stop and find it |

This single number reframes every subsequent conversation.

---

### QW-11 · Run the ad-blocker test
**Effort** 30 min · **Impact** Shows exactly what you are not measuring

**Do it:** install uBlock Origin in a fresh profile. Walk a full conversion journey. Note which events survive.
Everything that disappears is a client-side-only event, and if any of them are Tier 0, you have found your reconciliation gap.

---

### QW-12 · Register your missing custom dimensions
**Effort** 2 h · **Impact** Parameters you already collect become reportable

Most estates send parameters that were never registered, so they are collected and invisible.

**Do it:** query BigQuery for distinct parameter keys, compare against GA4 → Admin → Custom definitions, register the gaps.
**Careful:** registration is not retroactive — dimensions populate from the day they are registered. And check cardinality before registering, or you will burn a slot on a dimension that turns into `(other)`.

---

### QW-13 · Fix duplicate SPA page views
**Effort** 2 h · **Impact** Engagement metrics stop being wrong by 2×

**Detect:** navigate three routes in Preview and count `page_view` events. Three is correct.
**Fix:** disable GA4 enhanced measurement page views, fire explicitly on route change after the route settles. Or keep enhanced measurement and remove the History Change trigger. One mechanism, not two.

---

### QW-14 · Add `data-analytics-id` to your top ten CTAs
**Effort** 3 h with frontend · **Impact** Ends redesign-driven tracking breakage

Not the whole estate — the ten elements that matter. It demonstrates the contract, it survives the next redesign, and it makes the case for doing the rest.

---

### QW-15 · Set up freshness alerts on Tier 0 events
**Effort** 3 h · **Impact** Data loss becomes hours instead of days

A scheduled query, run hourly, that alerts when a Tier 0 event has not fired within its expected window:

```sql
SELECT event_name,
       TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(event_timestamp_utc), MINUTE) AS minutes_since_last
FROM `project.dataset.events_streaming`
WHERE event_name IN ('purchase','subscription_started','signup_completed')
  AND event_timestamp_utc >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
GROUP BY event_name
HAVING minutes_since_last > 120;
```

Any row returned during business hours is an alert. This is the highest-value three hours in this document.

---

### QW-16 · Fold one name explosion into properties
**Effort** 4 h · **Impact** A visible, teachable win

Find the worst cluster — usually exports, CTAs, or filters. Replace with one event plus properties. Dual-run for 30 days, then deprecate.

Pick a cluster with real volume so the before/after is obvious. This is the change that teaches the team the pattern, and it makes every future request easier to answer.

---

### QW-17 · Document the ten events people actually use
**Effort** 4 h · **Impact** New analysts become productive in days, not weeks

Not the whole plan — the ten that appear in weekly reporting. For each: name, definition, trigger, properties, owner, known caveats.

**Where:** a version-controlled file, not a wiki page nobody can find. Start `tracking-plan.json` with these ten.

---

### QW-18 · Add the consent matrix to your release checklist
**Effort** 1 h to write · **Impact** Stops compliance regressions from shipping

Four states, one journey each: all denied, analytics only, ads only, all granted. Check actual cookies and actual network requests, not the CMP's status display.

Bolt it onto whatever release process already exists. It costs fifteen minutes per release and prevents the class of finding that arrives with a legal deadline.

---

## Sequencing

If you only have a week, in this order:

```
Day 1   QW-01, QW-02, QW-03, QW-04, QW-05, QW-07     ~1.5 h total, all config
Day 2   QW-10, QW-11                                  the reconciliation and the evidence
Day 3   QW-09, QW-15                                  the zombie list and the alerting
Day 4   QW-12, QW-13                                  fix what is measurably wrong
Day 5   QW-17, QW-18                                  make it stick
```

Day 2 is the one that matters. **The reconciliation number is what turns "our tracking is a bit messy" into a decision with a budget attached.**

---

**See also:** [Common risks](common-risks.md) · [Audit checklist](../gtm-templates/audit-checklist.md) · [Audit report template](gtm-audit-template.md)
