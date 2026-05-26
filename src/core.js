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
  },
  lee: {
    name: "Robert E. Lee",
    majorOrders: [{ type: "flank_attack", line: "Strike the exposed flank.", inspiredBy: "Chancellorsville" }],
    preferredActions: ["flank_attack", "rally"],
    traits: { aggression: 5, control: 7, creativity: 9, panicResistance: 7 },
    signature: { name: "Jackson's Foot Cavalry", type: "foot_cavalry", duration: 5, description: "Infantry gains +1 move and morale shock in one sector for 5 turns." },
  },
  genghis: {
    name: "Genghis Khan",
    majorOrders: [{ type: "feigned_retreat", line: "Draw them forward, then strike from range.", inspiredBy: "Steppe feigned retreat" }],
    preferredActions: ["flank_attack", "cavalry_charge"],
    traits: { aggression: 9, control: 3, creativity: 9, panicResistance: 8 },
    signature: { name: "Feigned Retreat", type: "feigned_retreat", duration: 5, description: "Cavalry retreats and attacks at range 2 for 5 turns." },
  },
  washington: {
    name: "George Washington",
    majorOrders: [{ type: "defensive_stand", line: "Stand firm and withdraw in good order.", inspiredBy: "Battle of Long Island" }],
    preferredActions: ["defensive_stand", "defend_flank"],
    traits: { aggression: 3, control: 9, creativity: 6, panicResistance: 9 },
    signature: { name: "Fighting Withdrawal", type: "fighting_withdrawal", duration: 5, description: "Target sector retreats, recovers 20% morale once, and takes 20% less damage for 5 turns." },
  },
  mcclellan: {
    name: "George B. McClellan",
    majorOrders: [{ type: "defensive_stand", line: "Prepare every detail, then strike with precision.", inspiredBy: "Peninsula Campaign planning" }],
    preferredActions: ["defensive_stand", "rally"],
    traits: { aggression: 0, control: 9, creativity: 3, panicResistance: 8 },
    signature: { name: "The Perfect Plan", type: "perfect_plan", duration: 5, description: "All units hold for 5 turns, then force an offensive action with +20% damage until the next major action turn." },
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
  simSpeed: "normal",
  running: false,
  simTimer: null,
  actionHighlights: [],
  battleOverlay: null,
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
  reelsBlueHealthFill: document.getElementById("reelsBlueHealthFill"),
  reelsRedHealthFill: document.getElementById("reelsRedHealthFill"),
  reelsBlueAbilityFill: document.getElementById("reelsBlueAbilityFill"),
  reelsRedAbilityFill: document.getElementById("reelsRedAbilityFill"),
  reelsBlueAbilityLabel: document.getElementById("reelsBlueAbilityLabel"),
  reelsRedAbilityLabel: document.getElementById("reelsRedAbilityLabel"),
  orderPopupLayer: document.getElementById("orderPopupLayer"),
  reelsSideControls: document.getElementById("reelsSideControls"),
  reelsSideSimBtn: document.getElementById("reelsSideSimBtn"),
  reelsSideStepBtn: document.getElementById("reelsSideStepBtn"),
  reelsSideModeBtn: document.getElementById("reelsSideModeBtn"),
};

const SCENARIO_API = "/api/scenarios";
const PORTRAITS = {
  napoleon: loadPortrait("./assets/commanders/napoleon.jpeg"),
  lee: loadPortrait("./assets/commanders/lee.jpg"),
  genghis: loadPortrait("./assets/commanders/genghis.jpg"),
  washington: loadPortrait("./assets/commanders/washington.jpeg"),
  mcclellan: loadPortrait("./assets/commanders/mcclellan.jpg"),
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
