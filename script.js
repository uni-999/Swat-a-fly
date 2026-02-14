"use strict";

const DEBUG_NPC_ONLY = true;
const TOTAL_RACERS = 4;
const CANVAS_WIDTH = 980;
const CANVAS_HEIGHT = 620;
const TAU = Math.PI * 2;
const RACE_TIMEOUT_MS = 120000;
const OUTSIDE_PENALTY_MS = 1400;
const PICKUP_RESPAWN_MS = 8000;
const STORAGE_PREFIX = "snake_drift_best_";

const SNAKES = [
  {
    id: "speedster",
    name: "Speedster",
    flavor: "Максималка выше всех, но тяжелее повернуть",
    color: "#58f4ff",
    stats: { maxSpeed: 238, accel: 330, drag: 1.3, turnRate: 2.52, offroadPenalty: 0.63, mass: 1.0 },
  },
  {
    id: "handler",
    name: "Handler",
    flavor: "Лучший контроль в поворотах",
    color: "#9fff77",
    stats: { maxSpeed: 214, accel: 318, drag: 1.25, turnRate: 3.0, offroadPenalty: 0.67, mass: 1.0 },
  },
  {
    id: "bully",
    name: "Bully",
    flavor: "Тяжелый корпус, сильнее толчки",
    color: "#ff8c7c",
    stats: { maxSpeed: 206, accel: 292, drag: 1.18, turnRate: 2.3, offroadPenalty: 0.71, mass: 1.35 },
  },
  {
    id: "trickster",
    name: "Trickster",
    flavor: "Почти не теряет темп вне дороги",
    color: "#d6a7ff",
    stats: { maxSpeed: 222, accel: 305, drag: 1.22, turnRate: 2.72, offroadPenalty: 0.82, mass: 0.95 },
  },
];

const PICKUP_TYPES = {
  BOOST: { name: "BOOST", color: "#44f084", durationMs: 2600 },
  SHIELD: { name: "SHIELD", color: "#63cfff", durationMs: 6500, charges: 1 },
  OIL: { name: "OIL", color: "#ffc45f", durationMs: 2200 },
  BOMB: { name: "BOMB", color: "#ff6975", durationMs: 2100, radius: 112 },
};

const PICKUP_ORDER = ["BOOST", "SHIELD", "OIL", "BOMB"];

const NPC_PROFILES = [
  { id: "careful", name: "NPC Careful", speedFactor: 0.88, lookAhead: 130, steerGain: 2.2, brakeAngle: 0.48 },
  { id: "normal", name: "NPC Normal", speedFactor: 0.95, lookAhead: 145, steerGain: 2.45, brakeAngle: 0.56 },
  { id: "aggressive", name: "NPC Aggro", speedFactor: 1.02, lookAhead: 160, steerGain: 2.65, brakeAngle: 0.66 },
  { id: "maniac", name: "NPC Maniac", speedFactor: 1.08, lookAhead: 172, steerGain: 2.85, brakeAngle: 0.76 },
];

const TRACK_DEFS = [
  {
    id: "canyon_loop",
    name: "Canyon Loop",
    subtitle: "Быстрая трасса с затяжными связками",
    roadWidth: 52,
    outsideWidth: 90,
    checkpointFractions: [0, 0.15, 0.33, 0.49, 0.68, 0.84],
    pickupFractions: [0.07, 0.21, 0.31, 0.42, 0.58, 0.73, 0.86, 0.93],
    createPoints: () => {
      const points = [];
      const steps = 180;
      for (let i = 0; i < steps; i += 1) {
        const t = (i / steps) * TAU;
        const x = 492 + Math.cos(t) * 315 + Math.cos(2 * t + 0.8) * 58;
        const y = 312 + Math.sin(t) * 198 + Math.sin(3 * t - 0.4) * 39;
        points.push({ x, y });
      }
      return points;
    },
  },
  {
    id: "switchback_run",
    name: "Switchback Run",
    subtitle: "Больше смен темпа и двойные апексы",
    roadWidth: 50,
    outsideWidth: 88,
    checkpointFractions: [0, 0.12, 0.25, 0.4, 0.56, 0.74, 0.88],
    pickupFractions: [0.05, 0.16, 0.29, 0.39, 0.51, 0.64, 0.79, 0.9],
    createPoints: () => {
      const points = [];
      const steps = 200;
      for (let i = 0; i < steps; i += 1) {
        const t = (i / steps) * TAU;
        const x = 488 + Math.cos(t) * 268 + Math.sin(2 * t) * 98 + Math.cos(3 * t) * 26;
        const y = 312 + Math.sin(t) * 162 + Math.sin(4 * t + 0.5) * 58;
        points.push({ x, y });
      }
      return points;
    },
  },
  {
    id: "twin_fang",
    name: "Twin Fang",
    subtitle: "Почти восьмерка с коварными перекладками",
    roadWidth: 48,
    outsideWidth: 86,
    checkpointFractions: [0, 0.11, 0.26, 0.43, 0.57, 0.72, 0.87],
    pickupFractions: [0.04, 0.17, 0.27, 0.36, 0.53, 0.68, 0.81, 0.92],
    createPoints: () => {
      const points = [];
      const steps = 220;
      for (let i = 0; i < steps; i += 1) {
        const t = (i / steps) * TAU;
        const x = 490 + Math.sin(t) * 300 + Math.sin(3 * t) * 20;
        const y = 310 + Math.sin(2 * t) * 162 + Math.cos(t) * 12;
        points.push({ x, y });
      }
      return points;
    },
  },
];

