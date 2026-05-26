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
    state.simTimer = setTimeout(loop, getTurnTransitionDelayMs());
  };
  loop();
}

function getTurnTransitionDelayMs() {
  const baseDelay = getSimStepDelayMs();
  if (!state.reelsMode) return baseDelay;
  const animationDelay = getRemainingUnitAnimationMs();
  return Math.max(baseDelay, animationDelay + 24);
}

function getRemainingUnitAnimationMs() {
  const now = performance.now();
  let maxRemaining = 0;
  Object.values(state.unitAnimations).forEach((anim) => {
    if (!anim) return;
    const segCount = Array.isArray(anim.segments) ? anim.segments.length : 0;
    if (segCount <= 0) return;
    const segDuration = anim.segmentDuration || getAnimationDurationMs();
    const total = segCount * segDuration;
    const elapsed = now - (anim.start || now);
    const remaining = Math.max(0, total - elapsed);
    if (remaining > maxRemaining) maxRemaining = remaining;
  });
  return maxRemaining;
}

function stepTurn() {
  const rand = rngFactory(state.seed + state.turn * 997);
  state.turn += 1;
  const turnEvents = [];

  if (isMajorActionTurn(state.turn)) {
    ["A", "B"].forEach((side) => chooseMajorAction(side, rand, turnEvents));
  }
  ["A", "B"].forEach((side) => autoCommitReservesIfDivisionCollapsed(side, turnEvents));
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
  return FRONTLINE_DIVISION_IDS.filter((s) =>
    army.divisions[s].unitIds.some((id) => {
      const u = army.units.find((u2) => u2.id === id);
      return u && u.alive && u.type === type;
    })
  );
}

function aliveCountInDivision(side, divisionId) {
  const army = state.armies[side];
  return (army.divisions[divisionId]?.unitIds || []).filter((id) => {
    const u = army.units.find((u2) => u2.id === id);
    return u && u.alive;
  }).length;
}

function aliveCountInSector(side, sector) {
  return aliveCountInDivision(side, sector);
}

function sectorWeights(side, sectors) {
  const w = {};
  sectors.forEach((s) => { w[s] = aliveCountInSector(side, s); });
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  if (total === 0) sectors.forEach((s) => { w[s] = 1; });
  return w;
}

function avgMoraleInSector(side, sector) {
  const army = state.armies[side];
  const units = army.divisions[sector].unitIds
    .map((id) => army.units.find((u) => u.id === id))
    .filter((u) => u && u.alive);
  if (!units.length) return 100;
  return units.reduce((sum, u) => sum + u.morale, 0) / units.length;
}

function chooseReserveReinforcementSector(side, candidateSectors = FRONTLINE_DIVISION_IDS) {
  const enemySide = side === "A" ? "B" : "A";
  const sectors = candidateSectors;
  let target = "center";
  let worstScore = -Infinity;

  sectors.forEach((sector) => {
    const myAlive = aliveCountInSector(side, sector);
    const enemyAlive = aliveCountInSector(enemySide, sector);
    const outnumberPressure = Math.max(0, enemyAlive - myAlive);
    const moralePressure = Math.max(0, (70 - avgMoraleInSector(side, sector)) / 10);
    const thinLinePressure = myAlive <= 1 ? 1.5 : myAlive <= 2 ? 0.8 : 0;
    const score = (outnumberPressure * 2.2) + moralePressure + thinLinePressure;
    if (score > worstScore) {
      worstScore = score;
      target = sector;
    }
  });

  return target;
}

function autoCommitReservesIfDivisionCollapsed(side, events) {
  const army = state.armies[side];
  const reserveUnits = army.units.filter((u) => u.alive && u.divisionId === "reserve");
  if (!reserveUnits.length) return;

  const depletedSectors = FRONTLINE_DIVISION_IDS.filter((sector) => aliveCountInSector(side, sector) === 0);
  if (!depletedSectors.length) return;

  const target = chooseReserveReinforcementSector(side, depletedSectors);
  reserveUnits.forEach((u) => {
    u.divisionId = target;
  });
  assignWingMembership(army);
  events.push(`${army.name} auto-commits reserves to ${target.toUpperCase()} after a division collapses.`);
}

