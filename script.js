"use strict";

// -----------------------------
// Game Constants and Parameters
// -----------------------------
const TOTAL_RACERS = 4;
const OFFLINE_MODES = {
  CLASSIC: "classic_1p_3npc",
  DEBUG: "debug_4npc",
};
const DEFAULT_OFFLINE_MODE = OFFLINE_MODES.DEBUG;
const CANVAS_WIDTH = 980;
const CANVAS_HEIGHT = 620;
const TAU = Math.PI * 2;
const RACE_TIMEOUT_MS = 120000;
const PICKUP_RESPAWN_MS = 8000;
const STORAGE_PREFIX = "snake_drift_best_";
const OFFROAD_EXTRA_SLOWDOWN = 0.84;
const MAX_HISTORY_POINTS = 320;
const BODY_ITEM_COUNT = 12;
const BODY_ITEM_RESPAWN_MS = 3600;
const START_BODY_SEGMENTS = 8;
const MIN_BODY_SEGMENTS = 1;
const MAX_BODY_SEGMENTS = 56;
const STARVATION_DECAY_INTERVAL_MS = 12000;
const STARVATION_DECAY_SEGMENTS = 1;
const APPLE_BOOST_DURATION_MS = 680;
const APPLE_BOOST_SPEED_MUL = 1.48;
const APPLE_BOOST_ACCEL_MUL = 1.34;
const APPLE_BOOST_INSTANT_SPEED_FACTOR = 0.44;
const EXHAUSTION_CRAWL_THRESHOLD = 3;
const EXHAUSTION_CRAWL_SPEED_FACTOR = 0.36;
const EXHAUSTION_SLOWDOWN_PER_STEP = 0.17;
const EXHAUSTION_SLOWDOWN_MIN_FACTOR = 0.32;
const CRITICAL_SEGMENTS_THRESHOLD = 4;
const CRITICAL_SEGMENTS_SLOWDOWN = 0.55;
const BODY_ITEM_MIN_SEPARATION = 64;
const BODY_ITEM_TO_CHECKPOINT_MIN_DIST = 62;
const BODY_ITEM_TO_START_CHECKPOINT_MIN_DIST = 150;
const BODY_ITEM_TO_PICKUP_MIN_DIST = 40;
const CROSS_ACCEL_SNAKE_ID = "handler";
const BODY_CROSS_SLOWDOWN_MUL = 0.9;
const SPEEDSTER_BODY_BLOCK_PUSH = 8;
const BULLY_PUSH_DISTANCE = 8;
const SEGMENT_RENDER_SCALE = 1.5;
const RESTART_DEBOUNCE_MS = 320;
const APPLE_STARTLINE_AVOID_RADIUS = 140;
const NPC_HAZARD_LOOKAHEAD_DELTA = 0.18;
const NPC_BOMB_AVOID_RADIUS = 246;
const NPC_CACTUS_AVOID_RADIUS = 188;
const NPC_OIL_AVOID_RADIUS = 198;
const NPC_BOMB_AVOID_WEIGHT = 2.1;
const NPC_CACTUS_AVOID_WEIGHT = 1.62;
const NPC_OIL_AVOID_WEIGHT = 1.78;
const NPC_HAZARD_AVOID_MAX_SHIFT = 96;
const NPC_EDGE_CAUTION_START_RATIO = 0.58;
const NPC_EDGE_AVOID_LOOKAHEAD = 0.022;
const NPC_BENEFIT_LOOKAHEAD_DELTA = 0.34;
const NPC_BENEFIT_MAX_DISTANCE = 560;
const BODY_CROSSING_START_GRACE_MS = 1200;
const BODY_CROSSING_EFFECT_COOLDOWN_MS = 260;
const RACE_START_GHOST_MS = 900;
const RACE_START_LAUNCH_SPEED_FACTOR = 0.24;
const ALWAYS_MOVE_SNAKE_IDS = new Set(["speedster", "handler"]);
const ALWAYS_MOVE_MIN_SPEED = 42;
const ALWAYS_MOVE_OFFROAD_FACTOR = 0.72;
const SPEEDSTER_BLOCK_EXTRA_TURN = 0.34;
const SPEEDSTER_BLOCK_NUDGE = 4;
const STALL_CHECK_WINDOW_MS = 780;
const STALL_UNSTUCK_COOLDOWN_MS = 520;
const STALL_MOVEMENT_EPSILON_SQ = 144;
const STALL_PROGRESS_EPSILON = 0.0022;
const STALL_NO_PROGRESS_WINDOW_MS = 1350;
const STALL_UNSTUCK_LOOKAHEAD = 0.02;
const STALL_UNSTUCK_NUDGE = 14;
const STALL_UNSTUCK_GHOST_MS = 720;
const STALL_HARD_UNSTUCK_LOOKAHEAD = 0.036;
const STALL_HARD_UNSTUCK_GHOST_MS = 1100;
const BOMB_HIT_IMMUNITY_MS = 1200;
const BOMB_RECOVERY_SPEED_FACTOR = 0.26;
const OUTSIDE_EXTRA_SLOWDOWN = 0.46;
const OUTSIDE_RECOVERY_STEER_GAIN = 3.4;
const OUTSIDE_RECOVERY_PULL_SPEED = 56;
const OUTSIDE_MIN_CRAWL_SPEED = 12;
const FINISHED_COAST_SPEED_FACTOR = 0.2;
const FINISHED_COAST_STEER_GAIN = 2.1;
const FINISHED_COAST_LOOKAHEAD = 0.008;
const DNF_LABEL = "Сход";
const VENOM_PROJECTILE_RADIUS = 4.5;
const VENOM_PROJECTILE_SPEED = 360;
const VENOM_PROJECTILE_HIT_RADIUS = 13;
const VENOM_PROJECTILE_MAX_LIFE_MS = 1800;
const VENOM_SLOW_BASE_DURATION_MS = 1750;
const RACE_COUNTDOWN_TOTAL_MS = 3000;
const RACE_COUNTDOWN_SECONDS = 3;
const TITLE_RACE_DURATION_STATS_KEY = "snake_race_duration_stats_v1";
const TITLE_CRAWL_DURATION_EXTRA_FACTOR = 1.12;
const TITLE_CRAWL_MIN_DURATION_MS = 42000;
const TITLE_CRAWL_MAX_DURATION_MS = 132000;
const TITLE_CRAWL_EMA_ALPHA = 0.24;
const TITLE_CRAWL_PACE_FACTOR = 0.27;
const TITLE_CRAWL_SIDE_PADDING = 24;
const TITLE_CRAWL_SLOWDOWN_FACTOR = 10;
const MATCH_SERVER_PORT = 2567;
const TITLE_REMOTE_STATS_PATH = "/local-stats/race-duration";
const TITLE_REMOTE_STATS_RETRY_MS = 20000;
const TRACK_MUSIC = {
  canyon_loop: { key: "music_formula1", path: "assets/sounds/Formula1.mp3", volume: 0.34 },
};

const BODY_ITEMS = {
  APPLE: { color: "#ff5f6a", deltaSegments: 1 },
  CACTUS: { color: "#4fd17b", deltaSegments: -1 },
};
const SNAKE_SPRITES_BASE_PATH = "assets/sprites/snakes";

const SNAKES = [
  {
    id: "speedster",
    name: "Speedster",
    flavor: "Максималка выше всех, но тяжелее повернуть",
    color: "#58f4ff",
    stats: { maxSpeed: 238, accel: 330, drag: 1.3, turnRate: 2.52, offroadPenalty: 0.63, mass: 1.0 },
    body: { segments: 18, spacing: 7.6, waveAmp: 4.8, waveFreq: 0.9, waveSpeed: 5.2, taper: 0.62 },
    venom: { range: 128, cooldownMs: 2650, slowMul: 0.9, durationMs: 1450, speed: 385 },
  },
  {
    id: "handler",
    name: "Handler",
    flavor: "Лучший контроль в поворотах",
    color: "#9fff77",
    stats: { maxSpeed: 214, accel: 318, drag: 1.25, turnRate: 3.0, offroadPenalty: 0.67, mass: 1.0 },
    body: { segments: 16, spacing: 8.4, waveAmp: 3.2, waveFreq: 1.15, waveSpeed: 4.1, taper: 0.56 },
    venom: { range: 168, cooldownMs: 2450, slowMul: 0.86, durationMs: 1650, speed: 360 },
  },
  {
    id: "bully",
    name: "Bully",
    flavor: "Тяжелый корпус, сильнее толчки",
    color: "#ff8c7c",
    stats: { maxSpeed: 206, accel: 292, drag: 1.18, turnRate: 2.3, offroadPenalty: 0.71, mass: 1.35 },
    body: { segments: 22, spacing: 8.8, waveAmp: 2.6, waveFreq: 0.72, waveSpeed: 3.1, taper: 0.72 },
    venom: { range: 182, cooldownMs: 2520, slowMul: 0.83, durationMs: 1800, speed: 342 },
  },
  {
    id: "trickster",
    name: "Trickster",
    flavor: "Почти не теряет темп вне дороги",
    color: "#d6a7ff",
    stats: { maxSpeed: 222, accel: 305, drag: 1.22, turnRate: 2.72, offroadPenalty: 0.82, mass: 0.95 },
    body: { segments: 15, spacing: 7.1, waveAmp: 5.3, waveFreq: 1.32, waveSpeed: 6.0, taper: 0.52 },
    venom: { range: 212, cooldownMs: 2200, slowMul: 0.81, durationMs: 1900, speed: 372 },
  },
];

function snakeHeadTextureKey(snakeId) {
  return `snake_head_${snakeId}`;
}

function snakeSegmentTextureKey(snakeId) {
  return `snake_segment_${snakeId}`;
}

function snakeHeadTexturePath(snakeId) {
  return `${SNAKE_SPRITES_BASE_PATH}/${snakeId}/head.png`;
}

function snakeSegmentTexturePath(snakeId) {
  return `${SNAKE_SPRITES_BASE_PATH}/${snakeId}/segment.png`;
}

const PICKUP_TYPES = {
  BOOST: { name: "BOOST", color: "#44f084", durationMs: 2600 },
  SHIELD: { name: "SHIELD", color: "#63cfff", durationMs: 6500, charges: 1 },
  OIL: { name: "OIL", color: "#ffc45f", durationMs: 2200 },
  BOMB: { name: "BOMB", color: "#ff6975", durationMs: 1450, radius: 86 },
};

const PICKUP_ORDER = ["BOOST", "SHIELD", "OIL", "BOMB"];

const NPC_PROFILES = [
  { id: "careful", name: "аккуратный", speedFactor: 0.88, lookAhead: 130, steerGain: 2.2, brakeAngle: 0.48 },
  { id: "normal", name: "ровный", speedFactor: 0.95, lookAhead: 145, steerGain: 2.45, brakeAngle: 0.56 },
  { id: "aggressive", name: "агро", speedFactor: 1.02, lookAhead: 160, steerGain: 2.65, brakeAngle: 0.66 },
  { id: "maniac", name: "маньяк", speedFactor: 1.08, lookAhead: 172, steerGain: 2.85, brakeAngle: 0.76 },
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
  {
    id: "dune_orbit",
    name: "Dune Orbit",
    subtitle: "Песчаный овал с волной по дугам",
    roadWidth: 50,
    outsideWidth: 90,
    checkpointFractions: [0, 0.13, 0.24, 0.37, 0.51, 0.64, 0.78, 0.9],
    pickupFractions: [0.03, 0.11, 0.19, 0.28, 0.4, 0.53, 0.66, 0.74, 0.83, 0.92],
    createPoints: () => {
      const points = [];
      const steps = 210;
      for (let i = 0; i < steps; i += 1) {
        const t = (i / steps) * TAU;
        const x = 490 + Math.cos(t) * 330 + Math.cos(3 * t + 0.5) * 34;
        const y = 312 + Math.sin(t) * 190 + Math.sin(2 * t - 0.8) * 46 + Math.sin(5 * t) * 12;
        points.push({ x, y });
      }
      return points;
    },
  },
  {
    id: "neon_delta",
    name: "Neon Delta",
    subtitle: "Три прямых зоны и резкие связки",
    roadWidth: 49,
    outsideWidth: 88,
    checkpointFractions: [0, 0.1, 0.22, 0.35, 0.49, 0.61, 0.74, 0.87],
    pickupFractions: [0.05, 0.14, 0.23, 0.31, 0.43, 0.56, 0.67, 0.75, 0.86, 0.94],
    createPoints: () => {
      const points = [];
      const steps = 240;
      for (let i = 0; i < steps; i += 1) {
        const t = (i / steps) * TAU;
        const triangleX = Math.asin(Math.sin(t)) * (2 / Math.PI);
        const triangleY = Math.asin(Math.sin(t + 1.2)) * (2 / Math.PI);
        const x = 490 + triangleX * 315 + Math.sin(4 * t) * 26 + Math.cos(2 * t - 0.2) * 20;
        const y = 312 + triangleY * 170 + Math.sin(3 * t + 0.3) * 34;
        points.push({ x, y });
      }
      return points;
    },
  },
  {
    id: "volcano_spiral",
    name: "Вулканическая спираль",
    subtitle: "Узкие дуги и пульсирующие связки в поворотах",
    roadWidth: 50,
    outsideWidth: 90,
    checkpointFractions: [0, 0.09, 0.2, 0.32, 0.46, 0.6, 0.73, 0.86],
    pickupFractions: [0.04, 0.12, 0.18, 0.27, 0.38, 0.49, 0.58, 0.69, 0.81, 0.93],
    createPoints: () => {
      const points = [];
      const steps = 240;
      for (let i = 0; i < steps; i += 1) {
        const t = (i / steps) * TAU;
        const x = 490 + Math.cos(t) * 308 + Math.cos(2 * t + 1.1) * 76 + Math.sin(5 * t + 0.2) * 14;
        const y = 310 + Math.sin(t) * 176 + Math.sin(3 * t - 0.35) * 62 + Math.cos(4 * t + 0.6) * 11;
        points.push({ x, y });
      }
      return points;
    },
  },
  {
    id: "glacier_chicane",
    name: "Ледяная шикана",
    subtitle: "Длинные прямые с быстрыми шиканами и перекладками",
    roadWidth: 51,
    outsideWidth: 92,
    checkpointFractions: [0, 0.11, 0.23, 0.35, 0.48, 0.61, 0.74, 0.88],
    pickupFractions: [0.03, 0.14, 0.22, 0.3, 0.41, 0.52, 0.63, 0.72, 0.84, 0.95],
    createPoints: () => {
      const points = [];
      const steps = 250;
      for (let i = 0; i < steps; i += 1) {
        const t = (i / steps) * TAU;
        const triX = Math.asin(Math.sin(t)) * (2 / Math.PI);
        const triY = Math.asin(Math.sin(t + 1.5)) * (2 / Math.PI);
        const x = 490 + triX * 324 + Math.sin(3 * t + 0.15) * 34 + Math.cos(5 * t) * 10;
        const y = 312 + triY * 182 + Math.sin(2 * t + 0.65) * 28 + Math.sin(6 * t - 0.4) * 13;
        points.push({ x, y });
      }
      return points;
    },
  },
];

