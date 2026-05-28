# SFX Authoring and Audio Tuning

This guide explains how to add and tune sound effects (SFX), including signature ult audio and the `AUDIO_TUNING` section.

---

## Where Audio Lives

- Core audio plumbing: `src/core.js`
- Signature cinematic triggers: `src/render.js` and `src/sim.js`

Main entry points:

- `playUnitKillSfx(unitType, delaySec)`
- `playSignatureUltSfx(sigType)`
- `playArtilleryImpactBoomSfx(delaySec, gainMult)`
- `setReelsSignatureSfx(signatureType, src)` for file-based audio

---

## Two Ways to Create SFX

### 1) Procedural SFX (WebAudio)

Use oscillators + noise + filters in `src/core.js`.

Good for:

- Drums/booms
- Horn-like stabs
- Bells/chimes
- Weapon impacts

Pattern used in this project:

1. Get context/output node
2. Schedule notes/hits (`currentTime + offset`)
3. Shape loudness with `GainNode` ramps
4. Add color with `BiquadFilterNode`
5. Stop nodes explicitly

Example shape (simplified):

```js
const ac = getCombatAudioContext();
const outNode = getCombatOutputNode(ac);
const t = ac.currentTime;

const osc = ac.createOscillator();
const gain = ac.createGain();
osc.type = "triangle";
osc.frequency.setValueAtTime(440, t);
gain.gain.setValueAtTime(0.0001, t);
gain.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);

osc.connect(gain);
gain.connect(outNode);
osc.start(t);
osc.stop(t + 0.22);
```

### 2) File-based SFX (Audio files)

Register a per-signature file and let the cinematic auto-play it at start:

```js
setReelsSignatureSfx("cross_rubicon", "./assets/sfx/cross-rubicon.mp3");
```

Tips:

- Keep files short (usually under 3s for ult stingers)
- Leave slight headroom in mastering to avoid clipping
- Use mono or focused stereo for punchy battlefield cues

---

## Signature Hookup Flow

To add SFX for a signature type:

1. Ensure signature exists in `COMMANDERS` (`src/core.js`)
2. Ensure cinematic type is queued (`queueSignatureCinematic(...)` in `src/render.js` via `src/sim.js` trigger)
3. Add branch in `playSignatureUltSfx(sigType)` in `src/core.js`
4. Optionally register external file with `setReelsSignatureSfx(...)`

Runtime flow:

- Signature triggers in sim
- `queueSignatureCinematic(...)` stores active FX
- `drawSignatureCinematics()` calls `playSignatureSfxIfNeeded(fx)` once
- That function plays procedural SFX and/or registered file clip

---

## AUDIO_TUNING Section

`AUDIO_TUNING` in `src/core.js` is the main balancing panel. It includes gains like:

- `killSfxGain`
- `ultWashingtonGain`
- `ultNapoleonGain`
- `artilleryImpactBoomGain`
- `rubiconDrumGain`
- `rubiconHornGain`

Use this first before rewriting synthesis code.

### Live tuning helpers (no UI changes needed)

Available in console:

- `getAudioTuning()`
- `setRubiconUltMix({ drumGain, hornGain })`

Examples:

```js
setRubiconUltMix({ drumGain: 1.1, hornGain: 0.35 });
setRubiconUltMix({ drumGain: 0.8, hornGain: 0.7 });
getAudioTuning();
```

Notes:

- Values are clamped to `0..3`
- Global `Audio Vol` still scales final output

---

## Practical Mixing Advice

- Start with low gains (`0.3` to `0.8`) and step up slowly
- Keep low-end booms shorter than you think; long tails muddy combat
- Add transient "snap" layer on drums for clarity on laptop speakers
- For horns: avoid too much sawtooth level, filter around harsh highs
- Compare against other ults at the same `Audio Vol`

---

## Quick Test Loop

1. Open battle in reels mode
2. Trigger signature repeatedly (or use a tiny scenario)
3. Tune gains in console (`setRubiconUltMix(...)`)
4. Once it sounds right, copy values into `AUDIO_TUNING`

Optional syntax check:

```bash
node --check src/core.js
```