function reserveAnchorForSide(side) {
  const army = state.armies[side];
  const lineUnits = army.units.filter((u) => u.alive && u.divisionId !== "reserve");
  const source = lineUnits.length ? lineUnits : army.units.filter((u) => u.alive);
  if (!source.length) return null;
  const q = source.reduce((sum, u) => sum + u.q, 0) / source.length;
  const r = source.reduce((sum, u) => sum + u.r, 0) / source.length;
  return { q, r };
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
    const sectors = FRONTLINE_DIVISION_IDS;
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
    return chooseReserveReinforcementSector(side);
  }
  if (action === "defend_flank") {
    return weightedPick(["left", "right"], sectorWeights(side, ["left", "right"]), rand);
  }
  if (action === "rally" || action === "retreat") {
    return weightedPick(FRONTLINE_DIVISION_IDS, sectorWeights(side, FRONTLINE_DIVISION_IDS), rand);
  }
  if (action === "bombard_sector") {
    if (aliveCountInDivision(side, "artillery") > 0) return "artillery";
    const valid = sectorsWithUnitType(side, "artillery");
    if (valid.length) return valid.length === 1 ? valid[0] : weightedPick(valid, sectorWeights(side, valid), rand);
  }
  if (action === "cavalry_charge") {
    if (aliveCountInDivision(side, "cavalry") > 0) return "cavalry";
    const valid = sectorsWithUnitType(side, "cavalry");
    if (valid.length) return valid.length === 1 ? valid[0] : weightedPick(valid, sectorWeights(side, valid), rand);
  }
  if (action === "flank_attack") {
    return weightedPick(["left", "right"], sectorWeights(side, ["left", "right"]), rand);
  }
  return weightedPick(FRONTLINE_DIVISION_IDS, sectorWeights(side, FRONTLINE_DIVISION_IDS), rand);
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
    const prepOrders = {
      left: "Hold",
      center: "Hold",
      right: "Hold",
      reserve: "Stay in Reserve",
      cavalry: "Stay on Flanks",
      artillery: "Stay in Rear",
    };
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
  let sector = army.currentSector || "center";

  if (action === "commit_reserve") {
    sector = chooseReserveReinforcementSector(side);
    army.currentSector = sector;
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
    cavalry_charge: sector === "cavalry"
      ? { left: "Advance", center: "Advance", right: "Advance", cavalry: "Cavalry Charge" }
      : sector === "left"
        ? { left: "Cavalry Charge", center: "Advance", right: "Hold" }
        : sector === "right"
          ? { left: "Hold", center: "Advance", right: "Cavalry Charge" }
          : { left: "Hold", center: "Cavalry Charge", right: "Hold" },
    defensive_stand: { left: "Hold", center: "Hold", right: "Hold" },
    bombard_sector: sector === "artillery"
      ? { left: "Hold", center: "Hold", right: "Hold", artillery: "Bombard" }
      : sector === "left"
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
    foot_cavalry: { left: "Flank Left", center: "Hold", right: "Flank Right" },
    feigned_retreat: { left: "Withdraw", center: "Withdraw", right: "Withdraw" },
    fighting_withdrawal: { left: "Withdraw", center: "Withdraw", right: "Withdraw" },
  };
  const orders = mapByAction[action] || mapByAction.concentrate_center;
  Object.entries(orders).forEach(([wing, order]) => {
    army.divisions[wing].currentOrder = order;
  });
  if (!Object.prototype.hasOwnProperty.call(orders, "reserve")) {
    army.divisions.reserve.currentOrder = defaultDivisionOrderForSim("reserve");
  }
  if (!Object.prototype.hasOwnProperty.call(orders, "cavalry")) {
    army.divisions.cavalry.currentOrder = defaultDivisionOrderForSim("cavalry");
  }
  if (!Object.prototype.hasOwnProperty.call(orders, "artillery")) {
    army.divisions.artillery.currentOrder = defaultDivisionOrderForSim("artillery");
  }

  if (isMajorActionTurn(state.turn)) {
    events.push(`${army.name} action set: ${formatActionName(action)} (${sector.toUpperCase()})`);
    queueActionHighlights(side, action, sector);
    showMajorOrderPopup(side, action, sector);
  }
}