// -----------------------------
// DOM Handles and Global State
// -----------------------------
const ui = {
  screens: {
    main: document.getElementById("screen-main"),
    snake: document.getElementById("screen-snake"),
    track: document.getElementById("screen-track"),
    race: document.getElementById("screen-race"),
    results: document.getElementById("screen-results"),
  },
  snakeCards: document.getElementById("snake-cards"),
  modeClassic: document.getElementById("mode-classic"),
  modeDebug: document.getElementById("mode-debug"),
  modeNote: document.getElementById("mode-note"),
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
  lastFinishedTrackId: null,
  race: null,
  offlineMode: DEFAULT_OFFLINE_MODE,
  lastResults: [],
  keyMap: new Set(),
  toastTimeout: null,
  lastRestartAtMs: 0,
  phaserGame: null,
  raceScene: null,
  visibilityPolicyApplied: false,
  visibilityKeepAliveHandlers: null,
};

let cachedEstimatedRaceDurationMs = NaN;
let remoteRaceDurationStats = null;
let remoteRaceDurationFetchInFlight = false;
let remoteRaceDurationFetchRetryAfterMs = 0;
let remoteRaceDurationPostInFlight = false;

// -----------------------------
// App Bootstrap and UI Wiring
// -----------------------------
bootstrap();

function bootstrap() {
  initSnakeTitleWave();
  maybePrefetchRemoteRaceDurationStats();
  wireUi();
  renderSnakeCards();
  renderTrackCards();
  updateOfflineModeUi();
  showScreen("main");
  initPhaser();
}

function initSnakeTitleWave() {
  const title = document.querySelector(".app-header h1");
  if (!title || title.dataset.waveReady === "1") {
    return;
  }
  const text = title.textContent || "";
  const chars = [...text];
  title.textContent = "";
  title.classList.add("title-snake-wave");
  const allSpans = [];
  chars.forEach((char, index) => {
    const span = document.createElement("span");
    span.className = "title-wave-char";
    span.style.setProperty("--i", String(index));
    allSpans.push(span);
    span.dataset.char = char === " " ? "\u00A0" : char;
    if (char === " ") {
      span.classList.add("title-wave-space");
      span.textContent = "\u00A0";
    } else {
      span.textContent = char;
    }
    title.appendChild(span);
  });
  title.dataset.waveReady = "1";

  if (allSpans.length < 2) {
    return;
  }

  startSnakeTitleWave(title, allSpans);
}

function startSnakeTitleWave(title, letterSpans) {
  const waveAmplitudeX = 8;
  const verticalAmplitude = 4;
  const waveFrequency = 3.0;
  const wavePhaseShift = Math.PI * 0.45;
  const gap = 8;
  const logicalTimeScale = 2.5;

  let logicalTime = 0;
  let crawlElapsedMs = 0;
  let wasRaceScreen = false;
  let lastFrameMs = performance.now();

  const getSpanWidth = (span) => {
    const rectWidth = span.getBoundingClientRect().width;
    const offsetWidth = span.offsetWidth || 0;
    const measured = Math.max(rectWidth, offsetWidth);
    if (measured > 0.5) {
      return measured;
    }
    return span.classList.contains("title-wave-space") ? gap * 0.85 : 24;
  };

  const measure = () => {
    const header = title.closest(".app-header");
    const availableWidth = header ? header.clientWidth : window.innerWidth;
    const stageWidth = Math.max(320, Math.min(800, availableWidth - 16));
    title.style.setProperty("--wave-stage-width", `${stageWidth}px`);

    const letterWidths = letterSpans.map((span) => getSpanWidth(span));
    const yPos = title.clientHeight * 0.5;

    return { stageWidth, letterWidths, yPos };
  };

  const renderFrame = () => {
    const { stageWidth, letterWidths, yPos } = measure();
    const totalWidth = letterWidths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, letterSpans.length - 1);
    const centeredBaseX = (stageWidth - totalWidth) * 0.5;
    const inRaceScreen = state.currentScreen === "race";
    let currentBaseX = centeredBaseX;
    if (inRaceScreen) {
      const crawlDurationMs = getTitleCrawlDurationMs() * TITLE_CRAWL_SLOWDOWN_FACTOR;
      const progress = ((crawlElapsedMs % crawlDurationMs) + crawlDurationMs) % crawlDurationMs / crawlDurationMs;
      const startX = -totalWidth - TITLE_CRAWL_SIDE_PADDING;
      const endX = stageWidth + TITLE_CRAWL_SIDE_PADDING;
      currentBaseX = lerp(startX, endX, progress);
    }

    let currentX = currentBaseX;
    for (let i = 0; i < letterSpans.length; i += 1) {
      const phase = logicalTime * waveFrequency + i * wavePhaseShift;
      const sin1 = Math.sin(phase);
      const waveOffsetX = sin1 * waveAmplitudeX + 0.15 * sin1;
      const vertPhase = phase - Math.PI / 2;
      const waveOffsetY = Math.sin(vertPhase) * verticalAmplitude;

      const centerX = currentX + letterWidths[i] / 2 + waveOffsetX;
      const centerY = yPos + waveOffsetY;

      const span = letterSpans[i];
      span.style.left = `${centerX.toFixed(2)}px`;
      span.style.top = `${centerY.toFixed(2)}px`;

      currentX += letterWidths[i] + gap;
    }
  };

  const tick = (nowMs) => {
    const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastFrameMs) / 1000));
    lastFrameMs = nowMs;
    logicalTime += dt * logicalTimeScale;
    const inRaceScreen = state.currentScreen === "race";
    if (inRaceScreen) {
      if (!wasRaceScreen) {
        crawlElapsedMs = 0;
      }
      crawlElapsedMs += dt * 1000;
    }
    wasRaceScreen = inRaceScreen;
    renderFrame();

    requestAnimationFrame(tick);
  };

  renderFrame();
  if (document.fonts?.ready?.then) {
    document.fonts.ready.then(() => {
      renderFrame();
    });
  }
  requestAnimationFrame(tick);
}

function getTitleCrawlDurationMs() {
  const avgRaceMs = getAverageRaceDurationMs();
  return clamp(avgRaceMs * TITLE_CRAWL_DURATION_EXTRA_FACTOR, TITLE_CRAWL_MIN_DURATION_MS, TITLE_CRAWL_MAX_DURATION_MS);
}

function estimateAverageRaceDurationMs() {
  if (Number.isFinite(cachedEstimatedRaceDurationMs)) {
    return cachedEstimatedRaceDurationMs;
  }

  const avgTrackLength =
    TRACK_DEFS.reduce((sum, def) => sum + buildTrackRuntime(def).totalLength, 0) / Math.max(1, TRACK_DEFS.length);
  const avgSnakeMaxSpeed = SNAKES.reduce((sum, snake) => sum + snake.stats.maxSpeed, 0) / Math.max(1, SNAKES.length);
  const avgProfileSpeedFactor =
    NPC_PROFILES.reduce((sum, profile) => sum + profile.speedFactor, 0) / Math.max(1, NPC_PROFILES.length);
  const effectiveSpeed = Math.max(18, avgSnakeMaxSpeed * avgProfileSpeedFactor * TITLE_CRAWL_PACE_FACTOR);
  const estimatedMs = (avgTrackLength / effectiveSpeed) * 1000;
  cachedEstimatedRaceDurationMs = clamp(estimatedMs, TITLE_CRAWL_MIN_DURATION_MS, RACE_TIMEOUT_MS * 0.9);
  return cachedEstimatedRaceDurationMs;
}

function loadRaceDurationStats() {
  try {
    const raw = localStorage.getItem(TITLE_RACE_DURATION_STATS_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !Number.isFinite(parsed.meanMs)) {
      return null;
    }
    return {
      meanMs: clamp(parsed.meanMs, TITLE_CRAWL_MIN_DURATION_MS, TITLE_CRAWL_MAX_DURATION_MS),
      samples: Number.isFinite(parsed.samples) ? clamp(parsed.samples, 0, 999) : 0,
    };
  } catch (error) {
    return null;
  }
}

function saveRaceDurationStats(stats) {
  if (!stats || !Number.isFinite(stats.meanMs)) {
    return;
  }
  const payload = {
    meanMs: clamp(stats.meanMs, TITLE_CRAWL_MIN_DURATION_MS, TITLE_CRAWL_MAX_DURATION_MS),
    samples: Number.isFinite(stats.samples) ? clamp(Math.floor(stats.samples), 0, 999) : 0,
  };
  localStorage.setItem(TITLE_RACE_DURATION_STATS_KEY, JSON.stringify(payload));
}

function getMatchServerBaseUrl() {
  if (typeof window === "undefined" || !window.location) {
    return null;
  }
  const protocol = window.location.protocol || "http:";
  const hostname = window.location.hostname || "localhost";
  return `${protocol}//${hostname}:${MATCH_SERVER_PORT}`;
}

function getRemoteRaceDurationStatsUrl() {
  const base = getMatchServerBaseUrl();
  if (!base) {
    return null;
  }
  return `${base}${TITLE_REMOTE_STATS_PATH}`;
}

function normalizeRaceDurationStats(stats) {
  if (!stats || !Number.isFinite(stats.meanMs) || stats.meanMs <= 0) {
    return null;
  }
  return {
    meanMs: clamp(stats.meanMs, TITLE_CRAWL_MIN_DURATION_MS, TITLE_CRAWL_MAX_DURATION_MS),
    samples: Number.isFinite(stats.samples) ? clamp(Math.floor(stats.samples), 0, 999999) : 0,
  };
}

function maybePrefetchRemoteRaceDurationStats() {
  if (remoteRaceDurationStats || remoteRaceDurationFetchInFlight) {
    return;
  }
  if (Date.now() < remoteRaceDurationFetchRetryAfterMs) {
    return;
  }
  const url = getRemoteRaceDurationStatsUrl();
  if (!url || typeof fetch !== "function") {
    return;
  }

  remoteRaceDurationFetchInFlight = true;
  fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`remote_stats_${response.status}`);
      }
      return response.json();
    })
    .then((payload) => {
      const normalized = normalizeRaceDurationStats(payload);
      if (!normalized) {
        return;
      }
      remoteRaceDurationStats = normalized;
      saveRaceDurationStats(normalized);
      remoteRaceDurationFetchRetryAfterMs = 0;
    })
    .catch(() => {
      // Silent fallback to localStorage/estimate for standalone mode.
      remoteRaceDurationFetchRetryAfterMs = Date.now() + TITLE_REMOTE_STATS_RETRY_MS;
    })
    .finally(() => {
      remoteRaceDurationFetchInFlight = false;
    });
}

function postRaceDurationStatsSample(raceMeanMs) {
  if (!Number.isFinite(raceMeanMs) || raceMeanMs <= 0) {
    return;
  }
  if (remoteRaceDurationPostInFlight) {
    return;
  }

  const url = getRemoteRaceDurationStatsUrl();
  if (!url || typeof fetch !== "function") {
    return;
  }

  remoteRaceDurationPostInFlight = true;
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ raceMeanMs: Math.round(raceMeanMs) }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`remote_stats_post_${response.status}`);
      }
      return response.json();
    })
    .then((payload) => {
      const normalized = normalizeRaceDurationStats(payload);
      if (!normalized) {
        return;
      }
      remoteRaceDurationStats = normalized;
      saveRaceDurationStats(normalized);
    })
    .catch(() => {
      // Local stats already updated; network sync is optional.
    })
    .finally(() => {
      remoteRaceDurationPostInFlight = false;
    });
}

function getAverageRaceDurationMs() {
  if (remoteRaceDurationStats?.meanMs > 0) {
    return clamp(remoteRaceDurationStats.meanMs, TITLE_CRAWL_MIN_DURATION_MS, TITLE_CRAWL_MAX_DURATION_MS);
  }
  maybePrefetchRemoteRaceDurationStats();

  const saved = loadRaceDurationStats();
  if (saved && Number.isFinite(saved.meanMs)) {
    return saved.meanMs;
  }

  const bestTimes = TRACK_DEFS.map((track) => loadBestTime(track.id)).filter((time) => Number.isFinite(time) && time > 0);
  if (bestTimes.length >= 2) {
    const avgBest = bestTimes.reduce((sum, time) => sum + time, 0) / bestTimes.length;
    return clamp(avgBest, TITLE_CRAWL_MIN_DURATION_MS, TITLE_CRAWL_MAX_DURATION_MS);
  }

  return estimateAverageRaceDurationMs();
}