const ui = {
  screens: {
    main: document.getElementById("screen-main"),
    snake: document.getElementById("screen-snake"),
    track: document.getElementById("screen-track"),
    race: document.getElementById("screen-race"),
    results: document.getElementById("screen-results"),
  },
  snakeCards: document.getElementById("snake-cards"),
  trackCards: document.getElementById("track-cards"),
  snakeNext: document.getElementById("snake-next"),
  trackStart: document.getElementById("track-start"),
  timer: document.getElementById("hud-timer"),
  speed: document.getElementById("hud-speed"),
  position: document.getElementById("hud-position"),
  effect: document.getElementById("hud-effect"),
  standings: document.getElementById("hud-standings"),
  overlay: document.getElementById("race-overlay"),
  resultsBody: document.getElementById("results-body"),
  toast: document.getElementById("toast"),
  raceStage: document.getElementById("race-stage"),
};

const state = {
  currentScreen: "main",
  selectedSnakeId: null,
  selectedTrackId: null,
  race: null,
  lastResults: [],
  keyMap: new Set(),
  toastTimeout: null,
  phaserGame: null,
  raceScene: null,
};

bootstrap();

function bootstrap() {
  wireUi();
  renderSnakeCards();
  renderTrackCards();
  showScreen("main");
  initPhaser();
}

function initPhaser() {
  class RaceScene extends Phaser.Scene {
    constructor() {
      super("RaceScene");
      this.graphics = null;
      this.infoText = null;
      this.labelMap = new Map();
    }

    create() {
      this.graphics = this.add.graphics();
      this.infoText = this.add
        .text(12, 12, "", {
          fontFamily: "\"Exo 2\", sans-serif",
          fontSize: "13px",
          color: "#dbe9ff",
        })
        .setDepth(30);
      state.raceScene = this;
    }

    update(time, delta) {
      const dt = Math.min(0.033, Math.max(0.001, delta / 1000));
      if (state.race) {
        updateRace(state.race, time, dt);
        renderRace(this, state.race, time);
      } else {
        renderIdle(this);
      }
    }
  }

  state.phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: ui.raceStage,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: "#081122",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    },
    scene: [RaceScene],
  });
}

function wireUi() {
  document.getElementById("btn-offline").addEventListener("click", () => showScreen("snake"));
  document.getElementById("btn-online").addEventListener("click", () => showToast("Онлайн модуль в следующем шаге (E3)."));
  document.getElementById("btn-leaderboards").addEventListener("click", () => showToast("Authoritative leaderboard будет добавлен через сервер."));
  document.getElementById("btn-settings").addEventListener("click", () => showToast("Настройки появятся после стабилизации core-loop."));

  document.getElementById("snake-back").addEventListener("click", () => showScreen("main"));
  document.getElementById("snake-next").addEventListener("click", () => showScreen("track"));
  document.getElementById("track-back").addEventListener("click", () => showScreen("snake"));
  document.getElementById("track-start").addEventListener("click", () => {
    if (!state.selectedTrackId) {
      return;
    }
    startRace(state.selectedTrackId);
  });

  document.getElementById("results-retry").addEventListener("click", () => {
    if (state.selectedTrackId) {
      startRace(state.selectedTrackId);
    }
  });
  document.getElementById("results-next").addEventListener("click", () => {
    if (!state.selectedTrackId) {
      return;
    }
    const idx = TRACK_DEFS.findIndex((t) => t.id === state.selectedTrackId);
    const next = TRACK_DEFS[(idx + 1) % TRACK_DEFS.length];
    state.selectedTrackId = next.id;
    startRace(next.id);
  });
  document.getElementById("results-back").addEventListener("click", () => {
    state.race = null;
    renderTrackCards();
    showScreen("main");
  });

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
}

function onKeyDown(event) {
  if (state.currentScreen === "race" && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code || event.key)) {
    event.preventDefault();
  }
  state.keyMap.add(event.code);
  if (event.code === "KeyR" && state.currentScreen === "race" && state.selectedTrackId) {
    startRace(state.selectedTrackId);
  }
}

function onKeyUp(event) {
  state.keyMap.delete(event.code);
}

function showScreen(name) {
  Object.entries(ui.screens).forEach(([id, node]) => node.classList.toggle("active", id === name));
  state.currentScreen = name;
  if (name !== "race") {
    ui.overlay.classList.remove("visible");
  }
}

