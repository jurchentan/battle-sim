# Adding New Commanders

This guide explains how to add a new commander to the game and all the places that need updates.

---

## File Checklist

| File | What to add |
|---|---|
| `src/core.js` | `COMMANDERS` entry, `PORTRAITS` entry, `COMMANDER_ACCENT` entry |
| `assets/commanders/` | Portrait image file |
| `src/sim.js` | Signature behavior (if novel), charge gain formula |
| `README-chaos.md` | Signature quote pool if adding a new signature type (so General Chaos can use it) |

---

## Step 1: Commander Definition (`src/core.js` — `COMMANDERS`)

Add a new key to the `COMMANDERS` object. Follow this template:

```js
yourCommanderId: {
  name: "Your Commander",
  majorOrders: [{ type: "defensive_stand", line: "A quote about their strategy.", inspiredBy: "Famous battle" }],
  preferredActions: ["concentrate_center", "flank_attack"],
  traits: { aggression: 5, control: 5, creativity: 5, panicResistance: 5 },
  signature: { name: "Ability Name", type: "signature_type", duration: 5, description: "What it does for 5 turns." },
  signatureQuotes: {
    signature_type: [
      "Quote 1 when activating.",
      "Quote 2 when activating.",
      "Quote 3 when activating.",
    ],
  },
  chargeDescription: "How the super charges.",
  victoryQuotes: ["Victory line 1.", "Victory line 2.", "Victory line 3."],
  defeatQuotes: ["Defeat line 1.", "Defeat line 2.", "Defeat line 3."],
},
```

### Fields explained

| Field | Required | Notes |
|---|---|---|
| `name` | Yes | Display name shown in UI |
| `majorOrders` | Yes | Array of `{ type, line, inspiredBy }`. The first entry is used in action log lines like `"Inspired by {inspiredBy}"`. The `type` must be a valid `MAJOR_ACTIONS` id. |
| `preferredActions` | No | Array of action ids this commander weights higher. Omit or leave empty for no preference. |
| `traits` | Yes | `aggression` (0-10), `control` (0-10), `creativity` (0-10), `panicResistance` (0-10). Used by `getActionWeights()` to scale action preferences. |
| `signature` | Yes | `{ name, type, duration, description }`. `type` must be a valid signature action id. `duration` defaults to 5. The `type` is used as `army.currentAction` and `army.activeSignature.type` and dispatches into existing combat/movement logic. |
| `signatureQuotes` | Yes (for reels mode) | Map of signature type → array of quote strings. The reels HUD picks a random quote from the active signature's type. |
| `chargeDescription` | Yes | Short text shown below the ability bar in reels HUD describing how charge builds. |
| `victoryQuotes` / `defeatQuotes` | Yes | Arrays of strings displayed on battle end. |

---

## Step 2: Portrait (`src/core.js` — `PORTRAITS`)

Add an entry:

```js
yourCommanderId: loadPortrait("./assets/commanders/your-image.png"),
```

Supported formats: PNG, JPG, JPEG. Place the image file in `assets/commanders/`.

---

## Step 3: Accent Color (`src/core.js` — `COMMANDER_ACCENT`)

Add an entry for the reels HUD accent color:

```js
yourCommanderId: "#hexcolor",
```

---

## Step 4: Signature Type — If Using an Existing Type

If your commander's `signature.type` matches one of the existing types, **no sim.js changes are needed** — the combat and movement dispatch logic already handles it:

| Type | Effect |
|---|---|
| `artillery_barrage` | Artillery deals x2 damage |
| `foot_cavalry` | Infantry gets +1 move and morale shock |
| `feigned_retreat` | Cavalry retreats and attacks at range 2 |
| `fighting_withdrawal` | Retreat + 20% morale + 20% damage reduction |
| `perfect_plan` | Hold for 5 turns, then forced offensive |

These are defined in `tickActiveAction()` and `moveUnits()` in `src/sim.js`.

If you want a novel effect, you need to add dispatch branches in the relevant places (see [Adding a New Signature Action](README-orders.md#adding-a-new-signature-action)).

---

## Step 5: Charge Gain Formula (`src/sim.js` — `resolveCombat()`)

Each commander needs a custom charge formula. Add a new `else if` branch at `src/sim.js:resolveCombat()`:

```js
} else if (commanderId === "yourCommanderId") {
  gain += Math.min(20, someMetric / 20);
}
```

Available metrics (all are per-side per-combat-round counters):

| Metric | Description |
|---|---|
| `damageDealt[side]` | Total damage dealt this round |
| `damageTaken[side]` | Total damage taken this round |
| `artilleryDamage[side]` | Damage dealt by artillery |
| `cavalryMoraleInflicted[side]` | Morale damage inflicted by cavalry |
| `flankExec[side]` | Flank attack executions this round |
| `holdUsage[side]` | Hold order ticks this round |

The base gain is 3 and the final value is clamped to `[1, 30]` before adding to `abilityCharge`.

---

## Step 6: Auto-Integrations (No Changes Needed)

These things pick up automatically:

- **Commander chooser dropdown** — iterates `Object.keys(COMMANDERS)` in `src/ui-controls.js`
- **Reels HUD portrait/name/traits** — reads from `COMMANDERS`, `PORTRAITS`, `COMMANDER_ACCENT`
- **General Chaos** — already picks random signatures from all commanders; no extra work unless you add a **new signature type** (see step 7)

---

## Step 7: New Signature Type — Update General Chaos

If you add a commander with a **novel signature type** (one not in the 5 existing), you must add a corresponding quote pool to General Chaos's `signatureQuotes` in `src/core.js`:

```js
signatureQuotes: {
  ...
  your_new_type: ["quote 1", "quote 2", "quote 3"],
},
```

Otherwise the reels HUD will fail to find a quote when Chaos randomly picks that signature.

---

## Verifying

```bash
node --check src/core.js
node --check src/sim.js
```

Then run a sim with the new commander for 5-10 turns and watch for errors in the log.
