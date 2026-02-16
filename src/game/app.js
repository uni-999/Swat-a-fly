import {
  OFFLINE_MODES,
  RESTART_DEBOUNCE_MS,
} from "./config.js";
import {
  SNAKES,
  TRACK_DEFS,
} from "./catalog.js";
import { ui, state, isDebugMode, setOfflineMode, updateOfflineModeUi } from "./state.js";
import { initLanguageState, t, localizeTrack, localizeSnake, toggleLanguage, getLanguageToggleLabel } from "./i18n.js";
import { createRaceDurationStatsApi } from "./raceDurationStats.js";
import { initSnakeTitleWave } from "./titleWave.js";
import { createAiApi } from "./ai.js";
import { createRaceFlowApi } from "./raceFlow.js?v=20260216_i18n_2";
import { createRaceState, randomizePickupPosition, randomizeBodyItemPosition } from "./raceSetup.js";
import { createHudApi } from "./hud.js?v=20260216_i18n_2";
import { createSceneApi } from "./scene.js?v=20260216_leaderboard_2";
import { createUiFlowApi } from "./uiFlow.js?v=20260216_i18n_2";
import { createCoreUiApi } from "./coreUi.js?v=20260216_i18n_2";
import { createOnlineRoomClientApi } from "./onlineRoomClient.js";
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
} from "./simulation.js";

export function bootstrapApp() {
  initLanguageState(state);
  const tUi = (key, vars = {}) => t(state, key, vars);
  const localizeTrackUi = (track) => localizeTrack(state, track);
  const localizeSnakeUi = (snake) => localizeSnake(state, snake);

  const {
    showOverlayMessage,
    triggerCountdownBurst,
    renderRace,
    renderIdle,
    loadBestTime,
    formatMs,
    showToast,
  } = createCoreUiApi({
    ui,
    state,
    getRacerMotionHeading,
    t: tUi,
    localizeTrack: localizeTrackUi,
  });

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
    state,
    t: tUi,
    computeStandings,
    getCurrentBodySegments,
    formatMs,
  });
  const {
    startOnlineRace,
    listOnlineRooms,
    getTrackLeaderboard,
    disconnectOnlineRace,
    sendOnlineInput,
  } = createOnlineRoomClientApi({ state });
  let syncRaceMusicRef = () => {};
  const {
    wireUi,
    showScreen,
    renderSnakeCards,
    renderTrackCards,
  } = createUiFlowApi({
    ui,
    state,
    OFFLINE_MODES,
    setOfflineMode,
    TRACK_DEFS,
    SNAKES,
    isDebugMode,
    createRaceState,
    syncRaceMusic: (...args) => syncRaceMusicRef(...args),
    startOnlineRace,
    listOnlineRooms,
    getTrackLeaderboard,
    disconnectOnlineRace,
    sendOnlineInput,
    showToast,
    loadBestTime,
    formatMs,
    RESTART_DEBOUNCE_MS,
    t: tUi,
    localizeSnake: localizeSnakeUi,
    localizeTrack: localizeTrackUi,
    toggleLanguage: () => toggleLanguage(state),
    getLanguageToggleLabel: () => getLanguageToggleLabel(state),
  });
  const { updateRace } = createRaceFlowApi({
    ui,
    state,
    t: tUi,
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
    randomizePickupPosition,
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
  const { initPhaser, syncRaceMusic } = createSceneApi({
    ui,
    state,
    updateRace,
    renderRace,
    renderIdle,
  });
  syncRaceMusicRef = syncRaceMusic;

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
