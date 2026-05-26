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

const ORDERS = ["Hold", "Advance", "Attack", "Flank Left", "Flank Right", "Retreat", "Withdraw", "Refuse Flank", "Support Center", "Bombard", "Charge", "Cavalry Charge"];
const MAJOR_ACTIONS = ["advance", "concentrate_center", "flank_attack", "cavalry_charge", "defensive_stand", "bombard_sector", "defend_flank", "rally", "retreat", "mass_assault", "line_rotation", "exploit_gap", "commit_reserve"];

const state = {
  mode: "terrain",
  brushTerrain: "plain",
  brushUnitType: "infantry",
  unitAction: "place",
  brushArmy: "A",
  map: { width: 17, height: 17, hexes: [] },
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
  napoleon: loadPortrait("./assets/napoleon.jpeg"),
  lee: loadPortrait("./assets/lee.jpg"),
  genghis: loadPortrait("./assets/genghis.jpg"),
  washington: loadPortrait("./assets/washington.jpeg"),
  mcclellan: loadPortrait("./assets/mcclellan.jpg"),
};
const COMMANDER_ACCENT = {
  napoleon: "#123d8d",
  genghis: "#5db9ff",
  lee: "#b22222",
  washington: "#2e8b57",
  mcclellan: "#44586f",
};

const ctx = els.canvas.getContext("2d");
const HEX_SIZE = 28;
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

function init() {
  buildMap();
  buildArmies();
  placeDefaultUnits();
  wireUi();
  renderModeTabs();
  renderToolPanel();
  render();
  log("Ready. Setup your battle and press Simulate.");
}

function buildMap() {
  state.map.hexes = [];
  const centerQ = Math.floor(state.map.width / 2);
  const centerR = Math.floor(state.map.height / 2);
  const radius = 8;
  for (let r = 0; r < state.map.height; r += 1) {
    for (let q = 0; q < state.map.width; q += 1) {
      const active = hexDist(q, r, centerQ, centerR) <= radius;
      state.map.hexes.push({ q, r, terrain: "plain", occupantUnitId: null, active });
    }
  }
}

function buildArmies() {
  state.armies = {
    A: {
      id: "A", name: "Blue Army", color: "#2d6ba8", armyCommanderId: "napoleon", divisions: wingTemplate(), units: [],
      startingUnitCount: 0, defeatedUnitCount: 0,
      currentAction: null, currentSector: "center",
      abilityCharge: 0, abilityReady: false, activeSignature: null,
      majorActionDamageBoost: 1,
      majorActionDamageBoostTurns: 0,
      forcedMajorAction: null,
      forcedMajorSector: null,
    },
    B: {
      id: "B", name: "Red Army", color: "#b0483e", armyCommanderId: "lee", divisions: wingTemplate(), units: [],
      startingUnitCount: 0, defeatedUnitCount: 0,
      currentAction: null, currentSector: "center",
      abilityCharge: 0, abilityReady: false, activeSignature: null,
      majorActionDamageBoost: 1,
      majorActionDamageBoostTurns: 0,
      forcedMajorAction: null,
      forcedMajorSector: null,
    },
  };
  ["A", "B"].forEach((side) => hydrateArmyState(state.armies[side]));
}

function hydrateArmyState(army) {
  if (!COMMANDERS[army.armyCommanderId]) {
    army.armyCommanderId = army.id === "B" ? "lee" : "napoleon";
  }
  if (!army.currentAction) army.currentAction = null;
  if (!army.currentSector) army.currentSector = "center";
  if (army.abilityCharge === undefined) army.abilityCharge = 0;
  if (army.abilityReady === undefined) army.abilityReady = false;
  if (army.activeSignature === undefined) army.activeSignature = null;
  if (army.majorActionDamageBoost === undefined) army.majorActionDamageBoost = 1;
  if (army.majorActionDamageBoostTurns === undefined) army.majorActionDamageBoostTurns = 0;
  if (army.forcedMajorAction === undefined) army.forcedMajorAction = null;
  if (army.forcedMajorSector === undefined) army.forcedMajorSector = null;
  army.units.forEach((u) => {
    const base = UNIT_BASE[u.type];
    if (base) {
      u.move = base.move;
      u.range = base.range;
      u.attack = base.attack;
      if (!u.alive && (u.strength === undefined || u.strength === null)) u.strength = 0;
      if (u.alive && (u.strength === undefined || u.strength === null || u.strength > base.strength)) {
        u.strength = Math.min(base.strength, Number(u.strength) || base.strength);
      }
    }
    if (!u.shockLocks) u.shockLocks = { isolated: false, flanked: false, surrounded: false };
    if (!u.statuses) u.statuses = { cavalryShockTurns: 0 };
    if (u.statuses.cavalryShockTurns === undefined || u.statuses.cavalryShockTurns === null) {
      u.statuses.cavalryShockTurns = 0;
    }
  });
}

function wingTemplate() {
  return {
    // TODO: wing commanders are defined but unused. commanderId is dead data — no logic reads it.
    left: { id: "left", commanderId: "napoleon", unitIds: [], currentOrder: "Hold", lastFrictionEvent: null },
    center: { id: "center", commanderId: "napoleon", unitIds: [], currentOrder: "Hold", lastFrictionEvent: null },
    right: { id: "right", commanderId: "lee", unitIds: [], currentOrder: "Hold", lastFrictionEvent: null },
    reserve: { id: "reserve", commanderId: "washington", unitIds: [], currentOrder: "Hold", lastFrictionEvent: null },
  };
}

function placeDefaultUnits() {
  state.armies.A.units = createUnitsFromMix("A", state.armyConfig.A);
  state.armies.B.units = createUnitsFromMix("B", state.armyConfig.B);
  deployByFormation("A", "line");
  deployByFormation("B", "line", true);
  refreshArmyCounts();
}

function createUnitsFromMix(side, mix) {
  const units = [];
  Object.keys(mix).forEach((type) => {
    for (let i = 0; i < mix[type]; i += 1) {
      units.push(makeUnit(side, type, i + 1));
    }
  });
  return units;
}

function nextUnitIndex(side, type) {
  const prefix = `${side}_${type.slice(0, 3).toUpperCase()}_`;
  const matches = state.armies[side].units
    .map((u) => u.id)
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.slice(prefix.length)) || 0);
  return (matches.length ? Math.max(...matches) : 0) + 1;
}

function makeUnit(side, type, idx) {
  return {
    id: `${side}_${type.slice(0, 3).toUpperCase()}_${String(idx).padStart(2, "0")}`,
    armyId: side,
    divisionId: "center",
    type,
    q: -1,
    r: -1,
    strength: UNIT_BASE[type].strength,
    morale: 100,
    state: "steady",
    move: UNIT_BASE[type].move,
    range: UNIT_BASE[type].range,
    attack: UNIT_BASE[type].attack,
    preferredR: null,
    shockLocks: { isolated: false, flanked: false, surrounded: false },
    statuses: { cavalryShockTurns: 0 },
    currentOrder: "Hold",
    alive: true,
  };
}

function deployByFormation(side, formation, reverse = false) {
  clearArmyOccupants(side);
  const army = state.armies[side];
  const inf = army.units.filter((u) => u.type === "infantry");
  const cav = army.units.filter((u) => u.type === "cavalry");
  const art = army.units.filter((u) => u.type === "artillery");
  const front = deploymentHexesForSide(side);
  const rear = deploymentHexesForSide(side, 1);

  assignWingMembership(army);
  let p = 0;
  const reserveBand = deploymentHexesForSide(side, 2);
  const reserveInfCount = Math.min(inf.length, Math.max(1, Math.floor(inf.length * 0.2)));
  inf.forEach((u, i) => {
    const pos = front[p++] || front[front.length - 1];
    setUnitPos(u, pos.q, pos.r);
    if (i >= inf.length - reserveInfCount) {
      const ri = i - (inf.length - reserveInfCount);
      const rpos = reserveBand[ri] || rear[ri] || pos;
      setUnitPos(u, rpos.q, rpos.r);
      u.divisionId = "reserve";
    } else {
      u.divisionId = i % 3 === 0 ? "left" : i % 3 === 1 ? "center" : "right";
    }
  });

  cav.forEach((u, i) => {
    const idx = i % 2 === 0 ? 0 : Math.max(0, front.length - 1);
    const pos = front[idx] || rear[idx] || front[0];
    setUnitPos(u, pos.q, pos.r);
    u.divisionId = i % 2 === 0 ? "left" : "right";
  });

  art.forEach((u, i) => {
    const pos = rear[Math.floor(rear.length / 2) + i - 1] || rear[Math.floor(rear.length / 2)] || front[Math.floor(front.length / 2)];
    setUnitPos(u, pos.q, pos.r);
    u.divisionId = "center";
  });

  if (formation === "cavalry_wings") {
    cav.forEach((u, i) => {
      const pos = i % 2 === 0 ? front[0] : front[front.length - 1];
      if (pos) setUnitPos(u, pos.q, pos.r);
    });
  }
  if (formation === "artillery_center") {
    art.forEach((u, i) => {
      const pos = rear[Math.floor(rear.length / 2) + i - 1] || rear[Math.floor(rear.length / 2)];
      if (pos) setUnitPos(u, pos.q, pos.r);
    });
  }

  assignWingMembership(army);
}

function deploymentHexesForSide(side, band = 0) {
  const active = state.map.hexes.filter((h) => h.active);
  const sorted = [...active].sort((a, b) => (a.q - b.q) || (a.r - b.r));
  const qGroups = [...new Set(sorted.map((h) => h.q))];
  const pickQ = side === "A"
    ? qGroups.slice(0 + band, 3 + band)
    : qGroups.slice(Math.max(0, qGroups.length - 3 - band), qGroups.length - band);
  const cells = sorted.filter((h) => pickQ.includes(h.q));
  return cells.sort((a, b) => a.r - b.r);
}

function assignWingMembership(army) {
  Object.values(army.divisions).forEach((d) => { d.unitIds = []; });
  army.units.forEach((u) => {
    const w = u.divisionId || "center";
    army.divisions[w].unitIds.push(u.id);
  });
}

function clearArmyOccupants(side) {
  state.map.hexes.forEach((h) => {
    if (h.occupantUnitId && h.occupantUnitId.startsWith(`${side}_`)) h.occupantUnitId = null;
  });
}

function setUnitPos(unit, q, r) {
  const next = getHex(q, r);
  if (!next || !next.active) return false;
  const fromQ = unit.q;
  const fromR = unit.r;
  const current = getHex(unit.q, unit.r);
  if (current && current.occupantUnitId === unit.id) current.occupantUnitId = null;
  unit.q = q;
  unit.r = r;
  if (fromQ !== q || fromR !== r) {
    unit.prevQ = fromQ;
    unit.prevR = fromR;
  }
  if (unit.preferredR === null || unit.preferredR === undefined) unit.preferredR = r;
  next.occupantUnitId = unit.id;
  if (state.reelsMode && fromQ >= 0 && fromR >= 0 && (fromQ !== q || fromR !== r)) {
    const now = performance.now();
    const segment = { fromQ, fromR, toQ: q, toR: r };
    const existing = state.unitAnimations[unit.id];
    if (existing && Array.isArray(existing.segments) && existing.segments.length > 0) {
      existing.segments.push(segment);
      existing.segmentDuration = getAnimationDurationMs();
      state.unitAnimations[unit.id] = existing;
    } else {
      state.unitAnimations[unit.id] = {
        segments: [segment],
        start: now,
        segmentDuration: getAnimationDurationMs(),
      };
    }
  }
  return true;
}

function getHex(q, r) {
  return state.map.hexes.find((h) => h.q === q && h.r === r);
}

