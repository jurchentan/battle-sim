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
  state.reelsCommanderQuote = { A: null, B: null };
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
    rules: {
      turnLimit: state.turnLimit,
      defeatThresholdPercent: state.defeatThresholdPercent,
      baseBattleSideLength: state.baseBattleSideLength,
      reelsBattleSideLength: state.reelsBattleSideLength,
    },
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
      state.defeatThresholdPercent = loaded.rules?.defeatThresholdPercent ?? state.defeatThresholdPercent;
      state.baseBattleSideLength = loaded.rules?.baseBattleSideLength ?? state.baseBattleSideLength;
      state.reelsBattleSideLength = loaded.rules?.reelsBattleSideLength ?? state.reelsBattleSideLength;
      state.currentBattleSideLength = getActiveBattleSideLength();
      state.seed = loaded.seed ?? state.seed;
      state.armyConfig = loaded.armyConfig || state.armyConfig;
      state.turn = 0;
      stopSimulationLoop();
      state.actionHighlights = [];
      state.battleOverlay = null;
      state.reelsCommanderQuote = { A: null, B: null };
      state.unitAnimations = {};
      reconcileScenarioState();
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