function renderSnakeCards() {
  ui.snakeCards.innerHTML = "";
  for (const snake of SNAKES) {
    const card = document.createElement("button");
    card.className = "card";
    card.type = "button";
    card.innerHTML = `
      <h3 style="color:${snake.color}">${snake.name}</h3>
      <p>${snake.flavor}</p>
      <ul>
        <li>maxSpeed: ${Math.round(snake.stats.maxSpeed)}</li>
        <li>turnRate: ${snake.stats.turnRate.toFixed(2)}</li>
        <li>offroadPenalty: ${(snake.stats.offroadPenalty * 100).toFixed(0)}%</li>
      </ul>
    `;
    card.addEventListener("click", () => {
      state.selectedSnakeId = snake.id;
      ui.snakeNext.disabled = false;
      [...ui.snakeCards.children].forEach((node) => node.classList.remove("selected"));
      card.classList.add("selected");
    });
    if (!state.selectedSnakeId && snake.id === "handler") {
      state.selectedSnakeId = snake.id;
      card.classList.add("selected");
      ui.snakeNext.disabled = false;
    } else if (state.selectedSnakeId === snake.id) {
      card.classList.add("selected");
      ui.snakeNext.disabled = false;
    }
    ui.snakeCards.appendChild(card);
  }
}

function renderTrackCards() {
  ui.trackCards.innerHTML = "";
  for (const track of TRACK_DEFS) {
    const best = loadBestTime(track.id);
    const card = document.createElement("button");
    card.className = "card";
    card.type = "button";
    card.innerHTML = `
      <h3>${track.name}</h3>
      <p>${track.subtitle}</p>
      <ul>
        <li>Best local: ${Number.isFinite(best) ? formatMs(best) : "—"}</li>
        <li>Road width: ${track.roadWidth}</li>
      </ul>
    `;
    card.addEventListener("click", () => {
      state.selectedTrackId = track.id;
      ui.trackStart.disabled = false;
      [...ui.trackCards.children].forEach((node) => node.classList.remove("selected"));
      card.classList.add("selected");
    });
    if (!state.selectedTrackId && track.id === "canyon_loop") {
      state.selectedTrackId = track.id;
      card.classList.add("selected");
      ui.trackStart.disabled = false;
    } else if (state.selectedTrackId === track.id) {
      card.classList.add("selected");
      ui.trackStart.disabled = false;
    }
    ui.trackCards.appendChild(card);
  }
}

function startRace(trackId) {
  const trackDef = TRACK_DEFS.find((item) => item.id === trackId);
  if (!trackDef) {
    return;
  }
  const selectedSnake = SNAKES.find((item) => item.id === state.selectedSnakeId) || SNAKES[0];
  state.race = createRaceState(trackDef, selectedSnake);
  showScreen("race");
  if (DEBUG_NPC_ONLY) {
    showToast("DEBUG: 4 NPC автопилот. Быстрая отладка симуляции.");
  }
}

function createRaceState(trackDef, selectedSnake) {
  const track = buildTrackRuntime(trackDef);
  const racers = [];
  const slotOffsets = [-22, -8, 8, 22];
  const selectedForProbe = selectedSnake;

  for (let i = 0; i < TOTAL_RACERS; i += 1) {
    const profile = NPC_PROFILES[i % NPC_PROFILES.length];
    const snake = i === 0 ? selectedForProbe : SNAKES[(i + 1) % SNAKES.length];
    const spawnFraction = mod1(0.992 - i * 0.008);
    const spawn = sampleTrack(track, spawnFraction);
    const normal = { x: -spawn.tangent.y, y: spawn.tangent.x };
    const offset = slotOffsets[i] || 0;

    const racer = {
      id: `racer_${i + 1}`,
      name: DEBUG_NPC_ONLY ? (i === 0 ? "NPC Probe" : profile.name) : i === 0 ? "You" : profile.name,
      typeId: snake.id,
      color: snake.color,
      stats: snake.stats,
      profile,
      isPlayer: !DEBUG_NPC_ONLY && i === 0,
      x: spawn.x + normal.x * offset,
      y: spawn.y + normal.y * offset,
      heading: Math.atan2(spawn.tangent.y, spawn.tangent.x),
      speed: 0,
      surface: "road",
      shieldCharges: 0,
      effects: [],
      nextCheckpointIndex: 1,
      checkpointsPassed: 0,
      readyToFinish: false,
      finished: false,
      finishTimeMs: Infinity,
      timePenaltyMs: 0,
      progressScore: 0,
      trail: [],
      lastProjection: null,
      impactUntilMs: 0,
    };
    racers.push(racer);
  }

  return {
    trackDef,
    track,
    racers,
    pickups: createPickups(track),
    phase: "countdown",
    createdAtMs: performance.now(),
    countdownStartMs: performance.now(),
    raceStartMs: 0,
    finishedAtMs: 0,
    overlayUntilMs: 0,
    focusRacerId: racers[0].id,
    standings: [],
    resultsPushed: false,
  };
}

