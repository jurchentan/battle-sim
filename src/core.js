const TERRAIN = ["plain", "hill", "forest", "river", "road", "town", "blocked"];
const MODES = ["terrain", "units", "wings", "commanders", "armies", "rules"];
const UNIT_BASE = {
  infantry: { strength: 250, morale: 100, move: 1, range: 1, attack: 12 },
  cavalry: { strength: 180, morale: 100, move: 2, range: 1, attack: 10 },
  artillery: { strength: 120, morale: 100, move: 1, range: 2, attack: 8 },
};
const MAX_MORALE = 120;

const COMMANDERS = {
  napoleon: {
    name: "Napoleon",
    majorOrders: [{ type: "artillery_concentration", line: "Concentrate the guns and break their center.", inspiredBy: "Austerlitz" }],
    preferredActions: ["concentrate_center", "bombard_sector"],
    traits: { aggression: 8, control: 8, creativity: 9, panicResistance: 9 },
    signature: { name: "Grand Battery", type: "artillery_barrage", duration: 1, description: "Napoleon's artillery fires at all available targets for x3 damage." },
    signatureQuotes: {
      artillery_barrage: [
        "Artillery is the god of war.",
        "Concentrate the guns and break their center.",
        "Let the batteries speak before the infantry moves.",
      ],
    },
    chargeDescription: "Charges from dealing damage with artillery.",
    victoryQuotes: [
      "Victory belongs to the most persevering.",
      "The battlefield has been won by decision and fire.",
      "You must not fight too often with one enemy, or you will teach him all your art of war.",
    ],
    defeatQuotes: [
      "A battle lost is a battle one thinks one has lost.",
      "Courage is like love; it must have hope for nourishment.",
      "In war, as in government, fortune favors the bold.",
    ],
  },
  lee: {
    name: "Robert E. Lee",
    majorOrders: [{ type: "flank_attack", line: "Strike the exposed flank.", inspiredBy: "Chancellorsville" }],
    preferredActions: ["flank_attack", "rally"],
    traits: { aggression: 5, control: 7, creativity: 9, panicResistance: 7 },
    signature: { name: "Jackson's Foot Cavalry", type: "foot_cavalry", duration: 5, description: "Infantry gains +1 move and morale shock in one sector for 5 turns." },
    signatureQuotes: {
      foot_cavalry: [
        "Press the march and strike where they bend.",
        "Speed and order decide the field.",
        "Keep the men moving; hit before they set.",
      ],
    },
    chargeDescription: "Charges when Flank Attacks succeed",
    victoryQuotes: [
      "Those people delight me. They don't know what war is.",
      "Duty is the sublimest word in our language.",
      "The enemy gave way; we pressed with resolution.",
    ],
    defeatQuotes: [
      "It is well that war is so terrible, otherwise we should grow too fond of it.",
      "We failed in execution, not in spirit.",
      "I cannot trust myself to speculate on defeat.",
    ],
  },
  genghis: {
    name: "Genghis Khan",
    majorOrders: [{ type: "feigned_retreat", line: "Draw them forward, then strike from range.", inspiredBy: "Steppe feigned retreat" }],
    preferredActions: ["flank_attack", "cavalry_charge"],
    traits: { aggression: 9, control: 7, creativity: 6, panicResistance: 8 },
    signature: { name: "Feigned Retreat", type: "feigned_retreat", duration: 5, description: "Cavalry retreats and attacks at range 2 for 5 turns." },
    signatureQuotes: {
      feigned_retreat: [
        "I am the punishment of God...",
        "Draw them out, then close the ring.",
        "Ride light, vanish, and return with steel.",
      ],
    },
    chargeDescription: "Charges when Cavalry inflicts Morale Damage.",
    victoryQuotes: [
      "The greatest happiness is to scatter your enemy.",
      "Even when a friend does something you do not like, he continues to be your friend.",
      "With Heaven's aid, we have struck and prevailed.",
    ],
    defeatQuotes: [
      "Walls can be rebuilt; horsemen can return.",
      "A setback is a road, not an end.",
      "Ride light, regroup, and strike where they weaken.",
    ],
  },
  washington: {
    name: "George Washington",
    majorOrders: [{ type: "defensive_stand", line: "Stand firm and withdraw in good order.", inspiredBy: "Battle of Long Island" }],
    preferredActions: ["defensive_stand", "defend_flank"],
    traits: { aggression: 3, control: 7, creativity: 5, panicResistance: 9 },
    signature: { name: "Fighting Withdrawal", type: "fighting_withdrawal", duration: 5, description: "The army retreats and recovers morale, firing at double range and recovering morale while active." },
    signatureQuotes: {
      fighting_withdrawal: [
        "Discipline is the soul of an army.",
        "Yield ground in order; preserve the force.",
        "A steady withdrawal is strength, not weakness.",
      ],
    },
    chargeDescription: "Charges when losses stay below the enemy's losses.",
    victoryQuotes: [
      "Perseverance and spirit have done wonders in all ages.",
      "Discipline is the soul of an army.",
      "By patience and order, we have carried the day.",
    ],
    defeatQuotes: [
      "To be prepared for war is one of the most effectual means of preserving peace.",
      "We must reform, regroup, and return with steadiness.",
      "Let us raise a standard to which the wise and honest can repair.",
    ],
  },
  mcclellan: {
    name: "George B. McClellan",
    reelsShortName: "McClellan",
    majorOrders: [{ type: "defensive_stand", line: "Prepare every detail, then strike with precision.", inspiredBy: "Peninsula Campaign planning" }],
    preferredActions: ["defensive_stand", "rally"],
    traits: { aggression: 0, control: 7, creativity: 3, panicResistance: 8 },
    signature: { name: "The Perfect Plan", type: "perfect_plan", duration: 5, description: "All units hold for 5 turns, then force an offensive action with +20% damage until the next major action turn." },
    signatureQuotes: {
      perfect_plan: [
        "Let no detail be left to chance.",
        "We move when every piece is in place.",
        "Preparation first; decisive action next.",
      ],
    },
    chargeDescription: "Charges from preserving formations.",
    victoryQuotes: [
      "By preparation and precision, we prevailed.",
      "Nothing is lost by deliberation joined to action.",
      "The plan held, and so did the line.",
    ],
    defeatQuotes: [
      "The Seven Days proved caution cannot stop momentum alone.",
      "On the Peninsula, delay cost the initiative.",
      "A careful plan still needs a decisive hour.",
    ],
  },
  caesar: {
    name: "Julius Caesar",
    majorOrders: [{ type: "mass_assault", line: "Cross the Rubicon and crush their line.", inspiredBy: "The crossing of the Rubicon" }],
    preferredActions: ["mass_assault", "exploit_gap"],
    traits: { aggression: 8, control: 8, creativity: 8, panicResistance: 8 },
    signature: { name: "Cross the Rubicon", type: "cross_rubicon", duration: 5, description: "All units are pinned to 120% morale while launching a mass assault." },
    signatureQuotes: {
      cross_rubicon: [
        "The die is cast.",
        "Cross now. No step backward.",
        "Press all divisions. Break them utterly.",
      ],
    },
    chargeDescription: "Charges with relentless frontline losses and tempo.",
    victoryQuotes: [
      "I came, I saw, I conquered.",
      "Fortune favors the bold.",
      "Their line broke before Roman resolve.",
    ],
    defeatQuotes: [
      "Even Rome must regroup to win tomorrow.",
      "The Rubicon is crossed only once; we will return stronger.",
      "Experience is the teacher of all things.",
    ],
  },
  chaos: {
    name: "General Chaos",
    majorOrders: [{ type: "defensive_stand", line: "Let chaos reign!", inspiredBy: "Chaos theory" }],
    traits: { aggression: 5, control: 5, creativity: 10, panicResistance: 7 },
    signature: { name: "Chaos Reigns", type: "chaos_reigns", duration: 5, description: "Picks a random signature ability from all other commanders." },
    signatureQuotes: {
      artillery_barrage: ["Fire at everything! Let the guns decide!", "Bombard chaos!", "Random shells for random people!"],
      foot_cavalry: ["Run fast, don't think!", "Speed is its own form of chaos!", "Forget formations, just move!"],
      feigned_retreat: ["Are we retreating? Attacking? Both!", "Confuse them by confusing ourselves!", "Retreat forward!"],
      fighting_withdrawal: ["Fighting or fleeing? Who can tell!", "Orderly chaos - the best kind!", "Fall back chaotically!"],
      perfect_plan: ["The plan is that there is no plan!", "Chaos is the plan!", "Perfectly unpredictable!"],
      cross_rubicon: ["Cross something dramatic and charge!", "No going back now, chaos legion!", "Rubicon crossed. Consequences optional!"],
    },
    chargeDescription: "Randomly unleashes another general's ability!",
    victoryQuotes: [
      "Chaos wins again!",
      "Order is overrated!",
      "The dice gods smile upon chaos!",
    ],
    defeatQuotes: [
      "Even chaos can't beat bad luck.",
      "Not chaotic enough. Next time, more chaos!",
      "The chaos was insufficient.",
    ],
  },
};