function defaultDivisionOrderForSim(divisionId) {
  if (divisionId === "reserve") return "Stay in Reserve";
  if (divisionId === "cavalry") return "Stay on Flanks";
  if (divisionId === "artillery") return "Stay in Rear";
  return "Hold";
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
  const s = targetLabel(sector);
  if (action === "advance") return "All units recover 4 morale per turn while advancing.";
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

function targetLabel(target) {
  if (target === "all") return "army-wide";
  if (SPECIAL_DIVISION_IDS.includes(target)) return `${target} division`;
  return `${target} sector`;
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
  if (action === "fighting_withdrawal") return FRONTLINE_DIVISION_IDS;
  if (action === "foot_cavalry" || action === "feigned_retreat") return FRONTLINE_DIVISION_IDS;
  if (action === "mass_assault") return FRONTLINE_DIVISION_IDS;
  if (action === "line_rotation" || action === "exploit_gap") return [sector];
  if (action === "commit_reserve") return [sector, "reserve"];
  if (action === "defend_flank" || action === "rally" || action === "retreat") return [sector];
  return FRONTLINE_DIVISION_IDS;
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
    const nearest = selectMovementTargetEnemy(u, side, enemySide, wing);
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
    const isReserveHold = wing.currentOrder === "Stay in Reserve";
    const isRearSupport = wing.currentOrder === "Stay in Rear";
    const isFlankDefense = wing.currentOrder === "Stay on Flanks";
    const flankDivision = u.divisionId === "left" || u.divisionId === "right";
    const behindFront = behindFrontlineDistance(u, side) > 2;
    const shouldRejoin = flankDivision && u.divisionId !== "reserve" && (behindFront || (u.statuses?.disengageTurns || 0) > 0);

    if (wing.currentOrder === "Retreat") u.statuses.disengageTurns = Math.max(u.statuses.disengageTurns || 0, 3);
    if (wing.currentOrder === "Withdraw") u.statuses.disengageTurns = Math.max(u.statuses.disengageTurns || 0, 2);

    if (!isFlankOrder && !allowsDisengage && distToNearest <= 1) return;

    let steps = Math.max(1, u.move);
    const sig = activeSig;
    if (sig?.type === "foot_cavalry" && u.type === "infantry") {
      steps += 1;
    }
    if (wing.currentOrder === "Withdraw") {
      steps = Math.min(steps, u.type === "cavalry" ? 2 : 1);
    }
    const visitedThisMove = new Set([`${u.q},${u.r}`]);
    for (let i = 0; i < steps; i += 1) {
      let next = null;
      if (isReserveHold) {
        next = chooseReserveStep(u, side, reserved, visitedThisMove);
      } else if (shouldRejoin) {
        next = chooseRejoinLineStep(u, side, reserved, visitedThisMove);
      } else if (isRearSupport) {
        next = chooseRearSupportStep(u, side, reserved, visitedThisMove);
      } else if (isFlankDefense) {
        next = chooseFlankDefenseStep(u, side, reserved, visitedThisMove);
      } else {
        next = chooseBestStep(u, nearest, wing, side, isFlankOrder, reserved, visitedThisMove);
      }
      if (!next) break;
      setUnitPos(u, next.q, next.r);
      reserved.add(`${next.q},${next.r}`);
      visitedThisMove.add(`${next.q},${next.r}`);
    }


  });
}

function behindFrontlineDistance(unit, side) {
  const anchor = frontlineAnchorForSide(side);
  if (!anchor) return 0;
  if (side === "A") return Math.max(0, anchor.q - unit.q);
  return Math.max(0, unit.q - anchor.q);
}

