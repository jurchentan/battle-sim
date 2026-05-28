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
  ensureUltTuningPreviewButton();
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
  if (els.reelsIntroAudioSelect) {
    populateReelsIntroAudioOptions();
    els.reelsIntroAudioSelect.value = state.selectedReelsIntroAudio || "none";
    els.reelsIntroAudioSelect.onchange = () => {
      state.selectedReelsIntroAudio = els.reelsIntroAudioSelect.value || "none";
    };
  }
  if (els.audioToggleBtn) {
    els.audioToggleBtn.onclick = () => {
      state.audioEnabled = !state.audioEnabled;
      updateAudioToggleButton();
      if (typeof applyAudioVolumeToMedia === "function") applyAudioVolumeToMedia();
      if (!state.audioEnabled) {
        const ac = COMBAT_AUDIO?.context;
        if (ac && typeof ac.suspend === "function") ac.suspend().catch(() => {});
      }
    };
  }
  if (els.audioVolumeRange) {
    els.audioVolumeRange.value = String(Math.round((state.audioVolume || 1) * 100));
    els.audioVolumeRange.oninput = () => {
      state.audioVolume = Math.max(0, Math.min(3, (Number(els.audioVolumeRange.value) || 0) / 100));
      if (typeof applyAudioVolumeToMedia === "function") applyAudioVolumeToMedia();
    };
  }

  els.canvas.addEventListener("click", onCanvasClick);
  els.canvas.addEventListener("mousedown", onCanvasPointerDown);
  els.canvas.addEventListener("mousemove", onCanvasPointerMove);
  window.addEventListener("mouseup", onCanvasPointerUp);
  window.addEventListener("keydown", onUltPortraitTuningKeydown);
  window.addEventListener("resize", updateReelsStageScale);
  updateSimButton();
  updateAudioToggleButton();
}

function populateReelsIntroAudioOptions() {
  if (!els.reelsIntroAudioSelect) return;
  const select = els.reelsIntroAudioSelect;
  select.innerHTML = "";

  const noneOpt = document.createElement("option");
  noneOpt.value = "none";
  noneOpt.textContent = "Intro Audio: None";
  select.appendChild(noneOpt);

  Object.keys(REELS_PREBATTLE_AUDIO || {}).forEach((key) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = `Intro Audio: ${key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`;
    select.appendChild(opt);
  });
}

function updateAudioToggleButton() {
  if (!els.audioToggleBtn) return;
  els.audioToggleBtn.textContent = `Audio: ${state.audioEnabled ? "On" : "Off"}`;
}

function onUltPortraitTuningKeydown(e) {
  if (!state.reelsMode) return;
  if (e.altKey && e.key.toLowerCase() === "u") {
    state.ultPortraitTuning.enabled = !state.ultPortraitTuning.enabled;
    const mode = state.ultPortraitTuning.enabled ? "ON" : "OFF";
    log(`Ult portrait tuning ${mode}. Side ${state.ultPortraitTuning.side}.`);
    if (state.ultPortraitTuning.enabled) {
      log("Keys: Arrows move, [ ] scale, , . z-index, Tab side, C copy config.");
    }
    updateUltTuningPreviewButtonLabel();
    render();
    return;
  }
  if (!state.ultPortraitTuning.enabled) return;

  const t = state.ultPortraitTuning;
  const side = t.side;
  const sigKey = getTunableUltSignatureKey(side);
  if (!sigKey) return;
  const patch = {};
  let changed = false;

  if (e.key === "ArrowLeft") { patch.offsetX = getUltLayoutValue(sigKey, side, "offsetX") - t.step; changed = true; }
  if (e.key === "ArrowRight") { patch.offsetX = getUltLayoutValue(sigKey, side, "offsetX") + t.step; changed = true; }
  if (e.key === "ArrowUp") { patch.offsetY = getUltLayoutValue(sigKey, side, "offsetY") - t.step; changed = true; }
  if (e.key === "ArrowDown") { patch.offsetY = getUltLayoutValue(sigKey, side, "offsetY") + t.step; changed = true; }
  if (e.key === "[") { patch.scale = Number((getUltLayoutValue(sigKey, side, "scale") - t.scaleStep).toFixed(3)); changed = true; }
  if (e.key === "]") { patch.scale = Number((getUltLayoutValue(sigKey, side, "scale") + t.scaleStep).toFixed(3)); changed = true; }
  if (e.key === ",") { patch.z = getUltLayoutValue(sigKey, side, "z") - t.zStep; changed = true; }
  if (e.key === ".") { patch.z = getUltLayoutValue(sigKey, side, "z") + t.zStep; changed = true; }

  if (e.key === "Tab") {
    e.preventDefault();
    t.side = t.side === "A" ? "B" : "A";
    log(`Ult portrait tuning side -> ${t.side}`);
    render();
    return;
  }

  if (e.key.toLowerCase() === "c") {
    e.preventDefault();
    const v = getUltLayoutValues(sigKey, side);
    const snippet = `\"${sigKey}\": { ${side}: { offsetX: ${v.offsetX}, offsetY: ${v.offsetY}, scale: ${v.scale}, z: ${v.z} } }`;
    log(`Ult layout ${side} copied snippet: ${snippet}`);
    return;
  }

  if (!changed) return;
  e.preventDefault();
  setUltPortraitLayout(sigKey, side, patch);
  const v = getUltLayoutValues(sigKey, side);
  els.banner.textContent = `ULT TUNE ${side} ${sigKey} · x ${v.offsetX} y ${v.offsetY} s ${v.scale} z ${v.z}`;
  render();
}

