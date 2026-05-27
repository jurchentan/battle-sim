const TERRAIN = ["plain", "hill", "forest", "river", "road", "town", "blocked"];
const MODES = ["terrain", "units", "wings", "commanders", "armies", "rules"];
const UNIT_BASE = {
  infantry: { strength: 250, morale: 100, move: 1, range: 1, attack: 12 },
  cavalry: { strength: 180, morale: 100, move: 2, range: 1, attack: 10 },
  artillery: { strength: 120, morale: 100, move: 1, range: 2, attack: 8 },
};

const COMMANDERS = {
  napoleon: {
    name: "Napoleon",
    majorOrders: [{ type: "artillery_concentration", line: "Concentrate the guns and break their center.", inspiredBy: "Austerlitz" }],
    preferredActions: ["concentrate_center", "bombard_sector"],
    traits: { aggression: 8, control: 8, creativity: 9, panicResistance: 9 },
    signature: { name: "Grand Battery", type: "artillery_barrage", duration: 5, description: "Artillery deals x2 damage in one sector for 5 turns." },
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
    traits: { aggression: 9, control: 3, creativity: 9, panicResistance: 8 },
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
    traits: { aggression: 3, control: 9, creativity: 6, panicResistance: 9 },
    signature: { name: "Fighting Withdrawal", type: "fighting_withdrawal", duration: 5, description: "Target sector retreats, recovers 20% morale once, and takes 20% less damage for 5 turns." },
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
    majorOrders: [{ type: "defensive_stand", line: "Prepare every detail, then strike with precision.", inspiredBy: "Peninsula Campaign planning" }],
    preferredActions: ["defensive_stand", "rally"],
    traits: { aggression: 0, control: 9, creativity: 3, panicResistance: 8 },
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
  simSpeed: "normal",
  running: false,
  simTimer: null,
  actionHighlights: [],
  battleOverlay: null,
  reelsCommanderQuote: { A: null, B: null },
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
  reelsTurnCounter: document.getElementById("reelsTurnCounter"),
};

const SCENARIO_API = "/api/scenarios";
const PORTRAITS = {
  napoleon: loadPortrait("./assets/commanders/napoleon.jpeg"),
  lee: loadPortrait("./assets/commanders/lee.jpg"),
  genghis: loadPortrait("./assets/commanders/genghis.jpg"),
  washington: loadPortrait("./assets/commanders/washington.jpeg"),
  mcclellan: loadPortrait("./assets/commanders/mcclellan.jpg"),
  chaos: loadPortrait("./assets/commanders/general chaos.png"),
};
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
  low: loadIcon("./assets/icons/lossmorale.png"),
  critical: loadIcon("./assets/icons/lossalotofmorale.png"),
};
const COMMANDER_ACCENT = {
  napoleon: "#123d8d",
  genghis: "#5db9ff",
  lee: "#b22222",
  washington: "#2e8b57",
  mcclellan: "#44586f",
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
  const map = { slow: 800, normal: 450, fast: 150 };
  return map[state.simSpeed] || 450;
}

function getAnimationDurationMs() {
  const map = { slow: 500, normal: 260, fast: 100 };
  return map[state.simSpeed] || 260;
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