function chooseRejoinLineStep(unit, side, reserved, visitedThisMove) {
  const front = frontlineAnchorForSide(side);
  if (!front) return null;
  const enemySide = side === "A" ? "B" : "A";
  const nearest = nearestEnemy(unit, enemySide);
  const centerR = getCenterDivisionMeanR(side);
  const targetR = unit.divisionId === "left" ? centerR - 3 : unit.divisionId === "right" ? centerR + 3 : centerR;
  const targetQ = side === "A" ? front.q - 0.3 : front.q + 0.3;

  const neighbors = getNeighbors(unit.q, unit.r)
    .filter((h) => h
      && h.active
      && h.terrain !== "blocked"
      && !h.occupantUnitId
      && !reserved.has(`${h.q},${h.r}`)
      && !visitedThisMove.has(`${h.q},${h.r}`));
  if (!neighbors.length) return null;

  let best = null;
  let bestScore = -Infinity;
  neighbors.forEach((h) => {
    const curQDist = Math.abs((unit.q ?? 0) - targetQ);
    const nextQDist = Math.abs(h.q - targetQ);
    const curRDist = Math.abs((unit.r ?? 0) - targetR);
    const nextRDist = Math.abs(h.r - targetR);
    const nextEnemyDist = nearest ? hexDist(h.q, h.r, nearest.q, nearest.r) : 99;
    let score = (curQDist - nextQDist) * 18;
    score += (curRDist - nextRDist) * 8;

    if (nextEnemyDist <= 1) score -= 24;
    else if (nextEnemyDist >= 2 && nextEnemyDist <= 3) score += 6;

    const adj = countAdjacentFriendly(h.q, h.r, unit.armyId);
    score += adj * 5;

    if (unit.prevQ === h.q && unit.prevR === h.r) score -= 10;

    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  });
  return best;
}

function selectMovementTargetEnemy(unit, side, enemySide, wing) {
  const allEnemies = state.armies[enemySide].units.filter((u) => u.alive);
  if (!allEnemies.length) return null;

  const lane = getTacticalLaneForUnit(unit);
  const laneEnemies = allEnemies.filter((e) => getTacticalLaneForUnit(e) === lane);
  const offensiveOrder = wing.currentOrder === "Advance"
    || wing.currentOrder === "Attack"
    || wing.currentOrder === "Charge"
    || wing.currentOrder === "Cavalry Charge"
    || wing.currentOrder === "Flank Left"
    || wing.currentOrder === "Flank Right";

  const pool = (unit.divisionId !== "reserve" && offensiveOrder && laneEnemies.length)
    ? laneEnemies
    : allEnemies;

  let best = null;
  let bestScore = Infinity;
  pool.forEach((e) => {
    const dist = hexDist(unit.q, unit.r, e.q, e.r);
    const lateral = Math.abs((unit.r ?? 0) - e.r);
    const score = dist + (lateral * 0.15);
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  });
  return best;
}

function chooseReserveStep(unit, side, reserved, visitedThisMove) {
  const anchor = reserveAnchorForSide(side);
  if (!anchor) return null;
  const enemySide = side === "A" ? "B" : "A";
  const nearest = nearestEnemy(unit, enemySide);
  const currentEnemyDist = nearest ? hexDist(unit.q, unit.r, nearest.q, nearest.r) : 99;
  const currentAnchorDist = hexDist(unit.q, unit.r, anchor.q, anchor.r);

  const neighbors = getNeighbors(unit.q, unit.r)
    .filter((h) => h
      && h.active
      && h.terrain !== "blocked"
      && !h.occupantUnitId
      && !reserved.has(`${h.q},${h.r}`)
      && !visitedThisMove.has(`${h.q},${h.r}`));
  if (!neighbors.length) return null;

  let best = null;
  let bestScore = -Infinity;
  neighbors.forEach((h) => {
    const nextEnemyDist = nearest ? hexDist(h.q, h.r, nearest.q, nearest.r) : 99;
    const nextAnchorDist = hexDist(h.q, h.r, anchor.q, anchor.r);
    let score = (currentAnchorDist - nextAnchorDist) * 12;

    if (nextEnemyDist <= 1) score -= 50;
    else if (nextEnemyDist === 2) score -= 18;
    else if (nextEnemyDist >= 3 && nextEnemyDist <= 5) score += 12;
    else if (nextEnemyDist > 6) score -= 6;

    score += (nextEnemyDist - currentEnemyDist) * 4;

    const laneDiff = Math.abs((unit.preferredR ?? unit.r) - h.r);
    score -= laneDiff * 3;

    const friendlyAdj = countAdjacentFriendly(h.q, h.r, unit.armyId);
    score += friendlyAdj * 4;
    if (friendlyAdj === 0) score -= 10;

    if (unit.prevQ === h.q && unit.prevR === h.r) score -= 10;

    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  });

  return best;
}

function frontlineAnchorForSide(side) {
  const army = state.armies[side];
  const lineUnits = army.units
    .filter((u) => u.alive && FRONTLINE_DIVISION_IDS.includes(u.divisionId));
  const source = lineUnits.length
    ? lineUnits
    : army.units.filter((u) => u.alive && u.divisionId !== "reserve");
  if (!source.length) return null;
  const q = source.reduce((sum, u) => sum + u.q, 0) / source.length;
  const r = source.reduce((sum, u) => sum + u.r, 0) / source.length;
  return { q, r };
}

