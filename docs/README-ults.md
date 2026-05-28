# Ultimate Abilities (Signatures)

This doc explains how ultimates ("signatures") work, how to tune their visuals, and how to add new ult portrait/audio assets.

## Gameplay Flow

Turn order with ult support:

1. Major action selection
2. Signature trigger (if charge is full)
3. Signature prelude animation (blocks simulation)
4. Movement
5. Combat resolve
6. Next turn

Important: ult animations are intentionally blocking. Movement/combat does not advance while the cinematic prelude is active.

## Charge Rules

Signature charge is global and commander-agnostic:

- Natural gain: `+2.5` per turn
- Loss gain: scales by unit losses
- Formula: `lossGainPerUnit = 200 / startingUnitCount`
- This means losing `50%` of starting units gives `100` charge

When charge reaches `100`, the HUD label shows `Ability Charged`.
When the signature is active, the HUD label shows `Ability Active`.

## Current Commander Signature Notes

- Napoleon (`artillery_barrage`)
  - One-time effect (`duration: 1`)
  - Artillery attacks all valid in-range targets
  - Damage multiplier on signature volley: `x3`
- Washington (`fighting_withdrawal`)
  - Army-wide withdrawal behavior for active duration
  - Ongoing morale recovery while active
  - Infantry can fire at range `2` while in `Withdraw`/`Retreat` orders

Artillery base damage is standardized to `12` regardless of distance.

## Visual FX Framework

Signature cinematic state:

- `state.signatureCinematics.A`
- `state.signatureCinematics.B`

Cinematics are queued with:

- `queueSignatureCinematic(side, sigType, payload)`

Triggered from major action selection:

- `triggerSignatureCinematic(side, sigType)`

Draw pass:

- `drawSignatureCinematics()`

Implemented signature visuals:

- `artillery_barrage`
  - map darken
  - artillery pulse sequence
  - tracer arcs
  - staggered impact rings/flashes
- `fighting_withdrawal`
  - fallback arrows on withdrawing units
  - infantry muzzle flash flicker

## Ult Portrait Framework

Base portraits live in `PORTRAITS`.
Ult/emotion portraits live in `PORTRAITS_ULT`.

Current portrait behavior:

- Base portrait always remains visible
- Ult portrait is rendered as a separate overlay layer on top
- Overlay is shown during active signature (and in tuning mode preview)
- If ult portrait is missing/invalid, overlay is hidden and only base portrait is shown

Suggested asset naming:

- `assets/commanders/napoleon.png`
- `assets/commanders/napoleon-ult.png`
- `assets/commanders/washington.png`
- `assets/commanders/washington-ult.png`

## Audio Framework

Signature SFX registry is available via:

- `setReelsSignatureSfx(signatureType, src)`

Example:

```js
setReelsSignatureSfx("artillery_barrage", "./assets/sfx/grand-battery.mp3");
setReelsSignatureSfx("fighting_withdrawal", "./assets/sfx/fighting-withdrawal.mp3");
```

SFX auto-plays once at cinematic start if configured.

## Recommended Manual Layout Tuning (Per Ult)

Because ult images are intentionally non-standard (hands/gestures extending outside normal frame), use per-ult manual placement config rather than auto-fit.

Suggested config shape:

```js
const ULT_PORTRAIT_LAYOUT = {
  "napoleon:artillery_barrage": {
    A: { offsetX: -56, offsetY: -24, scale: 1.34, z: 8 },
    B: { offsetX: 56, offsetY: -24, scale: 1.34, z: 8 },
  },
};
```

## Tuning Mode (In-App)

Yes: tuning mode is a live helper to position ult portraits quickly.

How to use:

- Toggle on/off: `Alt+U`
- Toggle ult overlay on/off (while tuning): `ULT Overlay: ON/OFF` button in reels controls
- Move portrait: arrow keys
- Scale portrait: `[` and `]`
- Change layer priority: `,` and `.`
- Switch side being edited: `Tab`
- Print copy-ready config snippet to log: `C`

Notes:

- Tuning mode works in Reels mode.
- It previews ult layout even when the signature is not currently active.
- The overlay toggle lets you compare `base only` vs `base + ult overlay` for alignment.
- Changes are runtime-only until you copy values into `ULT_PORTRAIT_LAYOUT`.

Why this approach:

- Every ult art piece can be composed differently
- You keep artistic control without forcing a fixed crop
- You can let hands overlap HUD intentionally while preserving face readability

## Quick Checklist: Adding a New Ult

1. Add/update commander signature in `src/core.js`
2. Add gameplay behavior in `src/sim.js`
3. Add cinematic renderer branch in `src/render.js`
4. Add optional ult portrait in `PORTRAITS_ULT`
5. Add optional audio via `setReelsSignatureSfx(...)`
6. Tune text (`actionTechnicalDescription` and `actionReelsDescription`)
7. Verify sequence: cinematic blocks movement/combat until finished