function updateRaceDurationStats(race) {
  if (!race?.racers?.length) {
    return;
  }
  const finishedTimes = race.racers.map((racer) => racer.finishTimeMs).filter((ms) => Number.isFinite(ms) && ms > 0);
  if (!finishedTimes.length) {
    return;
  }

  const raceMeanMs = finishedTimes.reduce((sum, ms) => sum + ms, 0) / finishedTimes.length;
  const prev = loadRaceDurationStats();
  let localNext = null;
  if (!prev || prev.samples <= 0 || !Number.isFinite(prev.meanMs)) {
    localNext = { meanMs: raceMeanMs, samples: 1 };
  } else {
    const meanMs = lerp(prev.meanMs, raceMeanMs, TITLE_CRAWL_EMA_ALPHA);
    localNext = { meanMs, samples: prev.samples + 1 };
  }
  saveRaceDurationStats(localNext);
  postRaceDurationStatsSample(raceMeanMs);
}

function isDebugMode() {
  return state.offlineMode === OFFLINE_MODES.DEBUG;
}

function setOfflineMode(mode) {
  state.offlineMode = mode;
  updateOfflineModeUi();
}

function updateOfflineModeUi() {
  const classicActive = state.offlineMode === OFFLINE_MODES.CLASSIC;
  if (ui.modeClassic) {
    ui.modeClassic.classList.toggle("mode-active", classicActive);
  }
  if (ui.modeDebug) {
    ui.modeDebug.classList.toggle("mode-active", !classicActive);
  }
  if (ui.modeNote) {
    ui.modeNote.textContent = classicActive
      ? "Режим PRD: вы управляете змеей, остальные 3 - боты."
      : "Режим отладки: все 4 змеи на автопилоте.";
  }
}

function initPhaser() {
  class RaceScene extends Phaser.Scene {
    constructor() {
      super("RaceScene");
      this.graphics = null;
      this.infoText = null;
      this.labelMap = new Map();
      this.spriteSupportMap = new Map();
      this.headSpriteMap = new Map();
      this.segmentSpriteMap = new Map();
      this.trackMusicMap = new Map();
    }

    preload() {
      for (const snake of SNAKES) {
        this.load.image(snakeHeadTextureKey(snake.id), snakeHeadTexturePath(snake.id));
        this.load.image(snakeSegmentTextureKey(snake.id), snakeSegmentTexturePath(snake.id));
      }
      for (const musicCfg of Object.values(TRACK_MUSIC)) {
        this.load.audio(musicCfg.key, musicCfg.path);
      }
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

      for (const snake of SNAKES) {
        this.spriteSupportMap.set(snake.id, {
          head: this.textures.exists(snakeHeadTextureKey(snake.id)),
          segment: this.textures.exists(snakeSegmentTextureKey(snake.id)),
        });
      }

      for (const [trackId, musicCfg] of Object.entries(TRACK_MUSIC)) {
        if (!this.cache.audio.exists(musicCfg.key)) {
          continue;
        }
        const trackMusic = this.sound.add(musicCfg.key, { volume: musicCfg.volume });
        trackMusic.setLoop(true);
        this.trackMusicMap.set(trackId, trackMusic);
      }

      applyBackgroundRunPolicy(this.game);
      state.raceScene = this;
      syncRaceMusic();
    }

    update(time, delta) {
      const dt = Math.min(0.033, Math.max(0.001, delta / 1000));
      const raceBeforeUpdate = state.race;
      if (!raceBeforeUpdate) {
        renderIdle(this);
        return;
      }

      updateRace(raceBeforeUpdate, time, dt);

      const raceAfterUpdate = state.race;
      if (raceAfterUpdate) {
        renderRace(this, raceAfterUpdate, time);
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
    fps: {
      forceSetTimeOut: true,
      target: 60,
      min: 5,
      panicMax: 120,
    },
    scene: [RaceScene],
  });
}

function applyBackgroundRunPolicy(game) {
  if (!game || state.visibilityPolicyApplied) {
    return;
  }

  const events = game.events;
  if (!events) {
    return;
  }

  // Disable Phaser auto-pause on hidden state and keep the loop alive.
  events.off(Phaser.Core.Events.HIDDEN, game.onHidden, game);
  events.off(Phaser.Core.Events.VISIBLE, game.onVisible, game);

  const onHiddenKeepAlive = () => {
    game.loop.blur();
  };
  const onVisibleKeepAlive = () => {
    game.loop.focus();
    events.emit(Phaser.Core.Events.RESUME, 0);
  };

  events.on(Phaser.Core.Events.HIDDEN, onHiddenKeepAlive);
  events.on(Phaser.Core.Events.VISIBLE, onVisibleKeepAlive);

  state.visibilityKeepAliveHandlers = { onHiddenKeepAlive, onVisibleKeepAlive };
  state.visibilityPolicyApplied = true;
}

function wireUi() {
  document.getElementById("btn-offline").addEventListener("click", () => showScreen("snake"));
  document.getElementById("btn-online").addEventListener("click", () => showToast("Онлайн модуль в следующем шаге (E3)."));
  document.getElementById("btn-leaderboards").addEventListener("click", () => showToast("Authoritative leaderboard будет добавлен через сервер."));
  document.getElementById("btn-settings").addEventListener("click", () => showToast("Настройки появятся после стабилизации core-loop."));

  if (ui.modeClassic) {
    ui.modeClassic.addEventListener("click", () => setOfflineMode(OFFLINE_MODES.CLASSIC));
  }
  if (ui.modeDebug) {
    ui.modeDebug.addEventListener("click", () => setOfflineMode(OFFLINE_MODES.DEBUG));
  }

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
    if (!TRACK_DEFS.length) {
      return;
    }
    const currentTrackId = state.lastFinishedTrackId || state.selectedTrackId || TRACK_DEFS[0].id;
    const nextTrack = getNextTrackDef(currentTrackId);
    state.selectedTrackId = nextTrack.id;
    startRace(nextTrack.id);
  });
  document.getElementById("results-back").addEventListener("click", () => {
    state.race = null;
    renderTrackCards();
    showScreen("main");
  });

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", () => {
    if (state.phaserGame) {
      state.phaserGame.scale.refresh();
    }
  });
}

function onKeyDown(event) {
  if (state.currentScreen === "race" && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code || event.key)) {
    event.preventDefault();
  }
  state.keyMap.add(event.code);
  const isRestartKey = event.code === "KeyR" || event.key === "r" || event.key === "R";
  const restartTrackId = state.race?.trackDef?.id || state.selectedTrackId;
  if (isRestartKey && state.currentScreen === "race" && restartTrackId) {
    event.preventDefault();
    const now = performance.now();
    if (now - state.lastRestartAtMs < RESTART_DEBOUNCE_MS) {
      return;
    }
    startRace(restartTrackId);
  }
}

function onKeyUp(event) {
  state.keyMap.delete(event.code);
}

function showScreen(name) {
  Object.entries(ui.screens).forEach(([id, node]) => node.classList.toggle("active", id === name));
  state.currentScreen = name;
  document.body.classList.toggle("race-screen-active", name === "race");
  if (name !== "race") {
    ui.overlay.classList.remove("visible");
  } else if (state.phaserGame) {
    setTimeout(() => {
      if (state.phaserGame) {
        state.phaserGame.scale.refresh();
      }
    }, 0);
  }
  syncRaceMusic();
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
        <li>Best local: ${Number.isFinite(best) ? formatMs(best) : "-"}</li>
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

function getTrackIndexById(trackId) {
  const idx = TRACK_DEFS.findIndex((track) => track.id === trackId);
  return idx >= 0 ? idx : 0;
}

function getNextTrackDef(currentTrackId) {
  const currentIndex = getTrackIndexById(currentTrackId);
  let next = TRACK_DEFS[(currentIndex + 1) % TRACK_DEFS.length];
  if (TRACK_DEFS.length > 1 && next.id === currentTrackId) {
    next = TRACK_DEFS[(currentIndex + 2) % TRACK_DEFS.length];
  }
  return next;
}

function startRace(trackId) {
  const trackDef = TRACK_DEFS.find((item) => item.id === trackId);
  if (!trackDef) {
    return false;
  }
  state.lastRestartAtMs = performance.now();
  state.selectedTrackId = trackDef.id;
  state.lastFinishedTrackId = null;
  state.keyMap.clear();
  const debugMode = isDebugMode();
  const selectedSnake = SNAKES.find((item) => item.id === state.selectedSnakeId) || SNAKES[0];
  const sceneNowMs = Number.isFinite(state.raceScene?.time?.now) ? state.raceScene.time.now : performance.now();
  state.race = createRaceState(trackDef, selectedSnake, debugMode, sceneNowMs);
  showScreen("race");
  syncRaceMusic();
  if (debugMode) {
    showToast("DEBUG: 4 бота на автопилоте. Быстрая отладка симуляции.");
  } else {
    showToast("Классический оффлайн: 1 игрок + 3 бота.");
  }
  return true;
}

function createRaceState(trackDef, selectedSnake, debugMode, startMs = performance.now()) {
  const track = buildTrackRuntime(trackDef);
  const racers = [];
  const slotOffsets = [-22, -8, 8, 22];
  const selectedForProbe = selectedSnake;
  const clockNowMs = Number.isFinite(startMs) ? startMs : performance.now();

  for (let i = 0; i < TOTAL_RACERS; i += 1) {
    const profile = NPC_PROFILES[i % NPC_PROFILES.length];
    const snake = i === 0 ? selectedForProbe : SNAKES[(i + 1) % SNAKES.length];
    const spawnFraction = mod1(0.992 - i * 0.008);
    const spawn = sampleTrack(track, spawnFraction);
    const normal = { x: -spawn.tangent.y, y: spawn.tangent.x };
    const offset = slotOffsets[i] || 0;

    const racer = {
      id: `racer_${i + 1}`,
      name: buildRacerDisplayName({
        snake,
        profile,
        isPlayer: !debugMode && i === 0,
        isProbe: debugMode && i === 0,
      }),
      typeId: snake.id,
      color: snake.color,
      stats: snake.stats,
      bodyConfig: snake.body,
      venomConfig: snake.venom,
      baseBodySegments: START_BODY_SEGMENTS,
      lengthBonusSegments: 0,
      profile,
      isPlayer: !debugMode && i === 0,
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
      history: [],
      bodySegments: [],
      bodyWaveSeed: Math.random() * TAU,
      lastProjection: null,
      impactUntilMs: 0,
      exhaustionSteps: 0,
      eliminationReason: null,
      nextHungerTickMs: 0,
      tailBiteCooldownUntilMs: 0,
      nextBodyCrossEffectAtMs: 0,
      stallWatch: null,
      unstuckUntilMs: 0,
      nextVenomShotAtMs: 0,
      nextBombHitAllowedAtMs: 0,
    };
    initializeRacerBodyHistory(racer);
    racers.push(racer);
  }

  const pickups = createPickups(track);
  const bodyItems = createBodyItems(track, pickups);

  return {
    trackDef,
    track,
    racers,
    pickups,
    bodyItems,
    venomShots: [],
    phase: "countdown",
    createdAtMs: clockNowMs,
    countdownStartMs: clockNowMs,
    raceStartMs: 0,
    bodyCrossingGraceUntilMs: 0,
    finishedAtMs: 0,
    overlayUntilMs: 0,
    focusRacerId: racers[0].id,
    standings: [],
    resultsPushed: false,
  };
}

function buildRacerDisplayName({ snake, profile, isPlayer, isProbe }) {
  const snakeToken = normalizeNameToken(snake?.id || "snake");
  if (isPlayer) {
    return `игрок_${snakeToken}`;
  }
  const profileSource = isProbe ? "проба" : profile?.name || profile?.id || "бот";
  const profileToken = normalizeNameToken(profileSource);
  return `бот_${profileToken}_${snakeToken}`;
}

function normalizeNameToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9а-яё_-]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
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

function createBodyItems(track, pickups) {
  const items = [];
  for (let i = 0; i < BODY_ITEM_COUNT; i += 1) {
    const item = {
      id: `body_item_${i + 1}`,
      type: Math.random() < 0.58 ? "APPLE" : "CACTUS",
      x: 0,
      y: 0,
      radius: 11,
      active: true,
      respawnAtMs: 0,
    };
    randomizeBodyItemPosition(item, track, items, pickups);
    items.push(item);
  }
  return items;
}

function randomizeBodyItemPosition(item, track, occupiedItems = [], pickups = []) {
  let chosen = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const sample = sampleTrack(track, Math.random());
    const side = Math.random() < 0.5 ? -1 : 1;
    const lateral = side * (Math.random() * track.roadWidth * 0.45);
    const normal = { x: -sample.tangent.y, y: sample.tangent.x };
    const x = sample.x + normal.x * lateral;
    const y = sample.y + normal.y * lateral;
    if (isBodyItemPositionValid(item, x, y, track, occupiedItems, pickups)) {
      chosen = { x, y };
      break;
    }
  }
  if (!chosen) {
    const sample = sampleTrack(track, Math.random());
    const normal = { x: -sample.tangent.y, y: sample.tangent.x };
    const side = Math.random() < 0.5 ? -1 : 1;
    const lateral = side * (Math.random() * track.roadWidth * 0.45);
    chosen = { x: sample.x + normal.x * lateral, y: sample.y + normal.y * lateral };
  }
  item.x = chosen.x;
  item.y = chosen.y;
  if (Math.random() < 0.35) {
    item.type = item.type === "APPLE" ? "CACTUS" : "APPLE";
  }
}