function chooseRearSupportStep(unit, side, reserved, visitedThisMove) {
  const anchor = frontlineAnchorForSide(side);
  if (!anchor) return null;
  const enemySide = side === "A" ? "B" : "A";
  const nearest = nearestEnemy(unit, enemySide);
  const targetQ = anchor.q + (side === "A" ? -1.5 : 1.5);
  const targetR = anchor.r;

  const neighbors = getNeighbors(unit.q, unit.r)
    .filter((h) => h
      && h.active
      && h.terrain !== "blocked"
      && !h.occupantUnitId
      && !reserved.has(`${h.q},${h.r}`)
      && !visitedThisMove.has(`${h.q},${h.r}`));
  if (!neighbors.length) return null;

  let best = null;
  let bestScore = -Infinity;
  neighbors.forEach((h) => {
    const toTargetNow = hexDist(unit.q, unit.r, targetQ, targetR);
    const toTargetNext = hexDist(h.q, h.r, targetQ, targetR);
    const nextEnemyDist = nearest ? hexDist(h.q, h.r, nearest.q, nearest.r) : 99;
    let score = (toTargetNow - toTargetNext) * 14;

    if (nextEnemyDist <= 1) score -= 36;
    else if (nextEnemyDist === 2) score += 14;
    else if (nextEnemyDist === 3) score += 8;
    else if (nextEnemyDist >= 4) score -= 4;

    const friendlyAdj = countAdjacentFriendly(h.q, h.r, unit.armyId);
    score += friendlyAdj * 4;
    if (friendlyAdj === 0) score -= 8;

    if (unit.prevQ === h.q && unit.prevR === h.r) score -= 10;

    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  });
  return best;
}

function chooseFlankDefenseStep(unit, side, reserved, visitedThisMove) {
  const enemySide = side === "A" ? "B" : "A";
  const nearest = nearestEnemy(unit, enemySide);
  const centerR = getCenterDivisionMeanR(side);
  const flankSign = getPinnedFlankSign(unit, side, centerR);
  const targetR = centerR + (flankSign * 5);
  const front = frontlineAnchorForSide(side);
  const targetQ = front ? front.q + (side === "A" ? 0.2 : -0.2) : unit.q;

  const neighbors = getNeighbors(unit.q, unit.r)
    .filter((h) => h
      && h.active
      && h.terrain !== "blocked"
      && !h.occupantUnitId
      && !reserved.has(`${h.q},${h.r}`)
      && !visitedThisMove.has(`${h.q},${h.r}`));
  if (!neighbors.length) return null;

  let best = null;
  let bestScore = -Infinity;
  neighbors.forEach((h) => {
    const currentFlankDist = Math.abs((unit.r ?? 0) - targetR);
    const nextFlankDist = Math.abs(h.r - targetR);
    const currentFrontDist = Math.abs((unit.q ?? 0) - targetQ);
    const nextFrontDist = Math.abs(h.q - targetQ);
    const nextEnemyDist = nearest ? hexDist(h.q, h.r, nearest.q, nearest.r) : 99;
    let score = (currentFlankDist - nextFlankDist) * 12;
    score += (currentFrontDist - nextFrontDist) * 14;

    const behindBy = side === "A" ? (targetQ - h.q) : (h.q - targetQ);
    if (behindBy > 1) score -= 24 + ((behindBy - 1) * 16);
    const aheadBy = side === "A" ? (h.q - targetQ) : (targetQ - h.q);
    if (aheadBy > 1.5) score -= 10 + ((aheadBy - 1.5) * 10);

    if (nextEnemyDist <= 1) score -= 28;
    else if (nextEnemyDist === 2) score += 6;
    else if (nextEnemyDist >= 3 && nextEnemyDist <= 4) score += 4;

    const divisionAdj = countAdjacentDivision(h.q, h.r, unit.armyId, unit.divisionId, unit.id);
    score += divisionAdj * 7;

    if (unit.prevQ === h.q && unit.prevR === h.r) score -= 10;

    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  });
  return best;
}

