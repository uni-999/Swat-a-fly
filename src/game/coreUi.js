import {
  STORAGE_PREFIX,
  NO_TIME_LABEL,
  COUNTDOWN_BURST_ANIM_CLASS,
  COUNTDOWN_COLORS,
} from "./config.js";
import { renderRace as renderRaceView, renderIdle as renderIdleView } from "./render.js";

export function createCoreUiApi({ ui, state, getRacerMotionHeading, t, localizeTrack } = {}) {
  function showOverlayMessage(text, mode = "", color = null) {
    ui.overlay.textContent = text;
    ui.overlay.classList.remove("countdown", COUNTDOWN_BURST_ANIM_CLASS, "overlay-go", "overlay-finish", "overlay-rules");
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

  function renderRace(scene, race, nowMs) {
    return renderRaceView(scene, race, nowMs, {
      formatMs,
      getRacerMotionHeading,
      t,
      localizeTrack,
    });
  }

  function renderIdle(scene) {
    return renderIdleView(scene, { getRacerMotionHeading });
  }

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

  return {
    showOverlayMessage,
    triggerCountdownBurst,
    renderRace,
    renderIdle,
    loadBestTime,
    formatMs,
    showToast,
  };
}