function isBodyItemPositionValid(item, x, y, track, occupiedItems, pickups) {
  for (let i = 0; i < track.checkpoints.length; i += 1) {
    const cp = track.checkpoints[i];
    const minDist = i === 0 ? BODY_ITEM_TO_START_CHECKPOINT_MIN_DIST : BODY_ITEM_TO_CHECKPOINT_MIN_DIST;
    if (sqrDistance(x, y, cp.x, cp.y) < minDist ** 2) {
      return false;
    }
  }
  for (const pickup of pickups) {
    if (sqrDistance(x, y, pickup.x, pickup.y) < BODY_ITEM_TO_PICKUP_MIN_DIST ** 2) {
      return false;
    }
  }
  for (const other of occupiedItems) {
    if (!other || other.id === item.id || !other.active) {
      continue;
    }
    if (sqrDistance(x, y, other.x, other.y) < BODY_ITEM_MIN_SEPARATION ** 2) {
      return false;
    }
  }
  return true;
}

function initializeRacerBodyHistory(racer) {
  racer.history.length = 0;
  const backX = -Math.cos(racer.heading);
  const backY = -Math.sin(racer.heading);
  for (let i = 0; i < 90; i += 1) {
    racer.history.push({
      x: racer.x + backX * i * 2.2,
      y: racer.y + backY * i * 2.2,
      heading: racer.heading,
    });
  }
  racer.bodySegments.length = 0;
}

