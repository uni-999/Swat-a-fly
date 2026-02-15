import {
  TOTAL_RACERS,
  OFFLINE_MODES,
  DEFAULT_OFFLINE_MODE,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TAU,
  RACE_TIMEOUT_MS,
  PICKUP_RESPAWN_MS,
  STORAGE_PREFIX,
  OFFROAD_EXTRA_SLOWDOWN,
  MAX_HISTORY_POINTS,
  BODY_ITEM_COUNT,
  BODY_ITEM_RESPAWN_MS,
  CACTUS_SEGMENT_LOSS_CHANCE,
  START_BODY_SEGMENTS,
  MIN_BODY_SEGMENTS,
  MAX_BODY_SEGMENTS,
  STARVATION_DECAY_INTERVAL_MS,
  STARVATION_DECAY_SEGMENTS,
  APPLE_BOOST_DURATION_MS,
  APPLE_BOOST_SPEED_MUL,
  APPLE_BOOST_ACCEL_MUL,
  APPLE_BOOST_INSTANT_SPEED_FACTOR,
  EXHAUSTION_CRAWL_THRESHOLD,
  EXHAUSTION_CRAWL_SPEED_FACTOR,
  EXHAUSTION_SLOWDOWN_PER_STEP,
  EXHAUSTION_SLOWDOWN_MIN_FACTOR,
  CRITICAL_SEGMENTS_THRESHOLD,
  CRITICAL_SEGMENTS_SLOWDOWN,
  BODY_ITEM_MIN_SEPARATION,
  BODY_ITEM_TO_CHECKPOINT_MIN_DIST,
  BODY_ITEM_TO_START_CHECKPOINT_MIN_DIST,
  BODY_ITEM_TO_PICKUP_MIN_DIST,
  CROSS_ACCEL_SNAKE_ID,
  BODY_CROSS_SLOWDOWN_MUL,
  SPEEDSTER_BODY_BLOCK_PUSH,
  BULLY_PUSH_DISTANCE,
  RESTART_DEBOUNCE_MS,
  APPLE_STARTLINE_AVOID_RADIUS,
  NPC_HAZARD_LOOKAHEAD_DELTA,
  NPC_BOMB_AVOID_RADIUS,
  NPC_CACTUS_AVOID_RADIUS,
  NPC_OIL_AVOID_RADIUS,
  NPC_BOMB_AVOID_WEIGHT,
  NPC_CACTUS_AVOID_WEIGHT,
  NPC_OIL_AVOID_WEIGHT,
  NPC_HAZARD_AVOID_MAX_SHIFT,
  NPC_EDGE_CAUTION_START_RATIO,
  NPC_EDGE_AVOID_LOOKAHEAD,
  NPC_BENEFIT_LOOKAHEAD_DELTA,
  NPC_BENEFIT_MAX_DISTANCE,
  BODY_CROSSING_START_GRACE_MS,
  BODY_CROSSING_EFFECT_COOLDOWN_MS,
  RACE_START_GHOST_MS,
  RACE_START_LAUNCH_SPEED_FACTOR,
  ALWAYS_MOVE_SNAKE_IDS,
  ALWAYS_MOVE_MIN_SPEED,
  ALWAYS_MOVE_OFFROAD_FACTOR,
  SPEEDSTER_BLOCK_EXTRA_TURN,
  SPEEDSTER_BLOCK_NUDGE,
  SPEEDSTER_BLOCK_MAX_SHIFT,
  SPEEDSTER_BLOCK_FORWARD_STEP,
  STALL_CHECK_WINDOW_MS,
  STALL_UNSTUCK_COOLDOWN_MS,
  STALL_MOVEMENT_EPSILON_SQ,
  STALL_PROGRESS_EPSILON,
  STALL_NO_PROGRESS_WINDOW_MS,
  STALL_UNSTUCK_LOOKAHEAD,
  STALL_RECOVERY_STEER_GAIN,
  STALL_HARD_RECOVERY_STEER_GAIN,
  STALL_OUTSIDE_RECOVERY_STEER_GAIN,
  STALL_UNSTUCK_GHOST_MS,
  STALL_HARD_UNSTUCK_LOOKAHEAD,
  STALL_HARD_UNSTUCK_GHOST_MS,
  BOMB_HIT_IMMUNITY_MS,
  BOMB_RECOVERY_SPEED_FACTOR,
  OUTSIDE_EXTRA_SLOWDOWN,
  OUTSIDE_RECOVERY_STEER_GAIN,
  OUTSIDE_RECOVERY_PULL_SPEED,
  OUTSIDE_MIN_CRAWL_SPEED,
  FINISHED_COAST_SPEED_FACTOR,
  FINISHED_COAST_STEER_GAIN,
  FINISHED_COAST_LOOKAHEAD,
  NO_TIME_LABEL,
  VENOM_PROJECTILE_RADIUS,
  VENOM_PROJECTILE_SPEED,
  VENOM_PROJECTILE_HIT_RADIUS,
  VENOM_PROJECTILE_MAX_LIFE_MS,
  VENOM_SLOW_BASE_DURATION_MS,
  RACE_COUNTDOWN_TOTAL_MS,
  RACE_COUNTDOWN_SECONDS,
  COUNTDOWN_BURST_ANIM_CLASS,
  COUNTDOWN_COLORS,
  TITLE_RACE_DURATION_STATS_KEY,
  TITLE_CRAWL_DURATION_EXTRA_FACTOR,
  TITLE_CRAWL_MIN_DURATION_MS,
  TITLE_CRAWL_MAX_DURATION_MS,
  TITLE_CRAWL_EMA_ALPHA,
  TITLE_CRAWL_PACE_FACTOR,
  TITLE_CRAWL_SIDE_PADDING,
  TITLE_CRAWL_SLOWDOWN_FACTOR,
  MATCH_SERVER_PORT,
  TITLE_REMOTE_STATS_PATH,
  TITLE_REMOTE_STATS_RETRY_MS,
  TRACK_MUSIC,
} from "./src/game/config.js";
import {
  BODY_ITEMS,
  SNAKES,
  snakeHeadTextureKey,
  snakeSegmentTextureKey,
  snakeHeadTexturePath,
  snakeSegmentTexturePath,
  PICKUP_TYPES,
  PICKUP_ORDER,
  NPC_PROFILES,
  TRACK_DEFS,
} from "./src/game/catalog.js";
import {
  clamp,
  lerp,
  sqrDistance,
  shortestAngle,
  wrapAngle,
  normalizeVec,
  mod1,
  forwardTrackDelta,
  signedTrackDelta,
  hexToInt,
} from "./src/game/utils.js";
import { buildTrackRuntime, sampleTrack, projectOnTrack } from "./src/game/trackMath.js";
import { renderRace as renderRaceView, renderIdle as renderIdleView } from "./src/game/render.js";

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
    const raceStageWidth = state.currentScreen === "race" ? ui.raceStage?.clientWidth || 0 : 0;
    const stageWidth = raceStageWidth > 320 ? raceStageWidth : Math.max(320, Math.min(800, availableWidth - 16));
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
      const startX = 0;
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
  const finishedTimes = race.racers
    .filter((racer) => racer.completedLap)
    .map((racer) => racer.finishTimeMs)
    .filter((ms) => Number.isFinite(ms) && ms > 0);
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
        .text(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT - 12, "", {
          fontFamily: "\"Exo 2\", sans-serif",
          fontSize: "12px",
          color: "#d8e7ff",
          align: "center",
          stroke: "#07111f",
          strokeThickness: 2,
        })
        .setOrigin(0.5, 1)
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
      finishTimeMs: NaN,
      completedLap: false,
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
    countdownLastSecond: null,
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

