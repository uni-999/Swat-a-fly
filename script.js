import {
  TOTAL_RACERS,
  OFFLINE_MODES,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TAU,
  RACE_TIMEOUT_MS,
  STORAGE_PREFIX,
  BODY_ITEM_COUNT,
  START_BODY_SEGMENTS,
  STARVATION_DECAY_INTERVAL_MS,
  EXHAUSTION_CRAWL_THRESHOLD,
  BODY_ITEM_MIN_SEPARATION,
  BODY_ITEM_TO_CHECKPOINT_MIN_DIST,
  BODY_ITEM_TO_START_CHECKPOINT_MIN_DIST,
  BODY_ITEM_TO_PICKUP_MIN_DIST,
  RESTART_DEBOUNCE_MS,
  BODY_CROSSING_START_GRACE_MS,
  RACE_START_GHOST_MS,
  RACE_START_LAUNCH_SPEED_FACTOR,
  NO_TIME_LABEL,
  RACE_COUNTDOWN_TOTAL_MS,
  RACE_COUNTDOWN_SECONDS,
  COUNTDOWN_BURST_ANIM_CLASS,
  COUNTDOWN_COLORS,
  TRACK_MUSIC,
} from "./src/game/config.js";
import {
  SNAKES,
  snakeHeadTextureKey,
  snakeSegmentTextureKey,
  snakeHeadTexturePath,
  snakeSegmentTexturePath,
  PICKUP_ORDER,
  NPC_PROFILES,
  TRACK_DEFS,
} from "./src/game/catalog.js";
import { clamp, sqrDistance, mod1 } from "./src/game/utils.js";
import { buildTrackRuntime, sampleTrack } from "./src/game/trackMath.js";
import { renderRace as renderRaceView, renderIdle as renderIdleView } from "./src/game/render.js";
import { ui, state, isDebugMode, setOfflineMode, updateOfflineModeUi } from "./src/game/state.js";
import { createRaceDurationStatsApi } from "./src/game/raceDurationStats.js";
import { initSnakeTitleWave } from "./src/game/titleWave.js";
import { createAiApi } from "./src/game/ai.js";
import {
  stepFinishedRacer,
  updatePickups,
  updateBodyItems,
  updateRacerHunger,
  checkPickupCollection,
  checkBodyItemCollection,
  getCurrentBodySegments,
  addEffect,
  removeEffect,
  updateBodySegmentsForRace,
  getRacerMotionHeading,
  stepRacer,
  shouldNeverStop,
  ensureAlwaysMoveSpeed,
  applyBodyCrossingRules,
  preventRacerStall,
  resolveRacerCollisions,
  updateCheckpointProgress,
  computeStandings,
} from "./src/game/simulation.js";

const { maybePrefetchRemoteRaceDurationStats, getTitleCrawlDurationMs, updateRaceDurationStats } =
  createRaceDurationStatsApi({ loadBestTime });
const { buildNpcControl, maybeShootVenom, updateVenomShots } = createAiApi({
  shouldNeverStop,
  getCurrentBodySegments,
  addEffect,
  removeEffect,
});

// -----------------------------
// App Bootstrap and UI Wiring
// -----------------------------
bootstrap();

function bootstrap() {
  initSnakeTitleWave({
    getCurrentScreen: () => state.currentScreen,
    getRaceStageWidth: () => ui.raceStage?.clientWidth || 0,
    getTitleCrawlDurationMs,
  });
  maybePrefetchRemoteRaceDurationStats();
  wireUi();
  renderSnakeCards();
  renderTrackCards();
  updateOfflineModeUi();
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
  updateBodyItems(race, nowMs, randomizeBodyItemPosition);

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
  const bodySegments = getCurrentBodySegments(focus);
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