// -----------------------------
// Race Loop and Simulation
// -----------------------------
function updateRace(race, nowMs, dt) {
  if (race.phase === "countdown") {
    const remain = Math.max(0, 3000 - (nowMs - race.countdownStartMs));
    if (remain <= 0) {
      race.phase = "running";
      race.raceStartMs = nowMs;
      race.bodyCrossingGraceUntilMs = nowMs + BODY_CROSSING_START_GRACE_MS;
      race.overlayUntilMs = nowMs + 700;
      for (const racer of race.racers) {
        racer.nextHungerTickMs = nowMs + STARVATION_DECAY_INTERVAL_MS;
        racer.speed = Math.max(racer.speed, racer.stats.maxSpeed * RACE_START_LAUNCH_SPEED_FACTOR);
        racer.nextBodyCrossEffectAtMs = nowMs + RACE_START_GHOST_MS;
        racer.impactUntilMs = nowMs + RACE_START_GHOST_MS;
        racer.unstuckUntilMs = nowMs + RACE_START_GHOST_MS;
        racer.stallWatch = null;
        ensureAlwaysMoveSpeed(racer);
      }
      ui.overlay.textContent = "GO";
      ui.overlay.classList.add("visible");
    } else {
      ui.overlay.textContent = String(Math.ceil(remain / 1000));
      ui.overlay.classList.add("visible");
    }
    updateBodySegmentsForRace(race, nowMs);
    updateHud(race, nowMs);
    return;
  }

  if (race.phase === "finished") {
    updateBodySegmentsForRace(race, nowMs);
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
  updateBodyItems(race, nowMs);

  for (const racer of race.racers) {
    if (racer.finished) {
      stepFinishedRacer(race, racer, dt);
      continue;
    }
    updateRacerHunger(racer, nowMs);
    if (racer.finished) {
      continue;
    }
    const control = racer.isPlayer ? readPlayerControl() : buildNpcControl(race, racer, nowMs);
    stepRacer(race, racer, control, nowMs, dt);
    applyBodyCrossingRules(race, racer, nowMs);
    preventRacerStall(race, racer, nowMs);
    maybeShootVenom(race, racer, control, nowMs);
    if (racer.finished) {
      continue;
    }
    updateCheckpointProgress(race, racer, nowMs);
    checkPickupCollection(race, racer, nowMs);
    checkBodyItemCollection(race, racer, nowMs);
  }

  updateVenomShots(race, nowMs, dt);
  resolveRacerCollisions(race, nowMs);
  updateBodySegmentsForRace(race, nowMs);
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

function stepFinishedRacer(race, racer, dt) {
  if (!racer || !race?.track) {
    return;
  }
  const projection = racer.lastProjection || projectOnTrack(race.track, racer.x, racer.y);
  racer.lastProjection = projection;
  const ahead = sampleTrack(race.track, mod1(projection.tNorm + FINISHED_COAST_LOOKAHEAD));
  const desiredHeading = Math.atan2(ahead.y - racer.y, ahead.x - racer.x);
  const angle = shortestAngle(racer.heading, desiredHeading);
  racer.heading = wrapAngle(racer.heading + clamp(angle, -1, 1) * FINISHED_COAST_STEER_GAIN * dt);

  const coastFloor = racer.stats.maxSpeed * FINISHED_COAST_SPEED_FACTOR;
  racer.speed = Math.max(racer.speed * 0.988, coastFloor);
  racer.x += Math.cos(racer.heading) * racer.speed * dt;
  racer.y += Math.sin(racer.heading) * racer.speed * dt;

  racer.trail.push({ x: racer.x, y: racer.y });
  if (racer.trail.length > 22) {
    racer.trail.shift();
  }

  racer.history.unshift({ x: racer.x, y: racer.y, heading: racer.heading });
  if (racer.history.length > MAX_HISTORY_POINTS) {
    racer.history.length = MAX_HISTORY_POINTS;
  }
  alignRacerHeadingToMotion(racer, 0.02, 16);

  const updatedProjection = projectOnTrack(race.track, racer.x, racer.y);
  if (updatedProjection) {
    racer.lastProjection = updatedProjection;
  }
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
  state.lastFinishedTrackId = race?.trackDef?.id || state.selectedTrackId;
  state.lastResults = ordered.map((racer, index) => ({
    rank: index + 1,
    name: racer.name,
    snake: racer.typeId,
    timeMs: racer.finishTimeMs,
  }));
  persistBestTimeFromRace(race);
  updateRaceDurationStats(race);
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
      <td>${Number.isFinite(row.timeMs) ? formatMs(row.timeMs) : DNF_LABEL}</td>
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

function updateBodyItems(race, nowMs) {
  for (const item of race.bodyItems) {
    if (!item.active && nowMs >= item.respawnAtMs) {
      item.active = true;
      randomizeBodyItemPosition(item, race.track, race.bodyItems, race.pickups);
    }
  }
}

function updateRacerHunger(racer, nowMs) {
  if (racer.finished) {
    return;
  }
  if (!Number.isFinite(racer.nextHungerTickMs) || racer.nextHungerTickMs <= 0) {
    racer.nextHungerTickMs = nowMs + STARVATION_DECAY_INTERVAL_MS;
    return;
  }

  while (nowMs >= racer.nextHungerTickMs && !racer.finished) {
    applyBodySegmentDelta(racer, -STARVATION_DECAY_SEGMENTS, nowMs, "STARVATION");
    racer.nextHungerTickMs += STARVATION_DECAY_INTERVAL_MS;
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

function checkBodyItemCollection(race, racer, nowMs) {
  for (const item of race.bodyItems) {
    if (!item.active) {
      continue;
    }
    const distSq = sqrDistance(racer.x, racer.y, item.x, item.y);
    if (distSq > (item.radius + 11) ** 2) {
      continue;
    }
    item.active = false;
    item.respawnAtMs = nowMs + BODY_ITEM_RESPAWN_MS;
    applyBodyItem(racer, item.type, nowMs);
  }
}

function applyBodyItem(racer, itemType, nowMs) {
  const delta = BODY_ITEMS[itemType]?.deltaSegments ?? 0;
  applyBodySegmentDelta(racer, delta, nowMs, itemType);
  if (itemType === "APPLE") {
    addEffect(racer, "APPLE_BOOST", APPLE_BOOST_DURATION_MS, nowMs, {
      speedMul: APPLE_BOOST_SPEED_MUL,
      accelMul: APPLE_BOOST_ACCEL_MUL,
    });
    const lowBodyMul = getLowBodySpeedFactor(racer);
    const exhaustionMul = getExhaustionSpeedFactor(racer);
    const instantFloor = racer.stats.maxSpeed * APPLE_BOOST_INSTANT_SPEED_FACTOR * lowBodyMul * exhaustionMul;
    racer.speed = Math.max(racer.speed, instantFloor);
    ensureAlwaysMoveSpeed(racer, lowBodyMul, exhaustionMul);
    racer.nextHungerTickMs = nowMs + STARVATION_DECAY_INTERVAL_MS;
  }
}

function getCurrentBodySegments(racer) {
  return clamp(racer.baseBodySegments + racer.lengthBonusSegments, MIN_BODY_SEGMENTS, MAX_BODY_SEGMENTS);
}

function applyBodySegmentDelta(racer, delta, nowMs, source = "UNKNOWN") {
  if (!Number.isFinite(delta) || delta === 0 || racer.finished) {
    return false;
  }

  const before = getCurrentBodySegments(racer);
  const minBonus = MIN_BODY_SEGMENTS - racer.baseBodySegments;
  const maxBonus = MAX_BODY_SEGMENTS - racer.baseBodySegments;
  racer.lengthBonusSegments = clamp(racer.lengthBonusSegments + delta, minBonus, maxBonus);
  const after = getCurrentBodySegments(racer);

  if (after < before && source === "STARVATION") {
    racer.exhaustionSteps = Math.max(0, (racer.exhaustionSteps || 0) + 1);
  } else if (after > before && source === "APPLE") {
    racer.exhaustionSteps = 0;
  }

  return after !== before;
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
      if (nowMs < (target.nextBombHitAllowedAtMs || 0)) {
        continue;
      }
      const distSq = sqrDistance(racer.x, racer.y, target.x, target.y);
      if (distSq > PICKUP_TYPES.BOMB.radius ** 2) {
        continue;
      }
      target.nextBombHitAllowedAtMs = nowMs + BOMB_HIT_IMMUNITY_MS;
      if (target.shieldCharges > 0) {
        target.shieldCharges -= 1;
        removeEffect(target, "SHIELD");
      } else {
        applyBodySegmentDelta(target, -1, nowMs, "BOMB");
        addEffect(target, "BOMB_SLOW", PICKUP_TYPES.BOMB.durationMs, nowMs);
        const lowBodyMul = getLowBodySpeedFactor(target);
        const exhaustionMul = getExhaustionSpeedFactor(target);
        const bombFloor = target.stats.maxSpeed * BOMB_RECOVERY_SPEED_FACTOR * lowBodyMul * exhaustionMul;
        target.speed = Math.max(target.speed, bombFloor);
        ensureAlwaysMoveSpeed(target, lowBodyMul, exhaustionMul);
      }
    }
  }
}

function addEffect(racer, type, durationMs, nowMs, extra = null) {
  removeEffect(racer, type);
  const effect = { type, untilMs: nowMs + durationMs };
  if (extra && typeof extra === "object") {
    Object.assign(effect, extra);
  }
  racer.effects.push(effect);
}

function removeEffect(racer, type) {
  racer.effects = racer.effects.filter((effect) => effect.type !== type);
}

function updateBodySegmentsForRace(race, nowMs) {
  for (const racer of race.racers) {
    updateRacerBodySegments(racer, nowMs);
  }
}

function getRacerMotionHeading(racer, minStep = 0.04, maxLookback = 12) {
  if (!racer?.history || racer.history.length < 2) {
    return null;
  }
  const head = racer.history[0];
  const minDistSq = Math.max(0.0001, minStep * minStep);
  const maxIndex = Math.min(racer.history.length - 1, Math.max(1, Math.floor(maxLookback)));

  for (let i = 1; i <= maxIndex; i += 1) {
    const prev = racer.history[i];
    const dx = head.x - prev.x;
    const dy = head.y - prev.y;
    if (dx * dx + dy * dy < minDistSq) {
      continue;
    }
    return wrapAngle(Math.atan2(dy, dx));
  }

  return null;
}

function alignRacerHeadingToMotion(racer, minStep = 0.04, maxLookback = 12) {
  const motionHeading = getRacerMotionHeading(racer, minStep, maxLookback);
  if (!Number.isFinite(motionHeading)) {
    return false;
  }
  racer.heading = motionHeading;
  if (racer.history?.length) {
    racer.history[0].heading = motionHeading;
  }
  return true;
}

function updateRacerBodySegments(racer, nowMs) {
  const cfg = racer.bodyConfig || { segments: 14, spacing: 8, waveAmp: 3.5, waveFreq: 1, waveSpeed: 4.2, taper: 0.6 };
  const required = getCurrentBodySegments(racer);
  const spacing = Math.max(5, cfg.spacing);
  const waveTime = nowMs * 0.001 * cfg.waveSpeed + racer.bodyWaveSeed;
  const segments = [];
  let targetDist = spacing;
  let traversed = 0;

  // Keep head orientation strictly aligned with actual displacement.
  alignRacerHeadingToMotion(racer, 0.03, 18);

  if (racer.history.length < 2) {
    racer.bodySegments = segments;
    return;
  }

  for (let i = 1; i < racer.history.length && segments.length < required; i += 1) {
    const prev = racer.history[i - 1];
    const curr = racer.history[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const pieceLen = Math.hypot(dx, dy);
    if (pieceLen < 0.001) {
      continue;
    }

    while (traversed + pieceLen >= targetDist && segments.length < required) {
      const t = (targetDist - traversed) / pieceLen;
      const baseX = lerp(prev.x, curr.x, t);
      const baseY = lerp(prev.y, curr.y, t);
      const heading = Math.atan2(prev.y - curr.y, prev.x - curr.x);
      const idx = segments.length + 1;
      const fade = 1 - idx / required;
      const wave = Math.sin(waveTime + idx * cfg.waveFreq) * cfg.waveAmp * (0.45 + fade * 0.55);
      const nx = -Math.sin(heading);
      const ny = Math.cos(heading);
      const radius = 2.6 + fade * 5.4 * cfg.taper;
      segments.push({
        x: baseX + nx * wave,
        y: baseY + ny * wave,
        heading,
        radius,
        alpha: 0.2 + fade * 0.68,
      });
      targetDist += spacing;
    }

    traversed += pieceLen;
  }

  racer.bodySegments = segments;
}

function stepRacer(race, racer, control, nowMs, dt) {
  racer.effects = racer.effects.filter((effect) => effect.untilMs > nowMs);

  const projection = projectOnTrack(race.track, racer.x, racer.y);
  racer.lastProjection = projection;
  racer.surface = projection.distance <= race.track.roadWidth ? "road" : projection.distance <= race.track.outsideWidth ? "offroad" : "outside";

  const modifiers = getRacerModifiers(racer);
  const outsideNow = racer.surface === "outside";
  const offroadNow = racer.surface === "offroad" || outsideNow;
  let surfaceMul = offroadNow ? racer.stats.offroadPenalty * OFFROAD_EXTRA_SLOWDOWN : 1;
  if (outsideNow) {
    surfaceMul *= OUTSIDE_EXTRA_SLOWDOWN;
  }
  const lowBodyMul = getLowBodySpeedFactor(racer);
  const exhaustionMul = getExhaustionSpeedFactor(racer);

  const maxSpeed = racer.stats.maxSpeed * surfaceMul * modifiers.speedMul * racer.profile.speedFactor * lowBodyMul * exhaustionMul;
  const accel = racer.stats.accel * surfaceMul * modifiers.accelMul * lowBodyMul * exhaustionMul;
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
  ensureAlwaysMoveSpeed(racer, lowBodyMul, exhaustionMul);
  ensureBombSlowFloorSpeed(racer, lowBodyMul, exhaustionMul);
  ensureOutsideCrawlSpeed(racer, lowBodyMul, exhaustionMul);

  const speedRatio = clamp(maxSpeed > 0 ? racer.speed / maxSpeed : 0, 0, 1);
  const turnRate = racer.stats.turnRate * modifiers.turnMul * (1 - speedRatio * 0.35);
  racer.heading = wrapAngle(racer.heading + turnInput * turnRate * dt);

  if (outsideNow && projection) {
    const toTrackHeading = Math.atan2(projection.y - racer.y, projection.x - racer.x);
    const recoverTurn = clamp(shortestAngle(racer.heading, toTrackHeading), -1, 1);
    racer.heading = wrapAngle(racer.heading + recoverTurn * OUTSIDE_RECOVERY_STEER_GAIN * dt);
  }

  racer.x += Math.cos(racer.heading) * racer.speed * dt;
  racer.y += Math.sin(racer.heading) * racer.speed * dt;

  if (outsideNow && projection) {
    const toTrackX = projection.x - racer.x;
    const toTrackY = projection.y - racer.y;
    const toTrackLen = Math.hypot(toTrackX, toTrackY);
    if (toTrackLen > 0.001) {
      const pullStep = Math.min(OUTSIDE_RECOVERY_PULL_SPEED * dt, toTrackLen);
      racer.x += (toTrackX / toTrackLen) * pullStep;
      racer.y += (toTrackY / toTrackLen) * pullStep;
    }
  }

  const updatedProjection = projectOnTrack(race.track, racer.x, racer.y);
  if (updatedProjection) {
    racer.lastProjection = updatedProjection;
    racer.surface =
      updatedProjection.distance <= race.track.roadWidth
        ? "road"
        : updatedProjection.distance <= race.track.outsideWidth
          ? "offroad"
          : "outside";
  }

  racer.trail.push({ x: racer.x, y: racer.y });
  if (racer.trail.length > 22) {
    racer.trail.shift();
  }

  racer.history.unshift({ x: racer.x, y: racer.y, heading: racer.heading });
  if (racer.history.length > MAX_HISTORY_POINTS) {
    racer.history.length = MAX_HISTORY_POINTS;
  }
}

function shouldNeverStop(racer) {
  if (!racer || racer.finished) {
    return false;
  }
  if ((racer.exhaustionSteps || 0) >= EXHAUSTION_CRAWL_THRESHOLD) {
    return true;
  }
  if (!racer.isPlayer) {
    return true;
  }
  return ALWAYS_MOVE_SNAKE_IDS.has(racer.typeId);
}

function getLowBodySpeedFactor(racer) {
  return getCurrentBodySegments(racer) < CRITICAL_SEGMENTS_THRESHOLD ? CRITICAL_SEGMENTS_SLOWDOWN : 1;
}

function getExhaustionSpeedFactor(racer) {
  const steps = Math.max(0, racer?.exhaustionSteps || 0);
  if (steps <= 0) {
    return 1;
  }
  if (steps >= EXHAUSTION_CRAWL_THRESHOLD) {
    return EXHAUSTION_CRAWL_SPEED_FACTOR;
  }
  return clamp(1 - steps * EXHAUSTION_SLOWDOWN_PER_STEP, EXHAUSTION_SLOWDOWN_MIN_FACTOR, 1);
}

function ensureAlwaysMoveSpeed(
  racer,
  lowBodyMul = getLowBodySpeedFactor(racer),
  exhaustionMul = getExhaustionSpeedFactor(racer),
) {
  if (!shouldNeverStop(racer)) {
    return;
  }
  const baseFloor = ALWAYS_MOVE_MIN_SPEED * lowBodyMul * exhaustionMul;
  let floor = racer.surface !== "road" ? baseFloor * ALWAYS_MOVE_OFFROAD_FACTOR : baseFloor;
  if (racer.surface === "outside") {
    floor *= OUTSIDE_EXTRA_SLOWDOWN;
  }
  racer.speed = Math.max(racer.speed, floor);
}

function ensureBombSlowFloorSpeed(
  racer,
  lowBodyMul = getLowBodySpeedFactor(racer),
  exhaustionMul = getExhaustionSpeedFactor(racer),
) {
  if (!racer.effects?.some((effect) => effect.type === "BOMB_SLOW")) {
    return;
  }
  const baseFloor = racer.stats.maxSpeed * BOMB_RECOVERY_SPEED_FACTOR * lowBodyMul * exhaustionMul;
  let floor = racer.surface !== "road" ? baseFloor * ALWAYS_MOVE_OFFROAD_FACTOR : baseFloor;
  if (racer.surface === "outside") {
    floor *= OUTSIDE_EXTRA_SLOWDOWN;
  }
  racer.speed = Math.max(racer.speed, floor);
}

function ensureOutsideCrawlSpeed(
  racer,
  lowBodyMul = getLowBodySpeedFactor(racer),
  exhaustionMul = getExhaustionSpeedFactor(racer),
) {
  if (racer.surface !== "outside" || racer.finished) {
    return;
  }
  const floor = Math.max(OUTSIDE_MIN_CRAWL_SPEED, racer.stats.maxSpeed * 0.08) * lowBodyMul * exhaustionMul;
  racer.speed = Math.max(racer.speed, floor);
}

function getRacerModifiers(racer) {
  let speedMul = 1;
  let accelMul = 1;
  let turnMul = 1;
  const bodyInfluence = getBodyInfluence(racer);
  for (const effect of racer.effects) {
    if (effect.type === "BOOST") {
      speedMul *= 1 + (1.34 - 1) * bodyInfluence.beneficialScale;
      accelMul *= 1 + (1.18 - 1) * bodyInfluence.beneficialScale;
    } else if (effect.type === "APPLE_BOOST") {
      speedMul *= 1 + ((effect.speedMul ?? APPLE_BOOST_SPEED_MUL) - 1) * bodyInfluence.beneficialScale;
      accelMul *= 1 + ((effect.accelMul ?? APPLE_BOOST_ACCEL_MUL) - 1) * bodyInfluence.beneficialScale;
    } else if (effect.type === "OIL") {
      turnMul *= applyHarmfulMitigation(0.64, bodyInfluence.harmfulMitigation);
      accelMul *= applyHarmfulMitigation(0.82, bodyInfluence.harmfulMitigation);
    } else if (effect.type === "BOMB_SLOW") {
      speedMul *= applyHarmfulMitigation(0.84, bodyInfluence.harmfulMitigation);
      accelMul *= applyHarmfulMitigation(0.86, bodyInfluence.harmfulMitigation);
      turnMul *= applyHarmfulMitigation(0.93, bodyInfluence.harmfulMitigation);
    } else if (effect.type === "VENOM_SLOW") {
      speedMul *= applyHarmfulMitigation(effect.speedMul ?? 0.86, bodyInfluence.harmfulMitigation);
      accelMul *= applyHarmfulMitigation((effect.speedMul ?? 0.86) * 0.98, bodyInfluence.harmfulMitigation);
      turnMul *= applyHarmfulMitigation(0.93, bodyInfluence.harmfulMitigation);
    }
  }
  return { speedMul, accelMul, turnMul };
}

function getBodyInfluence(racer) {
  const base = Math.max(START_BODY_SEGMENTS, racer.baseBodySegments || START_BODY_SEGMENTS);
  const current = getCurrentBodySegments(racer);
  const ratio = (current - base) / base;
  const beneficialScale = 1 + Math.max(0, ratio) * 0.9;
  const harmfulMitigation = clamp(Math.max(0, -ratio) * 0.95, 0, 0.8);
  return { beneficialScale, harmfulMitigation, currentSegments: current };
}

function applyHarmfulMitigation(baseMultiplier, harmfulMitigation) {
  const penalty = 1 - baseMultiplier;
  const mitigatedPenalty = penalty * (1 - harmfulMitigation);
  return 1 - mitigatedPenalty;
}

function buildNpcControl(race, racer, nowMs) {
  const projection = racer.lastProjection || projectOnTrack(race.track, racer.x, racer.y);
  const lookAheadDistance = racer.profile.lookAhead + racer.speed * 0.32;
  const targetFraction = mod1(projection.tNorm + lookAheadDistance / race.track.totalLength);
  const trackTarget = sampleTrack(race.track, targetFraction);
  const appleTarget = findNpcAppleTarget(race, racer, projection);
  const blendedTarget = blendNpcTarget(trackTarget, appleTarget, racer);
  const hazardAvoidance = findNpcHazardAvoidance(race, racer, projection);
  const edgeAvoidance = findNpcEdgeAvoidance(race, racer, projection);
  const hazardTarget = applyNpcHazardAvoidanceTarget(race, blendedTarget, hazardAvoidance);
  let target = hazardTarget;
  if (edgeAvoidance?.target) {
    const edgeBlend = lerp(0.62, 0.99, edgeAvoidance.intensity);
    target = {
      x: lerp(target.x, edgeAvoidance.target.x, edgeBlend),
      y: lerp(target.y, edgeAvoidance.target.y, edgeBlend),
    };
  }
  const appleAttraction = getNpcAppleAttraction(racer);
  const hazardIntensity = hazardAvoidance?.intensity || 0;
  const edgeIntensity = edgeAvoidance?.intensity || 0;
  const caution = clamp(hazardIntensity * 0.7 + edgeIntensity * 1.4, 0, 1);
  const desiredHeading = Math.atan2(target.y - racer.y, target.x - racer.x);
  const angle = shortestAngle(racer.heading, desiredHeading);
  const neverStop = shouldNeverStop(racer);

  let throttle = 1;
  let brake = 0;
  if (Math.abs(angle) > racer.profile.brakeAngle) {
    throttle = 0.42;
    brake = 0.26;
  }
  if (racer.surface !== "road") {
    throttle = Math.min(throttle, racer.surface === "outside" ? 0.46 : 0.66);
    brake = Math.max(brake, racer.surface === "outside" ? 0.32 : 0.16);
  }
  const underBombSlow = racer.effects.some((effect) => effect.type === "BOMB_SLOW");
  if (underBombSlow) {
    throttle = Math.max(throttle, 0.82);
    brake = Math.max(brake, 0.06);
  }
  if (appleAttraction > 0 && caution < 0.34 && edgeIntensity < 0.22) {
    throttle = Math.max(throttle, lerp(0.9, 1, appleAttraction));
    brake = Math.min(brake, lerp(0.14, 0, appleAttraction));
  }
  if (caution > 0) {
    throttle = Math.min(throttle, lerp(0.84, 0.34, caution));
    brake = Math.max(brake, lerp(0.08, 0.42, caution));
  }
  if (edgeIntensity > 0.35) {
    throttle = Math.min(throttle, 0.62);
    brake = Math.max(brake, 0.14);
  }
  if (edgeIntensity > 0.58) {
    throttle = Math.min(throttle, 0.44);
    brake = Math.max(brake, 0.26);
  }
  if (edgeIntensity > 0.78) {
    throttle = Math.min(throttle, 0.28);
    brake = Math.max(brake, 0.42);
  }
  if (racer.speed < 12) {
    if (caution < 0.55) {
      throttle = Math.max(throttle, 0.92);
      brake = 0;
    } else {
      throttle = Math.max(throttle, 0.7);
      brake = Math.max(brake, 0.12);
    }
  }
  if (neverStop) {
    const cautiousMode = caution >= 0.2 || racer.surface !== "road";
    if (!cautiousMode) {
      throttle = Math.max(throttle, 0.96);
      brake = 0;
      if (racer.speed < ALWAYS_MOVE_MIN_SPEED * 0.7) {
        throttle = 1;
      }
    } else {
      throttle = Math.max(throttle, edgeIntensity > 0.62 ? 0.34 : 0.5);
      brake = Math.max(brake, lerp(0.1, 0.34, clamp(caution + edgeIntensity * 0.32, 0, 1)));
    }
  }

  const steerGain = racer.profile.steerGain * (1 + caution * 0.65 + edgeIntensity * 0.9);
  const spit = canNpcShootVenom(race, racer, nowMs);

  return {
    throttle: clamp(throttle, 0, 1),
    brake: clamp(brake, 0, 1),
    turn: clamp(angle * steerGain, -1, 1),
    spit,
  };
}

function getNpcAppleAttraction(racer) {
  if (!racer) {
    return 0;
  }
  const hungerSteps = Math.max(0, racer.exhaustionSteps || 0);
  const hungerAttraction = clamp(hungerSteps / 5, 0, 1);
  const bodySegments = getCurrentBodySegments(racer);
  const emergencyBonus = bodySegments <= MIN_BODY_SEGMENTS + 1 ? 0.18 : 0;
  return clamp(hungerAttraction + emergencyBonus, 0, 1);
}

function findNpcAppleTarget(race, racer, racerProjection) {
  const bodySegments = getCurrentBodySegments(racer);
  const attraction = getNpcAppleAttraction(racer);
  if (attraction <= 0.02 && bodySegments >= racer.baseBodySegments + 2) {
    return null;
  }
  const startCheckpoint = race.track.checkpoints?.[0];
  const maxForwardDelta = lerp(0.18, 0.42, attraction);
  const maxDistance = lerp(235, 520, attraction);
  const forwardWeight = lerp(0.75, 0.34, attraction);
  const distanceNorm = lerp(850, 1300, attraction);
  let best = null;
  for (const item of race.bodyItems) {
    if (!item.active || item.type !== "APPLE") {
      continue;
    }
    if (startCheckpoint && sqrDistance(item.x, item.y, startCheckpoint.x, startCheckpoint.y) < APPLE_STARTLINE_AVOID_RADIUS ** 2) {
      continue;
    }
    const itemProjection = projectOnTrack(race.track, item.x, item.y);
    const forwardDelta = forwardTrackDelta(racerProjection.tNorm, itemProjection.tNorm);
    if (forwardDelta <= 0.0001 || forwardDelta > maxForwardDelta) {
      continue;
    }
    const dist = Math.hypot(item.x - racer.x, item.y - racer.y);
    if (dist > maxDistance) {
      continue;
    }
    const score = forwardDelta * forwardWeight + dist / distanceNorm;
    if (!best || score < best.score) {
      best = { item, score, dist };
    }
  }
  return best ? best.item : null;
}

function blendNpcTarget(trackTarget, appleTarget, racer) {
  if (!appleTarget) {
    return trackTarget;
  }
  const attraction = getNpcAppleAttraction(racer);
  const appleDist = Math.hypot(appleTarget.x - racer.x, appleTarget.y - racer.y);
  const maxDistance = lerp(300, 700, attraction);
  const minWeight = lerp(0.1, 0.72, attraction);
  const maxWeight = lerp(0.44, 0.95, attraction);
  const appleWeight = clamp(1 - appleDist / maxDistance, minWeight, maxWeight);
  return {
    x: lerp(trackTarget.x, appleTarget.x, appleWeight),
    y: lerp(trackTarget.y, appleTarget.y, appleWeight),
  };
}

function findNpcHazardAvoidance(race, racer, racerProjection) {
  if (!race?.track || !racer || !racerProjection) {
    return { x: 0, y: 0, intensity: 0 };
  }

  let avoidX = 0;
  let avoidY = 0;
  let totalInfluence = 0;

  const hazards = [];
  for (const pickup of race.pickups) {
    if (pickup.active && pickup.type === "BOMB") {
      hazards.push({
        x: pickup.x,
        y: pickup.y,
        radius: NPC_BOMB_AVOID_RADIUS,
        weight: NPC_BOMB_AVOID_WEIGHT,
      });
    }
  }
  for (const item of race.bodyItems) {
    if (item.active && item.type === "CACTUS") {
      hazards.push({
        x: item.x,
        y: item.y,
        radius: NPC_CACTUS_AVOID_RADIUS,
        weight: NPC_CACTUS_AVOID_WEIGHT,
      });
    }
  }

  for (const hazard of hazards) {
    const hazardProjection = projectOnTrack(race.track, hazard.x, hazard.y);
    if (!hazardProjection) {
      continue;
    }

    const forwardDelta = forwardTrackDelta(racerProjection.tNorm, hazardProjection.tNorm);
    if (forwardDelta <= 0.0001 || forwardDelta > NPC_HAZARD_LOOKAHEAD_DELTA) {
      continue;
    }

    const dist = Math.hypot(racer.x - hazard.x, racer.y - hazard.y);
    if (dist >= hazard.radius) {
      continue;
    }

    const distanceFactor = 1 - dist / hazard.radius;
    const forwardFactor = 1 - forwardDelta / NPC_HAZARD_LOOKAHEAD_DELTA;
    const influence = hazard.weight * distanceFactor * forwardFactor;
    if (influence <= 0) {
      continue;
    }

    const repel = normalizeVec(racer.x - hazard.x, racer.y - hazard.y);
    avoidX += repel.x * influence;
    avoidY += repel.y * influence;
    totalInfluence += influence;
  }

  if (totalInfluence <= 0.0001) {
    return { x: 0, y: 0, intensity: 0 };
  }

  const dir = normalizeVec(avoidX, avoidY);
  const intensity = clamp(totalInfluence / (NPC_BOMB_AVOID_WEIGHT + NPC_CACTUS_AVOID_WEIGHT), 0, 1);
  return {
    x: dir.x,
    y: dir.y,
    intensity,
  };
}

function applyNpcHazardAvoidanceTarget(race, target, hazardAvoidance) {
  if (!target || !hazardAvoidance || hazardAvoidance.intensity <= 0) {
    return target;
  }

  const shift = NPC_HAZARD_AVOID_MAX_SHIFT * hazardAvoidance.intensity;
  const shiftedX = target.x + hazardAvoidance.x * shift;
  const shiftedY = target.y + hazardAvoidance.y * shift;

  const projection = projectOnTrack(race.track, shiftedX, shiftedY);
  if (!projection) {
    return { x: shiftedX, y: shiftedY };
  }
  const normal = { x: -projection.tangent.y, y: projection.tangent.x };
  const dx = shiftedX - projection.x;
  const dy = shiftedY - projection.y;
  const lateral = clamp(dx * normal.x + dy * normal.y, -race.track.roadWidth * 0.74, race.track.roadWidth * 0.74);
  return {
    x: projection.x + normal.x * lateral,
    y: projection.y + normal.y * lateral,
  };
}

function findNpcEdgeAvoidance(race, racer, racerProjection) {
  if (!race?.track || !racerProjection) {
    return { target: null, intensity: 0 };
  }

  const cautionStart = race.track.roadWidth * NPC_EDGE_CAUTION_START_RATIO;
  const range = Math.max(1, race.track.outsideWidth - cautionStart);
  const raw = clamp((racerProjection.distance - cautionStart) / range, 0, 1);
  let intensity = clamp(Math.pow(raw, 0.62) * 1.08, 0, 1);
  if (racer.surface === "outside") {
    intensity = 1;
  } else if (racer.surface === "offroad") {
    intensity = Math.max(intensity, 0.68);
  }
  if (intensity <= 0.001) {
    return { target: null, intensity: 0 };
  }

  const ahead = sampleTrack(race.track, mod1(racerProjection.tNorm + NPC_EDGE_AVOID_LOOKAHEAD + intensity * 0.018));
  const normal = { x: -ahead.tangent.y, y: ahead.tangent.x };
  const dx = racer.x - ahead.x;
  const dy = racer.y - ahead.y;
  const lateral = dx * normal.x + dy * normal.y;
  const lateralSign = Math.sign(lateral) || 1;
  const headingX = Math.cos(racer.heading);
  const headingY = Math.sin(racer.heading);
  const outwardNormalX = normal.x * lateralSign;
  const outwardNormalY = normal.y * lateralSign;
  const outwardDot = headingX * outwardNormalX + headingY * outwardNormalY;
  if (outwardDot > 0) {
    intensity = clamp(intensity + outwardDot * 0.26, 0, 1);
  }

  const safeLimit = lerp(race.track.roadWidth * 0.52, race.track.roadWidth * 0.16, intensity);
  const safeLateral = clamp(lateral, -safeLimit, safeLimit);
  const laneTarget = {
    x: ahead.x + normal.x * safeLateral,
    y: ahead.y + normal.y * safeLateral,
  };
  const centerBlend = lerp(0.54, 0.96, intensity);

  return {
    target: {
      x: lerp(laneTarget.x, ahead.x, centerBlend),
      y: lerp(laneTarget.y, ahead.y, centerBlend),
    },
    intensity,
  };
}

function getVenomConfig(racer) {
  const base = racer.venomConfig || {};
  return {
    range: clamp(base.range ?? 150, 90, 260),
    cooldownMs: clamp(base.cooldownMs ?? 2400, 900, 6000),
    slowMul: clamp(base.slowMul ?? 0.86, 0.65, 0.95),
    durationMs: clamp(base.durationMs ?? VENOM_SLOW_BASE_DURATION_MS, 800, 4200),
    speed: clamp(base.speed ?? VENOM_PROJECTILE_SPEED, 240, 520),
  };
}

function canNpcShootVenom(race, racer, nowMs) {
  if (racer.finished || race.phase !== "running") {
    return false;
  }
  if (racer.speed < 18 || race.racers.length < 2) {
    return false;
  }
  if (nowMs < (racer.nextVenomShotAtMs || 0)) {
    return false;
  }
  const venom = getVenomConfig(racer);
  return Boolean(findVenomTarget(race, racer, venom.range));
}

function findVenomTarget(race, racer, range) {
  let best = null;
  const lookCos = Math.cos(0.56);
  const hx = Math.cos(racer.heading);
  const hy = Math.sin(racer.heading);

  for (const target of race.racers) {
    if (target.id === racer.id || target.finished) {
      continue;
    }
    const dx = target.x - racer.x;
    const dy = target.y - racer.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range || dist < 4) {
      continue;
    }
    const nx = dx / dist;
    const ny = dy / dist;
    const facingDot = hx * nx + hy * ny;
    if (facingDot < lookCos) {
      continue;
    }
    const score = dist - facingDot * 16;
    if (!best || score < best.score) {
      best = { target, score };
    }
  }
  return best ? best.target : null;
}

function maybeShootVenom(race, racer, control, nowMs) {
  if (!control?.spit || racer.finished || race.phase !== "running") {
    return;
  }
  if (nowMs < (racer.nextVenomShotAtMs || 0)) {
    return;
  }
  const venom = getVenomConfig(racer);
  racer.nextVenomShotAtMs = nowMs + venom.cooldownMs;

  const shot = {
    id: `venom_${racer.id}_${Math.floor(nowMs)}_${Math.floor(Math.random() * 9999)}`,
    ownerId: racer.id,
    x: racer.x + Math.cos(racer.heading) * 13,
    y: racer.y + Math.sin(racer.heading) * 13,
    vx: Math.cos(racer.heading),
    vy: Math.sin(racer.heading),
    speed: venom.speed,
    radius: VENOM_PROJECTILE_RADIUS,
    bornAtMs: nowMs,
    maxLifeMs: VENOM_PROJECTILE_MAX_LIFE_MS,
    maxTravelDist: venom.range,
    traveledDist: 0,
    durationMs: venom.durationMs,
    slowMul: venom.slowMul,
    color: hexToInt(racer.color),
  };

  race.venomShots.push(shot);
}

function updateVenomShots(race, nowMs, dt) {
  if (!race.venomShots || !race.venomShots.length) {
    return;
  }

  for (let i = race.venomShots.length - 1; i >= 0; i -= 1) {
    const shot = race.venomShots[i];
    if (nowMs - shot.bornAtMs > shot.maxLifeMs || shot.traveledDist >= shot.maxTravelDist) {
      race.venomShots.splice(i, 1);
      continue;
    }

    const step = shot.speed * dt;
    shot.x += shot.vx * step;
    shot.y += shot.vy * step;
    shot.traveledDist += Math.abs(step);

    const projection = projectOnTrack(race.track, shot.x, shot.y);
    if (!projection || projection.distance > race.track.outsideWidth * 1.15) {
      race.venomShots.splice(i, 1);
      continue;
    }

    let hitTarget = null;
    for (const target of race.racers) {
      if (target.id === shot.ownerId || target.finished) {
        continue;
      }
      if (sqrDistance(shot.x, shot.y, target.x, target.y) <= (shot.radius + VENOM_PROJECTILE_HIT_RADIUS) ** 2) {
        hitTarget = target;
        break;
      }
    }

    if (!hitTarget) {
      continue;
    }

    applyVenomHit(hitTarget, shot, nowMs);
    race.venomShots.splice(i, 1);
  }
}

function applyVenomHit(target, shot, nowMs) {
  if (target.shieldCharges > 0) {
    target.shieldCharges -= 1;
    removeEffect(target, "SHIELD");
    return;
  }
  addEffect(target, "VENOM_SLOW", shot.durationMs, nowMs, { speedMul: shot.slowMul });
}

function applyBodyCrossingRules(race, racer, nowMs) {
  if (racer.finished) {
    return;
  }
  if (nowMs < (racer.unstuckUntilMs || 0)) {
    return;
  }
  if (nowMs < (race.bodyCrossingGraceUntilMs || 0)) {
    return;
  }

  const headRadius = 10;
  for (const other of race.racers) {
    if (other.id === racer.id || other.finished || nowMs < (other.unstuckUntilMs || 0) || !other.bodySegments?.length) {
      continue;
    }

    const tail = other.bodySegments[other.bodySegments.length - 1];
    if (
      racer.typeId === "trickster" &&
      tail &&
      nowMs >= (racer.tailBiteCooldownUntilMs || 0) &&
      sqrDistance(racer.x, racer.y, tail.x, tail.y) <= (headRadius + tail.radius + 2) ** 2
    ) {
      const bitten = applyBodySegmentDelta(other, -1, nowMs, "BITE");
      if (bitten) {
        racer.tailBiteCooldownUntilMs = nowMs + 900;
      }
    }

    for (const segment of other.bodySegments) {
      const limit = headRadius + segment.radius;
      const dx = racer.x - segment.x;
      const dy = racer.y - segment.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > limit * limit) {
        continue;
      }

      if (racer.typeId === "speedster") {
        const dist = Math.sqrt(Math.max(0.0001, distSq));
        const nx = dx / dist;
        const ny = dy / dist;
        const push = limit + Math.max(2, SPEEDSTER_BODY_BLOCK_PUSH * 0.5);
        racer.x = segment.x + nx * push;
        racer.y = segment.y + ny * push;
        const tangentSign = Math.sign(shortestAngle(racer.heading, segment.heading || racer.heading)) || 1;
        racer.heading = wrapAngle(racer.heading + SPEEDSTER_BLOCK_EXTRA_TURN * tangentSign);
        const projection = racer.lastProjection || projectOnTrack(race.track, racer.x, racer.y);
        const ahead = sampleTrack(race.track, mod1(projection.tNorm + 0.011));
        const forwardHeading = Math.atan2(ahead.y - racer.y, ahead.x - racer.x);
        racer.heading = wrapAngle(racer.heading + shortestAngle(racer.heading, forwardHeading) * 0.55);
        racer.x += Math.cos(racer.heading) * (SPEEDSTER_BLOCK_NUDGE + 1.5);
        racer.y += Math.sin(racer.heading) * (SPEEDSTER_BLOCK_NUDGE + 1.5);
        if (nowMs >= (racer.nextBodyCrossEffectAtMs || 0)) {
          racer.speed *= 0.96;
          racer.nextBodyCrossEffectAtMs = nowMs + BODY_CROSSING_EFFECT_COOLDOWN_MS;
        }
        ensureAlwaysMoveSpeed(racer);
      } else if (racer.typeId === CROSS_ACCEL_SNAKE_ID) {
        if (nowMs >= (racer.nextBodyCrossEffectAtMs || 0)) {
          racer.speed = Math.min(racer.speed * 1.08, racer.stats.maxSpeed * 1.18);
          racer.nextBodyCrossEffectAtMs = nowMs + BODY_CROSSING_EFFECT_COOLDOWN_MS;
        }
        ensureAlwaysMoveSpeed(racer);
      } else {
        if (nowMs >= (racer.nextBodyCrossEffectAtMs || 0)) {
          racer.speed *= BODY_CROSS_SLOWDOWN_MUL;
          racer.nextBodyCrossEffectAtMs = nowMs + BODY_CROSSING_EFFECT_COOLDOWN_MS;
        }
        ensureAlwaysMoveSpeed(racer);
      }
      break;
    }
  }
}

function preventRacerStall(race, racer, nowMs) {
  if (racer.finished || race.phase !== "running") {
    return;
  }

  const projection = racer.lastProjection || projectOnTrack(race.track, racer.x, racer.y);
  racer.lastProjection = projection;
  ensureAlwaysMoveSpeed(racer);

  if (!racer.stallWatch) {
    racer.stallWatch = {
      x: racer.x,
      y: racer.y,
      progressT: projection.tNorm,
      lastMoveAtMs: nowMs,
      lastProgressAtMs: nowMs,
      lastUnstuckAtMs: 0,
    };
    return;
  }

  const watch = racer.stallWatch;
  const movedSq = sqrDistance(racer.x, racer.y, watch.x, watch.y);
  const progressDelta = signedTrackDelta(watch.progressT, projection.tNorm);
  const movedEnough = movedSq >= STALL_MOVEMENT_EPSILON_SQ;
  const madeForwardProgress = progressDelta >= STALL_PROGRESS_EPSILON;

  if (movedEnough) {
    watch.x = racer.x;
    watch.y = racer.y;
    watch.lastMoveAtMs = nowMs;
  }
  if (madeForwardProgress) {
    watch.progressT = projection.tNorm;
    watch.lastProgressAtMs = nowMs;
  }

  const noProgressForMs = nowMs - (watch.lastProgressAtMs || watch.lastMoveAtMs);
  const noMovementForMs = nowMs - watch.lastMoveAtMs;
  const hardDeadlock = noProgressForMs >= STALL_NO_PROGRESS_WINDOW_MS;

  if (!hardDeadlock && noMovementForMs < STALL_CHECK_WINDOW_MS) {
    return;
  }
  if (movedEnough && !hardDeadlock) {
    return;
  }
  if (nowMs - watch.lastUnstuckAtMs < STALL_UNSTUCK_COOLDOWN_MS) {
    return;
  }

  const lookAhead = hardDeadlock ? STALL_HARD_UNSTUCK_LOOKAHEAD : STALL_UNSTUCK_LOOKAHEAD;
  const ahead = sampleTrack(race.track, mod1(projection.tNorm + lookAhead));
  const normal = { x: -ahead.tangent.y, y: ahead.tangent.x };
  let laneSign = Number.parseInt(racer.id.replace(/\D+/g, ""), 10) % 2 === 0 ? 1 : -1;
  if (hardDeadlock) {
    laneSign *= Math.floor(nowMs / STALL_NO_PROGRESS_WINDOW_MS) % 2 === 0 ? 1 : -1;
  }
  const lateral = Math.min(race.track.roadWidth * 0.16, 9) * laneSign;
  racer.x = ahead.x + normal.x * lateral;
  racer.y = ahead.y + normal.y * lateral;
  racer.heading = Math.atan2(ahead.tangent.y, ahead.tangent.x);
  const nudgeFactor = hardDeadlock ? 0.95 : 0.45;
  racer.x += Math.cos(racer.heading) * (STALL_UNSTUCK_NUDGE * nudgeFactor);
  racer.y += Math.sin(racer.heading) * (STALL_UNSTUCK_NUDGE * nudgeFactor);

  const forcedSpeed = shouldNeverStop(racer)
    ? Math.max(ALWAYS_MOVE_MIN_SPEED * (hardDeadlock ? 1.24 : 1.08), racer.stats.maxSpeed * (hardDeadlock ? 0.3 : 0.22))
    : Math.max(16, racer.stats.maxSpeed * (hardDeadlock ? 0.22 : 0.14));
  racer.speed = Math.max(racer.speed, forcedSpeed);
  const ghostMs = hardDeadlock ? STALL_HARD_UNSTUCK_GHOST_MS : STALL_UNSTUCK_GHOST_MS;
  racer.nextBodyCrossEffectAtMs = nowMs + ghostMs;
  racer.impactUntilMs = nowMs + ghostMs;
  racer.unstuckUntilMs = nowMs + ghostMs;
  racer.trail.length = 0;
  initializeRacerBodyHistory(racer);

  watch.x = racer.x;
  watch.y = racer.y;
  watch.progressT = ahead.fraction;
  watch.lastMoveAtMs = nowMs;
  watch.lastProgressAtMs = nowMs;
  watch.lastUnstuckAtMs = nowMs;
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
    spit: state.keyMap.has("Space"),
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
      if (nowMs < (a.unstuckUntilMs || 0) || nowMs < (b.unstuckUntilMs || 0)) {
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

      const aIsBully = a.typeId === "bully";
      const bIsBully = b.typeId === "bully";
      if (aIsBully && !bIsBully) {
        b.x += nx * BULLY_PUSH_DISTANCE;
        b.y += ny * BULLY_PUSH_DISTANCE;
      } else if (bIsBully && !aIsBully) {
        a.x -= nx * BULLY_PUSH_DISTANCE;
        a.y -= ny * BULLY_PUSH_DISTANCE;
      }

      if (nowMs < a.impactUntilMs || nowMs < b.impactUntilMs) {
        continue;
      }
      a.impactUntilMs = nowMs + 220;
      b.impactUntilMs = nowMs + 220;
      if (!aIsBully) {
        applyCollisionPenalty(a);
      }
      if (!bIsBully) {
        applyCollisionPenalty(b);
      }
    }
  }

  for (const racer of race.racers) {
    if (racer.history && racer.history.length) {
      racer.history[0].x = racer.x;
      racer.history[0].y = racer.y;
      racer.history[0].heading = racer.heading;
      alignRacerHeadingToMotion(racer, 0.02, 18);
    }
  }
}

function applyCollisionPenalty(racer) {
  if (racer.shieldCharges > 0) {
    racer.shieldCharges -= 1;
    removeEffect(racer, "SHIELD");
    return;
  }
  racer.speed *= shouldNeverStop(racer) ? 0.9 : 0.72;
  ensureAlwaysMoveSpeed(racer);
}

function updateCheckpointProgress(race, racer, nowMs) {
  const checkpoints = race.track.checkpoints;
  const startCheckpoint = checkpoints[0];
  const startDist = Math.hypot(startCheckpoint.x - racer.x, startCheckpoint.y - racer.y);

  if (racer.readyToFinish && startDist <= race.track.checkpointRadius && nowMs - race.raceStartMs > 4500) {
    racer.finished = true;
    racer.finishTimeMs = Math.max(0, nowMs - race.raceStartMs + racer.timePenaltyMs);
    racer.speed = Math.max(racer.speed, racer.stats.maxSpeed * FINISHED_COAST_SPEED_FACTOR);
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
  const finished = race.racers
    .filter((racer) => racer.finished && Number.isFinite(racer.finishTimeMs))
    .sort((a, b) => a.finishTimeMs - b.finishTimeMs);
  const active = race.racers
    .filter((racer) => !racer.finished)
    .sort((a, b) => b.progressScore - a.progressScore);
  const dnf = race.racers.filter((racer) => racer.finished && !Number.isFinite(racer.finishTimeMs));
  return [...finished, ...active, ...dnf];
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
  ui.timer.textContent = Number.isFinite(timerMs) ? formatMs(timerMs) : DNF_LABEL;

  const kmh = Math.round(focus.speed * 1.92);
  ui.speed.textContent = `${kmh} km/h`;

  const rank = standings.findIndex((racer) => racer.id === focus.id) + 1;
  ui.position.textContent = `P${Math.max(1, rank)}/${TOTAL_RACERS} (${focus.name})`;
  const bodySegments = getBodyInfluence(focus).currentSegments;
  const hungerSteps = focus.exhaustionSteps || 0;
  const hungerLabel =
    hungerSteps >= EXHAUSTION_CRAWL_THRESHOLD ? `голод: ${hungerSteps} (ползком)` : `голод: ${hungerSteps}`;
  ui.effect.textContent = `${readActiveEffectLabel(focus)} | тело: ${bodySegments} | ${hungerLabel}`;

  ui.standings.innerHTML = "";
  standings.forEach((racer) => {
    const li = document.createElement("li");
    const tail = racer.finished
      ? Number.isFinite(racer.finishTimeMs)
        ? formatMs(racer.finishTimeMs)
        : racer.eliminationReason || DNF_LABEL
      : "в гонке";
    li.textContent = `${racer.name} - ${tail}`;
    ui.standings.appendChild(li);
  });
}

function readActiveEffectLabel(racer) {
  if (racer.finished && racer.eliminationReason) {
    return racer.eliminationReason;
  }
  if (racer.shieldCharges > 0) {
    return `Щит x${racer.shieldCharges}`;
  }
  if (!racer.effects.length) {
    return "нет";
  }
  const top = racer.effects.reduce((acc, item) => (item.untilMs > acc.untilMs ? item : acc), racer.effects[0]);
  if (top.type === "BOMB_SLOW") {
    return "Бомба: замедление";
  }
  if (top.type === "BOOST") {
    return "Ускорение";
  }
  if (top.type === "APPLE_BOOST") {
    return "Яблочный рывок";
  }
  if (top.type === "OIL") {
    return "Масло";
  }
  if (top.type === "VENOM_SLOW") {
    return "Яд";
  }
  if (top.type === "SHIELD") {
    return "Щит";
  }
  return top.type;
}

// -----------------------------
// Rendering
// -----------------------------
function renderRace(scene, race, nowMs) {
  const g = scene.graphics;
  drawBackground(g);
  drawTrack(g, race.track);
  drawCheckpoints(g, race.track);
  drawBodyItems(g, race.bodyItems);
  drawPickups(g, race.pickups);
  drawVenomShots(g, race.venomShots || []);
  drawRacers(scene, g, race.racers);
  syncRacerRenderSprites(scene, race.racers, true);
  syncRacerLabels(scene, race.racers, true);

  const phaseText = race.phase === "countdown" ? "Отсчет" : race.phase === "running" ? "Гонка" : "Финиш";
  scene.infoText.setVisible(true);
  scene.infoText.setText([
    `Трасса: ${race.trackDef.name}`,
    `Фаза: ${phaseText}`,
    `Время: ${formatMs(Math.max(0, nowMs - race.raceStartMs))}`,
  ]);
}

function renderIdle(scene) {
  drawBackground(scene.graphics);
  scene.infoText.setVisible(false);
  syncRacerRenderSprites(scene, [], false);
  syncRacerLabels(scene, [], false);
}

function drawBackground(g) {
  g.clear();
  // Grass base with warmer tint for a more natural terrain look.
  g.fillGradientStyle(0x264827, 0x264827, 0x1d381f, 0x1d381f, 1);
  g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  g.fillStyle(0x335d2f, 0.22);
  g.fillEllipse(CANVAS_WIDTH * 0.24, CANVAS_HEIGHT * 0.2, 360, 240);
  g.fillEllipse(CANVAS_WIDTH * 0.74, CANVAS_HEIGHT * 0.25, 300, 220);
  g.fillEllipse(CANVAS_WIDTH * 0.62, CANVAS_HEIGHT * 0.74, 420, 260);
  g.fillStyle(0x1a311a, 0.18);
  g.fillEllipse(CANVAS_WIDTH * 0.45, CANVAS_HEIGHT * 0.46, 300, 170);
}

function drawTrack(g, track) {
  // Outer verge (grass shoulder).
  g.lineStyle((track.outsideWidth + 16) * 2, 0x3f6d33, 0.38);
  strokeClosedPolyline(g, track.points);

  // Dirt layer between grass and asphalt.
  g.lineStyle(track.outsideWidth * 2, 0x8d6c45, 0.78);
  strokeClosedPolyline(g, track.points);

  // Dusty edge to soften transition into asphalt.
  g.lineStyle((track.roadWidth + 6) * 2, 0x8f7d61, 0.34);
  strokeClosedPolyline(g, track.points);

  // Asphalt.
  g.lineStyle(track.roadWidth * 2, 0x5c5d59, 0.95);
  strokeClosedPolyline(g, track.points);

  // Center marking.
  g.lineStyle(2, 0xf2dc9a, 0.76);
  drawDashedPolyline(g, track.points, 11, 11);
}

function strokeClosedPolyline(g, points) {
  if (!points.length) {
    return;
  }
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    g.lineTo(points[i].x, points[i].y);
  }
  g.lineTo(points[0].x, points[0].y);
  g.strokePath();
}

function drawDashedPolyline(g, points, dash, gap) {
  if (points.length < 2) {
    return;
  }
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) {
      continue;
    }
    const nx = dx / len;
    const ny = dy / len;
    let pos = 0;
    let paint = true;
    while (pos < len) {
      const segLen = Math.min(paint ? dash : gap, len - pos);
      if (paint) {
        const x1 = a.x + nx * pos;
        const y1 = a.y + ny * pos;
        const x2 = a.x + nx * (pos + segLen);
        const y2 = a.y + ny * (pos + segLen);
        g.lineBetween(x1, y1, x2, y2);
      }
      pos += segLen;
      paint = !paint;
    }
  }
}