function getPinnedFlankSign(unit, side, centerR) {
  if (unit.flankSign === 1 || unit.flankSign === -1) return unit.flankSign;
  const fallback = (unit.preferredR ?? unit.r) >= centerR ? 1 : -1;
  const lane = getTacticalLaneForUnit(unit);
  if (lane === "left") {
    unit.flankSign = side === "A" ? -1 : 1;
  } else if (lane === "right") {
    unit.flankSign = side === "A" ? 1 : -1;
  } else {
    unit.flankSign = fallback;
  }
  return unit.flankSign;
}

function getSectorForUnit(unit) {
  return getTacticalLaneForUnit(unit);
}

function getTacticalLaneForUnit(unit) {
  if (unit.divisionId === "left" || unit.divisionId === "center" || unit.divisionId === "right") {
    return unit.divisionId;
  }

  const army = state.armies[unit.armyId];
  if (!army) return "center";
  const means = FRONTLINE_DIVISION_IDS.map((divisionId) => ({
    divisionId,
    meanR: divisionMeanR(army, divisionId),
  }));

  means.sort((a, b) => Math.abs(unit.r - a.meanR) - Math.abs(unit.r - b.meanR));
  return means[0]?.divisionId || "center";
}

function divisionMeanR(army, divisionId) {
  const division = army.divisions[divisionId];
  if (!division || !Array.isArray(division.unitIds) || !division.unitIds.length) {
    return getCenterDivisionMeanR(army.id);
  }
  const units = division.unitIds
    .map((id) => army.units.find((u) => u.id === id))
    .filter((u) => u && u.alive);
  if (!units.length) return getCenterDivisionMeanR(army.id);
  return units.reduce((sum, u) => sum + u.r, 0) / units.length;
}

function unitMatchesActionTarget(unit, target) {
  if (SPECIAL_DIVISION_IDS.includes(target)) return unit.divisionId === target;
  return getSectorForUnit(unit) === target;
}

