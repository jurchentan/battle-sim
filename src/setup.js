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
  if (!army.divisions || typeof army.divisions !== "object") {
    army.divisions = wingTemplate();
  }
  DIVISION_IDS.forEach((wingId) => {
    if (!army.divisions[wingId]) {
      const defaultOrder = defaultDivisionOrder(wingId);
      army.divisions[wingId] = { id: wingId, commanderId: army.armyCommanderId || "napoleon", unitIds: [], currentOrder: defaultOrder, lastFrictionEvent: null };
      return;
    }
    const wing = army.divisions[wingId];
    wing.id = wingId;
    if (!Array.isArray(wing.unitIds)) wing.unitIds = [];
    if (!wing.currentOrder) wing.currentOrder = defaultDivisionOrder(wingId);
    if (wing.lastFrictionEvent === undefined) wing.lastFrictionEvent = null;
  });
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
    if (!u.statuses) u.statuses = { cavalryShockTurns: 0, disengageTurns: 0 };
    if (u.statuses.cavalryShockTurns === undefined || u.statuses.cavalryShockTurns === null) {
      u.statuses.cavalryShockTurns = 0;
    }
    if (u.statuses.disengageTurns === undefined || u.statuses.disengageTurns === null) {
      u.statuses.disengageTurns = 0;
    }
  });
}

function wingTemplate() {
  return {
    // TODO: wing commanders are defined but unused. commanderId is dead data — no logic reads it.
    left: { id: "left", commanderId: "napoleon", unitIds: [], currentOrder: "Hold", lastFrictionEvent: null },
    center: { id: "center", commanderId: "napoleon", unitIds: [], currentOrder: "Hold", lastFrictionEvent: null },
    right: { id: "right", commanderId: "lee", unitIds: [], currentOrder: "Hold", lastFrictionEvent: null },
    reserve: { id: "reserve", commanderId: "washington", unitIds: [], currentOrder: "Stay in Reserve", lastFrictionEvent: null },
    cavalry: { id: "cavalry", commanderId: "genghis", unitIds: [], currentOrder: "Stay on Flanks", lastFrictionEvent: null },
    artillery: { id: "artillery", commanderId: "napoleon", unitIds: [], currentOrder: "Stay in Rear", lastFrictionEvent: null },
  };
}

function defaultDivisionOrder(divisionId) {
  if (divisionId === "reserve") return "Stay in Reserve";
  if (divisionId === "cavalry") return "Stay on Flanks";
  if (divisionId === "artillery") return "Stay in Rear";
  return "Hold";
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
    statuses: { cavalryShockTurns: 0, disengageTurns: 0 },
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
    if (!army.divisions[w]) {
      army.divisions[w] = { id: w, commanderId: army.armyCommanderId || "napoleon", unitIds: [], currentOrder: defaultDivisionOrder(w), lastFrictionEvent: null };
    }
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

function reconcileScenarioState() {
  state.map.hexes.forEach((h) => {
    h.occupantUnitId = null;
  });

  ["A", "B"].forEach((side) => {
    const army = state.armies[side];
    if (!army || !Array.isArray(army.units)) return;

    army.units.forEach((u) => {
      if (u.alive === undefined || u.alive === null) {
        u.alive = (u.strength ?? 1) > 0 && (u.morale ?? 1) > 0;
      }
      if (!u.divisionId || !army.divisions[u.divisionId]) {
        u.divisionId = "center";
      }
      if (!u.alive) return;

      const hex = getHex(u.q, u.r);
      if (!hex || !hex.active || hex.terrain === "blocked") {
        u.alive = false;
        return;
      }

      if (!hex.occupantUnitId) {
        hex.occupantUnitId = u.id;
        return;
      }

      const winner = findUnit(hex.occupantUnitId);
      if (!winner || !winner.alive) {
        hex.occupantUnitId = u.id;
      } else {
        u.alive = false;
      }
    });

    assignWingMembership(army);
  });
}