function drawCheckpoints(g, track) {
  for (let i = 0; i < track.checkpoints.length; i += 1) {
    const cp = track.checkpoints[i];
    g.fillStyle(i === 0 ? 0xff6565 : 0x62dbff, i === 0 ? 0.9 : 0.85);
    g.fillCircle(cp.x, cp.y, i === 0 ? 8 : 6);
  }
}

function drawBodyItems(g, bodyItems) {
  for (const item of bodyItems) {
    if (!item.active) {
      continue;
    }
    if (item.type === "APPLE") {
      drawApple(g, item.x, item.y, item.radius);
    } else {
      drawCactus(g, item.x, item.y, item.radius);
    }
  }
}

function drawApple(g, x, y, radius) {
  g.fillStyle(hexToInt(BODY_ITEMS.APPLE.color), 0.95);
  g.fillCircle(x, y, radius * 0.9);
  g.fillStyle(0x8d2e35, 0.34);
  g.fillCircle(x + radius * 0.28, y - radius * 0.1, radius * 0.28);
  g.lineStyle(2, 0x6b4a2d, 1);
  g.lineBetween(x, y - radius, x + 2, y - radius - 7);
  g.fillStyle(0x67d275, 0.95);
  g.fillEllipse(x + 6, y - radius - 6, 8, 5);
}