const ORDERS = ["Hold", "Advance", "Attack", "Flank Left", "Flank Right", "Retreat", "Withdraw", "Refuse Flank", "Support Center", "Bombard", "Charge", "Cavalry Charge", "Stay in Reserve", "Stay on Flanks", "Stay in Rear"];
const MAJOR_ACTIONS = ["advance", "concentrate_center", "flank_attack", "cavalry_charge", "defensive_stand", "bombard_sector", "defend_flank", "rally", "retreat", "mass_assault", "line_rotation", "exploit_gap", "commit_reserve"];
const FRONTLINE_DIVISION_IDS = ["left", "center", "right"];
const SPECIAL_DIVISION_IDS = ["cavalry", "artillery"];
const DIVISION_IDS = [...FRONTLINE_DIVISION_IDS, "reserve", ...SPECIAL_DIVISION_IDS];

const state = {
  mode: "terrain",
  brushTerrain: "plain",
  brushUnitType: "infantry",
  unitAction: "place",
  brushArmy: "A",
  map: { width: 17, height: 17, hexes: [] },
  baseBattleSideLength: 9,
  reelsBattleSideLength: 7,
  currentBattleSideLength: 9,
  armies: {},
  selectedUnitId: null,
  moveSourceUnitId: null,
  selectedWingUnits: new Set(),
  wingDragActive: false,
  wingDragMoved: false,
  wingDragLastHex: null,
  turn: 0,
  seed: 48192,
  turnLimit: 20,
  actionInterval: 5,
  defeatThresholdPercent: 60,
  reelsMode: false,
  reelsUnitScale: 2,
  simSpeed: "slow",
  audioEnabled: true,
  audioVolume: 1,
  selectedReelsIntroAudio: "none",
  running: false,
  turnInProgress: false,
  pendingTurnDamage: null,
  pendingTurnPrelude: null,
  simTimer: null,
  actionHighlights: [],
  actionHighlightVisuals: {},
  battleOverlay: null,
  reelsCommanderQuote: { A: null, B: null },
  signatureCinematics: { A: null, B: null },
  pendingKillSfx: [],
  pendingMajorActionSfx: [],
  pendingVictorySfx: false,
  ultPortraitTuning: { enabled: false, side: "A", step: 4, scaleStep: 0.02, zStep: 1, showOverlay: true },
  unitAnimations: {},
  animationFramePending: false,
  replay: { seed: 0, turns: [], finalResult: null },
  turnZeroSnapshot: null,
  armyConfig: {
    A: { infantry: 8, cavalry: 2, artillery: 2 },
    B: { infantry: 10, cavalry: 1, artillery: 3 },
  },
};