function getActionAttackMultiplier(army, unit) {
  const action = army.currentAction;
  const sector = army.currentSector || "center";
  const unitSector = getSectorForUnit(unit);

  let mult = 1;
  if (action === "concentrate_center" && unitSector === "center") mult *= 1.2;
  if (action === "flank_attack" && unitSector === sector) mult *= 1.2;
  if (action === "cavalry_charge" && unit.type === "cavalry" && (unitMatchesActionTarget(unit, sector) || sector === "center")) mult *= 1.2;
  if (action === "bombard_sector" && unit.type === "artillery" && unitMatchesActionTarget(unit, sector)) mult *= 1.2;
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

  const holdLine = wing.currentOrder === "Hold" || wing.currentOrder === "Stay in Rear";
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
    const flankBias = getFlankBias(side, wing.currentOrder);
    score += (hex.r - unit.r) * flankBias * 7;
  }

  if (wing.currentOrder === "Retreat") score = -score * 1.35;
  if (wing.currentOrder === "Withdraw") {
    score = -score * 0.35;
    if (nextDist >= currentDist + 2) score -= 18;
    if (nextDist === currentDist + 1) score += 8;
    if (nextDist > currentDist + 1) score -= (nextDist - (currentDist + 1)) * 10;
  }
  if (wing.currentOrder === "Hold") {
    if (nextDist < currentDist) score -= 18;
    if (nextDist > currentDist) score -= 4;
    if (nextDist === currentDist) score += 8;
  }
  if (wing.currentOrder === "Advance") {
    if (nextDist < currentDist) score += 7;
    if (nextDist > currentDist) score -= 10;
  }
  if (wing.currentOrder === "Attack") {
    if (nextDist < currentDist) score += 16;
    if (nextDist > currentDist) score -= 16;
    if (nextDist <= 1) score += 6;
  }
  if (wing.currentOrder === "Charge") {
    if (nextDist < currentDist) score += 24;
    if (nextDist > currentDist) score -= 24;
    if (nextDist <= 1) score += 12;
    if (unit.type === "cavalry" && nextDist <= 2) score += 8;
  }
  if (wing.currentOrder === "Stay in Rear") {
    if (nextDist < currentDist) score -= 24;
    if (nextDist > currentDist) score += 6;
    if (nextDist >= 2 && nextDist <= 4) score += 10;
    if (nextDist <= 1) score -= 28;
  }
  if (wing.currentOrder === "Stay on Flanks") {
    const centerAnchor = getCenterDivisionMeanR(side);
    const currentToCenter = Math.abs((unit.r ?? 0) - centerAnchor);
    const nextToCenter = Math.abs(hex.r - centerAnchor);
    score += (nextToCenter - currentToCenter) * 9;
    if (nextDist <= 1) score -= 16;
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

  const currentDivisionAdj = countAdjacentDivision(unit.q, unit.r, unit.armyId, unit.divisionId, unit.id);
  const nextDivisionAdj = countAdjacentDivision(hex.q, hex.r, unit.armyId, unit.divisionId, unit.id);
  score += (nextDivisionAdj - currentDivisionAdj) * 9;
  if (nextDivisionAdj === 0) score -= 10;

  const currentDivisionSpread = divisionSpreadFrom(unit.armyId, unit.divisionId, unit.id, unit.q, unit.r);
  const nextDivisionSpread = divisionSpreadFrom(unit.armyId, unit.divisionId, unit.id, hex.q, hex.r);
  score += (currentDivisionSpread - nextDivisionSpread) * 2.5;

  const localCrowd = countFriendlyInRadius(hex.q, hex.r, unit.armyId, 1);
  if (localCrowd > 3) score -= (localCrowd - 3) * 8;

  const offensiveOrder = wing.currentOrder === "Advance"
    || wing.currentOrder === "Attack"
    || wing.currentOrder === "Charge"
    || wing.currentOrder === "Cavalry Charge"
    || wing.currentOrder === "Flank Left"
    || wing.currentOrder === "Flank Right";
  if (unit.divisionId !== "reserve" && offensiveOrder) {
    const localCrowdWide = countFriendlyInRadius(hex.q, hex.r, unit.armyId, 2);
    if (localCrowdWide > 7) score -= (localCrowdWide - 7) * 4;
    if (localCrowdWide <= 5) score += 4;
  }

  if (unit.type === "artillery") {
    const standOff = hexDist(hex.q, hex.r, nearest.q, nearest.r);
    if (standOff === 2) score += 22;
    else if (standOff === 3) score -= 6;
    if (standOff <= 1) score -= 20;
    if (standOff > 3) score -= 12;
  }

  if (unit.type === "infantry") score += 4;
  if (unit.type === "cavalry") {
    const cavalryClose = evaluateCavalryCloseDecision(unit, hex, side);
    if (!cavalryClose.canClose && nextDist <= 2) {
      score -= 34;
    } else if (cavalryClose.shouldPress && nextDist <= 2) {
      score += 12;
    }
    if (!isFlankOrder && nextDist <= 1 && !cavalryClose.shouldPress) score -= 10;
  }

  return score;
}

function getFlankBias(side, order) {
  if (order.includes("Left")) {
    return side === "A" ? 1 : -1;
  }
  return side === "A" ? -1 : 1;
}

function unitPowerValue(unit) {
  const typeWeight = { infantry: 1, cavalry: 0.95, artillery: 1.25 }[unit.type] || 1;
  const baseStrength = UNIT_BASE[unit.type]?.strength || Math.max(1, unit.strength || 1);
  const strengthPct = Math.max(0.15, Math.min(1.25, (unit.strength || baseStrength) / baseStrength));
  const moraleFactor = 0.6 + (Math.max(0, Math.min(100, unit.morale || 0)) / 250);
  return typeWeight * strengthPct * moraleFactor;
}

function localCombatPowerAt(q, r, side, radius) {
  const enemySide = side === "A" ? "B" : "A";
  const friendlyPower = state.armies[side].units
    .filter((u) => u.alive && hexDist(q, r, u.q, u.r) <= radius)
    .reduce((sum, u) => sum + unitPowerValue(u), 0);
  const enemyPower = state.armies[enemySide].units
    .filter((u) => u.alive && hexDist(q, r, u.q, u.r) <= radius)
    .reduce((sum, u) => sum + unitPowerValue(u), 0);
  return { friendlyPower, enemyPower, ratio: friendlyPower / Math.max(0.01, enemyPower) };
}