function drawCactus(g, x, y, radius) {
  const color = hexToInt(BODY_ITEMS.CACTUS.color);
  const h = radius * 1.8;
  const arm = radius * 0.9;
  g.fillStyle(color, 0.95);
  g.fillRoundedRect(x - radius * 0.35, y - h * 0.5, radius * 0.7, h, 3);
  g.fillRoundedRect(x - arm, y - h * 0.2, arm * 0.65, radius * 0.5, 3);
  g.fillRoundedRect(x + radius * 0.35, y - h * 0.06, arm * 0.65, radius * 0.5, 3);
  g.lineStyle(1, 0x2f874f, 0.95);
  g.lineBetween(x - radius * 0.12, y - h * 0.45, x - radius * 0.12, y + h * 0.43);
  g.lineBetween(x + radius * 0.12, y - h * 0.45, x + radius * 0.12, y + h * 0.43);
}

function drawPickups(g, pickups) {
  for (const pickup of pickups) {
    if (!pickup.active) {
      continue;
    }
    const color = hexToInt(PICKUP_TYPES[pickup.type].color);
    const size = 7;
    g.fillStyle(color, 1);
    g.fillPoints(
      [
        { x: pickup.x, y: pickup.y - size },
        { x: pickup.x + size, y: pickup.y },
        { x: pickup.x, y: pickup.y + size },
        { x: pickup.x - size, y: pickup.y },
      ],
      true
    );
  }
}