function showOverlayMessage(text, mode = "", color = null) {
  ui.overlay.textContent = text;
  ui.overlay.classList.remove("countdown", COUNTDOWN_BURST_ANIM_CLASS, "overlay-go", "overlay-finish");
  if (mode) {
    ui.overlay.classList.add(mode);
  }
  if (color) {
    ui.overlay.style.setProperty("--overlay-color", color);
  } else {
    ui.overlay.style.removeProperty("--overlay-color");
  }
  ui.overlay.classList.add("visible");
}

function triggerCountdownBurst(value) {
  const color = COUNTDOWN_COLORS[value] || "#f0f5ff";
  showOverlayMessage(String(value), "countdown", color);
  ui.overlay.classList.remove(COUNTDOWN_BURST_ANIM_CLASS);
  // Force reflow so CSS animation restarts on every digit.
  void ui.overlay.offsetWidth;
  ui.overlay.classList.add(COUNTDOWN_BURST_ANIM_CLASS);
}

// -----------------------------
// Race Loop and Simulation
// -----------------------------
function updateRace(race, nowMs, dt) {
  if (race.phase === "countdown") {
    const remain = Math.max(0, RACE_COUNTDOWN_TOTAL_MS - (nowMs - race.countdownStartMs));
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
      showOverlayMessage("GO", "overlay-go", "#8eff84");
    } else {
      const sec = clamp(Math.ceil(remain / 1000), 1, RACE_COUNTDOWN_SECONDS);
      if (race.countdownLastSecond !== sec) {
        race.countdownLastSecond = sec;
        triggerCountdownBurst(sec);
      } else {
        ui.overlay.classList.add("visible");
      }
    }
    updateBodySegmentsForRace(race, nowMs);
    updateHud(race, nowMs);
    return;
  }

  if (race.phase === "finished") {
    updateBodySegmentsForRace(race, nowMs);
    if (nowMs > race.overlayUntilMs) {
      ui.overlay.classList.remove("visible", "overlay-go", "overlay-finish", "countdown", COUNTDOWN_BURST_ANIM_CLASS);
      ui.overlay.style.removeProperty("--overlay-color");
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
    ui.overlay.classList.remove("visible", "overlay-go", "overlay-finish", "countdown", COUNTDOWN_BURST_ANIM_CLASS);
    ui.overlay.style.removeProperty("--overlay-color");
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
    preventRacerStall(race, racer, nowMs, dt);
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
        racer.completedLap = false;
        racer.finishTimeMs = Math.max(0, elapsedMs + racer.timePenaltyMs);
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
  showOverlayMessage("FINISH", "overlay-finish", "#ffb17f");
}

function finalizeResults(race) {
  const ordered = computeStandings(race);
  state.lastFinishedTrackId = race?.trackDef?.id || state.selectedTrackId;
  state.lastResults = ordered.map((racer, index) => ({
    rank: index + 1,
    name: racer.name,
    snake: racer.typeId,
    timeMs: racer.finishTimeMs,
    completedLap: Boolean(racer.completedLap),
    progressLabel: formatRacerProgressLabel(race, racer),
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
  if (!focus || !focus.completedLap || !Number.isFinite(focus.finishTimeMs)) {
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
      <td>${row.completedLap ? formatMs(row.timeMs) : row.progressLabel}</td>
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
  let delta = BODY_ITEMS[itemType]?.deltaSegments ?? 0;
  if (itemType === "CACTUS" && delta < 0) {
    // Cactus now applies damage in ~66% of pickups (about one-third softer overall).
    delta = Math.random() < CACTUS_SEGMENT_LOSS_CHANCE ? delta : 0;
  }
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
        const desiredX = segment.x + nx * push;
        const desiredY = segment.y + ny * push;
        const shiftX = desiredX - racer.x;
        const shiftY = desiredY - racer.y;
        const shiftLen = Math.hypot(shiftX, shiftY);
        if (shiftLen > 0.001) {
          const shiftStep = Math.min(SPEEDSTER_BLOCK_MAX_SHIFT, shiftLen);
          racer.x += (shiftX / shiftLen) * shiftStep;
          racer.y += (shiftY / shiftLen) * shiftStep;
        }
        const tangentSign = Math.sign(shortestAngle(racer.heading, segment.heading || racer.heading)) || 1;
        racer.heading = wrapAngle(racer.heading + SPEEDSTER_BLOCK_EXTRA_TURN * tangentSign);
        const projection = racer.lastProjection || projectOnTrack(race.track, racer.x, racer.y);
        const ahead = sampleTrack(race.track, mod1(projection.tNorm + 0.011));
        const forwardHeading = Math.atan2(ahead.y - racer.y, ahead.x - racer.x);
        racer.heading = wrapAngle(racer.heading + shortestAngle(racer.heading, forwardHeading) * 0.55);
        const forwardStep = Math.min(SPEEDSTER_BLOCK_FORWARD_STEP, SPEEDSTER_BLOCK_NUDGE + 1.5);
        racer.x += Math.cos(racer.heading) * forwardStep;
        racer.y += Math.sin(racer.heading) * forwardStep;
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

function preventRacerStall(race, racer, nowMs, dt) {
  if (racer.finished || race.phase !== "running") {
    return;
  }

  const projection = racer.lastProjection || projectOnTrack(race.track, racer.x, racer.y);
  racer.lastProjection = projection;
  ensureAlwaysMoveSpeed(racer);
  const safeDt = Math.min(0.05, Math.max(0.001, Number.isFinite(dt) ? dt : 0.016));

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
  const targetX = ahead.x + normal.x * lateral;
  const targetY = ahead.y + normal.y * lateral;
  const desiredHeading = Math.atan2(targetY - racer.y, targetX - racer.x);
  const headingDelta = shortestAngle(racer.heading, desiredHeading);
  const steerGain = hardDeadlock ? STALL_HARD_RECOVERY_STEER_GAIN : STALL_RECOVERY_STEER_GAIN;
  racer.heading = wrapAngle(racer.heading + clamp(headingDelta, -1, 1) * steerGain * safeDt);

  // If snake is deeply outside, bias steering back toward nearest track projection,
  // but keep movement continuous (no coordinate snap).
  if (projection.distance > race.track.outsideWidth * 0.98) {
    const toTrackHeading = Math.atan2(projection.y - racer.y, projection.x - racer.x);
    const toTrackDelta = shortestAngle(racer.heading, toTrackHeading);
    racer.heading = wrapAngle(racer.heading + clamp(toTrackDelta, -1, 1) * STALL_OUTSIDE_RECOVERY_STEER_GAIN * safeDt);
  }

  const forcedSpeed = shouldNeverStop(racer)
    ? Math.max(ALWAYS_MOVE_MIN_SPEED * (hardDeadlock ? 1.24 : 1.08), racer.stats.maxSpeed * (hardDeadlock ? 0.3 : 0.22))
    : Math.max(16, racer.stats.maxSpeed * (hardDeadlock ? 0.22 : 0.14));
  racer.speed = Math.max(racer.speed, forcedSpeed);
  const ghostMs = hardDeadlock ? STALL_HARD_UNSTUCK_GHOST_MS : STALL_UNSTUCK_GHOST_MS;
  racer.nextBodyCrossEffectAtMs = nowMs + ghostMs;
  racer.impactUntilMs = nowMs + ghostMs;
  racer.unstuckUntilMs = nowMs + ghostMs;

  watch.x = racer.x;
  watch.y = racer.y;
  watch.progressT = projection.tNorm;
  watch.lastMoveAtMs = nowMs;
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
    racer.completedLap = true;
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
  return [...race.racers].sort((a, b) => {
    if (a.completedLap !== b.completedLap) {
      return a.completedLap ? -1 : 1;
    }
    if (a.completedLap && b.completedLap) {
      const timeA = Number.isFinite(a.finishTimeMs) ? a.finishTimeMs : Number.POSITIVE_INFINITY;
      const timeB = Number.isFinite(b.finishTimeMs) ? b.finishTimeMs : Number.POSITIVE_INFINITY;
      if (timeA !== timeB) {
        return timeA - timeB;
      }
    }
    if (a.progressScore !== b.progressScore) {
      return b.progressScore - a.progressScore;
    }
    if (a.checkpointsPassed !== b.checkpointsPassed) {
      return b.checkpointsPassed - a.checkpointsPassed;
    }
    return a.id.localeCompare(b.id);
  });
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
  ui.timer.textContent = Number.isFinite(timerMs) ? formatMs(timerMs) : NO_TIME_LABEL;

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
    const tail = racer.finished ? formatRacerStandingsTail(race, racer) : "в гонке";
    li.textContent = `${racer.name} - ${tail}`;
    ui.standings.appendChild(li);
  });
}

function formatRacerProgressLabel(race, racer) {
  const checkpointsDone = Math.max(0, racer.checkpointsPassed || 0);
  const nextIndex = Number.isFinite(racer.nextCheckpointIndex) ? racer.nextCheckpointIndex : 0;
  const nextCheckpoint = race?.track?.checkpoints?.[nextIndex];
  if (!nextCheckpoint) {
    return `CP ${checkpointsDone}`;
  }
  const distToNext = Math.hypot(nextCheckpoint.x - racer.x, nextCheckpoint.y - racer.y);
  return `CP ${checkpointsDone} | next ${Math.round(distToNext)}px`;
}

function formatRacerStandingsTail(race, racer) {
  if (racer.completedLap && Number.isFinite(racer.finishTimeMs)) {
    return formatMs(racer.finishTimeMs);
  }
  return formatRacerProgressLabel(race, racer);
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
  return renderRaceView(scene, race, nowMs, { formatMs, getRacerMotionHeading });
}

function renderIdle(scene) {
  return renderIdleView(scene, { getRacerMotionHeading });
}

// -----------------------------
// Track Geometry and Utilities
// -----------------------------
function loadBestTime(trackId) {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${trackId}`);
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function formatMs(ms) {
  if (!Number.isFinite(ms)) {
    return NO_TIME_LABEL;
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