function isEnemyWeakNear(q, r, side, radius) {
  const enemySide = side === "A" ? "B" : "A";
  const enemies = state.armies[enemySide].units.filter((u) => u.alive && hexDist(q, r, u.q, u.r) <= radius);
  if (!enemies.length) return true;
  const avgMorale = enemies.reduce((sum, u) => sum + u.morale, 0) / enemies.length;
  const weakCount = enemies.filter((u) => u.morale < 45 || u.strength < (UNIT_BASE[u.type].strength * 0.55)).length;
  return avgMorale < 55 || weakCount >= Math.ceil(enemies.length * 0.5);
}

function evaluateCavalryCloseDecision(unit, targetHex, side) {
  const commander = COMMANDERS[state.armies[side].armyCommanderId] || { traits: {} };
  const aggr = commander.traits.aggression || 5;
  const sig = state.armies[side].activeSignature;
  const local = localCombatPowerAt(targetHex.q, targetHex.r, side, 2);
  const enemyWeak = isEnemyWeakNear(targetHex.q, targetHex.r, side, 2);

  let minToClose = 1.1 - ((aggr - 5) * 0.03);
  let pressThreshold = 1.25 - ((aggr - 5) * 0.04);
  if (sig?.type === "feigned_retreat") {
    minToClose -= 0.1;
    pressThreshold -= 0.12;
  }
  if (enemyWeak) {
    minToClose -= 0.12;
    pressThreshold -= 0.15;
  }
  minToClose = clamp(minToClose, 0.82, 1.2);
  pressThreshold = clamp(pressThreshold, 0.95, 1.35);

  const canClose = local.ratio >= minToClose;
  const shouldPress = local.ratio >= pressThreshold;
  return { canClose, shouldPress, ratio: local.ratio };
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

function countAdjacentDivision(q, r, side, divisionId, unitId) {
  const army = state.armies[side];
  if (!army) return 0;
  return getNeighbors(q, r).filter((h) => {
    if (!h.occupantUnitId || h.occupantUnitId === unitId) return false;
    const other = army.units.find((u) => u.id === h.occupantUnitId);
    return other && other.alive && other.divisionId === divisionId;
  }).length;
}

function divisionSpreadFrom(side, divisionId, movingUnitId, q, r) {
  const army = state.armies[side];
  if (!army) return 0;
  const divisionUnits = army.units.filter((u) => u.alive && u.divisionId === divisionId);
  if (!divisionUnits.length) return 0;
  const withMoved = divisionUnits.map((u) => {
    if (u.id === movingUnitId) return { q, r };
    return { q: u.q, r: u.r };
  });
  const centerQ = withMoved.reduce((sum, p) => sum + p.q, 0) / withMoved.length;
  const centerR = withMoved.reduce((sum, p) => sum + p.r, 0) / withMoved.length;
  return withMoved.reduce((sum, p) => sum + hexDist(p.q, p.r, centerQ, centerR), 0) / withMoved.length;
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
      if (!u.statuses) u.statuses = { cavalryShockTurns: 0, disengageTurns: 0 };
      if ((u.statuses.cavalryShockTurns || 0) > 0) u.statuses.cavalryShockTurns -= 1;
      if ((u.statuses.disengageTurns || 0) > 0) u.statuses.disengageTurns -= 1;
      if (army.currentAction === "advance") {
        u.morale = Math.min(100, u.morale + 4);
      }
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
          if (d === 1) shock += 18;
          else if (d === 2) shock += 10;
          else if (d === 3) shock += 4;
        });
        if (shock > 0) {
          u.morale = Math.max(0, u.morale - shock);
          shocked += 1;
        }
      });
      if (shocked > 0) events.push(`${army.name} morale cascade: ${shocked} nearby units shaken.`);

      const enemySide = side === "A" ? "B" : "A";
      let inspired = 0;
      state.armies[enemySide].units.forEach((u) => {
        if (!u.alive) return;
        let gain = 0;
        routedThisTurn.forEach((r) => {
          const d = hexDist(u.q, u.r, r.q, r.r);
          if (d === 1) gain += 8;
          else if (d === 2) gain += 5;
          else if (d === 3) gain += 2;
        });
        gain = Math.min(12, gain);
        if (gain > 0) {
          u.morale = Math.min(100, u.morale + gain);
          inspired += 1;
        }
      });
      if (inspired > 0) events.push(`${state.armies[enemySide].name} morale surge: ${inspired} nearby units emboldened by enemy routs.`);
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
