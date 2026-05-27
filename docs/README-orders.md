# Adding New Orders (Including Custom Orders)

This guide explains where orders are defined and how to add new ones safely.

## Order Types In This Project

- **Division order**: Applied to a division (`left`, `center`, `right`, `reserve`, `cavalry`, `artillery`) and used by movement logic.
- **Major action**: High-level AI decision (like `flank_attack`, `exploit_gap`) that maps into division orders.
- **Signature action**: Commander special ability (like `artillery_barrage`, `feigned_retreat`) that can also map into orders and combat effects.

---

## File Map

- `src/core.js`
  - `ORDERS`: human-readable order labels shown in UI
  - `MAJOR_ACTIONS`: AI-selectable action ids
  - `COMMANDERS`: signatures, traits, quote metadata
- `src/setup.js`
  - `wingTemplate()` and defaults for division orders
- `src/sim.js`
  - `issueOrdersFromAction(...)`: maps major/signature actions to per-division orders
  - `chooseSectorForAction(...)`: target selection (sector/division)
  - `scoreMoveTile(...)`: movement behavior by order
  - `choose*Step(...)`: special movement behaviors (reserve/rear/flank/rejoin)
  - `getActionAttackMultiplier(...)`, `getActionDefenseMultiplier(...)`, `getActionMoraleShockMultiplier(...)`
  - `actionDescription(...)`: tooltip text
- `src/ui-controls.js`
  - division assignment tools and rules tab controls
- `src/render.js`
  - selection info line, HUD display

---

## Fast Path: Add a New Division Order

Example order: `Pin and Probe`

1. Add display label to `ORDERS` in `src/core.js`.
2. Decide which divisions should default to this order (if any) in `defaultDivisionOrder(...)` (`src/setup.js`).
3. Add behavior in movement logic (`src/sim.js`):
   - Either add scoring branch in `scoreMoveTile(...)`, or
   - Add dedicated step chooser (like `chooseFlankDefenseStep(...)`) and route to it in `moveUnits(...)`.
4. If this order should affect combat math, update attack/defense/morale multiplier helpers.
5. Add order description text in `actionDescription(...)` if needed.
6. Validate with:

```bash
node --check src/sim.js
```

---

## Full Path: Add a New Major Action (Custom AI Action)

Example action id: `pin_and_probe`

1. Add id to `MAJOR_ACTIONS` in `src/core.js`.
2. Make it eligible in `getAvailableActionsForArmy(...)` (`src/sim.js`).
3. Add weighting in `getActionWeights(...)`:
   - Base weight from battle status
   - Personality multipliers via commander traits
4. Add target logic in `chooseSectorForAction(...)`.
5. Add mapping in `issueOrdersFromAction(...)` (critical):
   - map action -> per-division orders
6. Add text in `actionDescription(...)` for logs/popups.
7. If this action changes damage or morale behavior, adjust multiplier helpers and/or combat phase.

---

## Adding a New Signature Action

1. Add signature in `COMMANDERS` (`src/core.js`):
   - `signature: { name, type, duration, description }`
2. Add quote pool in `signatureQuotes` for reels speech bubbles.
3. Mark it signature-compatible in the signature trigger path (`sim.js`).
4. Define gameplay effects:
   - movement-level effects in `moveUnits(...)`
   - combat-level effects in `resolveCombat(...)`
   - action/order effects in `issueOrdersFromAction(...)`
5. Add any charge-model integration if relevant.

---

## Custom Order Design Checklist (Recommended)

- **Intent**: What should units do differently from existing orders?
- **Distance band**: Should units seek contact (`<=1`), pressure (`2-3`), or standoff (`3-5`)?
- **Formation rule**: Cohesion priority vs spread/frontage priority.
- **Side symmetry**: Validate Blue and Red mirror behavior.
- **Fallback rule**: What happens when no valid tile exists?
- **Interaction with reserves/rejoin**: Avoid accidental rerouting to center/rear loops.
- **Interaction with cavalry odds gating**: ensure aggressive orders still obey local odds when needed.

---

## Common Pitfalls

- Forgetting side-aware mapping for left/right behavior.
- Adding an order label but not adding movement behavior (results in implicit generic behavior).
- Allowing action selection but not defining order map in `issueOrdersFromAction(...)`.
- Making an order too passive because it only changes one score term.
- Not handling special divisions (`cavalry`, `artillery`) in target and lane logic.

---

## Minimal Test Script After Changes

1. Start sim and force both sides to use the new action/order for 3-5 major turns.
2. Verify:
   - units move as intended,
   - Blue/Red mirror correctly,
   - no rear-loop behavior,
   - no syntax errors.
3. Check selection panel shows division + current order as expected.

---

## Naming Convention

- **Action ids**: snake_case, internal (`exploit_gap`, `line_rotation`)
- **Order labels**: Title Case, UI-facing (`Stay on Flanks`, `Stay in Rear`)
- Keep action id and order label distinct.