const els = {
  canvas: document.getElementById("mapCanvas"),
  title: document.querySelector(".topbar h1"),
  subtitle: document.getElementById("subtitle"),
  modeTabs: document.getElementById("modeTabs"),
  toolPanel: document.getElementById("toolPanel"),
  selectionInfo: document.getElementById("selectionInfo"),
  armyAInfo: document.getElementById("armyAInfo"),
  armyBInfo: document.getElementById("armyBInfo"),
  banner: document.getElementById("eventBanner"),
  log: document.getElementById("log"),
  seedInput: document.getElementById("seedInput"),
  turnLimitInput: document.getElementById("turnLimitInput"),
  defeatInput: document.getElementById("defeatInput"),
  scenarioLibrary: document.getElementById("scenarioLibrary"),
  scenarioNameInput: document.getElementById("scenarioNameInput"),
  saveNamedScenarioBtn: document.getElementById("saveNamedScenarioBtn"),
  closeLibraryBtn: document.getElementById("closeLibraryBtn"),
  scenarioList: document.getElementById("scenarioList"),
  simSpeedSelect: document.getElementById("simSpeedSelect"),
  audioToggleBtn: document.getElementById("audioToggleBtn"),
  importScenarioBtn: document.getElementById("importScenarioBtn"),
  importScenarioInput: document.getElementById("importScenarioInput"),
  reelsModeBtn: document.getElementById("reelsModeBtn"),
  reelsHud: document.getElementById("reelsHud"),
  reelsBluePortrait: document.getElementById("reelsBluePortrait"),
  reelsRedPortrait: document.getElementById("reelsRedPortrait"),
  reelsBlueName: document.getElementById("reelsBlueName"),
  reelsRedName: document.getElementById("reelsRedName"),
  reelsBlueTraits: document.getElementById("reelsBlueTraits"),
  reelsRedTraits: document.getElementById("reelsRedTraits"),
  reelsBlueQuote: document.getElementById("reelsBlueQuote"),
  reelsRedQuote: document.getElementById("reelsRedQuote"),
  reelsBlueMiniTraits: document.getElementById("reelsBlueMiniTraits"),
  reelsRedMiniTraits: document.getElementById("reelsRedMiniTraits"),
  reelsBlueHealthFill: document.getElementById("reelsBlueHealthFill"),
  reelsRedHealthFill: document.getElementById("reelsRedHealthFill"),
  reelsBlueAbilityFill: document.getElementById("reelsBlueAbilityFill"),
  reelsRedAbilityFill: document.getElementById("reelsRedAbilityFill"),
  reelsPowerLeft: document.getElementById("reelsPowerLeft"),
  reelsPowerRight: document.getElementById("reelsPowerRight"),
  reelsBlueAbilityLabel: document.getElementById("reelsBlueAbilityLabel"),
  reelsRedAbilityLabel: document.getElementById("reelsRedAbilityLabel"),
  reelsBlueTitleName: document.getElementById("reelsBlueTitleName"),
  reelsRedTitleName: document.getElementById("reelsRedTitleName"),
  reelsNextAction: document.getElementById("reelsNextAction"),
  reelsBlueOrderName: document.getElementById("reelsBlueOrderName"),
  reelsRedOrderName: document.getElementById("reelsRedOrderName"),
  reelsBlueOrderDesc: document.getElementById("reelsBlueOrderDesc"),
  reelsRedOrderDesc: document.getElementById("reelsRedOrderDesc"),
  reelsMapWrap: document.getElementById("reelsMapWrap"),
  orderPopupLayer: document.getElementById("orderPopupLayer"),
  reelsSideControls: document.getElementById("reelsSideControls"),
  reelsSideSimBtn: document.getElementById("reelsSideSimBtn"),
  reelsSideStepBtn: document.getElementById("reelsSideStepBtn"),
  reelsSideModeBtn: document.getElementById("reelsSideModeBtn"),
  reelsIntroAudioSelect: document.getElementById("reelsIntroAudioSelect"),
  audioVolumeRange: document.getElementById("audioVolumeRange"),
  reelsTurnCounter: document.getElementById("reelsTurnCounter"),
};