function drawVenomShots(g, venomShots) {
  for (const shot of venomShots) {
    const base = shot.color || 0x8df36a;
    g.fillStyle(base, 0.88);
    g.fillCircle(shot.x, shot.y, shot.radius);
    g.lineStyle(1, 0xeaffdf, 0.78);
    g.strokeCircle(shot.x, shot.y, shot.radius + 1.8);
  }
}

function drawRacers(scene, g, racers) {
  racers.forEach((racer) => {
    if (!supportsSnakeSegmentSprite(scene, racer.typeId)) {
      drawBodySegments(g, racer);
    }
    drawTrail(g, racer);
  });
  racers.forEach((racer) => {
    if (!supportsSnakeHeadSprite(scene, racer.typeId)) {
      drawRacerBody(g, racer);
    }
  });
}

function supportsSnakeHeadSprite(scene, snakeId) {
  const support = scene.spriteSupportMap?.get(snakeId);
  return Boolean(support && support.head);
}

function supportsSnakeSegmentSprite(scene, snakeId) {
  const support = scene.spriteSupportMap?.get(snakeId);
  return Boolean(support && support.segment);
}

function syncRacerRenderSprites(scene, racers, visible) {
  const live = new Set();

  for (const racer of racers) {
    live.add(racer.id);
    syncRacerHeadSprite(scene, racer, visible);
    syncRacerSegmentSprites(scene, racer, visible);
  }

  scene.headSpriteMap.forEach((sprite, racerId) => {
    if (!live.has(racerId) || !visible) {
      sprite.setVisible(false);
    }
  });

  scene.segmentSpriteMap.forEach((pool, racerId) => {
    if (!live.has(racerId) || !visible) {
      for (const sprite of pool) {
        sprite.setVisible(false);
      }
    }
  });
}

function syncRacerHeadSprite(scene, racer, visible) {
  if (!supportsSnakeHeadSprite(scene, racer.typeId)) {
    const existing = scene.headSpriteMap.get(racer.id);
    if (existing) {
      existing.setVisible(false);
    }
    return;
  }

  const key = snakeHeadTextureKey(racer.typeId);
  let sprite = scene.headSpriteMap.get(racer.id);
  if (!sprite) {
    sprite = scene.add.image(0, 0, key).setDepth(23);
    sprite.setOrigin(0.5, 0.5);
    scene.headSpriteMap.set(racer.id, sprite);
  } else if (sprite.texture.key !== key) {
    sprite.setTexture(key);
  }

  sprite.setVisible(visible);
  sprite.setPosition(racer.x, racer.y);
  const renderHeading = getRacerMotionHeading(racer, 0.02, 16) ?? racer.heading;
  sprite.setRotation(renderHeading);
  const headSize = 28;
  sprite.setDisplaySize(headSize, headSize);
  sprite.setAlpha(1);
}

function syncRacerSegmentSprites(scene, racer, visible) {
  let pool = scene.segmentSpriteMap.get(racer.id);
  if (!pool) {
    pool = [];
    scene.segmentSpriteMap.set(racer.id, pool);
  }

  if (!supportsSnakeSegmentSprite(scene, racer.typeId)) {
    for (const sprite of pool) {
      sprite.setVisible(false);
    }
    return;
  }

  const key = snakeSegmentTextureKey(racer.typeId);
  const segments = racer.bodySegments || [];

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    let sprite = pool[i];
    if (!sprite) {
      sprite = scene.add.image(0, 0, key).setDepth(17);
      sprite.setOrigin(0.5, 0.5);
      pool.push(sprite);
    } else if (sprite.texture.key !== key) {
      sprite.setTexture(key);
    }

    sprite.setVisible(visible);
    sprite.setPosition(segment.x, segment.y);
    // Segment sprite must face opposite to movement (tail direction).
    sprite.setRotation(wrapAngle(segment.heading + Math.PI));
    const size = Math.max(4, segment.radius * 2.25 * SEGMENT_RENDER_SCALE);
    sprite.setDisplaySize(size, size);
    sprite.setAlpha(segment.alpha);
  }

  for (let i = segments.length; i < pool.length; i += 1) {
    pool[i].setVisible(false);
  }
}

function drawBodySegments(g, racer) {
  if (!racer.bodySegments || !racer.bodySegments.length) {
    return;
  }
  const color = hexToInt(racer.color);
  for (let i = racer.bodySegments.length - 1; i >= 0; i -= 1) {
    const segment = racer.bodySegments[i];
    g.fillStyle(color, segment.alpha);
    g.fillCircle(segment.x, segment.y, segment.radius * SEGMENT_RENDER_SCALE);
  }
}

function drawTrail(g, racer) {
  if (!racer.trail.length) {
    return;
  }
  const color = hexToInt(racer.color);
  for (let i = 0; i < racer.trail.length; i += 1) {
    const point = racer.trail[i];
    const alpha = i / racer.trail.length;
    const radius = 3 + alpha * 4;
    g.fillStyle(color, 0.05 + alpha * 0.12);
    g.fillCircle(point.x, point.y, radius);
  }
}

function drawRacerBody(g, racer) {
  const renderHeading = getRacerMotionHeading(racer, 0.02, 16) ?? racer.heading;
  const p1 = rotatePoint(15, 0, renderHeading, racer.x, racer.y);
  const p2 = rotatePoint(-11, 8, renderHeading, racer.x, racer.y);
  const p3 = rotatePoint(-6, 0, renderHeading, racer.x, racer.y);
  const p4 = rotatePoint(-11, -8, renderHeading, racer.x, racer.y);

  g.fillStyle(hexToInt(racer.color), 1);
  g.fillPoints([p1, p2, p3, p4], true);

  g.lineStyle(1.3, 0x080a0e, 0.65);
  g.beginPath();
  g.moveTo(p1.x, p1.y);
  g.lineTo(p2.x, p2.y);
  g.lineTo(p3.x, p3.y);
  g.lineTo(p4.x, p4.y);
  g.closePath();
  g.strokePath();

  if (racer.shieldCharges > 0) {
    g.lineStyle(2, 0x63cfff, 0.86);
    g.strokeCircle(racer.x, racer.y, 16);
  }
}

function rotatePoint(localX, localY, angle, baseX, baseY) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: baseX + localX * c - localY * s,
    y: baseY + localX * s + localY * c,
  };
}

function syncRacerLabels(scene, racers, visible) {
  const live = new Set();
  for (const racer of racers) {
    let label = scene.labelMap.get(racer.id);
    if (!label) {
      label = scene.add
        .text(0, 0, "", {
          fontFamily: "\"Exo 2\", sans-serif",
          fontSize: "12px",
          color: "#e9f2ff",
          stroke: "#0a1020",
          strokeThickness: 2,
        })
        .setDepth(25);
      scene.labelMap.set(racer.id, label);
    }
    label.setVisible(visible);
    label.setText(racer.name);
    label.setPosition(racer.x - 24, racer.y - 26);
    live.add(racer.id);
  }

  scene.labelMap.forEach((label, id) => {
    if (!live.has(id) || !visible) {
      label.setVisible(false);
    }
  });
}

// -----------------------------
// Track Geometry and Utilities
// -----------------------------
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
    return DNF_LABEL;
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

function syncRaceMusic() {
  const scene = state.raceScene;
  if (!scene || !scene.trackMusicMap || !scene.trackMusicMap.size) {
    return;
  }
  const activeTrackId = state.currentScreen === "race" && state.race?.trackDef?.id ? state.race.trackDef.id : null;

  scene.trackMusicMap.forEach((music, trackId) => {
    if (!music) {
      return;
    }
    const shouldPlay = activeTrackId === trackId;
    if (shouldPlay) {
      if (!music.loop) {
        music.setLoop(true);
      }
      if (!music.isPlaying) {
        try {
          const cfg = TRACK_MUSIC[trackId];
          music.play({ loop: true, volume: cfg?.volume ?? music.volume ?? 1 });
        } catch (error) {
          console.warn("[audio] track music play failed:", error);
        }
      }
    } else if (music.isPlaying) {
      music.stop();
    }
  });
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

function forwardTrackDelta(fromNorm, toNorm) {
  return toNorm >= fromNorm ? toNorm - fromNorm : 1 - fromNorm + toNorm;
}

function signedTrackDelta(fromNorm, toNorm) {
  let delta = toNorm - fromNorm;
  if (delta > 0.5) {
    delta -= 1;
  } else if (delta < -0.5) {
    delta += 1;
  }
  return delta;
}

function hexToInt(hex) {
  const c = hex.replace("#", "");
  const value = c.length === 3 ? c.split("").map((part) => `${part}${part}`).join("") : c;
  return Number.parseInt(value, 16);
}
