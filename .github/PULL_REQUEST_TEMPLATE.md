## What changed

<!-- One or two sentences. -->

## Type

- [ ] New event — RFC linked below
- [ ] Change to an existing event's **meaning** — this is breaking; RFC required
- [ ] Additive: new optional property or enum member
- [ ] Deprecation or removal
- [ ] Documentation only
- [ ] Tooling

## Checks

- [ ] `node tooling/validate.mjs` passes locally
- [ ] Every new event has an owner, a description, a trigger, and a stated decision
- [ ] Tier 0 events are server-sourced and have monitoring configured **before** publish
- [ ] Tier 3 events carry an expiry date
- [ ] No property can carry personal data
- [ ] Monetary properties have a `currency` sibling
- [ ] Custom-dimension budget impact stated below
- [ ] Deprecations have a sunset date and a dual-run window

## Budget impact

<!-- Paste the summary block from `node tooling/validate.mjs`. -->

```
```

## Breaking changes

<!-- Who consumes this today, and what is the migration? "Nobody" is an acceptable answer
     only if you checked. -->

## RFC

<!-- Link, or "n/a — additive". -->