function wireUi() {
  document.getElementById("simulateBtn").onclick = toggleSimulation;
  document.getElementById("stepBtn").onclick = stepTurn;
  document.getElementById("resetBtn").onclick = resetBattleState;
  document.getElementById("randomizeSeedBtn").onclick = randomizeSeed;
  document.getElementById("clearTerrainBtn").onclick = clearTerrain;
  document.getElementById("clearArmiesBtn").onclick = clearArmies;
  els.reelsModeBtn.onclick = toggleReelsMode;
  els.reelsSideModeBtn.onclick = toggleReelsMode;
  els.reelsSideSimBtn.onclick = toggleSimulation;
  els.reelsSideStepBtn.onclick = stepTurn;
  document.getElementById("saveScenarioBtn").onclick = openScenarioLibrary;
  document.getElementById("loadScenarioBtn").onclick = openScenarioLibrary;
  els.saveNamedScenarioBtn.onclick = saveScenario;
  els.closeLibraryBtn.onclick = closeScenarioLibrary;
  els.importScenarioBtn.onclick = () => els.importScenarioInput.click();
  els.importScenarioInput.onchange = importScenarioFromFile;

  els.seedInput.value = state.seed;
  els.turnLimitInput.value = state.turnLimit;
  els.turnLimitInput.disabled = true;
  els.turnLimitInput.title = "Turn limit disabled (unlimited turns).";
  els.defeatInput.value = state.defeatThresholdPercent;
  els.seedInput.onchange = () => { state.seed = Number(els.seedInput.value) || state.seed; };
  els.defeatInput.onchange = () => { state.defeatThresholdPercent = Number(els.defeatInput.value) || 60; };
  els.simSpeedSelect.value = state.simSpeed;
  els.simSpeedSelect.onchange = () => { state.simSpeed = els.simSpeedSelect.value; };

  els.canvas.addEventListener("click", onCanvasClick);
  els.canvas.addEventListener("mousedown", onCanvasPointerDown);
  els.canvas.addEventListener("mousemove", onCanvasPointerMove);
  window.addEventListener("mouseup", onCanvasPointerUp);
  updateSimButton();
}

function toggleReelsMode() {
  state.reelsMode = !state.reelsMode;
  document.body.classList.toggle("reels-mode", state.reelsMode);
  els.reelsHud.classList.toggle("hidden", !state.reelsMode);
  els.reelsSideControls.classList.toggle("hidden", !state.reelsMode);
  els.reelsModeBtn.textContent = `Reels Mode: ${state.reelsMode ? "On" : "Off"}`;
  els.reelsSideModeBtn.textContent = `Reels: ${state.reelsMode ? "On" : "Off"}`;
  render();
}

function updateSimButton() {
  const btn = document.getElementById("simulateBtn");
  const sideBtn = els.reelsSideSimBtn;
  if (state.running) {
    btn.textContent = "Pause";
    if (sideBtn) sideBtn.textContent = "Pause";
    return;
  }
  btn.textContent = state.turn > 0 ? "Resume" : "Simulate";
  if (sideBtn) sideBtn.textContent = state.turn > 0 ? "Resume" : "Simulate";
}

function openScenarioLibrary() {
  els.scenarioLibrary.classList.remove("hidden");
  renderScenarioLibrary();
}

function closeScenarioLibrary() {
  els.scenarioLibrary.classList.add("hidden");
}

function resetBattleState() {
  const restored = restoreTurnZeroSnapshot();
  state.turn = 0;
  state.running = false;
  state.replay = { seed: state.seed, turns: [], finalResult: null };
  state.selectedUnitId = null;
  state.moveSourceUnitId = null;
  state.selectedWingUnits.clear();
  state.actionHighlights = [];
  state.battleOverlay = null;
  state.unitAnimations = {};

  if (!restored) {
    placeDefaultUnits();
  }

  ["A", "B"].forEach((side) => {
    const army = state.armies[side];
    army.currentAction = null;
    army.currentSector = "center";
    army.abilityCharge = 0;
    army.abilityReady = false;
    army.activeSignature = null;
    army.majorActionDamageBoost = 1;
    army.majorActionDamageBoostTurns = 0;
    army.forcedMajorAction = null;
    army.forcedMajorSector = null;
    army.units.forEach((u) => {
      u.currentOrder = "Hold";
      if (u.alive) {
        u.strength = UNIT_BASE[u.type].strength;
        u.morale = 100;
        u.state = "steady";
      }
    });
    assignWingMembership(army);
  });

  els.banner.textContent = "Ready.";
  stopSimulationLoop();
  els.seedInput.value = state.seed;
  els.turnLimitInput.value = state.turnLimit;
  els.defeatInput.value = state.defeatThresholdPercent;
  refreshArmyCounts();
  log("Battle reset to turn 0 setup snapshot.");
  render();
}

function captureTurnZeroSnapshot() {
  state.turnZeroSnapshot = JSON.parse(JSON.stringify({
    map: state.map,
    armies: state.armies,
    seed: state.seed,
    turnLimit: state.turnLimit,
    defeatThresholdPercent: state.defeatThresholdPercent,
    armyConfig: state.armyConfig,
  }));
}

function restoreTurnZeroSnapshot() {
  if (!state.turnZeroSnapshot) return false;
  const snap = JSON.parse(JSON.stringify(state.turnZeroSnapshot));
  state.map = snap.map;
  state.armies = snap.armies;
  state.seed = snap.seed;
  state.turnLimit = snap.turnLimit;
  state.defeatThresholdPercent = snap.defeatThresholdPercent;
  state.armyConfig = snap.armyConfig;
  ["A", "B"].forEach((side) => hydrateArmyState(state.armies[side]));
  return true;
}

function renderModeTabs() {
  els.modeTabs.innerHTML = "";
  MODES.forEach((m) => {
    const btn = document.createElement("button");
    btn.textContent = m === "wings" ? "Divisions" : (m[0].toUpperCase() + m.slice(1));
    btn.className = state.mode === m ? "active" : "";
    btn.onclick = () => {
      state.mode = m;
      if (m !== "units") state.moveSourceUnitId = null;
      renderModeTabs();
      renderToolPanel();
    };
    els.modeTabs.appendChild(btn);
  });
}

function renderToolPanel() {
  const t = els.toolPanel;
  t.innerHTML = "";
  if (state.mode === "terrain") {
    t.appendChild(toolButtons("Terrain Brush", TERRAIN, state.brushTerrain, (v) => { state.brushTerrain = v; }));
  }
  if (state.mode === "units") {
    t.appendChild(toolButtons("Army", ["Blue", "Red"], state.brushArmy === "A" ? "Blue" : "Red", (v) => { state.brushArmy = v === "Blue" ? "A" : "B"; }));
    t.appendChild(toolButtons("Action", ["place", "select", "move", "delete"], state.unitAction, (v) => { state.unitAction = v; }));
    if (state.unitAction === "place") {
      t.appendChild(toolButtons("Brigade Type", ["infantry", "cavalry", "artillery"], state.brushUnitType, (v) => { state.brushUnitType = v; }));
    }
    if (state.unitAction === "move") {
      const note = document.createElement("div");
      note.className = "card";
      note.textContent = state.moveSourceUnitId
        ? `Moving ${displayUnitId(state.moveSourceUnitId)}. Tap destination hex.`
        : "Tap a brigade, then tap an empty hex.";
      t.appendChild(note);
    }
    const movementNote = document.createElement("div");
    movementNote.className = "card";
    movementNote.textContent = "Movement: infantry 1 hex, artillery 1 hex, cavalry 2 hexes per turn.";
    t.appendChild(movementNote);
  }
  if (state.mode === "wings") {
    const c = document.createElement("div");
    c.className = "tool-group";
    c.innerHTML = "<h3>Assign Selected Brigades To Division</h3>";
    const picked = document.createElement("div");
    picked.className = "card";
    picked.textContent = `Selected brigades: ${state.selectedWingUnits.size}. Tap or drag across brigades, then assign division.`;
    c.appendChild(picked);
    ["left", "center", "right", "reserve"].forEach((wing) => {
      const b = document.createElement("button");
      b.textContent = `${wing} division`;
      b.onclick = () => assignSelectedToWing(wing);
      c.appendChild(b);
    });
    const clearSel = document.createElement("button");
    clearSel.textContent = "Clear selection";
    clearSel.onclick = () => { state.selectedWingUnits.clear(); render(); };
    c.appendChild(clearSel);
    t.appendChild(c);
  }
  if (state.mode === "commanders") {
    t.appendChild(commanderChooser("A"));
    t.appendChild(commanderChooser("B"));
  }
  if (state.mode === "armies") {
    const c = document.createElement("div");
    c.className = "tool-group";
    c.innerHTML = "<h3>Army Brigade Counts</h3>";
    c.appendChild(armyConfigEditor("A"));
    c.appendChild(armyConfigEditor("B"));
    t.appendChild(c);
  }
}

function armyConfigEditor(side) {
  const box = document.createElement("div");
  box.className = "card";
  box.innerHTML = `<strong>${side === "A" ? "Blue Army" : "Red Army"}</strong>`;
  ["infantry", "cavalry", "artillery"].forEach((type) => {
    const row = document.createElement("label");
    row.style.display = "block";
    row.style.marginTop = "6px";
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "20";
    input.value = state.armyConfig[side][type];
    input.onchange = () => {
      state.armyConfig[side][type] = Math.max(0, Number(input.value) || 0);
    };
    row.append(`${type}: `);
    row.appendChild(input);
    box.appendChild(row);
  });

  const apply = document.createElement("button");
  apply.textContent = `Apply ${side === "A" ? "Blue" : "Red"} Army`;
  apply.onclick = () => applyArmyConfig(side);
  box.appendChild(apply);
  return box;
}

function toolButtons(title, options, selected, onPick) {
  const box = document.createElement("div");
  box.className = "tool-group";
  const h = document.createElement("h3");
  h.textContent = title;
  box.appendChild(h);
  const g = document.createElement("div");
  g.className = "tool-grid";
  options.forEach((opt) => {
    const b = document.createElement("button");
    b.textContent = opt;
    if (opt === selected) b.classList.add("selected");
    b.onclick = () => { onPick(opt); renderToolPanel(); };
    g.appendChild(b);
  });
  box.appendChild(g);
  return box;
}

function commanderChooser(side) {
  const box = document.createElement("div");
  box.className = "tool-group";
  const h = document.createElement("h3");
  h.textContent = `${side === "A" ? "Blue" : "Red"} Commander`;
  box.appendChild(h);
  Object.keys(COMMANDERS).forEach((id) => {
    const b = document.createElement("button");
    b.textContent = COMMANDERS[id].name;
    b.onclick = () => { state.armies[side].armyCommanderId = id; render(); };
    box.appendChild(b);
  });
  return box;
}

function onCanvasClick(e) {
  if (state.mode === "wings" && state.wingDragMoved) {
    state.wingDragMoved = false;
    return;
  }
  const { q, r } = pixelToHex(e);
  if (q < 0 || q >= state.map.width || r < 0 || r >= state.map.height) return;
  const hex = getHex(q, r);
  if (!hex || !hex.active) return;
  if (state.mode === "terrain") {
    hex.terrain = state.brushTerrain;
  } else if (state.mode === "units") {
    if (state.unitAction === "delete") {
      if (hex.occupantUnitId) removeUnitById(hex.occupantUnitId);
    } else if (state.unitAction === "place") {
      if (!hex.occupantUnitId) {
        const army = state.armies[state.brushArmy];
        const unit = makeUnit(state.brushArmy, state.brushUnitType, nextUnitIndex(state.brushArmy, state.brushUnitType));
        army.units.push(unit);
        unit.divisionId = "center";
        setUnitPos(unit, q, r);
        assignWingMembership(army);
        refreshArmyCounts();
      }
    } else if (state.unitAction === "select") {
      state.selectedUnitId = hex.occupantUnitId || null;
    } else if (state.unitAction === "move") {
      if (!state.moveSourceUnitId && hex.occupantUnitId) {
        state.moveSourceUnitId = hex.occupantUnitId;
        state.selectedUnitId = hex.occupantUnitId;
        renderToolPanel();
      } else if (state.moveSourceUnitId && !hex.occupantUnitId) {
        const unit = findUnit(state.moveSourceUnitId);
        if (unit) {
          setUnitPos(unit, q, r);
        }
        state.moveSourceUnitId = null;
        renderToolPanel();
      }
    }
  } else if (state.mode === "wings") {
    if (hex.occupantUnitId) {
      if (state.selectedWingUnits.has(hex.occupantUnitId)) state.selectedWingUnits.delete(hex.occupantUnitId);
      else state.selectedWingUnits.add(hex.occupantUnitId);
    }
  }
  state.selectedUnitId = hex.occupantUnitId;
  render();
}

function onCanvasPointerDown(e) {
  if (state.mode !== "wings") return;
  state.wingDragActive = true;
  state.wingDragMoved = false;
  state.wingDragLastHex = null;
  addWingSelectionFromPointerEvent(e);
}

function onCanvasPointerMove(e) {
  if (state.mode !== "wings" || !state.wingDragActive) return;
  addWingSelectionFromPointerEvent(e);
}

function onCanvasPointerUp() {
  if (!state.wingDragActive) return;
  state.wingDragActive = false;
  state.wingDragLastHex = null;
}

