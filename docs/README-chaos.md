# General Chaos Maintenance Guide

General Chaos (`chaos`) is a special commander who randomly picks from the full set of available options rather than using personality weights. Whenever you add new content, Chaos needs to be updated so he can use it.

## Chaos's Mechanics

| Aspect | How Chaos works | Code location |
|---|---|---|
| **Action selection** | Uniform random from `getAvailableActionsForArmy()` | `src/sim.js:chooseMajorAction()` |
| **Signature (super)** | Picks a random other commander's `signature` object (type, name, duration) | `src/sim.js:chooseMajorAction()` — `chaos_reigns` branch |
| **Charge gain** | Passive: 15 per combat round, no conditions | `src/sim.js:resolveCombat()` |

Everything is dynamic — Chaos doesn't need code changes when you add a new major action or signature *unless* the new content requires special-case handling that Chaos would skip or break.

---

## When You Add a New Major Action

1. Add the action id to `MAJOR_ACTIONS` in `src/core.js`.
2. Add eligibility in `getAvailableActionsForArmy()` in `src/sim.js`.
3. **Chaos will pick it automatically** — no Chaos-specific changes needed, as long as the action works with `chooseSectorForAction()` and `issueOrdersFromAction()` (which it must for any commander).

---

## When You Add a New Commander with a Signature

1. Add the commander entry to `COMMANDERS` in `src/core.js`, including `signature` with `type`, `name`, `duration`.
2. **Chaos will randomly pick this signature** — no Chaos-specific changes needed.
3. Chaos will use the picked signature's `type` for `army.currentAction` and `army.activeSignature`, so any combat/movement logic that dispatches on `activeSignature.type` works automatically.

### If the new signature has a quote pool

Chaos has `signatureQuotes` entries for all 5 existing types. If you add a new signature type, **add a corresponding quote pool to Chaos's `signatureQuotes`** so the reels HUD doesn't break:

```js
signatureQuotes: {
  artillery_barrage: [...],
  foot_cavalry: [...],
  feigned_retreat: [...],
  fighting_withdrawal: [...],
  perfect_plan: [...],
  your_new_type: ["quote 1", "quote 2", "quote 3"],  // <-- add this
},
```

---

## When You Add a New Division Order

1. Add the display label to `ORDERS` in `src/core.js`.
2. Add movement behavior in `src/sim.js` (scoring, step choosers, etc.).
3. **Chaos will issue this order** if the randomly-picked major action maps to it via `issueOrdersFromAction()` — no Chaos-specific changes needed.

---

## What Does NOT Need Chaos-Specific Changes

- New terrain types
- New unit types (Chaos selects actions, not units)
- UI/rendering changes
- Scenario data
- Balance/weight tuning (Chaos ignores weights entirely)

---

## Verifying Chaos After Changes

```bash
node --check src/core.js
node --check src/sim.js
```

Then run a sim with one or both sides as General Chaos for 5-10 turns and watch the log for errors.