const REELS_MUSIC = {
  A: null,
  B: null,
};

const REELS_SIGNATURE_SFX = {
  artillery_barrage: null,
  fighting_withdrawal: null,
};

const REELS_PREBATTLE_AUDIO = {
  napoleon_vs_gw: "./assets/reels-battle-audio/napoleon-vs-gw.mp3",
};

let reelsPrebattleAudioEl = null;

function ensureReelsPrebattleAudioEl() {
  if (!reelsPrebattleAudioEl) {
    reelsPrebattleAudioEl = new Audio();
    reelsPrebattleAudioEl.preload = "auto";
    reelsPrebattleAudioEl.crossOrigin = "anonymous";
    const ac = getCombatAudioContext();
    if (ac) {
      try {
        COMBAT_AUDIO.prebattleSource = ac.createMediaElementSource(reelsPrebattleAudioEl);
        COMBAT_AUDIO.prebattleSource.connect(getCombatOutputNode(ac));
      } catch (_) {
        COMBAT_AUDIO.prebattleSource = null;
      }
    }
    applyAudioVolumeToMedia();
  }
  return reelsPrebattleAudioEl;
}

function stopReelsPrebattleAudio() {
  if (!reelsPrebattleAudioEl) return;
  reelsPrebattleAudioEl.pause();
  try {
    reelsPrebattleAudioEl.currentTime = 0;
  } catch (_) {}
}