function addWingSelectionFromPointerEvent(e) {
  const { q, r } = pixelToHex(e);
  if (q < 0 || q >= state.map.width || r < 0 || r >= state.map.height) return;
  const key = `${q},${r}`;
  if (state.wingDragLastHex === key) return;
  state.wingDragLastHex = key;
  const hex = getHex(q, r);
  if (!hex || !hex.active || !hex.occupantUnitId) return;
  state.selectedWingUnits.add(hex.occupantUnitId);
  state.selectedUnitId = hex.occupantUnitId;
  state.wingDragMoved = true;
  render();
}

function removeUnitById(id) {
  if (!id) return;
  const side = id[0];
  const army = state.armies[side];
  const idx = army.units.findIndex((u) => u.id === id);
  if (idx >= 0) {
    const u = army.units[idx];
    const h = getHex(u.q, u.r);
    if (h) h.occupantUnitId = null;
    army.units.splice(idx, 1);
  }
  assignWingMembership(army);
  if (state.selectedUnitId === id) state.selectedUnitId = null;
  if (state.moveSourceUnitId === id) state.moveSourceUnitId = null;
  refreshArmyCounts();
}

function applyArmyConfig(side) {
  const reverse = side === "B";
  state.armies[side].units = createUnitsFromMix(side, state.armyConfig[side]);
  deployByFormation(side, "line", reverse);
  refreshArmyCounts();
  state.selectedUnitId = null;
  state.moveSourceUnitId = null;
  log(`${side === "A" ? "Blue" : "Red"} army rebuilt from brigade counts.`);
  render();
}

function assignSelectedToWing(wing) {
  state.selectedWingUnits.forEach((id) => {
    const side = id[0];
    const army = state.armies[side];
    const unit = army.units.find((u) => u.id === id);
    if (unit) unit.divisionId = wing;
    assignWingMembership(army);
  });
  state.selectedWingUnits.clear();
  render();
}

function hexToPixel(q, r) {
  const x = HEX_SIZE * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r) + MAP_ORIGIN_X;
  const y = HEX_SIZE * (1.5 * r) + MAP_ORIGIN_Y;
  return { x, y };
}

function pixelToHex(e) {
  const rect = els.canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) * els.canvas.width) / rect.width;
  const y = ((e.clientY - rect.top) * els.canvas.height) / rect.height;
  const q = (Math.sqrt(3) / 3 * (x - MAP_ORIGIN_X) - (1 / 3) * (y - MAP_ORIGIN_Y)) / HEX_SIZE;
  const r = ((2 / 3) * (y - MAP_ORIGIN_Y)) / HEX_SIZE;
  return axialRound(q, r);
}

function axialRound(q, r) {
  let x = q;
  let z = r;
  let y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);
  if (xDiff > yDiff && xDiff > zDiff) rx = -ry - rz;
  else if (yDiff > zDiff) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}

function render() {
  if (!state.running && state.turn === 0) {
    captureTurnZeroSnapshot();
  }
  updateMapOrigin();
  drawMap();
  drawUnits();
  drawActionHighlights();
  drawCommanders();
  drawBattleOverlay();
  renderInfo();
  const phase = state.running ? "Simulation" : "Setup Battle";
  const nextOrderIn = turnsUntilNextActionTurn();
  if (state.reelsMode) {
    const blueName = (COMMANDERS[state.armies.A.armyCommanderId]?.name || "Blue").toUpperCase();
    const redName = (COMMANDERS[state.armies.B.armyCommanderId]?.name || "Red").toUpperCase();
    els.title.textContent = `${blueName} vs ${redName}`;
  } else {
    els.title.textContent = "AI Commander Hex Battle Simulator";
  }
  els.subtitle.textContent = `${phase} · Turn ${state.turn} · Next Major Order: ${nextOrderIn === 0 ? "Now" : `${nextOrderIn} turns`}`;
  updateReelsHud();
  updateSimButton();
  requestAnimationRenderIfNeeded();
}

function requestAnimationRenderIfNeeded() {
  const now = performance.now();
  const hasActive = Object.values(state.unitAnimations).some((a) => {
    if (!a) return false;
    const segCount = Array.isArray(a.segments) ? a.segments.length : 0;
    const segDuration = a.segmentDuration || getAnimationDurationMs();
    return segCount > 0 && (now - a.start) < (segCount * segDuration);
  });
  if (!hasActive || state.animationFramePending) return;
  state.animationFramePending = true;
  requestAnimationFrame(() => {
    state.animationFramePending = false;
    render();
  });
}

function drawBattleOverlay() {
  if (!state.battleOverlay) return;
  const o = state.battleOverlay;
  const w = Math.min(760, els.canvas.width - 40);
  const h = 210;
  const x = (els.canvas.width - w) / 2;
  const y = (els.canvas.height - h) / 2;

  ctx.fillStyle = "rgba(20, 16, 12, 0.82)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#f0d7ab";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = "#fff3dc";
  ctx.font = "bold 34px Verdana";
  ctx.textAlign = "center";
  ctx.fillText(o.title, x + w / 2, y + 48);

  ctx.font = "bold 15px Verdana";
  ctx.fillStyle = "#f5e8cf";
  ctx.fillText("Casualties", x + w / 2, y + 78);

  const leftX = x + 28;
  const rightX = x + w - 28;
  const startY = y + 108;

  ctx.textAlign = "left";
  ctx.fillStyle = "#cfe0ff";
  ctx.font = "bold 22px Verdana";
  ctx.fillText(o.leftName, leftX, startY);
  ctx.font = "18px Verdana";
  ctx.fillText(`INF ${o.left.infantry}`, leftX, startY + 32);
  ctx.fillText(`CAV ${o.left.cavalry}`, leftX, startY + 58);
  ctx.fillText(`ART ${o.left.artillery}`, leftX, startY + 84);

  ctx.textAlign = "right";
  ctx.fillStyle = "#ffd2ce";
  ctx.font = "bold 22px Verdana";
  ctx.fillText(o.rightName, rightX, startY);
  ctx.font = "18px Verdana";
  ctx.fillText(`INF ${o.right.infantry}`, rightX, startY + 32);
  ctx.fillText(`CAV ${o.right.cavalry}`, rightX, startY + 58);
  ctx.fillText(`ART ${o.right.artillery}`, rightX, startY + 84);
}

function drawActionHighlights() {
  const now = Date.now();
  state.actionHighlights = state.actionHighlights.filter((h) => h.expiresAt > now);
  state.actionHighlights.forEach((h) => {
    const army = state.armies[h.side];
    if (!army) return;
    const wing = army.divisions[h.wing];
    if (!wing) return;
    const units = wing.unitIds
      .map((id) => army.units.find((u) => u.id === id))
      .filter((u) => u && u.alive);
    if (!units.length) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    units.forEach((u) => {
      const p = hexToPixel(u.q, u.r);
      minX = Math.min(minX, p.x - 18);
      minY = Math.min(minY, p.y - 18);
      maxX = Math.max(maxX, p.x + 18);
      maxY = Math.max(maxY, p.y + 18);
    });

    const color = h.side === "A" ? "rgba(45,107,168,0.9)" : "rgba(176,72,62,0.9)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

    ctx.fillStyle = h.side === "A" ? "#174b7d" : "#7a2c20";
    ctx.fillRect(minX, minY - 18, Math.max(90, (h.label.length * 7) + 10), 16);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px Verdana";
    ctx.textAlign = "left";
    ctx.fillText(h.label, minX + 5, minY - 6);
  });
}

function updateMapOrigin() {
  const active = state.map.hexes.filter((h) => h.active);
  if (!active.length) return;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  active.forEach((h) => {
    const x = HEX_SIZE * (Math.sqrt(3) * h.q + (Math.sqrt(3) / 2) * h.r);
    const y = HEX_SIZE * (1.5 * h.r);
    minX = Math.min(minX, x - HEX_SIZE);
    maxX = Math.max(maxX, x + HEX_SIZE);
    minY = Math.min(minY, y - HEX_SIZE);
    maxY = Math.max(maxY, y + HEX_SIZE);
  });
  const mapW = maxX - minX;
  const mapH = maxY - minY;
  MAP_ORIGIN_X = (els.canvas.width - mapW) / 2 - minX;
  MAP_ORIGIN_Y = (els.canvas.height - mapH) / 2 - minY;
}

function isMajorActionTurn(turn) {
  return turn === 1 || ((turn - 1) % state.actionInterval === 0);
}

function turnsUntilNextActionTurn() {
  if (state.turn === 0) return 1;
  if (isMajorActionTurn(state.turn)) return state.actionInterval;
  const mod = (state.turn - 1) % state.actionInterval;
  return state.actionInterval - mod;
}

function drawMap() {
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  state.map.hexes.forEach((hex) => {
    if (!hex.active) return;
    const p = hexToPixel(hex.q, hex.r);
    const color = terrainColor(hex.terrain);
    drawHex(p.x, p.y, HEX_SIZE - 1, color, "#c3b08f");
  });
}

function drawHex(x, y, size, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = ((60 * i - 30) * Math.PI) / 180;
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function terrainColor(t) {
  return {
    plain: "#ecd8b5",
    hill: "#ccaa7d",
    forest: "#8ca86f",
    river: "#8db8d8",
    road: "#d4d0c6",
    town: "#c7b399",
    blocked: "#8f8375",
  }[t] || "#ecd8b5";
}

function drawUnits() {
  const now = performance.now();
  ["A", "B"].forEach((side) => {
    state.armies[side].units.filter((u) => u.alive).forEach((u) => {
      const p = animatedPixelForUnit(u, now);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = side === "A" ? "#2d6ba8" : "#b0483e";
      ctx.fill();

      if (state.selectedWingUnits.has(u.id) || state.selectedUnitId === u.id) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = "#fff";
      ctx.font = "11px Verdana";
      ctx.textAlign = "center";
      ctx.fillText(iconFor(u.type), p.x, p.y + 3);

      if (u.morale < 40) {
        ctx.strokeStyle = "#d92f2f";
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x - 12, p.y - 12, 24, 24);
      }

      drawHealthBar(u, p.x, p.y + 14);
    });
  });
}

function animatedPixelForUnit(unit, now) {
  const anim = state.unitAnimations[unit.id];
  if (!anim) return hexToPixel(unit.q, unit.r);
  const segs = Array.isArray(anim.segments) ? anim.segments : [];
  const segDuration = anim.segmentDuration || getAnimationDurationMs();
  const totalDuration = Math.max(1, segs.length * segDuration);
  const elapsed = Math.max(0, now - anim.start);
  if (!segs.length || elapsed >= totalDuration) {
    delete state.unitAnimations[unit.id];
    return hexToPixel(unit.q, unit.r);
  }
  const segIndex = Math.min(segs.length - 1, Math.floor(elapsed / segDuration));
  const localElapsed = elapsed - (segIndex * segDuration);
  const t = Math.max(0, Math.min(1, localElapsed / segDuration));
  const seg = segs[segIndex];
  const from = hexToPixel(seg.fromQ, seg.fromR);
  const to = hexToPixel(seg.toQ, seg.toR);
  return { x: from.x + ((to.x - from.x) * t), y: from.y + ((to.y - from.y) * t) };
}

function drawHealthBar(unit, x, y) {
  const max = UNIT_BASE[unit.type].strength;
  const pct = Math.max(0, Math.min(1, unit.strength / max));
  const width = 22;
  const height = 4;
  ctx.fillStyle = "#3f3a32";
  ctx.fillRect(x - width / 2 - 1, y - 1, width + 2, height + 2);
  const r = Math.round(220 * (1 - pct));
  const g = Math.round(190 * pct);
  ctx.fillStyle = `rgb(${r},${g},40)`;
  ctx.fillRect(x - width / 2, y, Math.max(0, width * pct), height);
}

function drawCommanders() {
  ["A", "B"].forEach((side) => {
    const army = state.armies[side];
    const alive = army.units.filter((u) => u.alive);
    if (!alive.length) return;
    const avg = alive.reduce((acc, u) => ({ q: acc.q + u.q, r: acc.r + u.r }), { q: 0, r: 0 });
    const center = hexToPixel(avg.q / alive.length, avg.r / alive.length + (side === "A" ? 2 : -2));
    const commander = COMMANDERS[army.armyCommanderId];
    ctx.fillStyle = "#fff8";
    ctx.fillRect(center.x - 36, center.y - 10, 72, 18);
    ctx.fillStyle = side === "A" ? "#174b7d" : "#7a2c20";
    ctx.font = "bold 11px Verdana";
    ctx.textAlign = "center";
    ctx.fillText(commander.name, center.x, center.y + 3);
  });

  if (!state.reelsMode) {
    drawCommanderHud("B");
    drawCommanderHud("A");
  }
}

