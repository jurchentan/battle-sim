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
    const nextIn = nextOrderIn === 0 ? "Now" : nextOrderIn;
    els.reelsTurnCounter.innerHTML = `Turn ${state.turn}<br>next action in: ${nextIn}`;
  } else {
    els.title.textContent = "AI Commander Hex Battle Simulator";
  }
  els.subtitle.textContent = `${phase} · Turn ${state.turn} · Next Major Order: ${nextOrderIn === 0 ? "Now" : `${nextOrderIn} turns`}`;
  updateReelsHud();
  updateSimButton();
  requestAnimationRenderIfNeeded();
}

function reelsVisualScale() {
  if (!state.reelsMode) return 1;
  return state.currentBattleSideLength <= 7 ? 1.3 : 1.15;
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
    let units;
    if (h.wing === "__all__") {
      units = army.units.filter((u) => u.alive);
    } else {
      const wing = army.divisions[h.wing];
      if (!wing) return;
      units = wing.unitIds
        .map((id) => army.units.find((u) => u.id === id))
        .filter((u) => u && u.alive);
    }
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

  const unitMin = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  };
  active.forEach((h) => {
    const x = (Math.sqrt(3) * h.q + (Math.sqrt(3) / 2) * h.r);
    const y = 1.5 * h.r;
    unitMin.minX = Math.min(unitMin.minX, x - 1);
    unitMin.maxX = Math.max(unitMin.maxX, x + 1);
    unitMin.minY = Math.min(unitMin.minY, y - 1);
    unitMin.maxY = Math.max(unitMin.maxY, y + 1);
  });
  const unitW = unitMin.maxX - unitMin.minX;
  const unitH = unitMin.maxY - unitMin.minY;
  const edgePadding = state.reelsMode ? 4 : 18;
  const targetW = Math.max(40, els.canvas.width - (edgePadding * 2));
  const targetH = Math.max(40, els.canvas.height - (edgePadding * 2));
  const fitScale = Math.min(targetW / unitW, targetH / unitH);
  const reelsBoost = state.reelsMode && state.currentBattleSideLength <= 7 ? 1.12 : 1;
  HEX_SIZE = Math.max(16, Math.min(38, fitScale * reelsBoost));

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
  const reelsUnitBoost = reelsVisualScale();
  const iconSize = Math.round(24 * reelsUnitBoost);
  const artillerySize = Math.round(30 * reelsUnitBoost);
  ["A", "B"].forEach((side) => {
    state.armies[side].units.filter((u) => u.alive).forEach((u) => {
      const p = animatedPixelForUnit(u, now);
      const size = u.type === "artillery" ? artillerySize : iconSize;
      const half = size / 2;

      const icon = UNIT_ICONS[side]?.[u.type];
      if (icon && icon.complete && icon.naturalWidth > 0) {
        if (side === "B") {
          ctx.save();
          ctx.translate(p.x, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(icon, -half, p.y - half, size, size);
          ctx.restore();
        } else {
          ctx.drawImage(icon, p.x - half, p.y - half, size, size);
        }
      } else {
        ctx.fillStyle = "#fff";
        ctx.font = `${Math.round(11 * reelsUnitBoost)}px Verdana`;
        ctx.textAlign = "center";
        ctx.fillText(iconFor(u.type), p.x, p.y + 3);
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      if (state.selectedWingUnits.has(u.id) || state.selectedUnitId === u.id) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (u.morale < 60) {
        drawMoraleIndicator(u, side, p.x, p.y, size);
      }

      drawHealthBar(u, p.x, p.y + 14);
    });
  });
}

function drawMoraleIndicator(unit, side, x, y, unitSize) {
  const scale = reelsVisualScale();
  const circleRadius = Math.round(7 * scale);
  const iconSize = Math.round((state.reelsMode ? 12 : 10) * scale);
  const cx = x + (unitSize / 2) + 1;
  const cy = y - (unitSize / 2) - 1;

  ctx.beginPath();
  ctx.arc(cx, cy, circleRadius, 0, Math.PI * 2);
  ctx.fillStyle = side === "A" ? "rgba(126,205,255,0.72)" : "rgba(208,98,88,0.68)";
  ctx.fill();

  const icon = unit.morale <= 30 ? MORALE_ICONS.critical : MORALE_ICONS.low;
  if (icon && icon.complete && icon.naturalWidth > 0) {
    ctx.drawImage(icon, cx - (iconSize / 2), cy - (iconSize / 2), iconSize, iconSize);
  }
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
  const scale = reelsVisualScale();
  const max = UNIT_BASE[unit.type].strength;
  const pct = Math.max(0, Math.min(1, unit.strength / max));
  const width = Math.round(22 * scale);
  const height = Math.round(4 * scale);
  ctx.fillStyle = "#3f3a32";
  ctx.fillRect(x - width / 2 - 1, y - 1, width + 2, height + 2);
  const r = Math.round(220 * (1 - pct));
  const g = Math.round(190 * pct);
  ctx.fillStyle = `rgb(${r},${g},40)`;
  ctx.fillRect(x - width / 2, y, Math.max(0, width * pct), height);
}

function drawCommanders() {
  const scale = reelsVisualScale();
  ["A", "B"].forEach((side) => {
    const army = state.armies[side];
    const alive = army.units.filter((u) => u.alive);
    if (!alive.length) return;
    const avg = alive.reduce((acc, u) => ({ q: acc.q + u.q, r: acc.r + u.r }), { q: 0, r: 0 });
    const center = hexToPixel(avg.q / alive.length, avg.r / alive.length + (side === "A" ? 2 : -2));
    const commander = COMMANDERS[army.armyCommanderId];
    ctx.fillStyle = "#fff8";
    ctx.fillRect(center.x - (36 * scale), center.y - (10 * scale), 72 * scale, 18 * scale);
    ctx.fillStyle = side === "A" ? "#174b7d" : "#7a2c20";
    ctx.font = `bold ${Math.round(11 * scale)}px Verdana`;
    ctx.textAlign = "center";
    ctx.fillText(commander.name, center.x, center.y + (3 * scale));

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
  const traitsEl = isBlue ? els.reelsBlueTraits : els.reelsRedTraits;
  const quoteEl = isBlue ? els.reelsBlueQuote : els.reelsRedQuote;
  const miniTraitsEl = isBlue ? els.reelsBlueMiniTraits : els.reelsRedMiniTraits;

  nameEl.textContent = commander?.name || (isBlue ? "Blue Commander" : "Red Commander");
  if (traitsEl && commander?.traits) {
    const aggr = commander.traits.aggression ?? 0;
    const control = commander.traits.control ?? 0;
    const creativity = commander.traits.creativity ?? 0;
    traitsEl.textContent = commander.chargeDescription || "Super charge follows battlefield momentum.";
    if (miniTraitsEl) {
      miniTraitsEl.innerHTML = `AGG ${aggr}<br>CON ${control}<br>CRE ${creativity}`;
    }
  }
  if (quoteEl) {
    const quoteState = state.reelsCommanderQuote?.[side];
    if (state.reelsMode && quoteState && (quoteState.expiresAt || 0) > Date.now()) {
      quoteEl.textContent = `"${quoteState.text}"`;
      quoteEl.classList.add("show");
    } else {
      quoteEl.textContent = "";
      quoteEl.classList.remove("show");
      if (state.reelsCommanderQuote?.[side] && (state.reelsCommanderQuote[side].expiresAt || 0) <= Date.now()) {
        state.reelsCommanderQuote[side] = null;
      }
    }
  }
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
  const selectedArmy = selected ? state.armies[selected.armyId] : null;
  const selectedDivision = selectedArmy?.divisions?.[selected.divisionId];
  const selectedOrder = selectedDivision?.currentOrder || "Hold";
  els.selectionInfo.textContent = selected
    ? `${displayUnitId(selected.id)} ${selected.type} brigade | Division: ${selected.divisionId} | Order: ${selectedOrder} | Move ${selected.move} | Range ${selected.range} | Str ${Math.round(selected.strength)} | Morale ${Math.round(selected.morale)}`
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