function playSelectedReelsPrebattleAudio(onDone) {
  if (!state.audioEnabled) return false;
  const key = state.selectedReelsIntroAudio;
  const src = REELS_PREBATTLE_AUDIO[key];
  if (!src) return false;
  const audio = ensureReelsPrebattleAudioEl();
  audio.src = src;
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    audio.onended = null;
    audio.onerror = null;
    if (typeof onDone === "function") onDone();
  };
  audio.onended = done;
  audio.onerror = done;
  const maybePromise = audio.play();
  if (maybePromise && typeof maybePromise.catch === "function") {
    maybePromise.catch(() => done());
  }
  return true;
}

function setReelsLeaderTrack(side, src) {
  if (!REELS_MUSIC[side]) {
    REELS_MUSIC[side] = new Audio();
    REELS_MUSIC[side].preload = "auto";
  }
  REELS_MUSIC[side].src = src;
  applyAudioVolumeToMedia();
}

window.setReelsLeaderTrack = setReelsLeaderTrack;

function setReelsSignatureSfx(signatureType, src) {
  if (!REELS_SIGNATURE_SFX[signatureType]) {
    REELS_SIGNATURE_SFX[signatureType] = new Audio();
    REELS_SIGNATURE_SFX[signatureType].preload = "auto";
  }
  REELS_SIGNATURE_SFX[signatureType].src = src;
  applyAudioVolumeToMedia();
}

window.setReelsSignatureSfx = setReelsSignatureSfx;

const SCENARIO_API = "/api/scenarios";
const PORTRAITS = {
  napoleon: loadPortrait("./assets/commanders/napoleon.png"),
  lee: loadPortrait("./assets/commanders/lee.jpg"),
  genghis: loadPortrait("./assets/commanders/genghis.jpg"),
  washington: loadPortrait("./assets/commanders/washington.png"),
  mcclellan: loadPortrait("./assets/commanders/mcclellan.png"),
  caesar: loadPortrait("./assets/commanders/caesar.png"),
  chaos: loadPortrait("./assets/commanders/general chaos.png"),
};
const PORTRAITS_ULT = {
  napoleon: loadPortrait("./assets/commanders/napoleon-ult.png"),
  washington: loadPortrait("./assets/commanders/washington-ult.png"),
};
const ULT_PORTRAIT_LAYOUT = {
  "napoleon:artillery_barrage": {
    A: { offsetX: -56, offsetY: -24, scale: 1.34, z: 8 },
    B: { offsetX: 56, offsetY: -24, scale: 1.34, z: 8 },
  },
  "washington:fighting_withdrawal": {
    A: { offsetX: -34, offsetY: -16, scale: 1.24, z: 8 },
    B: { offsetX: 34, offsetY: -16, scale: 1.24, z: 8 },
  },
};

function setUltPortraitLayout(signatureKey, side, patch) {
  if (!signatureKey || (side !== "A" && side !== "B")) return;
  if (!ULT_PORTRAIT_LAYOUT[signatureKey]) ULT_PORTRAIT_LAYOUT[signatureKey] = {};
  const current = ULT_PORTRAIT_LAYOUT[signatureKey][side] || { offsetX: 0, offsetY: 0, scale: 1, z: 8 };
  ULT_PORTRAIT_LAYOUT[signatureKey][side] = { ...current, ...(patch || {}) };
}

