function render() {
  if (!state.running && state.turn === 0) {
    captureTurnZeroSnapshot();
  }
  if (state.reelsMode) {
    resizeCanvasForReels();
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
    els.title.innerHTML = `<span class="blue-name">${blueName}</span><span class="vs">vs</span><span class="red-name">${redName}</span>`;
    if (els.reelsBlueTitleName) {
      const blueDisplay = formatReelsTitleName(blueName);
      els.reelsBlueTitleName.textContent = blueDisplay;
      fitReelsTitleName(els.reelsBlueTitleName, blueDisplay);
    }
    if (els.reelsRedTitleName) {
      const redDisplay = formatReelsTitleName(redName);
      els.reelsRedTitleName.textContent = redDisplay;
      fitReelsTitleName(els.reelsRedTitleName, redDisplay);
    }
    const nextIn = nextOrderIn === 0 ? "Now" : nextOrderIn;
    if (els.reelsTurnCounter) els.reelsTurnCounter.textContent = `turn #${state.turn}`;
    if (els.reelsNextAction) els.reelsNextAction.textContent = `next action in: ${nextIn}`;
  } else {
    els.title.textContent = "AI Commander Hex Battle Simulator";
  }
  els.subtitle.textContent = `${phase} · Turn ${state.turn} · Next Major Order: ${nextOrderIn === 0 ? "Now" : `${nextOrderIn} turns`}`;
  updateReelsHud();
  updateSimButton();
  requestAnimationRenderIfNeeded();
}