function updateReelsHud() {
  if (!state.reelsMode) return;
  updateReelsCard("A");
  updateReelsCard("B");
}

function updateReelsCard(side) {
  const army = state.armies[side];
  const commander = COMMANDERS[army.armyCommanderId];
  const portrait = PORTRAITS[army.armyCommanderId];
  const isBlue = side === "A";

  const nameEl = isBlue ? els.reelsBlueName : els.reelsRedName;
  const portraitEl = isBlue ? els.reelsBluePortrait : els.reelsRedPortrait;
  const healthEl = isBlue ? els.reelsBlueHealthFill : els.reelsRedHealthFill;
  const abilityEl = isBlue ? els.reelsBlueAbilityFill : els.reelsRedAbilityFill;
  const abilityLabelEl = isBlue ? els.reelsBlueAbilityLabel : els.reelsRedAbilityLabel;

  nameEl.textContent = commander?.name || (isBlue ? "Blue Commander" : "Red Commander");
  if (portrait && portrait.src) portraitEl.src = portrait.src;

  const defeatedPct = (army.defeatedUnitCount / Math.max(1, army.startingUnitCount)) * 100;
  const healthPct = Math.max(0, 1 - (defeatedPct / Math.max(1, state.defeatThresholdPercent)));
  const chargePct = Math.max(0, Math.min(1, army.abilityCharge / 100));

  healthEl.style.width = `${Math.round(healthPct * 100)}%`;
  healthEl.style.background = healthPct > 0.5 ? "#41a85f" : healthPct > 0.25 ? "#d8a135" : "#d64d42";
  abilityEl.style.width = `${Math.round(chargePct * 100)}%`;
  abilityEl.style.background = isBlue ? "#3576c4" : "#b0483e";
  const sigName = commander?.signature?.name || "Ability";
  if (army.abilityReady) {
    const accent = COMMANDER_ACCENT[army.armyCommanderId] || "#c57b1f";
    abilityLabelEl.textContent = `${sigName} READY`;
    abilityLabelEl.style.color = accent;
    abilityLabelEl.style.fontWeight = "700";
  } else {
    abilityLabelEl.textContent = sigName;
    abilityLabelEl.style.color = "";
    abilityLabelEl.style.fontWeight = "";
  }
}

function drawCommanderHud(side) {
  const army = state.armies[side];
  if (!army) return;
  const commander = COMMANDERS[army.armyCommanderId];
  if (!commander) return;

  const w = 220;
  const h = 92;
  const x = side === "B" ? els.canvas.width - w - 14 : 14;
  const y = side === "B" ? 14 : els.canvas.height - h - 14;

  ctx.fillStyle = "rgba(255,250,240,0.92)";
  ctx.strokeStyle = side === "B" ? "#b0483e" : "#2d6ba8";
  ctx.lineWidth = 2;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  const portrait = PORTRAITS[army.armyCommanderId];
  const pw = 58;
  const ph = 58;
  const px = x + 8;
  const py = y + 8;
  ctx.fillStyle = "#d9ccb3";
  ctx.fillRect(px, py, pw, ph);
  if (portrait && portrait.complete) {
    ctx.drawImage(portrait, px, py, pw, ph);
  }
  ctx.strokeStyle = "#8f7d62";
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, pw, ph);

  ctx.fillStyle = side === "B" ? "#7a2c20" : "#174b7d";
  ctx.font = "bold 12px Verdana";
  ctx.textAlign = "left";
  ctx.fillText(commander.name, x + 72, y + 20);

  const defeatedPct = (army.defeatedUnitCount / Math.max(1, army.startingUnitCount)) * 100;
  const healthPct = Math.max(0, 1 - (defeatedPct / Math.max(1, state.defeatThresholdPercent)));
  drawLabeledBar(x + 72, y + 30, 136, 8, healthPct, "Army Health", "#44a65d", "#d44a3f");

  const sigPct = Math.max(0, Math.min(1, army.abilityCharge / 100));
  drawLabeledBar(x + 72, y + 56, 136, 8, sigPct, "Signature", "#3576c4", "#3576c4");
  if (army.abilityReady) {
    ctx.fillStyle = "#c57b1f";
    ctx.font = "bold 10px Verdana";
    ctx.fillText("READY", x + 170, y + 76);
  }
}

function drawLabeledBar(x, y, w, h, pct, label, fullColor, lowColor) {
  ctx.fillStyle = "#3f3a32";
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  const r = Math.round(parseInt(lowColor.slice(1, 3), 16) * (1 - pct) + parseInt(fullColor.slice(1, 3), 16) * pct);
  const g = Math.round(parseInt(lowColor.slice(3, 5), 16) * (1 - pct) + parseInt(fullColor.slice(3, 5), 16) * pct);
  const b = Math.round(parseInt(lowColor.slice(5, 7), 16) * (1 - pct) + parseInt(fullColor.slice(5, 7), 16) * pct);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(x, y, Math.max(0, w * pct), h);
  ctx.fillStyle = "#3d3124";
  ctx.font = "10px Verdana";
  ctx.textAlign = "left";
  ctx.fillText(label, x, y - 3);
}

function iconFor(type) {
  if (type === "infantry") return "X";
  if (type === "cavalry") return "/";
  return "C";
}

function renderInfo() {
  const selected = findUnit(state.selectedUnitId);
  els.selectionInfo.textContent = selected
    ? `${displayUnitId(selected.id)} ${selected.type} brigade | Division: ${selected.divisionId} | Move ${selected.move} | Range ${selected.range} | Str ${Math.round(selected.strength)} | Morale ${Math.round(selected.morale)}`
    : "No selection";

  ["A", "B"].forEach((side) => {
    const army = state.armies[side];
    const commander = COMMANDERS[army.armyCommanderId];
    const defeatedPct = Math.round((army.defeatedUnitCount / Math.max(1, army.startingUnitCount)) * 100);
    const aliveCount = army.units.filter((u) => u.alive).length;
    const actionName = army.currentAction ? formatActionName(army.currentAction) : "Pending";
    const nextOrderIn = turnsUntilNextActionTurn();
    const charge = Math.floor(army.abilityCharge);
    const bar = makeBar(charge, 100, 10);
    const sigName = commander.signature?.name || "Ability";
    const activeSig = army.activeSignature
      ? `${army.activeSignature.name}${army.activeSignature.sector === "all" ? " (army-wide)" : ` (${army.activeSignature.sector})`}`
      : "None";
    const txt = `${commander.name} | Brigades ${aliveCount}/${army.startingUnitCount} | Defeated ${defeatedPct}%\n`
      + `Order (5-turn): ${actionName} -> ${army.currentSector.toUpperCase()} | Next in ${nextOrderIn === 0 ? "Now" : nextOrderIn}\n`
      + `${sigName}: ${army.abilityReady ? "READY" : `${charge}/100`} ${bar}\n`
      + `Active Effect: ${activeSig}`;
    if (side === "A") els.armyAInfo.textContent = txt;
    else els.armyBInfo.textContent = txt;
  });
}

function makeBar(value, max, width) {
  const filled = Math.max(0, Math.min(width, Math.round((value / max) * width)));
  return `[${"#".repeat(filled)}${"-".repeat(width - filled)}]`;
}

function displayUnitId(id) {
  return String(id || "")
    .replace(/^A_/, "BLUE_")
    .replace(/^B_/, "RED_");
}

function findUnit(id) {
  if (!id) return null;
  return [...state.armies.A.units, ...state.armies.B.units].find((u) => u.id === id) || null;
}

function refreshArmyCounts() {
  ["A", "B"].forEach((side) => {
    const a = state.armies[side];
    a.startingUnitCount = a.units.length;
    a.defeatedUnitCount = a.units.filter((u) => !u.alive).length;
  });
}

function toggleSimulation() {
  if (state.running) {
    stopSimulationLoop();
    log("Simulation paused.");
    render();
    return;
  }
  runSimulation();
}

function stopSimulationLoop() {
  state.running = false;
  if (state.simTimer) {
    clearTimeout(state.simTimer);
    state.simTimer = null;
  }
}

function runSimulation() {
  state.battleOverlay = null;
  state.unitAnimations = {};
  state.running = true;
  if (!state.replay.turns.length) {
    state.replay = { seed: state.seed, turns: [], finalResult: null };
    log(`Simulation starts. Seed ${state.seed}.`);
  } else {
    log("Simulation resumed.");
  }
  const loop = () => {
    if (!state.running) return;
    const result = stepTurn();
    if (result?.ended) {
      stopSimulationLoop();
      render();
      return;
    }
    state.simTimer = setTimeout(loop, getSimStepDelayMs());
  };
  loop();
}

function stepTurn() {
  const rand = rngFactory(state.seed + state.turn * 997);
  state.turn += 1;
  const turnEvents = [];

  if (isMajorActionTurn(state.turn)) {
    ["A", "B"].forEach((side) => chooseMajorAction(side, rand, turnEvents));
  }
  ["A", "B"].forEach((side) => issueOrdersFromAction(side, turnEvents));
  ["A", "B"].forEach((side) => applyFriction(side, rand, turnEvents));
  ["A", "B"].forEach((side) => moveUnits(side, rand));
  resolveCombat(rand, turnEvents);
  ["A", "B"].forEach((side) => tickActiveAction(side, rand, turnEvents));
  ["A", "B"].forEach((side) => tickMajorActionBoost(side));
  routeAndCleanup(turnEvents);
  refreshArmyCounts();

  const winner = checkEndCondition();
  state.replay.turns.push({ turn: state.turn, events: turnEvents });
  if (winner) {
    endBattle(`${winner} wins on turn ${state.turn}.`);
    return { ended: true };
  }

  if (turnEvents.length) {
    els.banner.textContent = turnEvents[turnEvents.length - 1];
    turnEvents.forEach((e) => log(`Turn ${state.turn}: ${e}`));
  }
  render();
  return { ended: false };
}

function chooseMajorAction(side, rand, events) {
  const army = state.armies[side];
  const c = COMMANDERS[army.armyCommanderId];

  if (army.forcedMajorAction) {
    army.currentAction = army.forcedMajorAction;
    army.currentSector = army.forcedMajorSector || chooseSectorForAction(army.forcedMajorAction, side, rand);
    army.forcedMajorAction = null;
    army.forcedMajorSector = null;
    const major = c.majorOrders[0];
    events.push(`${c.name}: ${formatActionName(army.currentAction)} (${army.currentSector.toUpperCase()} sector) · Inspired by ${major.inspiredBy}`);
    return;
  }

  if (army.abilityReady && c.signature) {
    const sector = "all";
    army.currentAction = c.signature.type;
    army.currentSector = sector;
    army.abilityCharge = 0;
    army.abilityReady = false;
    army.activeSignature = {
      type: c.signature.type,
      name: c.signature.name,
      sector,
      turnsLeft: c.signature.duration || 5,
    };
    if (c.signature.type === "fighting_withdrawal") {
      army.units.forEach((u) => {
        if (u.alive) u.morale = Math.min(100, u.morale + 20);
      });
    }
    events.push(`${c.name}: ${c.signature.name} ORDER (ARMY-WIDE)`);
    return;
  }

  const availableActions = getAvailableActionsForArmy(side);
  const phase = getBattlePhase(side);
  const actionWeights = getActionWeights(c, phase, side);
  const action = weightedPick(availableActions, actionWeights, rand);
  const sector = chooseSectorForAction(action, side, rand);
  army.currentAction = action;
  army.currentSector = sector;
  army.activeSignature = null;

  const major = c.majorOrders[0];
  const line = `${c.name}: ${formatActionName(action)} (${sector.toUpperCase()} sector) · Inspired by ${major.inspiredBy}`;
  events.push(line);
}

function sectorsWithUnitType(side, type) {
  const army = state.armies[side];
  return ["left", "center", "right"].filter((s) =>
    army.divisions[s].unitIds.some((id) => {
      const u = army.units.find((u2) => u2.id === id);
      return u && u.alive && u.type === type;
    })
  );
}

function aliveCountInSector(side, sector) {
  const army = state.armies[side];
  return army.divisions[sector].unitIds.filter((id) => {
    const u = army.units.find((u2) => u2.id === id);
    return u && u.alive;
  }).length;
}