window.setUltPortraitLayout = setUltPortraitLayout;
window.getUltPortraitLayout = () => JSON.parse(JSON.stringify(ULT_PORTRAIT_LAYOUT));
const UNIT_ICONS = {
  A: {
    infantry: loadIcon("./assets/icons/infantry-blue.png"),
    cavalry: loadIcon("./assets/icons/cavalry-blue.png"),
    artillery: loadIcon("./assets/icons/artillery-blue.png"),
  },
  B: {
    infantry: loadIcon("./assets/icons/infantry-red.png"),
    cavalry: loadIcon("./assets/icons/cavalry-red.png"),
    artillery: loadIcon("./assets/icons/artillery-red.png"),
  },
};
const MORALE_ICONS = {
  high: loadIcon("./assets/icons/gainmorale.png"),
  low: loadIcon("./assets/icons/lossmorale.png"),
  critical: loadIcon("./assets/icons/lossalotofmorale.png"),
};
const SIGNATURE_ICONS = {
  explosion: loadIcon("./assets/icons/explosion.png"),
  usFlag: loadIcon("./assets/icons/us-flag.png"),
  gunsmoke: loadIcon("./assets/icons/gunsmoke.png"),
};

const COMBAT_AUDIO = {
  context: null,
  masterGain: null,
  prebattleSource: null,
};

const AUDIO_TUNING = {
  killSfxGain: 0.52,
  ultWashingtonGain: 1.4,
  ultNapoleonGain: 0.9,
  victoryDingGain: 1.4,
  actionBellGain: 0.6,
  startBellGain: 1,
  startBellStrikeGapSec: 0.15,
  startBellWaitMs: 600,
  artilleryImpactBoomGain: 0.95,
};

function getCombatAudioContext() {
  if (!state.audioEnabled) return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!COMBAT_AUDIO.context) COMBAT_AUDIO.context = new Ctx();
  if (COMBAT_AUDIO.context.state === "suspended") {
    COMBAT_AUDIO.context.resume().catch(() => {});
  }
  return COMBAT_AUDIO.context;
}

function getCombatOutputNode(ac) {
  if (!COMBAT_AUDIO.masterGain) {
    COMBAT_AUDIO.masterGain = ac.createGain();
    COMBAT_AUDIO.masterGain.connect(ac.destination);
  }
  COMBAT_AUDIO.masterGain.gain.value = state.audioEnabled ? Math.max(0, Math.min(3, state.audioVolume || 0)) : 0;
  return COMBAT_AUDIO.masterGain;
}

function applyAudioVolumeToMedia() {
  const vol = state.audioEnabled ? Math.max(0, Math.min(3, state.audioVolume || 0)) : 0;
  [REELS_MUSIC.A, REELS_MUSIC.B, REELS_SIGNATURE_SFX.artillery_barrage, REELS_SIGNATURE_SFX.fighting_withdrawal, reelsPrebattleAudioEl]
    .forEach((a) => {
      if (!a) return;
      a.volume = a === reelsPrebattleAudioEl ? 1 : Math.min(1, vol);
    });
  if (COMBAT_AUDIO.masterGain) {
    COMBAT_AUDIO.masterGain.gain.value = vol;
  }
}

function playUnitKillSfx(unitType, delaySec = 0) {
  const ac = getCombatAudioContext();
  if (!ac) return;
  const outNode = getCombatOutputNode(ac);
  const now = ac.currentTime + Math.max(0, delaySec);
  const out = ac.createGain();
  out.connect(outNode);
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(AUDIO_TUNING.killSfxGain, now + 0.008);
  out.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

  if (unitType === "infantry") {
    const osc = ac.createOscillator();
    const noise = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2100, now);
    const len = Math.floor(ac.sampleRate * 0.22);
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2) - 1;
    noise.buffer = buffer;

    osc.type = "square";
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.14);

    osc.connect(out);
    noise.connect(filter);
    filter.connect(out);
    osc.start(now);
    noise.start(now);
    osc.stop(now + 0.16);
    noise.stop(now + 0.19);
    return;
  }

  if (unitType === "cavalry") {
    const hit1 = ac.createOscillator();
    const hit2 = ac.createOscillator();
    const ring = ac.createGain();
    ring.gain.setValueAtTime(0.001, now);
    ring.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
    ring.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    hit1.type = "triangle";
    hit2.type = "triangle";
    hit1.frequency.setValueAtTime(820, now);
    hit2.frequency.setValueAtTime(1160, now);
    hit1.frequency.exponentialRampToValueAtTime(380, now + 0.22);
    hit2.frequency.exponentialRampToValueAtTime(520, now + 0.2);
    hit1.connect(ring);
    hit2.connect(ring);
    ring.connect(out);
    hit1.start(now);
    hit2.start(now + 0.008);
    hit1.stop(now + 0.24);
    hit2.stop(now + 0.22);
    return;
  }

  const low = ac.createOscillator();
  const boomNoise = ac.createBufferSource();
  const lowpass = ac.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(260, now);
  const len = Math.floor(ac.sampleRate * 0.5);
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2) - 1;
  boomNoise.buffer = buffer;

  low.type = "sine";
  low.frequency.setValueAtTime(95, now);
  low.frequency.exponentialRampToValueAtTime(48, now + 0.32);
  low.connect(out);
  boomNoise.connect(lowpass);
  lowpass.connect(out);
  low.start(now);
  boomNoise.start(now);
  low.stop(now + 0.34);
  boomNoise.stop(now + 0.46);
}