function ensureUltTuningPreviewButton() {
  if (!els.reelsSideControls) return;
  let btn = document.getElementById("ultTunePreviewBtn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "ultTunePreviewBtn";
    btn.className = "ghost";
    btn.onclick = () => {
      state.ultPortraitTuning.showOverlay = !state.ultPortraitTuning.showOverlay;
      const mode = state.ultPortraitTuning.showOverlay ? "ON" : "OFF";
      log(`Ult overlay reference: ${mode}`);
      updateUltTuningPreviewButtonLabel();
      render();
    };
    els.reelsSideControls.appendChild(btn);
  }
  updateUltTuningPreviewButtonLabel();
}

function updateUltTuningPreviewButtonLabel() {
  const btn = document.getElementById("ultTunePreviewBtn");
  if (!btn) return;
  const imgMode = state.ultPortraitTuning.showOverlay ? "ON" : "OFF";
  const tuneMode = state.ultPortraitTuning.enabled ? "ON" : "OFF";
  btn.textContent = `ULT Overlay: ${imgMode} · Tune ${tuneMode}`;
}

function getTunableUltSignatureKey(side) {
  const army = state.armies[side];
  if (!army) return null;
  if (army.activeSignature) return `${army.armyCommanderId}:${army.activeSignature.type}`;
  const fallbackType = COMMANDERS[army.armyCommanderId]?.signature?.type;
  if (!fallbackType) return null;
  return `${army.armyCommanderId}:${fallbackType}`;
}

function getUltLayoutValue(sigKey, side, field) {
  return getUltLayoutValues(sigKey, side)[field];
}

function getUltLayoutValues(sigKey, side) {
  const map = getUltPortraitLayout();
  const v = map?.[sigKey]?.[side] || {};
  return {
    offsetX: Number(v.offsetX) || 0,
    offsetY: Number(v.offsetY) || 0,
    scale: Number(v.scale) || 1,
    z: Number(v.z) || 8,
  };
}

function toggleReelsMode() {
  const prevSize = getActiveBattleSideLength();
  state.reelsMode = !state.reelsMode;
  document.body.classList.toggle("reels-mode", state.reelsMode);
  updateReelsStageScale();
  mountCanvasForMode();
  els.reelsHud.classList.toggle("hidden", !state.reelsMode);
  els.reelsSideControls.classList.toggle("hidden", !state.reelsMode);
  els.reelsModeBtn.textContent = `Reels Mode: ${state.reelsMode ? "On" : "Off"}`;
  els.reelsSideModeBtn.textContent = `Reels: ${state.reelsMode ? "On" : "Off"}`;
  const nextSize = getActiveBattleSideLength();
  if (nextSize !== prevSize) {
    rebuildBattlefieldForCurrentModeSize();
    return;
  }
  render();
}