function createPickups(track) {
  return track.pickupFractions.map((fraction, index) => {
    const sample = sampleTrack(track, fraction);
    const tangent = sample.tangent;
    const normal = { x: -tangent.y, y: tangent.x };
    const lateral = (index % 2 === 0 ? 1 : -1) * (track.roadWidth * 0.32);
    return {
      id: `pickup_${index + 1}`,
      type: PICKUP_ORDER[index % PICKUP_ORDER.length],
      x: sample.x + normal.x * lateral,
      y: sample.y + normal.y * lateral,
      active: true,
      respawnAtMs: 0,
      radius: 12,
    };
  });
}

function updateRace(race, nowMs, dt) {
  if (race.phase === "countdown") {
    const remain = Math.max(0, 3000 - (nowMs - race.countdownStartMs));
    if (remain <= 0) {
      race.phase = "running";
      race.raceStartMs = nowMs;
      race.overlayUntilMs = nowMs + 700;
      ui.overlay.textContent = "GO";
      ui.overlay.classList.add("visible");
    } else {
      ui.overlay.textContent = String(Math.ceil(remain / 1000));
      ui.overlay.classList.add("visible");
    }
    updateHud(race, nowMs);
    return;
  }

  if (race.phase === "finished") {
    if (nowMs > race.overlayUntilMs) {
      ui.overlay.classList.remove("visible");
      if (!race.resultsPushed) {
        race.resultsPushed = true;
        finalizeResults(race);
      }
    }
    return;
  }

  if (nowMs <= race.overlayUntilMs) {
    ui.overlay.classList.add("visible");
  } else {
    ui.overlay.classList.remove("visible");
  }

  updatePickups(race, nowMs);

  for (const racer of race.racers) {
    if (racer.finished) {
      continue;
    }
    const control = racer.isPlayer && !DEBUG_NPC_ONLY ? readPlayerControl() : buildNpcControl(race, racer);
    stepRacer(race, racer, control, nowMs, dt);
    updateCheckpointProgress(race, racer, nowMs);
    checkPickupCollection(race, racer, nowMs);
  }

  resolveRacerCollisions(race, nowMs);
  race.standings = computeStandings(race);

  const elapsedMs = nowMs - race.raceStartMs;
  if (elapsedMs > RACE_TIMEOUT_MS) {
    for (const racer of race.racers) {
      if (!racer.finished) {
        racer.finished = true;
        racer.finishTimeMs = Infinity;
      }
    }
    finishRace(race, nowMs);
  } else if (race.racers.every((racer) => racer.finished)) {
    finishRace(race, nowMs);
  }

  updateHud(race, nowMs);
}

function finishRace(race, nowMs) {
  race.phase = "finished";
  race.finishedAtMs = nowMs;
  race.overlayUntilMs = nowMs + 1300;
  ui.overlay.textContent = "FINISH";
  ui.overlay.classList.add("visible");
}

function finalizeResults(race) {
  const ordered = computeStandings(race);
  state.lastResults = ordered.map((racer, index) => ({
    rank: index + 1,
    name: racer.name,
    snake: racer.typeId,
    timeMs: racer.finishTimeMs,
  }));
  persistBestTimeFromRace(race);
  renderResultsTable();
  renderTrackCards();
  state.race = null;
  showScreen("results");
}

function persistBestTimeFromRace(race) {
  const focus = race.racers.find((racer) => racer.id === race.focusRacerId);
  if (!focus || !Number.isFinite(focus.finishTimeMs)) {
    return;
  }
  const prev = loadBestTime(race.trackDef.id);
  if (!Number.isFinite(prev) || focus.finishTimeMs < prev) {
    localStorage.setItem(`${STORAGE_PREFIX}${race.trackDef.id}`, String(Math.round(focus.finishTimeMs)));
  }
}