function playSignatureUltSfx(sigType) {
  const ac = getCombatAudioContext();
  if (!ac) return;
  const outNode = getCombatOutputNode(ac);
  const now = ac.currentTime;

  if (sigType === "fighting_withdrawal") {
    const notes = [523.25, 523.25, 587.33, 659.25, 523.25, 659.25, 587.33, 440.0];
    notes.forEach((hz, i) => {
      const t = now + (i * 0.17);
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(hz, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(AUDIO_TUNING.ultWashingtonGain, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain);
      gain.connect(outNode);
      osc.start(t);
      osc.stop(t + 0.17);
    });
    return;
  }

  if (sigType === "artillery_barrage") {
    const bangs = 6;
    for (let i = 0; i < bangs; i += 1) {
      const t = now + (i * 0.09);
      const noise = ac.createBufferSource();
      const crack = ac.createOscillator();
      const snap = ac.createOscillator();
      const bandpass = ac.createBiquadFilter();
      const highpass = ac.createBiquadFilter();
      const gain = ac.createGain();

      crack.type = "square";
      crack.frequency.setValueAtTime(230 - (i * 6), t);
      crack.frequency.exponentialRampToValueAtTime(110, t + 0.1);
      snap.type = "triangle";
      snap.frequency.setValueAtTime(900, t);
      snap.frequency.exponentialRampToValueAtTime(280, t + 0.07);

      bandpass.type = "bandpass";
      bandpass.frequency.setValueAtTime(1650, t);
      highpass.type = "highpass";
      highpass.frequency.setValueAtTime(220, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, AUDIO_TUNING.ultNapoleonGain * 0.7), t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

      const len = Math.floor(ac.sampleRate * 0.2);
      const buffer = ac.createBuffer(1, len, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let s = 0; s < len; s += 1) data[s] = (Math.random() * 2) - 1;
      noise.buffer = buffer;

      crack.connect(gain);
      snap.connect(gain);
      noise.connect(bandpass);
      bandpass.connect(highpass);
      highpass.connect(gain);
      gain.connect(outNode);

      crack.start(t);
      snap.start(t + 0.003);
      noise.start(t);
      crack.stop(t + 0.12);
      snap.stop(t + 0.09);
      noise.stop(t + 0.2);
    }
    return;
  }
}

function playArtilleryImpactBoomSfx(delaySec = 0, gainMult = 1) {
  const ac = getCombatAudioContext();
  if (!ac) return;
  const outNode = getCombatOutputNode(ac);
  const t = ac.currentTime + Math.max(0, delaySec);
  const noise = ac.createBufferSource();
  const low = ac.createOscillator();
  const snap = ac.createOscillator();
  const lowpass = ac.createBiquadFilter();
  const band = ac.createBiquadFilter();
  const out = ac.createGain();
  const g = Math.max(0.0001, AUDIO_TUNING.artilleryImpactBoomGain * AUDIO_TUNING.ultNapoleonGain * gainMult);

  low.type = "sine";
  low.frequency.setValueAtTime(118, t);
  low.frequency.exponentialRampToValueAtTime(42, t + 0.42);
  snap.type = "triangle";
  snap.frequency.setValueAtTime(920, t);
  snap.frequency.exponentialRampToValueAtTime(210, t + 0.09);

  lowpass.type = "lowpass";
  lowpass.frequency.setValueAtTime(220, t);
  band.type = "bandpass";
  band.frequency.setValueAtTime(1200, t);

  const len = Math.floor(ac.sampleRate * 0.5);
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2) - 1;
  noise.buffer = buffer;

  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(g, t + 0.006);
  out.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);

  low.connect(lowpass);
  lowpass.connect(out);
  snap.connect(out);
  noise.connect(band);
  band.connect(out);
  out.connect(outNode);

  low.start(t);
  snap.start(t);
  noise.start(t);
  low.stop(t + 0.44);
  snap.stop(t + 0.11);
  noise.stop(t + 0.5);
}

