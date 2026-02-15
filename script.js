import {
  OFFLINE_MODES,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  STORAGE_PREFIX,
  RESTART_DEBOUNCE_MS,
  NO_TIME_LABEL,
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
  TRACK_DEFS,
} from "./src/game/catalog.js";
import { renderRace as renderRaceView, renderIdle as renderIdleView } from "./src/game/render.js";
import { ui, state, isDebugMode, setOfflineMode, updateOfflineModeUi } from "./src/game/state.js";
import { createRaceDurationStatsApi } from "./src/game/raceDurationStats.js";
import { initSnakeTitleWave } from "./src/game/titleWave.js";
import { createAiApi } from "./src/game/ai.js";
import { createRaceFlowApi } from "./src/game/raceFlow.js";
import { createRaceState, randomizeBodyItemPosition } from "./src/game/raceSetup.js";
import { createHudApi } from "./src/game/hud.js";
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
const { updateHud, formatRacerProgressLabel } = createHudApi({
  ui,
  computeStandings,
  getCurrentBodySegments,
  formatMs,
});
const { updateRace } = createRaceFlowApi({
  ui,
  state,
  ensureAlwaysMoveSpeed,
  updateBodySegmentsForRace,
  updatePickups,
  updateBodyItems,
  stepFinishedRacer,
  updateRacerHunger,
  buildNpcControl,
  stepRacer,
  applyBodyCrossingRules,
  preventRacerStall,
  maybeShootVenom,
  updateCheckpointProgress,
  checkPickupCollection,
  checkBodyItemCollection,
  updateVenomShots,
  resolveRacerCollisions,
  computeStandings,
  randomizeBodyItemPosition,
  showOverlayMessage,
  triggerCountdownBurst,
  updateHud,
  updateRaceDurationStats,
  renderTrackCards,
  showScreen,
  loadBestTime,
  formatMs,
  formatRacerProgressLabel,
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