function sectorWeights(side, sectors) {
  const w = {};
  sectors.forEach((s) => { w[s] = aliveCountInSector(side, s); });
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  if (total === 0) sectors.forEach((s) => { w[s] = 1; });
  return w;
}

function chooseSectorForAction(action, side, rand) {
  if (action === "mass_assault") return "all";
  if (action === "concentrate_center") return "center";
  if (action === "line_rotation") {
    const enemySide = side === "A" ? "B" : "A";
    const diffs = [
      { sector: "left", diff: aliveCountInSector(enemySide, "left") - aliveCountInSector(side, "left") },
      { sector: "center", diff: aliveCountInSector(enemySide, "center") - aliveCountInSector(side, "center") },
      { sector: "right", diff: aliveCountInSector(enemySide, "right") - aliveCountInSector(side, "right") },
    ];
    diffs.sort((a, b) => b.diff - a.diff);
    return diffs[0].sector;
  }
  if (action === "exploit_gap") {
    const enemySide = side === "A" ? "B" : "A";
    const sectors = ["left", "center", "right"];
    let best = "center";
    let bestScore = -Infinity;
    sectors.forEach((s) => {
      const my = aliveCountInSector(side, s);
      const enemy = aliveCountInSector(enemySide, s);
      const score = (my * 1.2) - (enemy * 1.8);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    });
    return best;
  }
  if (action === "commit_reserve") {
    const enemySide = side === "A" ? "B" : "A";
    const sectors = ["left", "center", "right"];
    let pressured = "center";
    let worst = -Infinity;
    sectors.forEach((s) => {
      const diff = aliveCountInSector(enemySide, s) - aliveCountInSector(side, s);
      if (diff > worst) {
        worst = diff;
        pressured = s;
      }
    });
    return pressured;
  }
  if (action === "defend_flank") {
    return weightedPick(["left", "right"], sectorWeights(side, ["left", "right"]), rand);
  }
  if (action === "rally" || action === "retreat") {
    return weightedPick(["left", "center", "right"], sectorWeights(side, ["left", "center", "right"]), rand);
  }
  if (action === "bombard_sector") {
    const valid = sectorsWithUnitType(side, "artillery");
    if (valid.length) return valid.length === 1 ? valid[0] : weightedPick(valid, sectorWeights(side, valid), rand);
  }
  if (action === "cavalry_charge") {
    const valid = sectorsWithUnitType(side, "cavalry");
    if (valid.length) return valid.length === 1 ? valid[0] : weightedPick(valid, sectorWeights(side, valid), rand);
  }
  if (action === "flank_attack") {
    return weightedPick(["left", "right"], sectorWeights(side, ["left", "right"]), rand);
  }
  return weightedPick(["left", "center", "right"], sectorWeights(side, ["left", "center", "right"]), rand);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function getBattleStatus(side) {
  const enemySide = side === "A" ? "B" : "A";
  const myAlive = state.armies[side].units.filter((u) => u.alive);
  const enemyAlive = state.armies[enemySide].units.filter((u) => u.alive);
  const myCount = myAlive.length;
  const enemyCount = enemyAlive.length;

  let contacts = 0;
  let near2 = 0;
  let nearestSum = 0;
  myAlive.forEach((u) => {
    const nearest = nearestEnemy(u, enemySide);
    if (!nearest) return;
    const d = hexDist(u.q, u.r, nearest.q, nearest.r);
    nearestSum += d;
    if (d <= 1) contacts += 1;
    if (d <= 2) near2 += 1;
  });

  const avgNearestDist = myCount ? nearestSum / myCount : 99;
  const contactRatio = myCount ? contacts / myCount : 0;
  const nearRatio = myCount ? near2 / myCount : 0;

  const myMorale = myCount ? myAlive.reduce((a, u) => a + u.morale, 0) / myCount : 100;
  const enemyMorale = enemyCount ? enemyAlive.reduce((a, u) => a + u.morale, 0) / enemyCount : 100;
  const myCav = myAlive.filter((u) => u.type === "cavalry").length;
  const myArt = myAlive.filter((u) => u.type === "artillery").length;

  const myLeft = aliveCountInSector(side, "left");
  const myCenter = aliveCountInSector(side, "center");
  const myRight = aliveCountInSector(side, "right");
  const enLeft = aliveCountInSector(enemySide, "left");
  const enCenter = aliveCountInSector(enemySide, "center");
  const enRight = aliveCountInSector(enemySide, "right");

  return {
    myCount,
    enemyCount,
    outnumberedRatio: myCount ? enemyCount / myCount : 1,
    contactRatio,
    nearRatio,
    avgNearestDist,
    myMorale,
    enemyMorale,
    myCav,
    myArt,
    cavShare: myCount ? myCav / myCount : 0,
    artShare: myCount ? myArt / myCount : 0,
    myLeft,
    myCenter,
    myRight,
    enLeft,
    enCenter,
    enRight,
    centerShare: myCount ? myCenter / myCount : 0,
    flankStrongShare: myCount ? Math.max(myLeft, myRight) / myCount : 0,
    flankWeakPressure: Math.max(enLeft - myLeft, enRight - myRight),
    centerAdvantage: myCenter - enCenter,
    flankAdvantage: Math.max(myLeft - enLeft, myRight - enRight),
    gapOpportunity: Math.max(
      clamp((myLeft * 1.1 - enLeft * 1.8) / 3, 0, 2),
      clamp((myCenter * 1.1 - enCenter * 1.8) / 3, 0, 2),
      clamp((myRight * 1.1 - enRight * 1.8) / 3, 0, 2)
    ),
  };
}

function getAvailableActionsForArmy(side) {
  const army = state.armies[side];
  const alive = army.units.filter((u) => u.alive);
  const cavalryCount = alive.filter((u) => u.type === "cavalry").length;
  const artilleryCount = alive.filter((u) => u.type === "artillery").length;
  const reserveCount = alive.filter((u) => u.divisionId === "reserve").length;
  const status = getBattleStatus(side);
  const farBattle = state.turn === 1 || (status.contactRatio < 0.12 && status.nearRatio < 0.25 && status.avgNearestDist > 2.2);

  return MAJOR_ACTIONS.filter((action) => {
    if (action === "cavalry_charge" && cavalryCount < 2) return false;
    if (action === "bombard_sector" && artilleryCount === 0) return false;
    if (action === "exploit_gap" && status.nearRatio < 0.2) return false;
    if (action === "line_rotation" && status.myMorale > 85 && status.outnumberedRatio < 1.05) return false;
    if (action === "commit_reserve" && reserveCount === 0) return false;
    if (farBattle && action !== "advance") return false;
    return true;
  });
}

function getBattlePhase(side) {
  if (state.turn <= 3) return "opening";
  const enemySide = side === "A" ? "B" : "A";
  const myAlive = state.armies[side].units.filter((u) => u.alive);
  const enemyAlive = state.armies[enemySide].units.filter((u) => u.alive);
  if (!myAlive.length || !enemyAlive.length) return "mid";

  let contactPairs = 0;
  myAlive.forEach((u) => {
    const nearest = nearestEnemy(u, enemySide);
    if (nearest && hexDist(u.q, u.r, nearest.q, nearest.r) <= 2) contactPairs += 1;
  });
  if (contactPairs >= Math.max(3, Math.floor(myAlive.length * 0.3))) return "mid";
  return "approach";
}

function getActionWeights(commander, phase, side) {
  const status = getBattleStatus(side);
  const pressure = clamp((status.outnumberedRatio - 1) * 1.4, 0, 1.5);
  const lowMorale = clamp((70 - status.myMorale) / 30, 0, 1.5);
  const veryLowMorale = clamp((45 - status.myMorale) / 20, 0, 1.8);
  const enemyBroken = clamp((65 - status.enemyMorale) / 25, 0, 1.8);
  const engagement = clamp(status.nearRatio * 1.8, 0, 1.6);
  const farness = clamp((status.avgNearestDist - 2) / 3, 0, 1.6);
  const cavPower = clamp(status.cavShare * 3.2, 0, 1.8);
  const artPower = clamp(status.artShare * 4, 0, 1.8);
  const centerStrong = clamp((status.centerShare - 0.28) * 3.8 + (status.centerAdvantage > 0 ? 0.25 : 0), 0, 1.8);
  const flankStrong = clamp((status.flankStrongShare - 0.3) * 3.5 + (status.flankAdvantage > 0 ? 0.25 : 0), 0, 1.8);
  const flankThreat = clamp(status.flankWeakPressure / 3, 0, 1.8);

  const base = {
    advance: 0.5 + farness * 2.6 + (phase === "opening" ? 1.6 : 0),
    concentrate_center: 0.5 + centerStrong * 2,
    flank_attack: 0.35 + flankStrong * 2.1 + engagement * 0.6,
    cavalry_charge: 0.2 + cavPower * 2.2 + engagement * 0.7,
    defensive_stand: 0.3 + pressure * 2.2,
    bombard_sector: 0.2 + artPower * 2.3 + engagement * 0.3,
    defend_flank: 0.25 + flankThreat * 2.4 + pressure * 0.6,
    rally: 0.15 + lowMorale * 2,
    retreat: 0.05 + veryLowMorale * 2.6 + pressure * 0.7,
    mass_assault: 0.08 + enemyBroken * 2.1 + engagement * 0.8,
    line_rotation: 0.2 + flankThreat * 1.8 + lowMorale * 1.1,
    exploit_gap: 0.08 + status.gapOpportunity * 2.2 + engagement * 0.5,
    commit_reserve: 0.1 + flankThreat * 2.1 + pressure * 0.7,
  };

  const aggr = commander.traits.aggression || 5;
  const control = commander.traits.control || 5;
  const creativity = commander.traits.creativity || 5;
  base.mass_assault *= 0.65 + (aggr / 10) * 0.9;
  base.cavalry_charge *= 0.8 + (aggr / 10) * 0.5;
  base.flank_attack *= 0.8 + (creativity / 10) * 0.65;
  base.concentrate_center *= 0.8 + (control / 10) * 0.5;
  base.bombard_sector *= 0.8 + (control / 10) * 0.45;
  base.defensive_stand *= 0.8 + ((10 - aggr) / 10) * 0.55;
  base.defend_flank *= 0.8 + (control / 10) * 0.45;
  base.rally *= 0.75 + ((10 - aggr) / 10) * 0.65;
  base.retreat *= 0.7 + ((10 - aggr) / 10) * 0.7;
  base.line_rotation *= 0.8 + (control / 10) * 0.7;
  base.exploit_gap *= 0.8 + (creativity / 10) * 0.8;
  base.commit_reserve *= 0.8 + (control / 10) * 0.85;

  Object.keys(base).forEach((k) => {
    base[k] = Math.max(0.01, base[k]);
  });

  const preferred = new Set(commander.preferredActions || []);
  Object.keys(base).forEach((action) => {
    if (preferred.has(action)) base[action] *= 2;
  });
  return base;
}

function issueOrdersFromAction(side, events) {
  const army = state.armies[side];
  const sig = army.activeSignature;
  if (sig?.type === "perfect_plan") {
    const prepOrders = { left: "Hold", center: "Hold", right: "Hold", reserve: "Hold" };
    Object.entries(prepOrders).forEach(([wing, order]) => {
      army.divisions[wing].currentOrder = order;
    });
    if (isMajorActionTurn(state.turn)) {
      events.push(`${army.name} action set: Perfect Plan (PREPARATION)`);
      queueActionHighlights(side, "perfect_plan", "all");
      showMajorOrderPopup(side, "perfect_plan", "all");
    }
    return;
  }
  const action = army.currentAction || "concentrate_center";
  const sector = army.currentSector || "center";

  if (action === "commit_reserve") {
    const reserveUnits = army.units.filter((u) => u.alive && u.divisionId === "reserve");
    reserveUnits.forEach((u) => {
      u.divisionId = sector;
    });
    assignWingMembership(army);
  }

  const mapByAction = {
    advance: { left: "Advance", center: "Advance", right: "Advance" },
    concentrate_center: { left: "Hold", center: "Attack", right: "Hold" },
    flank_attack: sector === "left"
      ? { left: "Flank Left", center: "Advance", right: "Hold" }
      : { left: "Hold", center: "Advance", right: "Flank Right" },
    cavalry_charge: sector === "left"
      ? { left: "Cavalry Charge", center: "Advance", right: "Hold" }
      : sector === "right"
        ? { left: "Hold", center: "Advance", right: "Cavalry Charge" }
        : { left: "Hold", center: "Cavalry Charge", right: "Hold" },
    defensive_stand: { left: "Hold", center: "Hold", right: "Hold" },
    bombard_sector: sector === "left"
      ? { left: "Bombard", center: "Hold", right: "Hold" }
      : sector === "right"
        ? { left: "Hold", center: "Hold", right: "Bombard" }
        : { left: "Hold", center: "Bombard", right: "Hold" },
    defend_flank: sector === "left"
      ? { left: "Refuse Flank", center: "Hold", right: "Hold" }
      : { left: "Hold", center: "Hold", right: "Refuse Flank" },
    rally: sector === "left"
      ? { left: "Hold", center: "Hold", right: "Hold" }
      : sector === "right"
        ? { left: "Hold", center: "Hold", right: "Hold" }
        : { left: "Hold", center: "Hold", right: "Hold" },
    retreat: sector === "left"
      ? { left: "Retreat", center: "Hold", right: "Hold" }
      : sector === "right"
        ? { left: "Hold", center: "Hold", right: "Retreat" }
        : { left: "Hold", center: "Retreat", right: "Hold" },
    mass_assault: { left: "Charge", center: "Charge", right: "Charge" },
    line_rotation: sector === "left"
      ? { left: "Withdraw", center: "Hold", right: "Advance" }
      : sector === "right"
        ? { left: "Advance", center: "Hold", right: "Withdraw" }
        : { left: "Hold", center: "Withdraw", right: "Hold" },
    exploit_gap: sector === "left"
      ? { left: "Charge", center: "Hold", right: "Hold" }
      : sector === "right"
        ? { left: "Hold", center: "Hold", right: "Charge" }
        : { left: "Hold", center: "Charge", right: "Hold" },
    commit_reserve: sector === "left"
      ? { left: "Attack", center: "Hold", right: "Hold", reserve: "Advance" }
      : sector === "right"
        ? { left: "Hold", center: "Hold", right: "Attack", reserve: "Advance" }
        : { left: "Hold", center: "Attack", right: "Hold", reserve: "Advance" },
    artillery_barrage: { left: "Bombard", center: "Bombard", right: "Bombard" },
    foot_cavalry: { left: "Attack", center: "Attack", right: "Attack" },
    feigned_retreat: { left: "Withdraw", center: "Withdraw", right: "Withdraw" },
    fighting_withdrawal: { left: "Withdraw", center: "Withdraw", right: "Withdraw" },
  };
  const orders = mapByAction[action] || mapByAction.concentrate_center;
  Object.entries(orders).forEach(([wing, order]) => {
    army.divisions[wing].currentOrder = order;
  });
  if (!Object.prototype.hasOwnProperty.call(orders, "reserve")) {
    army.divisions.reserve.currentOrder = "Hold";
  }

  if (isMajorActionTurn(state.turn)) {
    events.push(`${army.name} action set: ${formatActionName(action)} (${sector.toUpperCase()})`);
    queueActionHighlights(side, action, sector);
    showMajorOrderPopup(side, action, sector);
  }
}

function showMajorOrderPopup(side, action, sector) {
  const wrap = els.orderPopupLayer;
  if (!wrap) return;
  const div = document.createElement("div");
  if (state.reelsMode) {
    const laneClass = side === "A" ? "left" : "right";
    const existing = wrap.querySelectorAll(`.order-popup.reels.${laneClass}`).length;
    div.className = `order-popup reels ${laneClass} ${existing > 0 ? "stack-1" : ""}`;
  } else {
    div.className = `order-popup ${side === "A" ? "left" : "right"}`;
  }
  const title = document.createElement("div");
  title.className = "order-popup-title";
  const commander = COMMANDERS[state.armies[side].armyCommanderId];
  title.textContent = `${commander?.name || "Commander"}: ${formatActionName(action)}`;
  const desc = document.createElement("div");
  desc.className = "order-popup-desc";
  desc.textContent = actionDescription(action, sector);
  if (isSignatureAction(action)) {
    const accent = COMMANDER_ACCENT[state.armies[side].armyCommanderId] || "#3d3124";
    title.style.color = accent;
    desc.style.color = accent;
  }
  div.appendChild(title);
  div.appendChild(desc);
  wrap.appendChild(div);
  setTimeout(() => div.remove(), 3400);
}

function isSignatureAction(action) {
  return action === "artillery_barrage"
    || action === "foot_cavalry"
    || action === "feigned_retreat"
    || action === "fighting_withdrawal"
    || action === "perfect_plan";
}

function actionDescription(action, sector) {
  const s = sector === "all" ? "army-wide" : `${sector} sector`;
  if (action === "advance") return "Infantry gets +5% attack while advancing.";
  if (action === "concentrate_center") return "Center wing gets +20% attack damage.";
  if (action === "flank_attack") return `Flank wing in ${s} gets +20% attack damage.`;
  if (action === "cavalry_charge") return `Cavalry in ${s} gets +20% attack damage.`;
  if (action === "defensive_stand") return `Units in ${s} take 20% less damage.`;
  if (action === "bombard_sector") return `Artillery in ${s} gets +20% attack damage.`;
  if (action === "defend_flank") return `Target flank in ${s} refuses flank and braces against turning attacks.`;
  if (action === "rally") return `Target flank in ${s} holds and recovers morale.`;
  if (action === "retreat") return `Target flank in ${s} retreats, recovers morale, but risks cascading morale collapse.`;
  if (action === "mass_assault") return "All sectors attack: +20% dealt, but units take +20% damage.";
  if (action === "line_rotation") return `Sector ${s} rotates line: controlled withdrawal, relief, and recovery.`;
  if (action === "exploit_gap") return `Exploit weakness in ${s}: opportunistic push with flank pressure.`;
  if (action === "commit_reserve") return `Reserve wing commits into ${s} to stabilize and counter-attack.`;
  if (action === "artillery_barrage") return "All artillery deals x2 damage for 5 turns.";
  if (action === "foot_cavalry") return "All infantry gets +1 move and extra morale pressure for 5 turns.";
  if (action === "feigned_retreat") return "All cavalry retreats and attacks at range 2 for 5 turns.";
  if (action === "fighting_withdrawal") return "Army-wide retreat with +20% morale and 20% damage reduction for 5 turns.";
  if (action === "perfect_plan") return "All units hold for 5 turns. Then force an offensive action with +20% damage until the next major action turn.";
  return "Major action active.";
}

function queueActionHighlights(side, action, sector) {
  if (action === "advance" || isSignatureAction(action)) return;
  const label = formatActionName(action);
  const wings = affectedWingsForAction(action, sector);
  const expiresAt = Date.now() + 3200;
  wings.forEach((wing) => {
    state.actionHighlights.push({ side, wing, label, expiresAt });
  });
  setTimeout(() => render(), 3300);
}

function affectedWingsForAction(action, sector) {
  if (action === "concentrate_center") return ["center"];
  if (action === "defensive_stand") return [sector];
  if (action === "bombard_sector" || action === "artillery_barrage") return [sector];
  if (action === "flank_attack") return sector === "center" ? ["left", "right"] : [sector];
  if (action === "cavalry_charge") return sector === "center" ? ["left", "right"] : [sector];
  if (action === "fighting_withdrawal") return ["left", "center", "right"];
  if (action === "foot_cavalry" || action === "feigned_retreat") return ["left", "center", "right"];
  if (action === "mass_assault") return ["left", "center", "right"];
  if (action === "line_rotation" || action === "exploit_gap") return [sector];
  if (action === "commit_reserve") return [sector, "reserve"];
  if (action === "defend_flank" || action === "rally" || action === "retreat") return [sector];
  return ["left", "center", "right"];
}

function formatActionName(action) {
  return action.split("_").map((s) => s[0].toUpperCase() + s.slice(1)).join(" ");
}

function weightedPick(options, weights, rand) {
  const total = options.reduce((acc, o) => acc + (weights[o] || 1), 0);
  let roll = rand() * total;
  for (let i = 0; i < options.length; i += 1) {
    const w = weights[options[i]] || 1;
    roll -= w;
    if (roll <= 0) return options[i];
  }
  return options[options.length - 1];
}

function chooseForcedOffensiveAction(side, rand) {
  const offensivePool = ["advance", "concentrate_center", "flank_attack", "cavalry_charge", "bombard_sector", "mass_assault", "exploit_gap"];
  const available = getAvailableActionsForArmy(side).filter((a) => offensivePool.includes(a));
  if (!available.length) return "advance";
  const army = state.armies[side];
  const commander = COMMANDERS[army.armyCommanderId];
  const phase = getBattlePhase(side);
  const weights = getActionWeights(commander, phase, side);
  return weightedPick(available, weights, rand);
}

function applyFriction(side, rand, events) {
  // TODO: wing commander friction — currently unused. All orders succeed.
}

function tickActiveAction(side, rand, events) {
  const army = state.armies[side];
  const sig = army.activeSignature;
  if (!sig) return;

  if (sig.type === "perfect_plan") {
    sig.turnsLeft -= 1;
    if (sig.turnsLeft <= 0) {
      const forced = chooseForcedOffensiveAction(side, rand);
      const forcedSector = chooseSectorForAction(forced, side, rand);
      army.currentAction = forced;
      army.currentSector = forcedSector;
      army.forcedMajorAction = forced;
      army.forcedMajorSector = forcedSector;
      army.majorActionDamageBoost = 1.2;
      army.majorActionDamageBoostTurns = turnsUntilNextActionTurn() + 1;
      army.activeSignature = null;
      events.push(`${COMMANDERS[army.armyCommanderId].name}: Perfect Plan complete — ${formatActionName(forced)} ordered (+20% damage).`);
    }
    return;
  }

  sig.turnsLeft -= 1;
  if (sig.turnsLeft <= 0) army.activeSignature = null;
}

function tickMajorActionBoost(side) {
  const army = state.armies[side];
  if (!army.majorActionDamageBoostTurns || army.majorActionDamageBoostTurns <= 0) return;
  army.majorActionDamageBoostTurns -= 1;
  if (army.majorActionDamageBoostTurns <= 0) {
    army.majorActionDamageBoostTurns = 0;
    army.majorActionDamageBoost = 1;
  }
}

function moveUnits(side, rand) {
  const army = state.armies[side];
  const enemySide = side === "A" ? "B" : "A";
  const reserved = new Set();
  const movers = army.units.filter((u) => u.alive);
  movers.forEach((u) => {
    const wing = army.divisions[u.divisionId] || army.divisions.center;
    const nearest = nearestEnemy(u, enemySide);
    if (!nearest) return;
    const distToNearest = hexDist(u.q, u.r, nearest.q, nearest.r);
    const activeSig = state.armies[side].activeSignature;

    if (activeSig?.type === "feigned_retreat" && u.type === "cavalry") {
      const retreatQ = u.q + Math.sign(u.q - nearest.q);
      const retreatR = u.r + Math.sign(u.r - nearest.r);
      const retreatHex = getHex(retreatQ, retreatR);
      if (retreatHex && retreatHex.active && retreatHex.terrain !== "blocked" && !retreatHex.occupantUnitId) {
        setUnitPos(u, retreatQ, retreatR);
      }
      return;
    }

    if (u.type === "artillery") {
      if (distToNearest <= u.range && distToNearest > 1) return;
      if (distToNearest <= 1) {
        const awayQ = u.q + Math.sign(u.q - nearest.q);
        const awayR = u.r + Math.sign(u.r - nearest.r);
        const awayHex = getHex(awayQ, awayR);
        if (awayHex && awayHex.active && awayHex.terrain !== "blocked" && !awayHex.occupantUnitId) {
          setUnitPos(u, awayQ, awayR);
          return;
        }
      }
    }

    const isFlankOrder = wing.currentOrder === "Flank Left" || wing.currentOrder === "Flank Right";
    const allowsDisengage = wing.currentOrder === "Retreat" || wing.currentOrder === "Withdraw" || wing.currentOrder === "Refuse Flank";
    if (!isFlankOrder && !allowsDisengage && distToNearest <= 1) return;

    let steps = Math.max(1, u.move);
    const sig = activeSig;
    if (sig?.type === "foot_cavalry" && u.type === "infantry") {
      steps += 1;
    }
    const visitedThisMove = new Set([`${u.q},${u.r}`]);
    for (let i = 0; i < steps; i += 1) {
      const next = chooseBestStep(u, nearest, wing, side, isFlankOrder, reserved, visitedThisMove);
      if (!next) break;
      setUnitPos(u, next.q, next.r);
      reserved.add(`${next.q},${next.r}`);
      visitedThisMove.add(`${next.q},${next.r}`);
    }


  });
}

function getSectorForUnit(unit) {
  if (unit.divisionId === "left") return "left";
  if (unit.divisionId === "right") return "right";
  return "center";
}

function getActionAttackMultiplier(army, unit) {
  const action = army.currentAction;
  const sector = army.currentSector || "center";
  const unitSector = getSectorForUnit(unit);

  let mult = 1;
  if (action === "concentrate_center" && unitSector === "center") mult *= 1.2;
  if (action === "flank_attack" && unitSector === sector) mult *= 1.2;
  if (action === "cavalry_charge" && unit.type === "cavalry" && (unitSector === sector || sector === "center")) mult *= 1.2;
  if (action === "bombard_sector" && unit.type === "artillery" && unitSector === sector) mult *= 1.2;
  if (action === "advance" && unit.type === "infantry") mult *= 1.05;
  if (action === "defend_flank" && unitSector === sector) mult *= 1.05;
  if (action === "mass_assault") mult *= 1.2;
  if (action === "exploit_gap" && unitSector === sector) mult *= 1.2;
  if ((army.majorActionDamageBoost || 1) > 1 && (army.majorActionDamageBoostTurns || 0) > 0) {
    mult *= army.majorActionDamageBoost;
  }
  const sig = army.activeSignature;
  return mult;
}

function getActionDefenseMultiplier(army, unit) {
  const action = army.currentAction;
  const sector = army.currentSector || "center";
  const unitSector = getSectorForUnit(unit);
  if (action === "defensive_stand" && unitSector === sector) return 0.8;
  if (action === "defend_flank" && unitSector === sector) return 0.8;
  if (action === "rally" && unitSector === sector) return 0.8;
  if (action === "mass_assault") return 1.2;
  if (action === "line_rotation" && unitSector === sector) return 0.9;
  const sig = army.activeSignature;
  if (sig?.type === "fighting_withdrawal") return 0.8;
  return 1;
}

function getActionMoraleShockMultiplier(army, unit) {
  const action = army.currentAction;
  const sector = army.currentSector || "center";
  const unitSector = getSectorForUnit(unit);
  if (action === "retreat" && unitSector === sector) return 2;
  return 1;
}

function chooseBestStep(unit, nearest, wing, side, isFlankOrder, reserved, visitedThisMove) {
  const neighbors = getNeighbors(unit.q, unit.r)
    .filter((h) => h
      && h.active
      && h.terrain !== "blocked"
      && !h.occupantUnitId
      && !reserved.has(`${h.q},${h.r}`)
      && !visitedThisMove.has(`${h.q},${h.r}`));
  if (!neighbors.length) return null;

  const holdLine = wing.currentOrder === "Hold";
  const holdNeighbors = holdLine
    ? neighbors.filter((h) => hexDist(h.q, h.r, nearest.q, nearest.r) >= hexDist(unit.q, unit.r, nearest.q, nearest.r))
    : neighbors;
  const candidates = holdNeighbors.length ? holdNeighbors : neighbors;

  let best = null;
  let bestScore = -Infinity;
  candidates.forEach((h) => {
    const score = scoreMoveTile(unit, h, nearest, wing, side, isFlankOrder);
    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  });
  if (holdLine && bestScore < 6) return null;
  return best;
}

function scoreMoveTile(unit, hex, nearest, wing, side, isFlankOrder) {
  const currentDist = hexDist(unit.q, unit.r, nearest.q, nearest.r);
  const nextDist = hexDist(hex.q, hex.r, nearest.q, nearest.r);
  let score = (currentDist - nextDist) * 10;

  if (isFlankOrder) {
    const flankBias = wing.currentOrder.includes("Left") ? -1 : 1;
    score += (hex.r - unit.r) * flankBias * 7;
  }

  if (wing.currentOrder === "Retreat") score = -score * 1.35;
  if (wing.currentOrder === "Withdraw") score = -score * 0.65;
  if (wing.currentOrder === "Hold") {
    if (nextDist < currentDist) score -= 18;
    if (nextDist > currentDist) score -= 4;
    if (nextDist === currentDist) score += 8;
  }

  if (wing.currentOrder === "Refuse Flank") {
    const centerAnchor = getCenterDivisionMeanR(side);
    const currentToCenter = Math.abs((unit.r ?? 0) - centerAnchor);
    const nextToCenter = Math.abs(hex.r - centerAnchor);
    score += (currentToCenter - nextToCenter) * 10;
    score += (hexDist(hex.q, hex.r, nearest.q, nearest.r) - currentDist) * 6;
  }

  if (unit.prevQ === hex.q && unit.prevR === hex.r) {
    const bouncePenalty = wing.currentOrder === "Retreat" ? 8 : 22;
    score -= bouncePenalty;
  }

  const laneDiff = Math.abs((unit.preferredR ?? unit.r) - hex.r);
  score -= laneDiff * (unit.type === "cavalry" ? 2 : 6);

  const friendlyAdj = countAdjacentFriendly(hex.q, hex.r, unit.armyId);
  score += friendlyAdj * 5;
  if (friendlyAdj === 0) score -= 12;

  const localCrowd = countFriendlyInRadius(hex.q, hex.r, unit.armyId, 1);
  if (localCrowd > 3) score -= (localCrowd - 3) * 8;

  if (unit.type === "artillery") {
    const standOff = hexDist(hex.q, hex.r, nearest.q, nearest.r);
    if (standOff === 2) score += 22;
    else if (standOff === 3) score -= 6;
    if (standOff <= 1) score -= 20;
    if (standOff > 3) score -= 12;
  }

  if (unit.type === "infantry") score += 4;
  if (unit.type === "cavalry" && !isFlankOrder && nextDist <= 1) score -= 6;

  return score;
}

function getCenterDivisionMeanR(side) {
  const army = state.armies[side];
  const centerUnits = army.units.filter((u) => u.alive && u.divisionId === "center");
  if (!centerUnits.length) return 8;
  const total = centerUnits.reduce((sum, u) => sum + u.r, 0);
  return total / centerUnits.length;
}

function getNeighbors(q, r) {
  const dirs = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  return dirs.map(([dq, dr]) => getHex(q + dq, r + dr)).filter(Boolean);
}

function countAdjacentFriendly(q, r, side) {
  return getNeighbors(q, r).filter((h) => h.occupantUnitId && h.occupantUnitId.startsWith(`${side}_`)).length;
}

function countFriendlyInRadius(q, r, side, radius) {
  return state.armies[side].units.filter((u) => u.alive && hexDist(q, r, u.q, u.r) <= radius).length;
}

function nearestEnemy(unit, enemySide) {
  let best = null;
  let bestDist = Infinity;
  state.armies[enemySide].units.filter((u) => u.alive).forEach((e) => {
    const d = hexDist(unit.q, unit.r, e.q, e.r);
    if (d < bestDist) { bestDist = d; best = e; }
  });
  return best;
}

function hexDist(q1, r1, q2, r2) {
  const dq = q1 - q2;
  const dr = r1 - r2;
  const ds = (q1 + r1) - (q2 + r2);
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

function resolveCombat(rand, events) {
  const damageDealt = { A: 0, B: 0 };
  const turnShockTracker = {};
  const aliveAtStart = new Set(
    [...state.armies.A.units, ...state.armies.B.units].filter((u) => u.alive).map((u) => u.id),
  );
  const intents = [];

  ["A", "B"].forEach((side) => {
    const enemy = side === "A" ? "B" : "A";
    state.armies[side].units.filter((u) => u.alive).forEach((u) => {
      if (!aliveAtStart.has(u.id)) return;
      const target = pickTargetFromSet(u, enemy, aliveAtStart);
      if (!target || !aliveAtStart.has(target.id)) return;

      const targetDist = hexDist(u.q, u.r, target.q, target.r);
      const attackerCohesion = countAdjacentFriendly(u.q, u.r, u.armyId);
      const targetSupport = countAdjacentFriendly(target.q, target.r, target.armyId);
      const cohesionBonus = attackerCohesion >= 2 ? 1.15 : 1;
      const supportMitigation = targetSupport >= 2 ? 0.9 : 1;

      let baseAttack = u.attack;
      if (u.type === "artillery") {
        baseAttack = targetDist <= 1 ? 16 : 8;
      }
      let base = baseAttack * cohesionBonus * supportMitigation;
      const sig = state.armies[side].activeSignature;
      if (sig?.type === "artillery_barrage" && u.type === "artillery") {
        base *= 2;
      }
      base *= getActionAttackMultiplier(state.armies[side], u);
      base *= getActionDefenseMultiplier(state.armies[target.armyId], target);
      const moraleMod = Math.max(0.4, u.morale / 100);
      const dmg = base * moraleMod * (0.6 + rand() * 0.8);

      intents.push({ attacker: u, target, side, dmg, targetSupport });
    });
  });

  intents.forEach((intent) => {
    const { attacker, target, side, dmg, targetSupport } = intent;
    if (!target.alive) return;
    target.strength -= dmg;
    damageDealt[side] += Math.max(0, dmg);

    let moraleShock = 0;
    const shockTags = [];
    const trackerKey = target.id;
    if (!turnShockTracker[trackerKey]) turnShockTracker[trackerKey] = new Set();
    const applyShock = (shockId, amount, label) => {
      if (turnShockTracker[trackerKey].has(shockId)) return;
      turnShockTracker[trackerKey].add(shockId);
      moraleShock += amount;
      shockTags.push(label);
    };

    if (attacker.type === "cavalry") {
      if (!target.statuses) target.statuses = { cavalryShockTurns: 0 };
      if ((target.statuses.cavalryShockTurns || 0) <= 0) {
        applyShock("cavalry", -20, "CAVALRY SHOCK -20%");
        target.statuses.cavalryShockTurns = 2;
      }
    }
    const surround = estimateSurrounding(target);
    applyPersistentStateShock(target, "surrounded", surround.full, -90, "SURROUNDED -90%", applyShock);
    applyPersistentStateShock(target, "flanked", surround.opposite, -50, "FLANKED -50%", applyShock);
    applyPersistentStateShock(target, "isolated", targetSupport === 0, -20, "ISOLATED -20%", applyShock);
    const footSig = state.armies[side].activeSignature;
    if (footSig?.type === "foot_cavalry" && attacker.type === "infantry") {
      applyShock("foot_cavalry_pressure", -15, "FOOT CAVALRY PRESSURE -15%");
    }
    const moraleShockMult = moraleShock < 0 ? getActionMoraleShockMultiplier(state.armies[target.armyId], target) : 1;
    target.morale += moraleShock * moraleShockMult;

    if (moraleShock < 0) {
      const label = shockTags.length ? shockTags.join(" + ") : `MORALE SHOCK ${Math.round(moraleShock)}%`;
      events.push(`${displayUnitId(target.id)} ${label}`);
    }
  });

  ["A", "B"].forEach((side) => {
    const army = state.armies[side];
    if (army.activeSignature) return;
    const gain = 5 + Math.min(25, damageDealt[side] / 18);
    army.abilityCharge = Math.min(100, army.abilityCharge + gain);
    if (army.abilityCharge >= 100) army.abilityReady = true;
  });
}

function pickTargetFromSet(unit, enemySide, aliveSet) {
  let best = null;
  let bestD = Infinity;
  const range = getEffectiveRange(unit);
  state.armies[enemySide].units.filter((u) => u.alive && aliveSet.has(u.id)).forEach((e) => {
    const d = hexDist(unit.q, unit.r, e.q, e.r);
    if (d <= range && d < bestD) { bestD = d; best = e; }
  });
  return best;
}

function pickTarget(unit, enemySide) {
  let best = null;
  let bestD = Infinity;
  const range = getEffectiveRange(unit);
  state.armies[enemySide].units.filter((u) => u.alive).forEach((e) => {
    const d = hexDist(unit.q, unit.r, e.q, e.r);
    if (d <= range && d < bestD) { bestD = d; best = e; }
  });
  return best;
}

function getEffectiveRange(unit) {
  const sig = state.armies[unit.armyId].activeSignature;
  if (sig?.type === "feigned_retreat" && unit.type === "cavalry") return 2;
  return unit.range;
}

function estimateSurrounding(target) {
  const enemySide = target.armyId === "A" ? "B" : "A";
  const dirs = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  const occupied = dirs.map(([dq, dr]) => {
    const h = getHex(target.q + dq, target.r + dr);
    if (!h || !h.occupantUnitId) return false;
    return h.occupantUnitId.startsWith(`${enemySide}_`);
  });
  return {
    opposite: (occupied[0] && occupied[3]) || (occupied[1] && occupied[4]) || (occupied[2] && occupied[5]),
    full: occupied.every(Boolean),
  };
}

function applyPersistentStateShock(unit, stateKey, condition, amount, label, applyShock) {
  if (!unit.shockLocks) unit.shockLocks = { isolated: false, flanked: false, surrounded: false };
  if (condition) {
    if (!unit.shockLocks[stateKey]) {
      applyShock(stateKey, amount, label);
      unit.shockLocks[stateKey] = true;
    }
  } else {
    unit.shockLocks[stateKey] = false;
  }
}

function routeAndCleanup(events) {
  ["A", "B"].forEach((side) => {
    const army = state.armies[side];
    const moraleRecoverySector = (army.currentAction === "rally" || army.currentAction === "retreat" || army.currentAction === "line_rotation") ? (army.currentSector || "center") : null;
    const routedThisTurn = [];
    state.armies[side].units.forEach((u) => {
      if (!u.alive) return;
      if (!u.statuses) u.statuses = { cavalryShockTurns: 0 };
      if ((u.statuses.cavalryShockTurns || 0) > 0) u.statuses.cavalryShockTurns -= 1;
      if (moraleRecoverySector && getSectorForUnit(u) === moraleRecoverySector) {
        const gain = army.currentAction === "line_rotation" ? 5 : 8;
        u.morale = Math.min(100, u.morale + gain);
      }
      u.morale = Math.max(0, Math.min(100, u.morale));
      if (u.morale === 0 || u.strength <= 0) {
        u.alive = false;
        const h = getHex(u.q, u.r);
        if (h && h.occupantUnitId === u.id) h.occupantUnitId = null;
        events.push(`${displayUnitId(u.id)} ROUTED`);
        routedThisTurn.push({ q: u.q, r: u.r, id: u.id });
      }
      if (u.morale < 40 && u.morale > 0) u.state = "broken";
      else if (u.morale < 70) u.state = "shaken";
      else u.state = "steady";
    });

    if (routedThisTurn.length) {
      let shocked = 0;
      army.units.forEach((u) => {
        if (!u.alive) return;
        let shock = 0;
        routedThisTurn.forEach((r) => {
          const d = hexDist(u.q, u.r, r.q, r.r);
          if (d === 1) shock += 12;
          else if (d === 2) shock += 6;
        });
        if (shock > 0) {
          u.morale = Math.max(0, u.morale - shock);
          shocked += 1;
        }
      });
      if (shocked > 0) events.push(`${army.name} morale cascade: ${shocked} nearby units shaken.`);
    }
  });
}

function checkEndCondition() {
  refreshArmyCounts();
  const a = state.armies.A;
  const b = state.armies.B;
  const aPct = (a.defeatedUnitCount / Math.max(1, a.startingUnitCount)) * 100;
  const bPct = (b.defeatedUnitCount / Math.max(1, b.startingUnitCount)) * 100;
  if (aPct >= state.defeatThresholdPercent) return "Red Army";
  if (bPct >= state.defeatThresholdPercent) return "Blue Army";
  return null;
}

function endBattle(text) {
  stopSimulationLoop();
  els.banner.textContent = text;
  log(text);
  state.replay.finalResult = text;
  state.battleOverlay = buildBattleOverlay();
  const report = postBattleReport();
  log(report.winner);
  log(report.keyMoment);
  log(report.collapseReason);
  render();
}

function buildBattleOverlay() {
  const blue = state.armies.A;
  const red = state.armies.B;
  const bluePct = (blue.defeatedUnitCount / Math.max(1, blue.startingUnitCount)) * 100;
  const redPct = (red.defeatedUnitCount / Math.max(1, red.startingUnitCount)) * 100;
  const winnerSide = redPct >= state.defeatThresholdPercent ? "A" : "B";
  const loserSide = winnerSide === "A" ? "B" : "A";
  const winnerName = COMMANDERS[state.armies[winnerSide].armyCommanderId]?.name || (winnerSide === "A" ? "Blue" : "Red");
  const loserName = COMMANDERS[state.armies[loserSide].armyCommanderId]?.name || (loserSide === "A" ? "Blue" : "Red");
  const blueCas = casualtyByType(blue);
  const redCas = casualtyByType(red);
  const blueStart = startingByType(blue);
  const redStart = startingByType(red);
  const blueCmd = (COMMANDERS[blue.armyCommanderId]?.name || "Blue").toUpperCase();
  const redCmd = (COMMANDERS[red.armyCommanderId]?.name || "Red").toUpperCase();
  return {
    title: `${winnerName} defeats ${loserName}!`,
    leftName: blueCmd,
    rightName: redCmd,
    left: {
      infantry: `${blueCas.infantry}/${blueStart.infantry}`,
      cavalry: `${blueCas.cavalry}/${blueStart.cavalry}`,
      artillery: `${blueCas.artillery}/${blueStart.artillery}`,
    },
    right: {
      infantry: `${redCas.infantry}/${redStart.infantry}`,
      cavalry: `${redCas.cavalry}/${redStart.cavalry}`,
      artillery: `${redCas.artillery}/${redStart.artillery}`,
    },
  };
}

function casualtyByType(army) {
  const out = { infantry: 0, cavalry: 0, artillery: 0 };
  army.units.forEach((u) => {
    if (!u.alive && out[u.type] !== undefined) out[u.type] += 1;
  });
  return out;
}

function startingByType(army) {
  const out = { infantry: 0, cavalry: 0, artillery: 0 };
  army.units.forEach((u) => {
    if (out[u.type] !== undefined) out[u.type] += 1;
  });
  return out;
}

function postBattleReport() {
  const a = state.armies.A;
  const b = state.armies.B;
  const aPct = Math.round((a.defeatedUnitCount / Math.max(1, a.startingUnitCount)) * 100);
  const bPct = Math.round((b.defeatedUnitCount / Math.max(1, b.startingUnitCount)) * 100);
  const winner = aPct > bPct ? "Army B wins" : "Army A wins";
  return {
    winner: `Winner: ${winner} after ${state.turn} turns.`,
    keyMoment: "Key Moment: a flank collapse triggered a rout cascade.",
    collapseReason: "Collapse Reason: morale shocks from cavalry and opposite-side attacks.",
  };
}

function randomizeSeed() {
  state.seed = randomSeed();
  els.seedInput.value = state.seed;
  log(`Seed randomized: ${state.seed}`);
}

function randomSeed() {
  if (window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return Number(arr[0] % 1000000000);
  }
  return Math.floor(Math.random() * 1000000000);
}

function clearTerrain() {
  state.map.hexes.forEach((h) => {
    h.terrain = "plain";
  });
  log("Terrain cleared to plain.");
  render();
}

function clearArmies() {
  stopSimulationLoop();
  state.selectedUnitId = null;
  state.moveSourceUnitId = null;
  state.selectedWingUnits.clear();
  state.actionHighlights = [];
  state.battleOverlay = null;
  state.unitAnimations = {};
  state.turn = 0;

  ["A", "B"].forEach((side) => {
    state.armies[side].units = [];
    assignWingMembership(state.armies[side]);
  });
  state.map.hexes.forEach((h) => {
    h.occupantUnitId = null;
  });
  refreshArmyCounts();
  log("All armies cleared from the map.");
  render();
}

function saveScenario() {
  const name = (els.scenarioNameInput.value || "").trim() || `Scenario ${new Date().toLocaleString()}`;
  const payload = {
    map: state.map,
    armies: state.armies,
    rules: { turnLimit: state.turnLimit, defeatThresholdPercent: state.defeatThresholdPercent },
    seed: state.seed,
    armyConfig: state.armyConfig,
  };

  apiRequest(SCENARIO_API, { method: "POST", body: JSON.stringify({ name, payload }) })
    .then(() => {
      log(`Scenario saved: ${name}`);
      els.scenarioNameInput.value = "";
      renderScenarioLibrary();
    })
    .catch(() => log("Scenario save failed. Start with `python3 server.py` to enable file saves."));
}

function loadScenarioById(id) {
  apiRequest(`${SCENARIO_API}/${encodeURIComponent(id)}`)
    .then((record) => {
      const loaded = record.payload;
      state.map = loaded.map;
      state.armies = loaded.armies;
      ["A", "B"].forEach((side) => hydrateArmyState(state.armies[side]));
      state.turnLimit = loaded.rules?.turnLimit ?? state.turnLimit;
      state.defeatThresholdPercent = loaded.rules.defeatThresholdPercent;
      state.seed = loaded.seed;
      state.armyConfig = loaded.armyConfig || state.armyConfig;
      state.turn = 0;
      stopSimulationLoop();
      state.actionHighlights = [];
      state.battleOverlay = null;
      state.unitAnimations = {};
      refreshArmyCounts();
      els.seedInput.value = state.seed;
      els.turnLimitInput.value = state.turnLimit;
      els.defeatInput.value = state.defeatThresholdPercent;
      log(`Scenario loaded: ${record.name}`);
      render();
      closeScenarioLibrary();
    })
    .catch(() => log("Scenario load failed."));
}

function deleteScenarioById(id) {
  apiRequest(`${SCENARIO_API}/${encodeURIComponent(id)}`, { method: "DELETE" })
    .then(() => renderScenarioLibrary())
    .catch(() => log("Scenario delete failed."));
}

function exportScenarioById(id) {
  apiRequest(`${SCENARIO_API}/${encodeURIComponent(id)}`)
    .then((record) => {
      const safeName = record.name.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase();
      const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName || "scenario"}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      log(`Scenario exported: ${record.name}`);
    })
    .catch(() => log("Scenario export failed."));
}

function importScenarioFromFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      const payload = parsed.payload ? parsed.payload : parsed;
      const name = (parsed.name || file.name.replace(/\.json$/i, "") || "Imported Scenario").trim();
      if (!payload.map || !payload.armies || !payload.seed) {
        log("Import failed: invalid scenario file format.");
        return;
      }
      apiRequest(SCENARIO_API, { method: "POST", body: JSON.stringify({ name, payload }) })
        .then(() => {
          renderScenarioLibrary();
          log(`Scenario imported: ${name}`);
        })
        .catch(() => log("Import failed: server unavailable."));
    } catch {
      log("Import failed: could not parse JSON file.");
    } finally {
      els.importScenarioInput.value = "";
    }
  };
  reader.readAsText(file);
}