function resizeCanvasForReels() {
  if (!state.reelsMode || !els.canvas) return;
  const wrap = els.reelsMapWrap;
  if (!wrap) return;
  const width = Math.max(1, Math.floor(wrap.clientWidth));
  const height = Math.max(1, Math.floor(wrap.clientHeight));
  if (els.canvas.width === width && els.canvas.height === height) return;
  els.canvas.width = width;
  els.canvas.height = height;
  els.canvas.style.width = `${width}px`;
  els.canvas.style.height = `${height}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function reelsVisualScale() {
  if (!state.reelsMode) return 1;
  return state.currentBattleSideLength <= 7 ? 1.12 : 1.06;
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
  const w = 760;
  const h = 230;
  const x = state.reelsMode ? 110 : Math.round((els.canvas.width - w) / 2);
  const y = state.reelsMode ? 375 : Math.round((els.canvas.height - h) / 2);

  ctx.fillStyle = "rgba(20, 16, 12, 0.82)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#f0d7ab";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = "#fff3dc";
  const titleLen = (o.title || "").length;
  let titlePx = 44;
  if (titleLen > 44) titlePx = 28;
  else if (titleLen > 36) titlePx = 32;
  else if (titleLen > 30) titlePx = 36;
  else if (titleLen > 24) titlePx = 40;
  ctx.font = `bold ${titlePx}px Verdana`;
  ctx.textAlign = "center";
  ctx.fillText(o.title, x + w / 2, y + 52, w - 36);

  ctx.font = "bold 15px Verdana";
  ctx.fillStyle = "#f5e8cf";
  ctx.fillText("Casualties", x + w / 2, y + 86);

  const colWidth = 200;
  const leftX = x + Math.round((w * 0.25));
  const rightX = x + Math.round((w * 0.75));
  const startY = y + 122;

  const leftLen = (o.leftName || "").length;
  const rightLen = (o.rightName || "").length;
  let leftNamePx = 30;
  let rightNamePx = 30;
  if (leftLen > 20) leftNamePx = 18;
  else if (leftLen > 16) leftNamePx = 22;
  else if (leftLen > 12) leftNamePx = 26;
  if (rightLen > 20) rightNamePx = 18;
  else if (rightLen > 16) rightNamePx = 22;
  else if (rightLen > 12) rightNamePx = 26;

  ctx.textAlign = "center";
  ctx.fillStyle = "#cfe0ff";
  ctx.font = `bold ${leftNamePx}px Verdana`;
  ctx.fillText(o.leftName, leftX, startY, colWidth);
  ctx.font = "18px Verdana";
  ctx.fillText(`INF ${o.left.infantry}`, leftX, startY + 32);
  ctx.fillText(`CAV ${o.left.cavalry}`, leftX, startY + 58);
  ctx.fillText(`ART ${o.left.artillery}`, leftX, startY + 84);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd2ce";
  ctx.font = `bold ${rightNamePx}px Verdana`;
  ctx.fillText(o.rightName, rightX, startY, colWidth);
  ctx.font = "18px Verdana";
  ctx.fillText(`INF ${o.right.infantry}`, rightX, startY + 32);
  ctx.fillText(`CAV ${o.right.cavalry}`, rightX, startY + 58);
  ctx.fillText(`ART ${o.right.artillery}`, rightX, startY + 84);
}

function drawActionHighlights() {
  state.actionHighlights = state.actionHighlights.filter((h) => (h.untilTurn || 0) >= state.turn);
  if (!state.actionHighlightVisuals) state.actionHighlightVisuals = {};
  const activeKeys = new Set();
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

    const key = `${h.side}:${h.wing}`;
    activeKeys.add(key);
    const targetRect = {
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
    };
    const shown = state.actionHighlightVisuals[key] || { ...targetRect };
    const lerp = 0.24;
    shown.x += (targetRect.x - shown.x) * lerp;
    shown.y += (targetRect.y - shown.y) * lerp;
    shown.w += (targetRect.w - shown.w) * lerp;
    shown.h += (targetRect.h - shown.h) * lerp;
    state.actionHighlightVisuals[key] = shown;

    const color = h.side === "A" ? "rgba(45,107,168,0.9)" : "rgba(176,72,62,0.9)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(shown.x, shown.y, shown.w, shown.h);

    ctx.fillStyle = h.side === "A" ? "#174b7d" : "#7a2c20";
    ctx.fillRect(shown.x, shown.y - 18, Math.max(90, (h.label.length * 7) + 10), 16);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px Verdana";
    ctx.textAlign = "left";
    ctx.fillText(h.label, shown.x + 5, shown.y - 6);
  });

  Object.keys(state.actionHighlightVisuals).forEach((key) => {
    if (!activeKeys.has(key)) delete state.actionHighlightVisuals[key];
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
  const edgePadding = state.reelsMode ? 18 : 18;
  const targetW = Math.max(40, els.canvas.width - (edgePadding * 2));
  const targetH = Math.max(40, els.canvas.height - (edgePadding * 2));
  const fitScale = Math.min(targetW / unitW, targetH / unitH);
  const reelsBoost = state.reelsMode && state.currentBattleSideLength <= 7 ? 1.1 : 1;
  HEX_SIZE = Math.max(16, Math.min(44, fitScale * reelsBoost));

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
  if (state.reelsMode) {
    MAP_ORIGIN_X -= 57;
    MAP_ORIGIN_Y -= 0;

    const bottomPadding = 8;
    const bottomEdge = maxY + MAP_ORIGIN_Y;
    const allowedBottom = els.canvas.height - bottomPadding;
    if (bottomEdge > allowedBottom) {
      MAP_ORIGIN_Y -= (bottomEdge - allowedBottom);
    }
  }
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
    if (state.reelsMode) {
      const fill = reelsTerrainFill(hex.terrain);
      const stroke = reelsTerrainStroke(hex.terrain);
      drawHex(p.x, p.y, HEX_SIZE - 1, fill, stroke);
      return;
    }
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

function reelsTerrainFill(t) {
  return {
    plain: "rgba(227, 190, 132, 0.06)",
    hill: "rgba(181, 132, 82, 0.1)",
    forest: "rgba(110, 133, 89, 0.12)",
    river: "rgba(96, 142, 179, 0.13)",
    road: "rgba(171, 147, 117, 0.08)",
    town: "rgba(168, 120, 85, 0.12)",
    blocked: "rgba(93, 75, 56, 0.14)",
  }[t] || "rgba(227, 190, 132, 0.06)";
}

function reelsTerrainStroke(t) {
  return {
    plain: "rgba(92, 70, 40, 0.44)",
    hill: "rgba(92, 70, 40, 0.5)",
    forest: "rgba(76, 90, 62, 0.5)",
    river: "rgba(67, 101, 126, 0.52)",
    road: "rgba(103, 87, 65, 0.46)",
    town: "rgba(109, 77, 53, 0.5)",
    blocked: "rgba(76, 57, 40, 0.56)",
  }[t] || "rgba(92, 70, 40, 0.44)";
}

function drawUnits() {
  const now = performance.now();
  const reelsUnitBoost = reelsVisualScale();
  const unitScale = state.reelsMode ? (state.reelsUnitScale || 1) : 1;
  const iconSize = Math.round(24 * reelsUnitBoost * unitScale);
  const artillerySize = Math.round(30 * reelsUnitBoost * unitScale);
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
  const unitScale = state.reelsMode ? (state.reelsUnitScale || 1) : 1;
  const scale = reelsVisualScale() * unitScale;
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
  const unitScale = state.reelsMode ? (state.reelsUnitScale || 1) : 1;
  const scale = reelsVisualScale() * unitScale;
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
  if (!state.reelsMode) {
    stopLeaderMusic("A");
    stopLeaderMusic("B");
    return;
  }
  updateReelsOrder("A");
  updateReelsOrder("B");
  updateReelsCard("A");
  updateReelsCard("B");
  updateReelsPowerBar();
  updateLeaderMusic();
}

function updateReelsOrder(side) {
  const army = state.armies[side];
  if (!army) return;
  const isBlue = side === "A";
  const nameEl = isBlue ? els.reelsBlueOrderName : els.reelsRedOrderName;
  const descEl = isBlue ? els.reelsBlueOrderDesc : els.reelsRedOrderDesc;
  const action = army.currentAction || "advance";
  const sector = army.currentSector || "all";
  const orderName = formatActionName(action, side).toUpperCase();
  if (nameEl) {
    updateAnimatedOrderText(nameEl, orderName);
    fitReelsOrderName(nameEl, orderName);
  }
  if (descEl) {
    const desc = getShortReelsActionDescription(action, sector);
    updateAnimatedOrderText(descEl, desc);
    fitReelsOrderDesc(descEl, desc);
  }
}

function updateAnimatedOrderText(el, nextText) {
  if (!el) return;
  const prev = el.dataset.lastOrderText || "";
  if (prev === nextText) return;
  el.classList.remove("swapping");
  el.classList.add("swapping");
  el.textContent = nextText;
  el.dataset.lastOrderText = nextText;
  requestAnimationFrame(() => el.classList.remove("swapping"));
}

function fitReelsOrderName(nameEl, text) {
  if (!nameEl) return;
  const len = (text || "").length;
  let px = 48;
  if (len > 26) px = 30;
  else if (len > 22) px = 34;
  else if (len > 18) px = 38;
  else if (len > 14) px = 42;
  fitTextBlock(nameEl, px, 34, 0.92, false);
}

function fitReelsOrderDesc(descEl, text) {
  if (!descEl) return;
  const len = (text || "").length;
  let px = 24;
  if (len > 90) px = 16;
  else if (len > 75) px = 18;
  else if (len > 60) px = 20;
  else if (len > 45) px = 22;
  fitTextBlock(descEl, px, 12, 1.1, true);
}

function fitTextBlock(el, startPx, minPx, lineHeight, checkWidth) {
  el.style.fontSize = `${startPx}px`;
  el.style.lineHeight = String(lineHeight);
  let size = startPx;
  while (size > minPx && (el.scrollHeight > el.clientHeight || (checkWidth && el.scrollWidth > el.clientWidth))) {
    size -= 1;
    el.style.fontSize = `${size}px`;
  }
}

function fitReelsTitleName(nameEl, text) {
  if (!nameEl) return;
  const lines = (text || "").split("\n");
  const longest = lines.reduce((m, line) => Math.max(m, line.length), 0);
  let px = 72;
  if (lines.length > 1) px = 62;
  if (longest > 16) px = Math.min(px, 58);
  if (longest > 20) px = Math.min(px, 54);
  if (longest > 24) px = Math.min(px, 48);
  nameEl.style.fontSize = `${px}px`;
  nameEl.style.lineHeight = "0.9";
}

function formatReelsTitleName(fullName) {
  const full = (fullName || "").trim();
  if (!full) return "COMMANDER";
  const parts = full.split(/\s+/);
  if (parts.length < 2) return full;
  if (full.length <= 15) return full;
  const last = parts[parts.length - 1];
  const firstLine = parts.slice(0, -1).join(" ");
  return `${firstLine}\n${last}`;
}

function getShortReelsActionDescription(action, sector) {
  return actionReelsDescription(action, sector);
}

function updateReelsCard(side) {
  const army = state.armies[side];
  if (!army) return;
  const commander = COMMANDERS[army.armyCommanderId];
  if (!commander) return;
  const portrait = PORTRAITS[army.armyCommanderId];
  const isBlue = side === "A";

  const nameEl = isBlue ? els.reelsBlueName : els.reelsRedName;
  const portraitEl = isBlue ? els.reelsBluePortrait : els.reelsRedPortrait;
  const healthEl = isBlue ? els.reelsBlueHealthFill : els.reelsRedHealthFill;
  const abilityEl = isBlue ? els.reelsBlueAbilityFill : els.reelsRedAbilityFill;
  const abilityLabelEl = isBlue ? els.reelsBlueAbilityLabel : els.reelsRedAbilityLabel;
  const chargeDescEl = isBlue ? els.reelsBlueTraits : els.reelsRedTraits;
  const quoteEl = isBlue ? els.reelsBlueQuote : els.reelsRedQuote;
  const miniTraitsEl = isBlue ? els.reelsBlueMiniTraits : els.reelsRedMiniTraits;

  if (nameEl) nameEl.textContent = getReelsDisplayName(commander).toUpperCase();
  fitCommanderName(nameEl);
  if (portraitEl && portrait && portrait.src) portraitEl.src = portrait.src;

  const defeatedPct = (army.defeatedUnitCount / Math.max(1, army.startingUnitCount)) * 100;
  const healthPct = Math.max(0, 1 - (defeatedPct / Math.max(1, state.defeatThresholdPercent)));
  const chargePct = Math.max(0, Math.min(1, army.abilityCharge / 100));

  if (healthEl) {
    healthEl.style.width = `${Math.round(healthPct * 100)}%`;
    healthEl.style.background = healthPct > 0.5 ? "#41a85f" : healthPct > 0.25 ? "#d8a135" : "#d64d42";
  }
  if (abilityEl) {
    abilityEl.style.width = `${Math.round(chargePct * 100)}%`;
    abilityEl.style.background = isBlue ? "#1e5fb8" : "#9e1f1a";
  }
  const sigName = commander.signature?.name || "Ability";
  if (abilityLabelEl) {
    abilityLabelEl.textContent = army.abilityReady ? `${sigName} READY` : sigName;
    abilityLabelEl.classList.toggle("ready", !!army.abilityReady);
  }
  if (chargeDescEl) {
    chargeDescEl.textContent = formatChargeDescription(commander.chargeDescription);
  }
  if (miniTraitsEl) {
    const t = commander.traits || {};
    miniTraitsEl.textContent = `Aggression ${t.aggression ?? 0}   Control ${t.control ?? 0}   Creativity ${t.creativity ?? 0}`;
  }
  updateReelsQuoteBubble(side, quoteEl);
}

function fitCommanderName(nameEl) {
  if (!nameEl) return;
  const text = nameEl.textContent || "";
  const len = text.length;
  let px = 38;
  if (len > 24) px = 22;
  else if (len > 20) px = 26;
  else if (len > 16) px = 30;
  else if (len > 13) px = 34;
  else if (len > 11) px = 36;
  nameEl.style.fontSize = `${px}px`;
}

function getReelsDisplayName(commander) {
  if (!commander) return "Commander";
  if (commander.reelsShortName) return commander.reelsShortName;
  const full = commander.name || "Commander";
  if (full.length <= 14) return full;
  const parts = full.trim().split(/\s+/);
  return parts[parts.length - 1] || full;
}

function formatChargeDescription(text) {
  const fallback = "Charges through battlefield momentum.";
  const raw = (text || fallback).trim();
  if (!raw) return fallback;
  const lowered = raw.toLowerCase();
  return lowered.charAt(0).toUpperCase() + lowered.slice(1);
}

function aliveUnitCount(side) {
  const army = state.armies[side];
  if (!army || !Array.isArray(army.units)) return 0;
  return army.units.filter((u) => u.alive).length;
}

function updateReelsPowerBar() {
  const blueAlive = aliveUnitCount("A");
  const redAlive = aliveUnitCount("B");
  const total = Math.max(1, blueAlive + redAlive);
  const bluePct = Math.round((blueAlive / total) * 100);
  const redPct = 100 - bluePct;

  if (els.reelsPowerLeft) els.reelsPowerLeft.style.width = `${bluePct}%`;
  if (els.reelsPowerRight) els.reelsPowerRight.style.width = `${redPct}%`;
}

function updateLeaderMusic() {
  const blueAlive = aliveUnitCount("A");
  const redAlive = aliveUnitCount("B");
  if (blueAlive > redAlive) {
    playLeaderMusic("A");
    stopLeaderMusic("B");
    return;
  }
  if (redAlive > blueAlive) {
    playLeaderMusic("B");
    stopLeaderMusic("A");
    return;
  }
  stopLeaderMusic("A");
  stopLeaderMusic("B");
}

function playLeaderMusic(side) {
  const track = REELS_MUSIC[side];
  if (!track || typeof track.play !== "function") return;
  if (!track.paused) return;
  track.loop = true;
  const maybePromise = track.play();
  if (maybePromise && typeof maybePromise.catch === "function") {
    maybePromise.catch(() => {});
  }
}

function stopLeaderMusic(side) {
  const track = REELS_MUSIC[side];
  if (!track || typeof track.pause !== "function") return;
  track.pause();
  if (typeof track.currentTime === "number") {
    track.currentTime = 0;
  }
}

function updateReelsQuoteBubble(side, quoteEl) {
  if (!quoteEl) return;
  const quoteState = state.reelsCommanderQuote?.[side];
  if (state.reelsMode && quoteState && (quoteState.expiresAt || 0) > Date.now()) {
    const text = `${quoteState.text || ""}`.trim();
    quoteEl.textContent = text;
    if (text.length <= 34) quoteEl.classList.add("compact");
    else quoteEl.classList.remove("compact");
    quoteEl.classList.add("show");
    return;
  }
  quoteEl.textContent = "";
  quoteEl.classList.remove("compact");
  quoteEl.classList.remove("show");
  if (state.reelsCommanderQuote?.[side] && (state.reelsCommanderQuote[side].expiresAt || 0) <= Date.now()) {
    state.reelsCommanderQuote[side] = null;
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
    const actionName = army.currentAction ? formatActionName(army.currentAction, side) : "Pending";
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