function updateReelsStageScale() {
  const app = document.querySelector(".app");
  if (!app) return;
  if (!state.reelsMode) {
    app.style.removeProperty("--reels-stage-scale");
    return;
  }
  const baseW = 1080;
  const baseH = 1920;
  const scale = Math.min(window.innerWidth / baseW, window.innerHeight / baseH);
  app.style.setProperty("--reels-stage-scale", String(Math.max(0.1, scale)));
}

function mountCanvasForMode() {
  if (!els.canvas) return;
  const centerPanel = document.querySelector(".center");
  if (state.reelsMode) {
    if (els.reelsMapWrap && els.canvas.parentElement !== els.reelsMapWrap) {
      els.reelsMapWrap.appendChild(els.canvas);
    }
    return;
  }
  if (centerPanel && els.canvas.parentElement !== centerPanel) {
    centerPanel.appendChild(els.canvas);
  }
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
  state.turnInProgress = false;
  state.pendingTurnDamage = null;
  state.pendingTurnPrelude = null;
  state.replay = { seed: state.seed, turns: [], finalResult: null };
  state.selectedUnitId = null;
  state.moveSourceUnitId = null;
  state.selectedWingUnits.clear();
  state.actionHighlights = [];
  state.actionHighlightVisuals = {};
  state.battleOverlay = null;
  state.reelsCommanderQuote = { A: null, B: null };
  state.signatureCinematics = { A: null, B: null };
  state.pendingKillSfx = [];
  state.pendingMajorActionSfx = [];
  state.pendingVictorySfx = false;
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
    baseBattleSideLength: state.baseBattleSideLength,
    reelsBattleSideLength: state.reelsBattleSideLength,
    currentBattleSideLength: state.currentBattleSideLength,
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
  state.baseBattleSideLength = snap.baseBattleSideLength ?? state.baseBattleSideLength;
  state.reelsBattleSideLength = snap.reelsBattleSideLength ?? state.reelsBattleSideLength;
  state.currentBattleSideLength = snap.currentBattleSideLength ?? state.currentBattleSideLength;
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
    DIVISION_IDS.forEach((wing) => {
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
    t.appendChild(commanderChooser("B"));
    t.appendChild(commanderChooser("A"));
  }
  if (state.mode === "armies") {
    const c = document.createElement("div");
    c.className = "tool-group";
    c.innerHTML = "<h3>Army Brigade Counts</h3>";
    c.appendChild(armyConfigEditor("A"));
    c.appendChild(armyConfigEditor("B"));
    t.appendChild(c);
  }
  if (state.mode === "rules") {
    const c = document.createElement("div");
    c.className = "tool-group";
    c.innerHTML = "<h3>Battlefield Size</h3>";

    const note = document.createElement("div");
    note.className = "card";
    note.textContent = `Current side length: ${state.currentBattleSideLength}${state.reelsMode ? " (Reels)" : ""}`;
    c.appendChild(note);

    c.appendChild(toolButtons("Normal Side Length", ["9", "7"], String(state.baseBattleSideLength), (v) => {
      state.baseBattleSideLength = Number(v);
    }));

    c.appendChild(toolButtons("Reels Side Length", ["9", "7"], String(state.reelsBattleSideLength), (v) => {
      state.reelsBattleSideLength = Number(v);
    }));

    const reelsNote = document.createElement("div");
    reelsNote.className = "card";
    reelsNote.textContent = "You can set both normal and reels battlefield side length (7 or 9).";
    c.appendChild(reelsNote);

    const apply = document.createElement("button");
    apply.textContent = "Apply Map Size";
    apply.onclick = () => rebuildBattlefieldForCurrentModeSize();
    c.appendChild(apply);

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
  const label = document.createElement("label");
  label.textContent = `${side === "A" ? "Blue" : "Red"} Commander `;
  const select = document.createElement("select");
  Object.keys(COMMANDERS).forEach((id) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = COMMANDERS[id].name;
    if (state.armies[side].armyCommanderId === id) opt.selected = true;
    select.appendChild(opt);
  });
  select.onchange = () => { state.armies[side].armyCommanderId = select.value; render(); };
  label.appendChild(select);
  box.appendChild(label);
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