function renderResultsTable() {
  ui.resultsBody.innerHTML = "";
  for (const row of state.lastResults) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.rank}</td>
      <td>${row.name}</td>
      <td>${row.snake}</td>
      <td>${Number.isFinite(row.timeMs) ? formatMs(row.timeMs) : "DNF"}</td>
    `;
    ui.resultsBody.appendChild(tr);
  }
}

function updatePickups(race, nowMs) {
  for (const pickup of race.pickups) {
    if (!pickup.active && nowMs >= pickup.respawnAtMs) {
      pickup.active = true;
    }
  }
}

function checkPickupCollection(race, racer, nowMs) {
  for (const pickup of race.pickups) {
    if (!pickup.active) {
      continue;
    }
    const distSq = sqrDistance(racer.x, racer.y, pickup.x, pickup.y);
    if (distSq > (pickup.radius + 11) ** 2) {
      continue;
    }
    pickup.active = false;
    pickup.respawnAtMs = nowMs + PICKUP_RESPAWN_MS;
    applyPickup(race, racer, pickup.type, nowMs);
  }
}

function applyPickup(race, racer, type, nowMs) {
  if (type === "BOOST") {
    addEffect(racer, "BOOST", PICKUP_TYPES.BOOST.durationMs, nowMs);
    return;
  }
  if (type === "SHIELD") {
    racer.shieldCharges = Math.max(racer.shieldCharges, PICKUP_TYPES.SHIELD.charges);
    addEffect(racer, "SHIELD", PICKUP_TYPES.SHIELD.durationMs, nowMs);
    return;
  }
  if (type === "OIL") {
    addEffect(racer, "OIL", PICKUP_TYPES.OIL.durationMs, nowMs);
    return;
  }
  if (type === "BOMB") {
    for (const target of race.racers) {
      if (target.id === racer.id || target.finished) {
        continue;
      }
      const distSq = sqrDistance(racer.x, racer.y, target.x, target.y);
      if (distSq > PICKUP_TYPES.BOMB.radius ** 2) {
        continue;
      }
      if (target.shieldCharges > 0) {
        target.shieldCharges -= 1;
        removeEffect(target, "SHIELD");
      } else {
        addEffect(target, "BOMB_SLOW", PICKUP_TYPES.BOMB.durationMs, nowMs);
      }
    }
  }
}

function addEffect(racer, type, durationMs, nowMs) {
  removeEffect(racer, type);
  racer.effects.push({ type, untilMs: nowMs + durationMs });
}

function removeEffect(racer, type) {
  racer.effects = racer.effects.filter((effect) => effect.type !== type);
}

function stepRacer(race, racer, control, nowMs, dt) {
  racer.effects = racer.effects.filter((effect) => effect.untilMs > nowMs);

  const projection = projectOnTrack(race.track, racer.x, racer.y);
  racer.lastProjection = projection;
  racer.surface = projection.distance <= race.track.roadWidth ? "road" : projection.distance <= race.track.outsideWidth ? "offroad" : "outside";

  if (racer.surface === "outside") {
    resetRacerToCheckpoint(race, racer);
    return;
  }

  const modifiers = getRacerModifiers(racer);
  const offroadMul = racer.surface === "offroad" ? racer.stats.offroadPenalty : 1;

  const maxSpeed = racer.stats.maxSpeed * offroadMul * modifiers.speedMul * racer.profile.speedFactor;
  const accel = racer.stats.accel * offroadMul * modifiers.accelMul;
  const drag = racer.stats.drag;
  const brakeForce = 460;

  const throttleInput = clamp(control.throttle, 0, 1);
  const brakeInput = clamp(control.brake, 0, 1);
  const turnInput = clamp(control.turn, -1, 1);

  const accelTerm = throttleInput * accel;
  const dragTerm = drag * racer.speed;
  const brakeTerm = brakeInput * brakeForce;

  racer.speed += (accelTerm - dragTerm - brakeTerm) * dt;
  racer.speed = clamp(racer.speed, 0, maxSpeed * 1.06);

  const speedRatio = clamp(maxSpeed > 0 ? racer.speed / maxSpeed : 0, 0, 1);
  const turnRate = racer.stats.turnRate * modifiers.turnMul * (1 - speedRatio * 0.35);
  racer.heading = wrapAngle(racer.heading + turnInput * turnRate * dt);

  racer.x += Math.cos(racer.heading) * racer.speed * dt;
  racer.y += Math.sin(racer.heading) * racer.speed * dt;

  racer.trail.push({ x: racer.x, y: racer.y });
  if (racer.trail.length > 22) {
    racer.trail.shift();
  }
}

function getRacerModifiers(racer) {
  let speedMul = 1;
  let accelMul = 1;
  let turnMul = 1;
  for (const effect of racer.effects) {
    if (effect.type === "BOOST") {
      speedMul *= 1.34;
      accelMul *= 1.18;
    } else if (effect.type === "OIL") {
      turnMul *= 0.64;
      accelMul *= 0.82;
    } else if (effect.type === "BOMB_SLOW") {
      speedMul *= 0.7;
      accelMul *= 0.72;
      turnMul *= 0.86;
    }
  }
  return { speedMul, accelMul, turnMul };
}

function resetRacerToCheckpoint(race, racer) {
  const checkpoints = race.track.checkpoints;
  let cpIndex = racer.nextCheckpointIndex - 1;
  if (cpIndex < 0) {
    cpIndex = checkpoints.length - 1;
  }
  const cp = checkpoints[cpIndex];
  const next = checkpoints[(cpIndex + 1) % checkpoints.length];
  const direction = { x: next.x - cp.x, y: next.y - cp.y };
  const len = Math.hypot(direction.x, direction.y) || 1;
  const nx = direction.x / len;
  const ny = direction.y / len;
  racer.x = cp.x + nx * 20;
  racer.y = cp.y + ny * 20;
  racer.heading = Math.atan2(ny, nx);
  racer.speed = Math.min(racer.speed, racer.stats.maxSpeed * 0.28);
  racer.timePenaltyMs += OUTSIDE_PENALTY_MS;
}

function buildNpcControl(race, racer) {
  const projection = racer.lastProjection || projectOnTrack(race.track, racer.x, racer.y);
  const lookAheadDistance = racer.profile.lookAhead + racer.speed * 0.32;
  const targetFraction = mod1(projection.tNorm + lookAheadDistance / race.track.totalLength);
  const target = sampleTrack(race.track, targetFraction);
  const desiredHeading = Math.atan2(target.y - racer.y, target.x - racer.x);
  const angle = shortestAngle(racer.heading, desiredHeading);

  let throttle = 1;
  let brake = 0;
  if (Math.abs(angle) > racer.profile.brakeAngle) {
    throttle = 0.45;
    brake = 0.24;
  }
  if (racer.surface === "offroad") {
    throttle = Math.min(throttle, 0.7);
  }

  return {
    throttle,
    brake,
    turn: clamp(angle * racer.profile.steerGain, -1, 1),
  };
}

function readPlayerControl() {
  const left = state.keyMap.has("ArrowLeft") || state.keyMap.has("KeyA");
  const right = state.keyMap.has("ArrowRight") || state.keyMap.has("KeyD");
  const up = state.keyMap.has("ArrowUp") || state.keyMap.has("KeyW");
  const down = state.keyMap.has("ArrowDown") || state.keyMap.has("KeyS");
  return {
    turn: (left ? -1 : 0) + (right ? 1 : 0),
    throttle: up ? 1 : 0,
    brake: down ? 1 : 0,
  };
}

function resolveRacerCollisions(race, nowMs) {
  const radius = 13;
  for (let i = 0; i < race.racers.length; i += 1) {
    const a = race.racers[i];
    if (a.finished) {
      continue;
    }
    for (let j = i + 1; j < race.racers.length; j += 1) {
      const b = race.racers[j];
      if (b.finished) {
        continue;
      }
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 0.001 || dist > radius * 2) {
        continue;
      }
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = radius * 2 - dist;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;

      if (nowMs < a.impactUntilMs || nowMs < b.impactUntilMs) {
        continue;
      }
      a.impactUntilMs = nowMs + 220;
      b.impactUntilMs = nowMs + 220;
      if (a.shieldCharges > 0) {
        a.shieldCharges -= 1;
        removeEffect(a, "SHIELD");
      } else {
        a.speed *= 0.72;
      }
      if (b.shieldCharges > 0) {
        b.shieldCharges -= 1;
        removeEffect(b, "SHIELD");
      } else {
        b.speed *= 0.72;
      }
    }
  }
}

function updateCheckpointProgress(race, racer, nowMs) {
  const checkpoints = race.track.checkpoints;
  const startCheckpoint = checkpoints[0];
  const startDist = Math.hypot(startCheckpoint.x - racer.x, startCheckpoint.y - racer.y);

  if (racer.readyToFinish && startDist <= race.track.checkpointRadius && nowMs - race.raceStartMs > 4500) {
    racer.finished = true;
    racer.finishTimeMs = Math.max(0, nowMs - race.raceStartMs + racer.timePenaltyMs);
    racer.speed = 0;
    return;
  }

  const next = checkpoints[racer.nextCheckpointIndex];
  const distToNext = Math.hypot(next.x - racer.x, next.y - racer.y);
  if (distToNext <= race.track.checkpointRadius && racer.nextCheckpointIndex !== 0) {
    racer.checkpointsPassed += 1;
    racer.nextCheckpointIndex = (racer.nextCheckpointIndex + 1) % checkpoints.length;
    if (racer.nextCheckpointIndex === 0) {
      racer.readyToFinish = true;
    }
  }

  const projection = racer.lastProjection || projectOnTrack(race.track, racer.x, racer.y);
  const targetDist = racer.readyToFinish ? startDist : distToNext;
  racer.progressScore = racer.checkpointsPassed * 10000 - targetDist + projection.tNorm * 120;
}

function computeStandings(race) {
  const finished = race.racers.filter((racer) => racer.finished).sort((a, b) => a.finishTimeMs - b.finishTimeMs);
  const active = race.racers
    .filter((racer) => !racer.finished)
    .sort((a, b) => b.progressScore - a.progressScore);
  return [...finished, ...active];
}

function updateHud(race, nowMs) {
  const standings = race.standings.length ? race.standings : computeStandings(race);
  const focus = race.racers.find((racer) => racer.id === race.focusRacerId) || race.racers[0];

  let timerMs = 0;
  if (race.phase === "running") {
    timerMs = focus.finished ? focus.finishTimeMs : Math.max(0, nowMs - race.raceStartMs + focus.timePenaltyMs);
  } else if (race.phase === "finished") {
    timerMs = focus.finishTimeMs;
  }
  ui.timer.textContent = Number.isFinite(timerMs) ? formatMs(timerMs) : "DNF";

  const kmh = Math.round(focus.speed * 1.92);
  ui.speed.textContent = `${kmh} km/h`;

  const rank = standings.findIndex((racer) => racer.id === focus.id) + 1;
  ui.position.textContent = `P${Math.max(1, rank)}/${TOTAL_RACERS} (${focus.name})`;
  ui.effect.textContent = readActiveEffectLabel(focus);

  ui.standings.innerHTML = "";
  standings.forEach((racer) => {
    const li = document.createElement("li");
    const tail = racer.finished ? (Number.isFinite(racer.finishTimeMs) ? formatMs(racer.finishTimeMs) : "DNF") : "running";
    li.textContent = `${racer.name} - ${tail}`;
    ui.standings.appendChild(li);
  });
}

function readActiveEffectLabel(racer) {
  if (racer.shieldCharges > 0) {
    return `SHIELD x${racer.shieldCharges}`;
  }
  if (!racer.effects.length) {
    return "none";
  }
  const top = racer.effects.reduce((acc, item) => (item.untilMs > acc.untilMs ? item : acc), racer.effects[0]);
  if (top.type === "BOMB_SLOW") {
    return "BOMB slow";
  }
  return top.type;
}

function renderRace(race, nowMs) {
  clearCanvas();
  drawTrack(race.track);
  drawCheckpoints(race.track);
  drawPickups(race.pickups);
  drawRacers(race.racers);

  canvasCtx.fillStyle = "rgba(255,255,255,0.76)";
  canvasCtx.font = "600 13px 'Exo 2', sans-serif";
  canvasCtx.fillText(`Track: ${race.trackDef.name}`, 12, 20);
  const phaseText = race.phase === "countdown" ? "Countdown" : race.phase === "running" ? "Running" : "Finished";
  canvasCtx.fillText(`Phase: ${phaseText}`, 12, 38);
  canvasCtx.fillText(`Time: ${formatMs(Math.max(0, nowMs - race.raceStartMs))}`, 12, 56);
}

function clearCanvas() {
  const grad = canvasCtx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  grad.addColorStop(0, "#0a1a33");
  grad.addColorStop(1, "#101026");
  canvasCtx.fillStyle = grad;
  canvasCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawTrack(track) {
  canvasCtx.save();
  canvasCtx.lineCap = "round";
  canvasCtx.lineJoin = "round";

  canvasCtx.beginPath();
  pathPolyline(canvasCtx, track.points);
  canvasCtx.strokeStyle = "rgba(145, 124, 88, 0.5)";
  canvasCtx.lineWidth = track.outsideWidth * 2;
  canvasCtx.stroke();

  canvasCtx.beginPath();
  pathPolyline(canvasCtx, track.points);
  canvasCtx.strokeStyle = "rgba(73, 83, 105, 0.92)";
  canvasCtx.lineWidth = track.roadWidth * 2;
  canvasCtx.stroke();

  canvasCtx.beginPath();
  pathPolyline(canvasCtx, track.points);
  canvasCtx.setLineDash([10, 12]);
  canvasCtx.strokeStyle = "rgba(152, 230, 255, 0.72)";
  canvasCtx.lineWidth = 2;
  canvasCtx.stroke();
  canvasCtx.setLineDash([]);

  canvasCtx.restore();
}

function drawCheckpoints(track) {
  for (let i = 0; i < track.checkpoints.length; i += 1) {
    const cp = track.checkpoints[i];
    canvasCtx.beginPath();
    canvasCtx.arc(cp.x, cp.y, i === 0 ? 8 : 6, 0, TAU);
    canvasCtx.fillStyle = i === 0 ? "rgba(255, 101, 101, 0.9)" : "rgba(98, 219, 255, 0.85)";
    canvasCtx.fill();
  }
}

function drawPickups(pickups) {
  for (const pickup of pickups) {
    if (!pickup.active) {
      continue;
    }
    const color = PICKUP_TYPES[pickup.type].color;
    canvasCtx.save();
    canvasCtx.translate(pickup.x, pickup.y);
    canvasCtx.rotate(Math.PI / 4);
    canvasCtx.fillStyle = color;
    canvasCtx.fillRect(-7, -7, 14, 14);
    canvasCtx.restore();
  }
}

function drawRacers(racers) {
  racers.forEach((racer) => {
    drawTrail(racer);
  });
  racers.forEach((racer) => {
    drawRacerBody(racer);
  });
}

function drawTrail(racer) {
  if (!racer.trail.length) {
    return;
  }
  for (let i = 0; i < racer.trail.length; i += 1) {
    const point = racer.trail[i];
    const alpha = i / racer.trail.length;
    const radius = 3 + alpha * 4;
    canvasCtx.beginPath();
    canvasCtx.arc(point.x, point.y, radius, 0, TAU);
    canvasCtx.fillStyle = hexToRgba(racer.color, 0.09 + alpha * 0.25);
    canvasCtx.fill();
  }
}

function drawRacerBody(racer) {
  canvasCtx.save();
  canvasCtx.translate(racer.x, racer.y);
  canvasCtx.rotate(racer.heading);
  canvasCtx.beginPath();
  canvasCtx.moveTo(15, 0);
  canvasCtx.lineTo(-11, 8);
  canvasCtx.lineTo(-6, 0);
  canvasCtx.lineTo(-11, -8);
  canvasCtx.closePath();
  canvasCtx.fillStyle = racer.color;
  canvasCtx.fill();
  canvasCtx.strokeStyle = "rgba(8, 10, 14, 0.65)";
  canvasCtx.lineWidth = 1.3;
  canvasCtx.stroke();

  if (racer.shieldCharges > 0) {
    canvasCtx.beginPath();
    canvasCtx.arc(0, 0, 16, 0, TAU);
    canvasCtx.strokeStyle = "rgba(99, 207, 255, 0.86)";
    canvasCtx.lineWidth = 2;
    canvasCtx.stroke();
  }
  canvasCtx.restore();

  canvasCtx.fillStyle = "rgba(255,255,255,0.78)";
  canvasCtx.font = "700 12px 'Exo 2', sans-serif";
  canvasCtx.fillText(racer.name, racer.x - 20, racer.y - 14);
}

function pathPolyline(ctx, points) {
  if (!points.length) {
    return;
  }
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.lineTo(points[0].x, points[0].y);
}

function buildTrackRuntime(def) {
  const points = def.createPoints();
  const segments = [];
  let totalLength = 0;

  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segments.push({ a, b, len, start: totalLength });
    totalLength += len;
  }

  const checkpoints = def.checkpointFractions.map((fraction) => sampleTrack({ points, segments, totalLength }, fraction));
  const pickupFractions = [...def.pickupFractions];

  return {
    defId: def.id,
    points,
    segments,
    totalLength,
    roadWidth: def.roadWidth,
    outsideWidth: def.outsideWidth,
    checkpoints: checkpoints.map((cp) => ({ x: cp.x, y: cp.y, fraction: cp.fraction })),
    checkpointRadius: def.roadWidth * 0.48,
    pickupFractions,
  };
}

function sampleTrack(track, fractionRaw) {
  const fraction = mod1(fractionRaw);
  const target = fraction * track.totalLength;
  for (const segment of track.segments) {
    if (target <= segment.start + segment.len) {
      const local = segment.len === 0 ? 0 : (target - segment.start) / segment.len;
      const x = lerp(segment.a.x, segment.b.x, local);
      const y = lerp(segment.a.y, segment.b.y, local);
      const tangent = normalizeVec(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
      return { x, y, tangent, fraction };
    }
  }
  const last = track.segments[track.segments.length - 1];
  const tangent = normalizeVec(last.b.x - last.a.x, last.b.y - last.a.y);
  return { x: last.b.x, y: last.b.y, tangent, fraction };
}

function projectOnTrack(track, x, y) {
  let bestDistSq = Infinity;
  let bestProjection = null;
  for (const segment of track.segments) {
    const proj = projectPointOnSegment(x, y, segment.a.x, segment.a.y, segment.b.x, segment.b.y);
    if (proj.distSq < bestDistSq) {
      bestDistSq = proj.distSq;
      const distOnTrack = segment.start + segment.len * proj.t;
      const tangent = normalizeVec(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
      bestProjection = {
        x: proj.x,
        y: proj.y,
        distance: Math.sqrt(bestDistSq),
        tNorm: distOnTrack / track.totalLength,
        tangent,
      };
    }
  }
  return bestProjection;
}

function projectPointOnSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby || 1;
  const apx = px - ax;
  const apy = py - ay;
  const t = clamp((apx * abx + apy * aby) / abLenSq, 0, 1);
  const x = ax + abx * t;
  const y = ay + aby * t;
  const dx = px - x;
  const dy = py - y;
  return { x, y, t, distSq: dx * dx + dy * dy };
}

function loadBestTime(trackId) {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${trackId}`);
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function formatMs(ms) {
  if (!Number.isFinite(ms)) {
    return "DNF";
  }
  const clean = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(clean / 60000);
  const seconds = Math.floor((clean % 60000) / 1000);
  const millis = clean % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function showToast(text) {
  ui.toast.textContent = text;
  ui.toast.classList.add("show");
  if (state.toastTimeout) {
    clearTimeout(state.toastTimeout);
  }
  state.toastTimeout = setTimeout(() => ui.toast.classList.remove("show"), 1900);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function sqrDistance(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function shortestAngle(from, to) {
  let delta = to - from;
  while (delta > Math.PI) {
    delta -= TAU;
  }
  while (delta < -Math.PI) {
    delta += TAU;
  }
  return delta;
}

function wrapAngle(angle) {
  while (angle > Math.PI) {
    angle -= TAU;
  }
  while (angle < -Math.PI) {
    angle += TAU;
  }
  return angle;
}

function normalizeVec(x, y) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

function mod1(value) {
  return ((value % 1) + 1) % 1;
}

function hexToRgba(hex, alpha) {
  const c = hex.replace("#", "");
  const value = c.length === 3 ? c.split("").map((part) => `${part}${part}`).join("") : c;
  const num = Number.parseInt(value, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