function renderScenarioLibrary() {
  els.scenarioList.innerHTML = "";
  apiRequest(SCENARIO_API)
    .then((res) => {
      const library = (res.items || []).sort((a, b) => b.updatedAt - a.updatedAt);
      if (!library.length) {
        const empty = document.createElement("div");
        empty.className = "card";
        empty.textContent = "No saved scenarios yet.";
        els.scenarioList.appendChild(empty);
        return;
      }

      library.forEach((entry) => {
        const row = document.createElement("div");
        row.className = "scenario-row";

        const info = document.createElement("div");
        const title = document.createElement("div");
        title.textContent = entry.name;
        const meta = document.createElement("div");
        meta.className = "scenario-meta";
        meta.textContent = `Saved ${new Date(entry.updatedAt).toLocaleString()}`;
        info.appendChild(title);
        info.appendChild(meta);

        const loadBtn = document.createElement("button");
        loadBtn.textContent = "Load";
        loadBtn.onclick = () => loadScenarioById(entry.id);

        const delBtn = document.createElement("button");
        delBtn.textContent = "Delete";
        delBtn.onclick = () => deleteScenarioById(entry.id);

        const exportBtn = document.createElement("button");
        exportBtn.textContent = "Export";
        exportBtn.onclick = () => exportScenarioById(entry.id);

        row.appendChild(info);
        row.appendChild(loadBtn);
        row.appendChild(exportBtn);
        row.appendChild(delBtn);
        els.scenarioList.appendChild(row);
      });
    })
    .catch(() => {
      const note = document.createElement("div");
      note.className = "card";
      note.textContent = "File scenario library offline. Run: python3 server.py";
      els.scenarioList.appendChild(note);
    });
}

function apiRequest(url, options = {}) {
  return fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });
}

function log(text) {
  const div = document.createElement("div");
  div.className = "log-entry";
  div.textContent = text;
  els.log.prepend(div);
}

init();
