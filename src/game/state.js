import { DEFAULT_OFFLINE_MODE, OFFLINE_MODES } from "./config.js";

// Shared DOM handles used across game modules.
export const ui = {
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
  playerNameInput: document.getElementById("player-name-input"),
  onlineRoomPicker: document.getElementById("online-room-picker"),
  onlineRoomSelect: document.getElementById("online-room-select"),
  onlineRoomRefresh: document.getElementById("online-room-refresh"),
  onlineRoomIdInput: document.getElementById("online-room-id-input"),
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

// Mutable app state shared by UI and simulation.
export const state = {
  currentScreen: "main",
  playMode: "offline",
  playerName: "",
  selectedSnakeId: null,
  selectedTrackId: null,
  onlineRoomId: "",
  onlineRoomOptions: [],
  onlineRoomOptionsTrackId: null,
  lastFinishedTrackId: null,
  race: null,
  online: {
    active: false,
    status: "idle",
    client: null,
    room: null,
    roomId: null,
    sessionId: null,
    endpoint: null,
    trackId: null,
    snapshot: null,
    lastSnapshotAtMs: 0,
    lastPongAtMs: 0,
    pingTimerId: null,
    latencyMs: null,
    error: null,
  },
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

export function isDebugMode() {
  return state.offlineMode === OFFLINE_MODES.DEBUG;
}

export function setOfflineMode(mode) {
  state.offlineMode = mode;
  updateOfflineModeUi();
}

export function updateOfflineModeUi() {
  const classicActive = state.offlineMode === OFFLINE_MODES.CLASSIC;
  if (ui.modeClassic) {
    ui.modeClassic.classList.toggle("mode-active", classicActive);
  }
  if (ui.modeDebug) {
    ui.modeDebug.classList.toggle("mode-active", !classicActive);
  }
  if (ui.modeNote) {
    ui.modeNote.textContent = classicActive
      ? "Р РµР¶РёРј PRD: РІС‹ СѓРїСЂР°РІР»СЏРµС‚Рµ Р·РјРµРµР№, РѕСЃС‚Р°Р»СЊРЅС‹Рµ 3 - Р±РѕС‚С‹."
      : "Р РµР¶РёРј РѕС‚Р»Р°РґРєРё: РІСЃРµ 4 Р·РјРµРё РЅР° Р°РІС‚РѕРїРёР»РѕС‚Рµ.";
  }
}