function playMajorActionIssuedSfx(side, action, delaySec = 0) {
  const ac = getCombatAudioContext();
  if (!ac) return;
  const outNode = getCombatOutputNode(ac);
  const now = ac.currentTime + Math.max(0, delaySec);
  const base = side === "A" ? 1046.5 : 987.77;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(base, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(AUDIO_TUNING.actionBellGain, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  osc.connect(gain);
  gain.connect(outNode);
  osc.start(now);
  osc.stop(now + 0.3);
}

function playVictoryDingSfx(delaySec = 0) {
  const ac = getCombatAudioContext();
  if (!ac) return;
  const outNode = getCombatOutputNode(ac);
  const now = ac.currentTime + Math.max(0, delaySec);
  const notes = [784, 988, 1175];
  notes.forEach((hz, i) => {
    const t = now + (i * 0.09);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(hz, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(AUDIO_TUNING.victoryDingGain, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain);
    gain.connect(outNode);
    osc.start(t);
    osc.stop(t + 0.21);
  });
}

function playBattleStartBellSfx(delaySec = 0) {
  const ac = getCombatAudioContext();
  if (!ac) return 0;
  const outNode = getCombatOutputNode(ac);
  const start = ac.currentTime + Math.max(0, delaySec);
  const strikes = [0, Math.max(0.2, Number(AUDIO_TUNING.startBellStrikeGapSec) || 1.25)];
  strikes.forEach((offset) => {
    const t = start + offset;
    const partials = [1568, 2093, 2637, 3136];
    const bellGain = Math.max(0.0001, Number(AUDIO_TUNING.startBellGain) || 1);
    const levels = [0.7 * bellGain, 0.45 * bellGain, 0.28 * bellGain, 0.15 * bellGain];
    partials.forEach((hz, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = i % 2 === 0 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(hz, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(levels[i], t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42 + (i * 0.06));
      osc.connect(gain);
      gain.connect(outNode);
      osc.start(t);
      osc.stop(t + 0.48 + (i * 0.08));
    });

    const hit = ac.createOscillator();
    const hitGain = ac.createGain();
    hit.type = "triangle";
    hit.frequency.setValueAtTime(3300, t);
    hit.frequency.exponentialRampToValueAtTime(1700, t + 0.026);
    hitGain.gain.setValueAtTime(0.0001, t);
    hitGain.gain.exponentialRampToValueAtTime(0.58, t + 0.0015);
    hitGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    hit.connect(hitGain);
    hitGain.connect(outNode);
    hit.start(t);
    hit.stop(t + 0.045);
  });
  return Math.max(300, Number(AUDIO_TUNING.startBellWaitMs) || 2600);
}
const COMMANDER_ACCENT = {
  napoleon: "#123d8d",
  genghis: "#5db9ff",
  lee: "#b22222",
  washington: "#2e8b57",
  mcclellan: "#44586f",
  caesar: "#7a1f1f",
  chaos: "#8B008B",
};

const ctx = els.canvas.getContext("2d");
let HEX_SIZE = 28;
let MAP_ORIGIN_X = 60;
let MAP_ORIGIN_Y = 60;

function rngFactory(seed) {
  let s = seed >>> 0;
  return function rand() {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function getSimStepDelayMs() {
  const map = { very_slow: 1250, slow: 800, normal: 450, fast: 150 };
  return map[state.simSpeed] || 800;
}

function getAnimationDurationMs() {
  const map = { very_slow: 760, slow: 500, normal: 260, fast: 100 };
  return map[state.simSpeed] || 500;
}

function loadPortrait(src) {
  const img = new Image();
  img.src = src;
  return img;
}

function loadIcon(src) {
  const img = new Image();
  img.onload = () => {
    if (typeof render === "function") render();
  };
  img.src = src;
  return img;
}
