#!/usr/bin/env node
/**
 * Generates TypeScript types from the tracking plan.
 *
 *   node tooling/generate-types.mjs > packages/analytics/src/generated.ts
 *
 * The point: a typo in an event name becomes a build failure instead of a
 * missing dimension discovered in a report six weeks later. The plan is not
 * documentation about the implementation — it generates the types the
 * implementation is checked against.
 *
 * Zero dependencies. Node 18+.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(readFileSync(process.argv[2] ?? resolve(HERE, 'tracking-plan.json'), 'utf8'));

const pascal = (s) => s.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join('');
const tsType = (p) => {
  if (p.enum_ref)     return pascal(p.enum_ref);
  if (p.registry_ref) return 'FeatureId';
  return p.type === 'integer' ? 'number' : p.type;
};

const out = [];
const w = (...l) => out.push(...l);

w('/* eslint-disable */');
w('// GENERATED FILE — do not edit.');
w('// Source: tooling/tracking-plan.json');
w(`// Plan ${plan.plan_version} · generated ${new Date().toISOString().slice(0, 10)}`);
w('');

// -- enums -------------------------------------------------------------
w('// ---------------------------------------------------------------- enums');
w('');
for (const [name, values] of Object.entries(plan.enums ?? {})) {
  w(`export type ${pascal(name)} =`);
  w(values.map(v => `  | ${JSON.stringify(v)}`).join('\n') + ';');
  w('');
}

// -- feature registry --------------------------------------------------
if (plan.feature_registry?.length) {
  w('// ------------------------------------------------------ feature registry');
  w('');
  w('export type FeatureId =');
  w(plan.feature_registry.map(f => `  | ${JSON.stringify(f.feature_id)}`).join('\n') + ';');
  w('');
}

// -- per-event property shapes ----------------------------------------
w('// --------------------------------------------------------------- events');
w('');

const active = (plan.events ?? []).filter(e => e.status !== 'sunset');

for (const ev of active) {
  const iface = `${pascal(ev.name)}Properties`;
  w(`/**`);
  w(` * ${ev.description}`);
  w(` *`);
  w(` * Tier ${ev.tier} · ${ev.source} · owner ${ev.owner}`);
  w(` * Fires: ${ev.trigger}`);
  if (ev.status === 'deprecated') w(` * @deprecated Sunset ${ev.sunset_at}${ev.superseded_by ? `. Use \`${ev.superseded_by}\`.` : ''}`);
  w(` */`);
  w(`export interface ${iface} {`);
  for (const p of ev.properties ?? []) {
    w(`  /** ${p.required ? 'required' : 'optional'}${p.cardinality ? ` · ${p.cardinality}` : ''} */`);
    w(`  ${p.name}${p.required ? '' : '?'}: ${tsType(p)};`);
  }
  w('}');
  w('');
}

// -- the union ---------------------------------------------------------
w('// ------------------------------------------------------------ event map');
w('');
w('export type EventName =');
w(active.map(e => `  | ${JSON.stringify(e.name)}`).join('\n') + ';');
w('');
w('export interface EventPropertyMap {');
for (const ev of active) w(`  ${JSON.stringify(ev.name)}: ${pascal(ev.name)}Properties;`);
w('}');
w('');
w('export type TrackedEvent = {');
w('  [K in EventName]: { event: K; properties: EventPropertyMap[K] };');
w('}[EventName];');
w('');

// -- runtime metadata --------------------------------------------------
w('// ------------------------------------------------------- runtime metadata');
w('');
w('export const EVENT_TIER: Record<EventName, 0 | 1 | 2 | 3> = {');
for (const ev of active) w(`  ${JSON.stringify(ev.name)}: ${ev.tier},`);
w('};');
w('');
w('export const SERVER_ONLY_EVENTS: ReadonlySet<EventName> = new Set([');
for (const ev of active.filter(e => e.source === 'server')) w(`  ${JSON.stringify(ev.name)},`);
w(']);');
w('');
w('export const DEPRECATED_EVENTS: Readonly<Record<string, string>> = {');
for (const ev of active.filter(e => e.status === 'deprecated')) {
  w(`  ${JSON.stringify(ev.name)}: ${JSON.stringify(`sunset ${ev.sunset_at}${ev.superseded_by ? ` — use ${ev.superseded_by}` : ''}`)},`);
}
w('};');
w('');

process.stdout.write(out.join('\n'));
