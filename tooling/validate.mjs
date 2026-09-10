#!/usr/bin/env node
/**
 * Tracking plan validator.
 *
 * Zero dependencies. Node 18+.
 *
 *   node tooling/validate.mjs [path-to-plan]
 *
 * Exit 0 — clean, or warnings only.
 * Exit 1 — one or more errors. CI blocks the pull request.
 *
 * A convention that is not enforced is a preference. This is the enforcement.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAN_PATH = process.argv[2] ?? resolve(HERE, 'tracking-plan.json');

const C = process.stdout.isTTY
  ? { r: '\x1b[31m', y: '\x1b[33m', g: '\x1b[32m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }
  : { r: '', y: '', g: '', d: '', b: '', x: '' };

const errors = [];
const warnings = [];
const err  = (where, msg) => errors.push({ where, msg });
const warn = (where, msg) => warnings.push({ where, msg });

// ---------------------------------------------------------------- load

let plan;
try {
  plan = JSON.parse(readFileSync(PLAN_PATH, 'utf8'));
} catch (e) {
  console.error(`${C.r}Cannot read or parse ${PLAN_PATH}${C.x}\n${e.message}`);
  process.exit(1);
}

const conv    = plan.conventions   ?? {};
const limits  = plan.platform_limits?.ga4 ?? {};
const budgets = plan.budgets       ?? {};
const enums   = plan.enums         ?? {};
const events  = plan.events        ?? [];
const registry = plan.feature_registry ?? [];

const EVENT_RE  = new RegExp(conv.event_name_pattern    ?? '^[a-z][a-z0-9_]{2,39}$');
const PROP_RE   = new RegExp(conv.property_name_pattern ?? '^[a-z][a-z0-9_]{1,39}$');
const ENUMVAL_RE= new RegExp(conv.enum_value_pattern    ?? '^[a-z][a-z0-9_]{0,60}$');
const VERBS     = new Set(conv.approved_verbs ?? []);
const EXEMPT    = new Set(conv.name_exceptions ?? []);
const RESERVED_PREFIXES = conv.reserved_prefixes ?? [];
const RESERVED_NAMES    = new Set(conv.reserved_event_names ?? []);
const FORBIDDEN         = conv.forbidden_name_patterns ?? [];

const VALID_TYPES        = new Set(['string', 'number', 'integer', 'boolean']);
const VALID_SOURCES      = new Set(['server', 'client', 'both']);
const VALID_STATUSES     = new Set(['active', 'deprecated', 'sunset']);
const VALID_DESTINATIONS = new Set(['ga4', 'warehouse', 'crm', 'ads', 'product_analytics', 'lifecycle']);
const VALID_CARDINALITY  = new Set(['enum', 'bounded', 'unbounded']);

// PII heuristics. Deliberately blunt: a false positive costs a rename,
// a false negative costs a disclosure.
const PII_PATTERNS = [
  /(^|_)email(_|$)/, /(^|_)e_?mail/, /(^|_)phone(_|$)/, /(^|_)tel(_|$)/,
  /(^|_)first_?name/, /(^|_)last_?name/, /(^|_)full_?name/, /(^|_)username/,
  /(^|_)address(_|$)/, /(^|_)street/, /(^|_)postcode/, /(^|_)zip(_|$)/,
  /(^|_)ip(_|$)/, /(^|_)dob(_|$)/, /(^|_)birth/, /(^|_)ssn(_|$)/,
  /(^|_)passport/, /(^|_)card_?number/, /(^|_)iban(_|$)/,
  /(^|_)password/, /(^|_)token(_|$)/, /(^|_)secret/, /(^|_)api_?key/,
  /(^|_)query_?string/, /(^|_)search_?query/, /(^|_)message_?body/, /(^|_)free_?text/
];
// Names that look like PII but classify or compare rather than carry.
const PII_ALLOWLIST = new Set([
  'email_domain_type',
  'recipient_domain_matches_account',
  'match_keys_sent'
]);

// ------------------------------------------------------- 1. plan-level

if (!plan.plan_version) err('plan', 'plan_version is required.');
if (!plan.updated_at)   err('plan', 'updated_at is required.');
if (!events.length)     err('plan', 'The plan contains no events.');

for (const key of Object.keys(enums)) {
  const values = enums[key];
  if (!Array.isArray(values) || values.length === 0) {
    err(`enums.${key}`, 'Enum must be a non-empty array.');
    continue;
  }
  const seen = new Set();
  for (const v of values) {
    if (typeof v !== 'string' || !ENUMVAL_RE.test(v)) {
      err(`enums.${key}`, `Value "${v}" must match ${ENUMVAL_RE}. Lowercase snake_case.`);
    }
    if (['null', '', 'undefined', 'n_a', 'na', 'none_'].includes(String(v))) {
      err(`enums.${key}`, `"${v}" is a placeholder, not a member. Absent means absent: omit the key.`);
    }
    if (seen.has(v)) err(`enums.${key}`, `Duplicate value "${v}".`);
    seen.add(v);
  }
}

// --------------------------------------------------- 2. feature registry

const featureIds = new Set();
for (const f of registry) {
  const at = `feature_registry.${f.feature_id ?? '?'}`;
  if (!f.feature_id || !PROP_RE.test(f.feature_id)) err(at, 'feature_id missing or malformed.');
  if (featureIds.has(f.feature_id)) err(at, 'Duplicate feature_id. Slugs are permanent and never reused.');
  featureIds.add(f.feature_id);
  if (!f.owner) err(at, 'Every feature needs a named owner.');
  if (!Array.isArray(f.depth_levels) || f.depth_levels.length < 2) {
    err(at, 'depth_levels must declare at least two rungs, or "adoption" means "clicked once".');
  }
  if (!f.released_at) warn(at, 'released_at missing. Adoption-since-release curves need it.');
}

// ---------------------------------------------------------- 3. events

const seenEvents = new Set();
let eventScopedDims = 0;
let userScopedDims  = 0;
const registeredDims = new Set();
const today = new Date().toISOString().slice(0, 10);

for (const ev of events) {
  const at = `events.${ev.name ?? '(unnamed)'}`;

  // -- name ------------------------------------------------------------
  if (!ev.name) { err(at, 'Event has no name.'); continue; }
  if (seenEvents.has(ev.name)) err(at, 'Duplicate event name.');
  seenEvents.add(ev.name);

  if (!EVENT_RE.test(ev.name)) err(at, `Name must match ${EVENT_RE}.`);
  if (ev.name.length > (limits.event_name_max_chars ?? 40)) {
    err(at, `Name is ${ev.name.length} chars, over the GA4 cap of ${limits.event_name_max_chars ?? 40}. GA4 truncates silently.`);
  }
  for (const p of RESERVED_PREFIXES) {
    if (ev.name.startsWith(p)) err(at, `Name uses the reserved prefix "${p}".`);
  }
  if (RESERVED_NAMES.has(ev.name)) {
    err(at, `"${ev.name}" is a reserved platform event name. Redefining it corrupts built-in reporting.`);
  }
  for (const f of FORBIDDEN) {
    if (new RegExp(f.pattern).test(ev.name)) err(at, `Forbidden name pattern /${f.pattern}/ — ${f.reason}`);
  }
  if (!EXEMPT.has(ev.name)) {
    const verb = ev.name.split('_').pop();
    if (!VERBS.has(verb)) {
      err(at, `Final token "${verb}" is not in conventions.approved_verbs. Use an approved verb, or extend the list in a PR.`);
    }
  }

  // -- governance ------------------------------------------------------
  if (ev.tier === undefined || ![0, 1, 2, 3].includes(ev.tier)) err(at, 'tier must be 0, 1, 2 or 3.');
  if (!ev.owner) err(at, 'No owner. Ownerless events are the ones that rot.');
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ev.owner)) warn(at, `owner "${ev.owner}" does not look like an address.`);
  if (!ev.description || ev.description.length < 30) {
    err(at, 'description is missing or too thin to survive the reconstruction test.');
  }
  if (!ev.trigger)  err(at, 'trigger is required: state exactly when this fires.');
  if (!ev.decision) err(at, 'decision is required: name the decision this event changes.');
  if (!VALID_SOURCES.has(ev.source)) err(at, `source must be one of ${[...VALID_SOURCES].join(', ')}.`);
  if (!VALID_STATUSES.has(ev.status)) err(at, `status must be one of ${[...VALID_STATUSES].join(', ')}.`);
  if (!ev.introduced) warn(at, 'introduced date missing.');

  // -- tier rules ------------------------------------------------------
  if (ev.tier === 0 && ev.source === 'client') {
    err(at, 'Tier 0 events cannot be client-only. Blockers, ITP and closed tabs make client collection best-effort by construction.');
  }
  if ((ev.tier === 0 || ev.tier === 1) && ev.status === 'active') {
    const m = ev.monitoring ?? {};
    if (!m.freshness) err(at, `Tier ${ev.tier} requires freshness monitoring. If it is not monitored, it is not implemented.`);
    if (ev.tier === 0 && m.paged !== true) {
      err(at, 'Tier 0 requires a paged anomaly alert.');
    }
  }
  if (ev.tier === 0 && ev.status === 'active' && !ev.reconciliation) {
    warn(at, 'Tier 0 without a declared reconciliation source. State what it is checked against.');
  }
  if (ev.tier === 3 && ev.status === 'active') {
    if (!ev.expires_at) err(at, 'Tier 3 events require expires_at. Experiments that never expire are just undocumented events.');
    else if (ev.expires_at < today) warn(at, `Expired on ${ev.expires_at}. Promote it with evidence of use, or delete it.`);
  }

  // -- deprecation -----------------------------------------------------
  if (ev.status === 'deprecated') {
    if (!ev.sunset_at) err(at, 'Deprecated events require a sunset_at date. Nothing sits in deprecated without one.');
    if (!ev.deprecated_at) warn(at, 'deprecated_at missing.');
    if (ev.superseded_by && !events.some(e => e.name === ev.superseded_by)) {
      err(at, `superseded_by references "${ev.superseded_by}", which is not in the plan.`);
    }
  }
  if (/_v[0-9]+$/.test(ev.name)) {
    err(at, 'Version suffix in an event name. A version number is an admission the name was wrong; fix the name.');
  }

  // -- destinations ----------------------------------------------------
  if (!Array.isArray(ev.destinations) || ev.destinations.length === 0) {
    err(at, 'At least one destination required, each with a named consumer.');
  } else {
    for (const d of ev.destinations) {
      if (!VALID_DESTINATIONS.has(d)) err(at, `Unknown destination "${d}".`);
    }
  }

  // -- properties ------------------------------------------------------
  const props = ev.properties ?? [];
  const hardMax = conv.max_properties_per_event ?? 12;
  const softMax = conv.soft_max_properties_per_event ?? 8;
  if (props.length > hardMax) {
    err(at, `${props.length} properties exceeds the hard cap of ${hardMax}. Beyond this you are logging a database row, not an event.`);
  } else if (props.length > softMax) {
    warn(at, `${props.length} properties is over the soft budget of ${softMax}. Which existing property is now less valuable than the one you added?`);
  }
  if (props.length + 13 > (limits.parameters_per_event ?? 25)) {
    warn(at, `${props.length} properties plus ~13 context parameters approaches the GA4 cap of ${limits.parameters_per_event ?? 25}. Excess is dropped silently.`);
  }

  const seenProps = new Set();
  let unboundedCount = 0;

  for (const p of props) {
    const pat = `${at}.${p.name ?? '(unnamed)'}`;
    if (!p.name) { err(pat, 'Property has no name.'); continue; }
    if (seenProps.has(p.name)) err(pat, 'Duplicate property name within the event.');
    seenProps.add(p.name);

    if (!PROP_RE.test(p.name)) err(pat, `Name must match ${PROP_RE}.`);
    if (p.name.length > (limits.parameter_name_max_chars ?? 40)) {
      err(pat, `Name is ${p.name.length} chars, over the GA4 cap of ${limits.parameter_name_max_chars ?? 40}.`);
    }
    if (!VALID_TYPES.has(p.type)) err(pat, `type must be one of ${[...VALID_TYPES].join(', ')}.`);
    if (typeof p.required !== 'boolean') err(pat, 'required must be an explicit boolean.');

    // PII
    if (!PII_ALLOWLIST.has(p.name)) {
      for (const re of PII_PATTERNS) {
        if (re.test(p.name)) {
          err(pat, `Name matches a PII pattern (${re}). The data layer is world-readable. Classify, band, or enumerate instead.`);
          break;
        }
      }
    }
    if (p.pii === true) err(pat, 'pii: true. An event carrying personal data must not reach this pipeline at all.');

    // enums
    if (p.enum_ref) {
      if (!enums[p.enum_ref]) err(pat, `enum_ref "${p.enum_ref}" is not declared in plan.enums.`);
      if (p.type !== 'string') err(pat, 'A property with an enum_ref must be type string.');
    }
    if (p.registry_ref) {
      if (p.registry_ref !== 'feature_registry') err(pat, `Unknown registry_ref "${p.registry_ref}".`);
    }

    // cardinality
    if (p.cardinality && !VALID_CARDINALITY.has(p.cardinality)) {
      err(pat, `cardinality must be one of ${[...VALID_CARDINALITY].join(', ')}.`);
    }
    if (p.cardinality === 'unbounded') {
      if (!/_id$/.test(p.name)) unboundedCount++;   // *_id are explicit join keys, exempt
      if (p.register_dimension === true) {
        err(pat, 'Unbounded property registered as a GA4 dimension. Past its cardinality ceiling GA4 aggregates the tail into (other), irreversibly. This is a join key: send it to the warehouse.');
      }
    }

    // ids are strings
    if (/_id$/.test(p.name) && p.type !== 'string') {
      err(pat, 'Identifiers are always type string, even numeric ones. The day you migrate to UUIDs you will not want to rewrite every downstream cast.');
    }
    // booleans read as booleans
    if (/^(is|has)_/.test(p.name) && p.type !== 'boolean') {
      err(pat, 'A property prefixed is_ / has_ must be type boolean.');
    }
    // units in the name
    if (/_(ms|s|days|d|h|bytes|pct)$/.test(p.name) && !['integer', 'number'].includes(p.type)) {
      err(pat, 'A property carrying a unit suffix must be numeric.');
    }
    // timestamps
    if (/_at$/.test(p.name)) {
      if (p.type !== 'string') err(pat, 'Timestamps are ISO 8601 strings.');
      else if (p.format !== 'date-time') warn(pat, 'Timestamp property without format: "date-time".');
    }
    // dimension registration budget
    if (p.register_dimension === true) {
      const key = `${p.scope ?? 'event'}:${p.name}`;
      if (!registeredDims.has(key)) {
        registeredDims.add(key);
        if (p.scope === 'user') userScopedDims++;
        else eventScopedDims++;
      }
      if (!['event', 'user', 'item'].includes(p.scope ?? 'event')) {
        err(pat, 'register_dimension requires scope: event, user or item.');
      }
    }
  }

  if (unboundedCount > (budgets.unbounded_non_id_properties_per_event ?? 0)) {
    warn(at, `${unboundedCount} unbounded non-identifier propert${unboundedCount === 1 ? 'y' : 'ies'}. Identifiers are join keys and are fine; anything else unbounded is free text in disguise.`);
  }

  // money needs a currency sibling
  const names = new Set(props.map(p => p.name));
  const MONETARY = ['value', 'mrr', 'mrr_previous', 'mrr_delta', 'mrr_lost', 'revenue', 'price', 'tax', 'shipping', 'lifetime_value'];
  const hasMoney = MONETARY.some(m => names.has(m));
  if (hasMoney && !names.has('currency')) {
    err(at, 'Monetary property without a currency sibling. GA4 discards revenue it cannot attribute to a currency, and it does so silently.');
  }
  if (names.has('currency')) {
    const cur = props.find(p => p.name === 'currency');
    if (cur.format !== 'iso4217') warn(at, 'currency should declare format: "iso4217".');
  }
}

// ------------------------------------------------------- 4. budgets

const evCap = budgets.event_scoped_dimensions?.budget ?? 30;
const evMax = budgets.event_scoped_dimensions?.cap ?? limits.event_scoped_dimensions ?? 50;
const usCap = budgets.user_scoped_dimensions?.budget ?? 15;
const usMax = budgets.user_scoped_dimensions?.cap ?? limits.user_scoped_dimensions ?? 25;

if (eventScopedDims > evMax) {
  err('budgets', `${eventScopedDims} event-scoped dimensions exceeds the GA4 hard cap of ${evMax}.`);
} else if (eventScopedDims > evCap) {
  warn('budgets', `${eventScopedDims} event-scoped dimensions is over the ${evCap} budget (cap ${evMax}). You cannot recover a slot without losing its history.`);
}
if (userScopedDims > usMax) {
  err('budgets', `${userScopedDims} user-scoped dimensions exceeds the GA4 hard cap of ${usMax}.`);
} else if (userScopedDims > usCap) {
  warn('budgets', `${userScopedDims} user-scoped dimensions is over the ${usCap} budget (cap ${usMax}).`);
}

// ------------------------------------------------- 5. definitions

const act = plan.definitions?.activation;
if (act) {
  if (!act.current_version) err('definitions.activation', 'current_version is required.');
  if (!Array.isArray(act.versions) || !act.versions.length) {
    err('definitions.activation', 'At least one versioned definition is required.');
  } else {
    if (!act.versions.some(v => v.version === act.current_version)) {
      err('definitions.activation', `current_version "${act.current_version}" has no matching entry in versions.`);
    }
    for (const v of act.versions) {
      const vat = `definitions.activation.${v.version}`;
      if (!v.window_days) err(vat, 'Activation must be time-bound. "Ever" is not a definition.');
      if (!Array.isArray(v.criteria) || v.criteria.length < 2) {
        err(vat, 'Activation needs at least two criteria. One action is noise; two or three correlated actions are a pattern.');
      }
      if (!v.derivation) err(vat, 'derivation is required: state the retention evidence this threshold came from.');
      if (!v.scope) warn(vat, 'scope missing. In B2B this is almost always "account".');
    }
  }
  if (events.some(e => e.name === 'activation_reached')) {
    const ar = events.find(e => e.name === 'activation_reached');
    if (!(ar.properties ?? []).some(p => p.name === 'activation_definition_version')) {
      err('events.activation_reached', 'Must carry activation_definition_version, or every trend line silently mixes definitions.');
    }
  }
}

// ------------------------------------------------------- 6. report

const line = (s) => console.log(s);
line('');
line(`${C.b}Tracking plan validation${C.x}  ${C.d}${PLAN_PATH}${C.x}`);
line(`${C.d}${plan.plan_name ?? 'plan'} v${plan.plan_version ?? '?'} · updated ${plan.updated_at ?? '?'}${C.x}`);
line('');
line(`  events              ${events.length}`);
line(`    tier 0            ${events.filter(e => e.tier === 0).length}`);
line(`    tier 1            ${events.filter(e => e.tier === 1).length}`);
line(`    tier 2            ${events.filter(e => e.tier === 2).length}`);
line(`    tier 3            ${events.filter(e => e.tier === 3).length}`);
line(`    deprecated        ${events.filter(e => e.status === 'deprecated').length}`);
line(`  enums               ${Object.keys(enums).length}`);
line(`  features            ${registry.length}`);
line(`  GA4 dimensions      ${eventScopedDims}/${evCap} event-scoped · ${userScopedDims}/${usCap} user-scoped`);
line('');

if (warnings.length) {
  line(`${C.y}${warnings.length} warning${warnings.length === 1 ? '' : 's'}${C.x}`);
  for (const w of warnings) line(`  ${C.y}!${C.x} ${C.b}${w.where}${C.x}\n    ${w.msg}`);
  line('');
}
if (errors.length) {
  line(`${C.r}${errors.length} error${errors.length === 1 ? '' : 's'}${C.x}`);
  for (const e of errors) line(`  ${C.r}✗${C.x} ${C.b}${e.where}${C.x}\n    ${e.msg}`);
  line('');
  line(`${C.r}FAILED${C.x} — the plan is the contract. Fix it before implementing against it.`);
  line('');
  process.exit(1);
}

line(`${C.g}PASSED${C.x}${warnings.length ? ` ${C.d}with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}${C.x}` : ''}`);
line('');
process.exit(0);
