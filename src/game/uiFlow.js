export function createUiFlowApi({
  ui,
  state,
  OFFLINE_MODES,
  setOfflineMode,
  TRACK_DEFS,
  SNAKES,
  isDebugMode,
  createRaceState,
  syncRaceMusic,
  startOnlineRace,
  listOnlineRooms,
  getTrackLeaderboard,
  disconnectOnlineRace,
  sendOnlineInput,
  showToast,
  loadBestTime,
  formatMs,
  RESTART_DEBOUNCE_MS,
  t,
  localizeSnake,
  localizeTrack,
  toggleLanguage,
  getLanguageToggleLabel,
} = {}) {
  const tr = typeof t === "function" ? t : (key) => key;
  const localizeSnakeText = typeof localizeSnake === "function" ? localizeSnake : (snake) => snake;
  const localizeTrackText = typeof localizeTrack === "function" ? localizeTrack : (track) => track;
  const switchLanguage = typeof toggleLanguage === "function" ? toggleLanguage : () => state.language;
  const readLanguageToggleLabel =
    typeof getLanguageToggleLabel === "function" ? getLanguageToggleLabel : () => "EN";
  const PLAYER_NAME_STORAGE_KEY = "polzunki_player_name_v1";
  const PLAYER_NAME_MAX_LENGTH = 24;
  const ONLINE_ROOM_ID_MAX_LENGTH = 64;
  const ONLINE_INPUT_PUSH_INTERVAL_MS = 50;
  const ONLINE_INPUT_KEEPALIVE_MS = 220;
  const LEADERBOARD_LIMIT = 20;
  const ONLINE_COUNTDOWN_MAX_SECONDS = 3;
  const COUNTDOWN_BURST_CLASS = "countdown-burst";
  const TOUCH_JOYSTICK_RADIUS_PX = 46;
  const TOUCH_TURN_DEADZONE = 0.12;
  const TOUCH_THROTTLE_DEADZONE = 0.08;
  const TOUCH_AIM_TURN_GAIN = 1.35;
  const PRESS_DEBOUNCE_MS = 140;
  let onlineInputPumpId = null;
  let lastOnlineInputSignature = "";
  let lastOnlineInputSentAtMs = 0;
  let lastHandledOnlineFinishKey = "";
  let onlineNoProgressSinceMs = 0;
  let onlineLastMaxProgress = 0;
  let onlineProgressWatchKey = "";
  let onlineOverlayLastCountdownSecond = null;
  let touchJoystickPointerId = null;
  let rulesModalOpen = false;
  let aboutModalOpen = false;
  let leaderboardLoading = false;
  function resolveSnakeName(rawSnakeId) {
    const normalized = String(rawSnakeId ?? "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      return tr("fallback.snake");
    }
    if (normalized === "online") {
      return tr("fallback.online");
    }
    const localized = localizeSnakeText({ id: normalized, name: String(rawSnakeId || normalized) });
    return localized?.name || String(rawSnakeId || normalized);
  }

  function normalizePlayerName(rawName) {
    return String(rawName ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, PLAYER_NAME_MAX_LENGTH);
  }

  function loadStoredPlayerName() {
    try {
      return localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function persistPlayerName(nextName) {
    try {
      localStorage.setItem(PLAYER_NAME_STORAGE_KEY, nextName);
    } catch (error) {
      // localStorage can be unavailable in private mode; keep in-memory value.
    }
  }

  function getResolvedPlayerName() {
    return normalizePlayerName(state.playerName) || getDefaultPlayerName();
  }

  function applyPlayerNameFromInput() {
    if (!ui.playerNameInput) {
      state.playerName = getResolvedPlayerName();
      return;
    }

    const normalized = normalizePlayerName(ui.playerNameInput.value);
    const resolved = normalized || getDefaultPlayerName();
    state.playerName = resolved;
    if (ui.playerNameInput.value !== normalized) {
      ui.playerNameInput.value = normalized;
    }
    persistPlayerName(resolved);
  }

  function initPlayerNameUi() {
    const normalizedStoredName = normalizePlayerName(loadStoredPlayerName());
    state.playerName = normalizedStoredName || getDefaultPlayerName();

    if (!ui.playerNameInput) {
      return;
    }

    ui.playerNameInput.value = normalizedStoredName;
    ui.playerNameInput.addEventListener("input", () => applyPlayerNameFromInput());
    ui.playerNameInput.addEventListener("change", () => applyPlayerNameFromInput());
    ui.playerNameInput.addEventListener("blur", () => applyPlayerNameFromInput());
  }

  function getDefaultPlayerName() {
    return tr("fallback.player");
  }

  function setText(selector, key, vars = {}) {
    const node = document.querySelector(selector);
    if (node) {
      node.textContent = tr(key, vars);
    }
  }

  function setHtml(selector, key, vars = {}) {
    const node = document.querySelector(selector);
    if (node) {
      node.innerHTML = tr(key, vars);
    }
  }

  function setPlaceholder(selector, key, vars = {}) {
    const node = document.querySelector(selector);
    if (node) {
      node.placeholder = tr(key, vars);
    }
  }

  function applyStaticLocalizedTexts() {
    document.title = tr("meta.title");
    document.documentElement.lang = String(state.language || "ru");

    const nextLangLabel = readLanguageToggleLabel();
    if (ui.languageButton) {
      ui.languageButton.textContent = nextLangLabel;
      ui.languageButton.setAttribute("aria-label", tr("lang.toggleAria", { lang: nextLangLabel }));
    }

    setText(".app-header p", "header.subtitle");
    setText("#btn-rules", "menu.rules");
    setText("label[for='player-name-input'] > span", "menu.playerNameLabel");
    setPlaceholder("#player-name-input", "menu.playerNamePlaceholder");
    setText("#btn-offline", "menu.playOffline");
    setText("#btn-online", "menu.playOnline");
    setText("#btn-leaderboards", "menu.leaderboard");
    setText("#btn-about", "menu.about");

    setText("#screen-leaderboard h2", "leaderboard.title");
    setText("label[for='leaderboard-track-select'] > span", "leaderboard.track");
    setText("#leaderboard-refresh", "leaderboard.refresh");
    if (!leaderboardLoading) {
      setText("#leaderboard-status", "leaderboard.initial");
    }
    setText("#screen-leaderboard thead th:nth-child(2)", "leaderboard.header.player");
    setText("#screen-leaderboard thead th:nth-child(3)", "leaderboard.header.track");
    setText("#screen-leaderboard thead th:nth-child(4)", "leaderboard.header.bestTime");
    setText("#leaderboard-back", "common.back");

    setText("#screen-snake h2", "snake.title");
    setText("#mode-classic", "snake.modeClassicBtn");
    setText("#mode-debug", "snake.modeDebugBtn");
    if (ui.modeNote) {
      ui.modeNote.textContent =
        state.offlineMode === OFFLINE_MODES.CLASSIC ? tr("snake.modeClassicNote") : tr("snake.modeDebugNote");
    }
    setText("#snake-back", "common.back");
    setText("#snake-next", "common.next");

    setText("#screen-track h2", "track.title");
    setText("label[for='online-room-select'] > span", "track.onlineRoomLabel");
    setPlaceholder("#online-room-id-input", "track.onlineRoomPlaceholder");
    setText("#online-room-refresh", "track.onlineRoomRefresh");
    const autoOption = document.querySelector("#online-room-select option[value='']");
    if (autoOption) {
      autoOption.textContent = tr("track.onlineAuto");
    }
    setText("#track-back", "common.back");
    setText("#track-start", "common.start");

    setText("#screen-race .hud-box--time > span", "hud.time");
    setText("#screen-race .hud-box--speed > span", "hud.speed");
    setText("#screen-race .hud-box--position > span", "hud.position");
    setText("#screen-race .hud-box--effect > span", "hud.effect");
    setText("#screen-race .hud-box--standings > span", "hud.order");
    setText("#screen-race .controls p:nth-child(1)", "hud.controls1");
    setText("#screen-race .controls p:nth-child(2)", "hud.controls2");
    setText("#screen-race .touch-controls__hint", "hud.touchHint");

    setText("#screen-results h2", "results.title");
    setText("#screen-results thead th:nth-child(2)", "results.header.participant");
    setText("#screen-results thead th:nth-child(3)", "results.header.snake");
    setText("#screen-results thead th:nth-child(4)", "results.header.finish");
    setText("#results-retry", "common.retry");
    setText("#results-next", "common.nextTrack");
    setText("#results-back", "common.back");

    setText("#rules-modal-title", "rules.title");
    setHtml("#rules-modal .rules-modal__goal:nth-of-type(1)", "rules.goal1");
    setHtml("#rules-modal .rules-modal__goal:nth-of-type(2)", "rules.goal2");
    setText("#rules-modal .rules-modal__panel h3:nth-of-type(1)", "rules.bodyTitle");
    setText("#rules-modal .rules-modal__goal:nth-of-type(3)", "rules.bodyLong");
    setText("#rules-modal .rules-modal__goal:nth-of-type(4)", "rules.bodyShort");
    setText("#rules-modal .rules-modal__panel h3:nth-of-type(2)", "rules.snakesTitle");
    setText("#rules-modal .rules-snake:nth-of-type(1) h4", "rules.speedster.title");
    setText("#rules-modal .rules-snake:nth-of-type(1) > p", "rules.speedster.desc");
    setText("#rules-modal .rules-snake:nth-of-type(1) li:nth-of-type(1)", "rules.speedster.p1");
    setText("#rules-modal .rules-snake:nth-of-type(1) li:nth-of-type(2)", "rules.speedster.p2");
    setText("#rules-modal .rules-snake:nth-of-type(2) h4", "rules.handler.title");
    setText("#rules-modal .rules-snake:nth-of-type(2) > p", "rules.handler.desc");
    setText("#rules-modal .rules-snake:nth-of-type(2) li:nth-of-type(1)", "rules.handler.p1");
    setText("#rules-modal .rules-snake:nth-of-type(2) li:nth-of-type(2)", "rules.handler.p2");
    setText("#rules-modal .rules-snake:nth-of-type(3) h4", "rules.bully.title");
    setText("#rules-modal .rules-snake:nth-of-type(3) > p", "rules.bully.desc");
    setText("#rules-modal .rules-snake:nth-of-type(3) li:nth-of-type(1)", "rules.bully.p1");
    setText("#rules-modal .rules-snake:nth-of-type(3) li:nth-of-type(2)", "rules.bully.p2");
    setText("#rules-modal .rules-snake:nth-of-type(4) h4", "rules.trickster.title");
    setText("#rules-modal .rules-snake:nth-of-type(4) > p", "rules.trickster.desc");
    setText("#rules-modal .rules-snake:nth-of-type(4) li:nth-of-type(1)", "rules.trickster.p1");
    setText("#rules-modal .rules-snake:nth-of-type(4) li:nth-of-type(2)", "rules.trickster.p2");
    setText("#rules-modal .rules-modal__panel h3:nth-of-type(3)", "rules.objectsTitle");
    setHtml("#rules-modal .rules-item:nth-of-type(1) p", "rules.item.boost");
    setHtml("#rules-modal .rules-item:nth-of-type(2) p", "rules.item.shield");
    setHtml("#rules-modal .rules-item:nth-of-type(3) p", "rules.item.apple");
    setHtml("#rules-modal .rules-item:nth-of-type(4) p", "rules.item.oil");
    setHtml("#rules-modal .rules-item:nth-of-type(5) p", "rules.item.bomb");
    setHtml("#rules-modal .rules-item:nth-of-type(6) p", "rules.item.cactus");

    if (ui.rulesClose) {
      ui.rulesClose.setAttribute("aria-label", tr("menu.rules"));
    }

    setText("#about-modal-title", "about.title");
    setText("#about-modal .about-modal__panel p", "about.text");
    if (ui.aboutClose) {
      ui.aboutClose.setAttribute("aria-label", tr("menu.about"));
    }
  }

  function initLanguageUi() {
    applyStaticLocalizedTexts();
    if (!ui.languageButton) {
      return;
    }
    bindPress(ui.languageButton, () => {
      switchLanguage();
      applyStaticLocalizedTexts();
      renderSnakeCards();
      renderTrackCards();
      renderOnlineRoomOptions();
      renderLeaderboardTrackOptions();
      if (state.currentScreen === "leaderboard") {
        void refreshLeaderboard({ silent: true });
      }
      if (state.currentScreen === "results") {
        renderResultsRows(state.lastResults || []);
      }
      if (state.playMode === "online") {
        syncOnlinePhaseOverlay();
      }
    });
  }

  function syncModalBodyLock() {
    document.body.classList.toggle("modal-open", rulesModalOpen || aboutModalOpen);
  }

  function clearRaceOverlay() {
    if (!ui.overlay) {
      return;
    }
    ui.overlay.classList.remove("visible", "overlay-go", "overlay-finish", "overlay-rules", "countdown", COUNTDOWN_BURST_CLASS);
    ui.overlay.style.removeProperty("--overlay-color");
    onlineOverlayLastCountdownSecond = null;
  }

  function openRulesModal() {
    if (!ui.rulesModal) {
      return;
    }
    closeAboutModal();
    ui.rulesModal.hidden = false;
    rulesModalOpen = true;
    syncModalBodyLock();
  }

  function closeRulesModal() {
    if (!ui.rulesModal) {
      return;
    }
    ui.rulesModal.hidden = true;
    rulesModalOpen = false;
    syncModalBodyLock();
  }

  function openAboutModal() {
    if (!ui.aboutModal) {
      return;
    }
    closeRulesModal();
    ui.aboutModal.hidden = false;
    aboutModalOpen = true;
    syncModalBodyLock();
  }

  function closeAboutModal() {
    if (!ui.aboutModal) {
      return;
    }
    ui.aboutModal.hidden = true;
    aboutModalOpen = false;
    syncModalBodyLock();
  }

  function bindPress(target, handler) {
    if (!target || typeof handler !== "function") {
      return;
    }

    let lastHandledAtMs = 0;
    const run = (event) => {
      if (target.disabled || target.getAttribute?.("aria-disabled") === "true") {
        return;
      }
      const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (nowMs - lastHandledAtMs < PRESS_DEBOUNCE_MS) {
        return;
      }
      lastHandledAtMs = nowMs;
      handler(event);
    };

    target.addEventListener("click", run);
    if (typeof window !== "undefined" && "PointerEvent" in window) {
      target.addEventListener("pointerup", (event) => {
        if (event.pointerType === "mouse") {
          return;
        }
        run(event);
      });
      return;
    }

    target.addEventListener("touchend", run, { passive: true });
  }

  function initRulesModalUi() {
    if (ui.rulesButton) {
      bindPress(ui.rulesButton, () => openRulesModal());
    }
    if (ui.rulesClose) {
      bindPress(ui.rulesClose, () => closeRulesModal());
    }
    if (ui.rulesModal) {
      ui.rulesModal.addEventListener("click", (event) => {
        if (event.target?.hasAttribute?.("data-rules-close")) {
          closeRulesModal();
        }
      });
    }
  }

  function initAboutModalUi() {
    if (ui.aboutButton) {
      bindPress(ui.aboutButton, () => openAboutModal());
    }
    if (ui.aboutClose) {
      bindPress(ui.aboutClose, () => closeAboutModal());
    }
    if (ui.aboutModal) {
      ui.aboutModal.addEventListener("click", (event) => {
        if (event.target?.hasAttribute?.("data-about-close")) {
          closeAboutModal();
        }
      });
    }
  }

  function clampUnit(value) {
    return Math.max(-1, Math.min(1, Number(value) || 0));
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function isTouchDevice() {
    if (typeof window === "undefined") {
      return false;
    }
    const hasCoarsePointer = Boolean(window.matchMedia?.("(pointer: coarse)")?.matches);
    const touchPoints = typeof navigator !== "undefined" ? Number(navigator.maxTouchPoints || 0) : 0;
    return hasCoarsePointer || touchPoints > 0;
  }

  function resetVirtualInputState() {
    if (!state.virtualInput) {
      state.virtualInput = { turn: 0, throttle: 0, brake: 0, active: false, aimAngle: null, magnitude: 0 };
      return;
    }
    state.virtualInput.turn = 0;
    state.virtualInput.throttle = 0;
    state.virtualInput.brake = 0;
    state.virtualInput.active = false;
    state.virtualInput.aimAngle = null;
    state.virtualInput.magnitude = 0;
  }

  function setTouchJoystickVisual(dx, dy) {
    if (!ui.touchJoystick) {
      return;
    }
    ui.touchJoystick.style.setProperty("--joy-x", `${Number(dx || 0).toFixed(2)}px`);
    ui.touchJoystick.style.setProperty("--joy-y", `${Number(dy || 0).toFixed(2)}px`);
  }

  function releaseTouchJoystickPointer() {
    if (!ui.touchJoystick || touchJoystickPointerId === null) {
      touchJoystickPointerId = null;
      return;
    }
    try {
      ui.touchJoystick.releasePointerCapture(touchJoystickPointerId);
    } catch (error) {
      // Ignore capture release errors from stale pointers.
    }
    touchJoystickPointerId = null;
  }

  function clearTouchJoystickControl() {
    resetVirtualInputState();
    setTouchJoystickVisual(0, 0);
    releaseTouchJoystickPointer();
    pushOnlineInput(true);
  }

  function syncTouchControlsVisibility() {
    if (!ui.touchControls) {
      return;
    }
    const visible = Boolean(isTouchDevice() && state.currentScreen === "race");
    ui.touchControls.hidden = !visible;
    if (!visible) {
      clearTouchJoystickControl();
    }
  }

  function applyTouchJoystickFromPointer(event) {
    if (!ui.touchJoystick || touchJoystickPointerId !== event.pointerId) {
      return;
    }

    const rect = ui.touchJoystick.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    let dx = Number(event.clientX) - cx;
    let dy = Number(event.clientY) - cy;
    const distance = Math.hypot(dx, dy);
    if (distance > TOUCH_JOYSTICK_RADIUS_PX && distance > 0.001) {
      const ratio = TOUCH_JOYSTICK_RADIUS_PX / distance;
      dx *= ratio;
      dy *= ratio;
    }

    setTouchJoystickVisual(dx, dy);

    const nx = clampUnit(dx / TOUCH_JOYSTICK_RADIUS_PX);
    const ny = clampUnit(dy / TOUCH_JOYSTICK_RADIUS_PX);
    const magnitude = clamp01(Math.hypot(dx, dy) / TOUCH_JOYSTICK_RADIUS_PX);
    const active = magnitude >= TOUCH_THROTTLE_DEADZONE;
    const turn = active && Math.abs(nx) >= TOUCH_TURN_DEADZONE ? nx : 0;
    const throttle = active ? magnitude : 0;
    const brake = 0;
    const aimAngle = active ? Math.atan2(ny, nx) : null;

    state.virtualInput.turn = turn;
    state.virtualInput.throttle = throttle;
    state.virtualInput.brake = brake;
    state.virtualInput.active = active;
    state.virtualInput.aimAngle = aimAngle;
    state.virtualInput.magnitude = active ? magnitude : 0;
    pushOnlineInput(true);
  }

  function initTouchControlsUi() {
    if (!ui.touchJoystick || !ui.touchControls) {
      return;
    }
    if (ui.touchJoystick.dataset.bound === "1") {
      syncTouchControlsVisibility();
      return;
    }
    ui.touchJoystick.dataset.bound = "1";

    ui.touchJoystick.addEventListener("pointerdown", (event) => {
      if (!isTouchDevice() || touchJoystickPointerId !== null) {
        return;
      }
      touchJoystickPointerId = event.pointerId;
      try {
        ui.touchJoystick.setPointerCapture(event.pointerId);
      } catch (error) {
        // Some mobile browsers can throw on pointer capture transitions.
      }
      applyTouchJoystickFromPointer(event);
      if (event.cancelable) {
        event.preventDefault();
      }
    });

    ui.touchJoystick.addEventListener("pointermove", (event) => {
      if (touchJoystickPointerId !== event.pointerId) {
        return;
      }
      applyTouchJoystickFromPointer(event);
      if (event.cancelable) {
        event.preventDefault();
      }
    });

    const clearPointer = (event) => {
      const eventPointerId = Number(event?.pointerId);
      if (Number.isFinite(eventPointerId) && touchJoystickPointerId !== eventPointerId) {
        return;
      }
      clearTouchJoystickControl();
      if (event?.cancelable) {
        event.preventDefault();
      }
    };

    ui.touchJoystick.addEventListener("pointerup", clearPointer);
    ui.touchJoystick.addEventListener("pointercancel", clearPointer);
    ui.touchJoystick.addEventListener("lostpointercapture", clearPointer);

    syncTouchControlsVisibility();
  }

  function normalizeOnlineRoomId(rawRoomId) {
    return String(rawRoomId ?? "")
      .trim()
      .slice(0, ONLINE_ROOM_ID_MAX_LENGTH);
  }

  function normalizeTrackId(rawTrackId) {
    return String(rawTrackId ?? "")
      .trim()
      .toLowerCase()
      .replace(/-/g, "_");
  }

  function localizeOnlinePhaseLabel(rawPhase) {
    const phase = String(rawPhase || "")
      .trim()
      .toLowerCase();
    if (!phase) {
      return tr("online.phase.unknown");
    }
    if (["lobby", "rules", "countdown", "running", "finished"].includes(phase)) {
      return tr(`online.phase.${phase}`);
    }
    return phase;
  }

  function resolveTrackDef(trackId) {
    const normalized = normalizeTrackId(trackId);
    return TRACK_DEFS.find((track) => normalizeTrackId(track.id) === normalized) || TRACK_DEFS[0] || null;
  }

  function getResolvedLeaderboardTrackId() {
    const selected = normalizeTrackId(ui.leaderboardTrackSelect?.value || "");
    const stateTrack = normalizeTrackId(state.leaderboardTrackId || "");
    const selectedTrack = normalizeTrackId(state.selectedTrackId || "");
    return selected || stateTrack || selectedTrack || normalizeTrackId(TRACK_DEFS[0]?.id || "");
  }

  function ensureOnlineRoomPickerDom() {
    if (ui.onlineRoomPicker && ui.onlineRoomSelect && ui.onlineRoomRefresh && ui.onlineRoomIdInput) {
      return;
    }
    const trackPanel = document.querySelector("#screen-track .panel");
    const trackCards = ui.trackCards || document.getElementById("track-cards");
    if (!trackPanel || !trackCards) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.id = "online-room-picker";
    wrapper.className = "online-room-picker";
    wrapper.hidden = true;
    wrapper.innerHTML = `
      <label class="menu-field" for="online-room-select">
        <span>${tr("track.onlineRoomLabel")}</span>
        <select id="online-room-select">
          <option value="">${tr("track.onlineAuto")}</option>
        </select>
      </label>
      <div class="online-room-actions">
        <input
          id="online-room-id-input"
          type="text"
          maxlength="64"
          autocomplete="off"
          spellcheck="false"
          placeholder="${tr("track.onlineRoomPlaceholder")}"
        >
        <button id="online-room-refresh" class="btn ghost" type="button">${tr("track.onlineRoomRefresh")}</button>
      </div>
    `;
    trackPanel.insertBefore(wrapper, trackCards);

    ui.onlineRoomPicker = wrapper;
    ui.onlineRoomSelect = wrapper.querySelector("#online-room-select");
    ui.onlineRoomRefresh = wrapper.querySelector("#online-room-refresh");
    ui.onlineRoomIdInput = wrapper.querySelector("#online-room-id-input");
    if (!ui.onlineRoomSelect) {
      ui.onlineRoomSelect = document.getElementById("online-room-select");
    }
    if (!ui.onlineRoomRefresh) {
      ui.onlineRoomRefresh = document.getElementById("online-room-refresh");
    }
    if (!ui.onlineRoomIdInput) {
      ui.onlineRoomIdInput = document.getElementById("online-room-id-input");
    }
  }

  function syncOnlineRoomPickerVisibility() {
    if (!ui.onlineRoomPicker) {
      return;
    }
    const visible = state.playMode === "online" && state.currentScreen === "track";
    ui.onlineRoomPicker.hidden = !visible;
    ui.onlineRoomPicker.style.display = visible ? "" : "none";
  }

  function getResolvedOnlineRoomId() {
    const manualRoomId = normalizeOnlineRoomId(ui.onlineRoomIdInput?.value || "");
    const selectedRoomId = normalizeOnlineRoomId(ui.onlineRoomSelect?.value || "");
    const stateRoomId = normalizeOnlineRoomId(state.onlineRoomId);
    return manualRoomId || selectedRoomId || stateRoomId || "";
  }

  function renderOnlineRoomOptions() {
    if (!ui.onlineRoomSelect) {
      return;
    }

    const manualRoomId = normalizeOnlineRoomId(ui.onlineRoomIdInput?.value || "");
    const selectedBefore = normalizeOnlineRoomId(ui.onlineRoomSelect.value || state.onlineRoomId);
    const rooms = Array.isArray(state.onlineRoomOptions) ? state.onlineRoomOptions : [];
    ui.onlineRoomSelect.innerHTML = "";

    const autoOption = document.createElement("option");
    autoOption.value = "";
    autoOption.textContent = tr("track.onlineAuto");
    ui.onlineRoomSelect.appendChild(autoOption);

    for (const room of rooms) {
      if (!room?.roomId) {
        continue;
      }
      const option = document.createElement("option");
      option.value = room.roomId;
      const occupancy =
        Number.isFinite(room.clients) && Number.isFinite(room.maxClients) && room.maxClients > 0
          ? `${room.clients}/${room.maxClients}`
          : "-/-";
      const phaseLabel = localizeOnlinePhaseLabel(room.phase || "lobby");
      option.textContent = `${room.roomId} (${occupancy}, ${phaseLabel})`;
      ui.onlineRoomSelect.appendChild(option);
    }

    let selectedNow = "";
    ui.onlineRoomSelect.value = "";
    if (selectedBefore) {
      const hasSelected = rooms.some((room) => room.roomId === selectedBefore);
      if (hasSelected) {
        ui.onlineRoomSelect.value = selectedBefore;
        selectedNow = selectedBefore;
      }
    }
    if (!selectedNow && !manualRoomId && rooms.length > 0) {
      selectedNow = String(rooms[0].roomId || "");
      if (selectedNow) {
        ui.onlineRoomSelect.value = selectedNow;
      }
    }
    if (!manualRoomId) {
      state.onlineRoomId = selectedNow;
    }
  }

  async function refreshOnlineRooms({ silent = false } = {}) {
    if (state.playMode !== "online") {
      return;
    }
    const trackId = state.selectedTrackId || TRACK_DEFS[0]?.id || null;
    if (!trackId || typeof listOnlineRooms !== "function") {
      return;
    }

    if (ui.onlineRoomRefresh) {
      ui.onlineRoomRefresh.disabled = true;
    }
    const result = await listOnlineRooms({ trackId });
    if (ui.onlineRoomRefresh) {
      ui.onlineRoomRefresh.disabled = false;
    }

    if (!result?.ok) {
      state.onlineRoomOptions = [];
      state.onlineRoomOptionsTrackId = trackId;
      renderOnlineRoomOptions();
      if (!silent) {
        showToast(tr("toast.onlineRoomsFailed", { error: result?.error || "unknown_error" }));
      }
      return;
    }

    state.onlineRoomOptions = Array.isArray(result.rooms) ? result.rooms : [];
    state.onlineRoomOptionsTrackId = trackId;
    renderOnlineRoomOptions();
    if (!silent) {
      showToast(tr("toast.onlineRoomsFound", { count: state.onlineRoomOptions.length }));
    }
  }

  function initOnlineRoomUi() {
    ensureOnlineRoomPickerDom();
    renderOnlineRoomOptions();
    syncOnlineRoomPickerVisibility();

    if (ui.onlineRoomSelect) {
      ui.onlineRoomSelect.addEventListener("change", () => {
        const selected = normalizeOnlineRoomId(ui.onlineRoomSelect.value);
        state.onlineRoomId = selected;
        if (selected && ui.onlineRoomIdInput) {
          ui.onlineRoomIdInput.value = "";
        }
      });
    }

    if (ui.onlineRoomIdInput) {
      ui.onlineRoomIdInput.addEventListener("input", () => {
        const normalized = normalizeOnlineRoomId(ui.onlineRoomIdInput.value);
        if (ui.onlineRoomIdInput.value !== normalized) {
          ui.onlineRoomIdInput.value = normalized;
        }
        state.onlineRoomId = normalized;
      });
      ui.onlineRoomIdInput.addEventListener("blur", () => {
        const normalized = normalizeOnlineRoomId(ui.onlineRoomIdInput.value);
        ui.onlineRoomIdInput.value = normalized;
        state.onlineRoomId = normalized;
      });
    }

    if (ui.onlineRoomRefresh) {
      bindPress(ui.onlineRoomRefresh, () => {
        void refreshOnlineRooms();
      });
    }
  }

  function setLeaderboardStatus(text, { error = false } = {}) {
    if (!ui.leaderboardStatus) {
      return;
    }
    ui.leaderboardStatus.textContent = text;
    ui.leaderboardStatus.style.color = error ? "#ffbaa2" : "";
  }

  function renderLeaderboardTrackOptions() {
    if (!ui.leaderboardTrackSelect) {
      return;
    }
    const resolvedTrack = resolveTrackDef(getResolvedLeaderboardTrackId());
    if (resolvedTrack) {
      state.leaderboardTrackId = resolvedTrack.id;
    }

    ui.leaderboardTrackSelect.innerHTML = "";
    for (const track of TRACK_DEFS) {
      const option = document.createElement("option");
      option.value = track.id;
      option.textContent = localizeTrackText(track)?.name || track.name;
      ui.leaderboardTrackSelect.appendChild(option);
    }
    if (state.leaderboardTrackId) {
      ui.leaderboardTrackSelect.value = state.leaderboardTrackId;
    }
  }

  function renderLeaderboardRows(rows = []) {
    if (!ui.leaderboardBody) {
      return;
    }
    ui.leaderboardBody.innerHTML = "";
    if (!rows.length) {
      const rowEl = document.createElement("tr");
      rowEl.innerHTML = `<td colspan="4">${tr("leaderboard.empty")}</td>`;
      ui.leaderboardBody.appendChild(rowEl);
      return;
    }
    rows.forEach((row, index) => {
      const rowEl = document.createElement("tr");
      const rowTrackDef = resolveTrackDef(row?.metadata?.track_id || row?.trackId || state.leaderboardTrackId);
      const rowTrackName =
        localizeTrackText(rowTrackDef || row?.metadata?.track_id || row?.trackId || "")?.name ||
        state.leaderboardTrackId ||
        "-";
      rowEl.innerHTML = `
      <td>${Number.isFinite(row?.rank) ? row.rank : index + 1}</td>
      <td>${row?.username || "-"}</td>
      <td>${rowTrackName}</td>
      <td>${Number.isFinite(row?.score) ? formatMs(row.score) : "-"}</td>
    `;
      ui.leaderboardBody.appendChild(rowEl);
    });
  }

  async function refreshLeaderboard({ silent = false } = {}) {
    if (!ui.leaderboardTrackSelect || !ui.leaderboardBody) {
      if (!silent) {
        showToast(tr("toast.leaderboardScreenUnavailable"));
      }
      return;
    }

    const trackDef = resolveTrackDef(getResolvedLeaderboardTrackId());
    if (!trackDef) {
      setLeaderboardStatus(tr("leaderboard.unavailable"), { error: true });
      renderLeaderboardRows([]);
      return;
    }
    const localizedTrackName = localizeTrackText(trackDef)?.name || trackDef.name || "-";

    state.leaderboardTrackId = trackDef.id;
    ui.leaderboardTrackSelect.value = trackDef.id;
    if (leaderboardLoading) {
      return;
    }

    if (typeof getTrackLeaderboard !== "function") {
      setLeaderboardStatus(tr("leaderboard.unavailable"), { error: true });
      renderLeaderboardRows([]);
      if (!silent) {
        showToast(tr("toast.leaderboardUnavailable", { error: "client_api_unavailable" }));
      }
      return;
    }

    leaderboardLoading = true;
    if (ui.leaderboardRefresh) {
      ui.leaderboardRefresh.disabled = true;
    }
    setLeaderboardStatus(tr("leaderboard.loading", { track: localizedTrackName }));

    const result = await getTrackLeaderboard({
      trackId: trackDef.id,
      limit: LEADERBOARD_LIMIT,
    });

    leaderboardLoading = false;
    if (ui.leaderboardRefresh) {
      ui.leaderboardRefresh.disabled = false;
    }

    if (!result?.ok) {
      renderLeaderboardRows([]);
      const errorLabel = result?.error || "unknown_error";
      setLeaderboardStatus(tr("leaderboard.loadFailed", { error: errorLabel }), { error: true });
      if (!silent) {
        showToast(tr("toast.leaderboardUnavailable", { error: errorLabel }));
      }
      return;
    }

    const rows = Array.isArray(result.records) ? result.records : [];
    renderLeaderboardRows(rows);
    if (result.disabled) {
      setLeaderboardStatus(tr("leaderboard.disabled"));
    } else {
      setLeaderboardStatus(tr("leaderboard.loaded", { track: localizedTrackName, count: rows.length }));
    }
    if (!silent) {
      showToast(tr("toast.leaderboardUpdated", { count: rows.length }));
    }
  }

  function renderResultsRows(rows = []) {
    if (!ui.resultsBody) {
      return;
    }
    ui.resultsBody.innerHTML = "";
    for (const row of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
      <td>${row.rank}</td>
      <td>${row.name}</td>
      <td>${resolveSnakeName(row.snake)}</td>
      <td>${row.completedLap ? formatMs(row.timeMs) : readResultsProgressLabel(row)}</td>
    `;
      ui.resultsBody.appendChild(tr);
    }
  }

  function readResultsProgressLabel(row) {
    const meters = Number(row?.progressMeters);
    if (Number.isFinite(meters) && meters >= 0) {
      return tr("results.progressMeters", { value: Math.round(meters) });
    }
    return row?.progressLabel || tr("results.progressMeters", { value: 0 });
  }

  function buildOnlineResultsRows(snapshot) {
    const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
    const sorted = players
      .map((player) => {
        const finishTimeMs = Number(player?.finishTimeMs);
        const hasFinishTime = Number.isFinite(finishTimeMs) && finishTimeMs >= 0;
        const progress = Math.max(0, Number(player?.progress) || 0);
        return {
          name: String(player?.displayName || tr("fallback.player")),
          snake: resolveSnakeName(player?.typeId || player?.snakeId || "online"),
          finishTimeMs: hasFinishTime ? Math.floor(finishTimeMs) : null,
          progress,
        };
      })
      .sort((a, b) => {
        const aFinished = Number.isFinite(a.finishTimeMs);
        const bFinished = Number.isFinite(b.finishTimeMs);
        if (aFinished !== bFinished) {
          return aFinished ? -1 : 1;
        }
        if (aFinished && bFinished) {
          return a.finishTimeMs - b.finishTimeMs;
        }
        return b.progress - a.progress;
      });

    return sorted.map((entry, index) => ({
      rank: index + 1,
      name: entry.name,
      snake: entry.snake,
      completedLap: Number.isFinite(entry.finishTimeMs),
      timeMs: Number.isFinite(entry.finishTimeMs) ? entry.finishTimeMs : NaN,
      progressMeters: Math.round(entry.progress),
      progressLabel: tr("results.progressMeters", { value: Math.round(entry.progress) }),
    }));
  }

  function getOnlineFinishKey(snapshot) {
    const roomId = String(snapshot?.roomId || state.online?.roomId || "-");
    const raceEndMs = Number(snapshot?.raceEndedAtMs);
    if (Number.isFinite(raceEndMs) && raceEndMs > 0) {
      return `${roomId}|${raceEndMs}`;
    }
    const tick = Number(snapshot?.tick);
    return `${roomId}|tick:${Number.isFinite(tick) ? tick : "?"}`;
  }

  function maybeHandleOnlineFinishedSnapshot() {
    const snapshot = state.online?.snapshot;
    if (!snapshot) {
      onlineNoProgressSinceMs = 0;
      onlineLastMaxProgress = 0;
      onlineProgressWatchKey = "";
      return;
    }
    const players = Array.isArray(snapshot.players) ? snapshot.players : [];
    if (!players.length) {
      return;
    }

    const roomId = String(snapshot?.roomId || state.online?.roomId || "-");
    const trackId = normalizeTrackId(snapshot?.trackId || state.online?.trackId || state.selectedTrackId || "");
    const watchKey = `${roomId}|${trackId}`;
    if (watchKey !== onlineProgressWatchKey) {
      onlineProgressWatchKey = watchKey;
      onlineNoProgressSinceMs = 0;
      onlineLastMaxProgress = 0;
    }

    const maxProgress = players.reduce((acc, player) => Math.max(acc, Number(player?.progress) || 0), 0);
    const nowMs = Date.now();
    if (maxProgress > onlineLastMaxProgress + 1.2) {
      onlineLastMaxProgress = maxProgress;
      onlineNoProgressSinceMs = 0;
    } else if ((snapshot.phase || "") === "running") {
      const allSlow = players.every((player) => (Number(player?.speed) || 0) < 1.2);
      if (allSlow) {
        if (!onlineNoProgressSinceMs) {
          onlineNoProgressSinceMs = nowMs;
        }
      } else {
        onlineNoProgressSinceMs = 0;
      }
    }

    const explicitFinished =
      snapshot.phase === "finished" ||
      (Number.isFinite(Number(snapshot?.raceEndedAtMs)) && Number(snapshot.raceEndedAtMs) > 0) ||
      players.every((player) => player?.finished === true);
    const stalledRunningFallback =
      snapshot.phase === "running" &&
      onlineNoProgressSinceMs > 0 &&
      nowMs - onlineNoProgressSinceMs >= 9000;

    if (!explicitFinished && !stalledRunningFallback) {
      return;
    }

    const finishKey = explicitFinished
      ? getOnlineFinishKey(snapshot)
      : `${watchKey}|stalled:${Math.floor(onlineNoProgressSinceMs / 1000)}`;
    if (finishKey === lastHandledOnlineFinishKey) {
      return;
    }
    lastHandledOnlineFinishKey = finishKey;

    const trackDef = resolveTrackDef(snapshot.trackId || state.online?.trackId || state.selectedTrackId);
    if (trackDef) {
      state.lastFinishedTrackId = trackDef.id;
      state.selectedTrackId = trackDef.id;
    }
    state.lastResults = buildOnlineResultsRows(snapshot);
    renderResultsRows(state.lastResults);
    showScreen("results");
    void disconnectOnlineRace?.();
    if (stalledRunningFallback && !explicitFinished) {
      showToast(tr("toast.onlineStalledFinish"));
    } else {
      showToast(tr("toast.onlineFinish"));
    }
  }

  function showOnlineRulesOverlay() {
    if (!ui.overlay) {
      return;
    }
    ui.overlay.textContent = tr("race.goalOverlay");
    ui.overlay.classList.remove("countdown", COUNTDOWN_BURST_CLASS, "overlay-go", "overlay-finish");
    ui.overlay.classList.add("overlay-rules", "visible");
    ui.overlay.style.setProperty("--overlay-color", "#ffe4bd");
  }

  function triggerOnlineCountdownBurst(second) {
    if (!ui.overlay) {
      return;
    }
    ui.overlay.textContent = String(second);
    ui.overlay.classList.remove("overlay-rules", "overlay-go", "overlay-finish", COUNTDOWN_BURST_CLASS);
    ui.overlay.classList.add("countdown", "visible");
    ui.overlay.style.removeProperty("--overlay-color");
    void ui.overlay.offsetWidth;
    ui.overlay.classList.add(COUNTDOWN_BURST_CLASS);
  }

  function syncOnlinePhaseOverlay() {
    if (state.playMode !== "online") {
      return;
    }

    if (state.currentScreen !== "race") {
      clearRaceOverlay();
      return;
    }

    const snapshot = state.online?.snapshot;
    if (!snapshot) {
      clearRaceOverlay();
      return;
    }

    const phase = String(snapshot.phase || "");
    if (phase === "rules") {
      onlineOverlayLastCountdownSecond = null;
      showOnlineRulesOverlay();
      return;
    }

    if (phase === "countdown") {
      let remainMs = Number(snapshot.countdownRemainingMs);
      if (!Number.isFinite(remainMs)) {
        const countdownEndsAtMs = Number(snapshot.countdownEndsAtMs);
        const serverNowMs = Number(snapshot.serverNowMs);
        if (Number.isFinite(countdownEndsAtMs)) {
          if (Number.isFinite(serverNowMs) && Number.isFinite(state.online?.lastSnapshotAtMs)) {
            const drift = Date.now() - state.online.lastSnapshotAtMs;
            remainMs = countdownEndsAtMs - (serverNowMs + Math.max(0, drift));
          } else {
            remainMs = countdownEndsAtMs - Date.now();
          }
        }
      }
      remainMs = Number.isFinite(remainMs) ? Math.max(0, remainMs) : 0;
      const second = Math.max(1, Math.min(ONLINE_COUNTDOWN_MAX_SECONDS, Math.ceil(remainMs / 1000)));
      if (onlineOverlayLastCountdownSecond !== second) {
        onlineOverlayLastCountdownSecond = second;
        triggerOnlineCountdownBurst(second);
      } else if (ui.overlay) {
        ui.overlay.classList.add("visible", "countdown");
      }
      return;
    }

    clearRaceOverlay();
  }

  function resetOnlineFinishWatchers() {
    lastHandledOnlineFinishKey = "";
    onlineNoProgressSinceMs = 0;
    onlineLastMaxProgress = 0;
    onlineProgressWatchKey = "";
  }

  function wireUi() {
    initPlayerNameUi();
    initLanguageUi();
    initRulesModalUi();
    initAboutModalUi();
    initTouchControlsUi();
    initOnlineRoomUi();
    renderLeaderboardTrackOptions();
    renderLeaderboardRows([]);

    bindPress(document.getElementById("btn-offline"), () => {
      state.playMode = "offline";
      state.onlineRoomId = "";
      resetOnlineFinishWatchers();
      void disconnectOnlineRace?.();
      showScreen("snake");
      showToast(tr("toast.offlineActivated"));
    });

    bindPress(document.getElementById("btn-online"), () => {
      state.playMode = "online";
      showScreen("snake");
      showToast(tr("toast.onlineHint"));
      if (state.onlineRoomOptionsTrackId !== state.selectedTrackId) {
        void refreshOnlineRooms({ silent: true });
      }
    });

    bindPress(document.getElementById("btn-leaderboards"), () => {
      const baseTrack = resolveTrackDef(state.selectedTrackId || TRACK_DEFS[0]?.id);
      if (baseTrack) {
        state.leaderboardTrackId = baseTrack.id;
      }
      renderLeaderboardTrackOptions();
      showScreen("leaderboard");
      void refreshLeaderboard();
    });

    if (ui.modeClassic) {
      bindPress(ui.modeClassic, () => setOfflineMode(OFFLINE_MODES.CLASSIC));
    }
    if (ui.modeDebug) {
      bindPress(ui.modeDebug, () => setOfflineMode(OFFLINE_MODES.DEBUG));
    }

    bindPress(document.getElementById("snake-back"), () => showScreen("main"));
    bindPress(document.getElementById("snake-next"), () => showScreen("track"));
    bindPress(document.getElementById("track-back"), () => showScreen("snake"));
    bindPress(document.getElementById("track-start"), () => {
      if (!state.selectedTrackId) {
        return;
      }
      void startRace(state.selectedTrackId);
    });

    bindPress(document.getElementById("results-retry"), () => {
      if (state.selectedTrackId) {
        void startRace(state.selectedTrackId);
      }
    });

    bindPress(document.getElementById("results-next"), () => {
      if (!TRACK_DEFS.length) {
        return;
      }
      const currentTrackId = state.lastFinishedTrackId || state.selectedTrackId || TRACK_DEFS[0].id;
      const nextTrack = getNextTrackDef(currentTrackId);
      state.selectedTrackId = nextTrack.id;
      void startRace(nextTrack.id);
    });

    bindPress(document.getElementById("results-back"), () => {
      resetOnlineFinishWatchers();
      void disconnectOnlineRace?.();
      state.race = null;
      renderTrackCards();
      showScreen("main");
    });

    if (ui.leaderboardTrackSelect) {
      ui.leaderboardTrackSelect.addEventListener("change", () => {
        const trackDef = resolveTrackDef(ui.leaderboardTrackSelect.value);
        if (!trackDef) {
          return;
        }
        state.leaderboardTrackId = trackDef.id;
        void refreshLeaderboard({ silent: true });
      });
    }

    if (ui.leaderboardRefresh) {
      bindPress(ui.leaderboardRefresh, () => {
        void refreshLeaderboard();
      });
    }

    const leaderboardBack = document.getElementById("leaderboard-back");
    if (leaderboardBack) {
      bindPress(leaderboardBack, () => showScreen("main"));
    }

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("resize", () => {
      if (state.phaserGame) {
        state.phaserGame.scale.refresh();
      }
      syncTouchControlsVisibility();
    });

    if (!onlineInputPumpId) {
      onlineInputPumpId = window.setInterval(() => {
        pushOnlineInput(false);
        syncOnlinePhaseOverlay();
        maybeHandleOnlineFinishedSnapshot();
      }, ONLINE_INPUT_PUSH_INTERVAL_MS);
    }
  }

  function onKeyDown(event) {
    const isEscape = event.code === "Escape" || event.key === "Escape";
    if (isEscape && rulesModalOpen) {
      event.preventDefault();
      closeRulesModal();
      return;
    }
    if (isEscape && aboutModalOpen) {
      event.preventDefault();
      closeAboutModal();
      return;
    }

    if (state.currentScreen === "race" && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code || event.key)) {
      event.preventDefault();
    }

    state.keyMap.add(event.code);
    const isRestartKey = event.code === "KeyR" || event.key === "r" || event.key === "R";
    const restartTrackId = state.race?.trackDef?.id || state.selectedTrackId || state.online?.trackId;
    pushOnlineInput(true);

    if (isRestartKey && state.currentScreen === "race" && restartTrackId) {
      event.preventDefault();
      const now = performance.now();
      if (now - state.lastRestartAtMs < RESTART_DEBOUNCE_MS) {
        return;
      }
      void startRace(restartTrackId);
    }
  }

  function onKeyUp(event) {
    state.keyMap.delete(event.code);
    pushOnlineInput(true);
  }

  function showScreen(name) {
    Object.entries(ui.screens).forEach(([id, node]) => {
      if (!node) {
        return;
      }
      node.classList.toggle("active", id === name);
    });
    state.currentScreen = name;
    document.body.classList.toggle("race-screen-active", name === "race");

    if (name !== "race") {
      clearRaceOverlay();
    } else if (state.phaserGame) {
      setTimeout(() => {
        if (state.phaserGame) {
          state.phaserGame.scale.refresh();
        }
      }, 0);
      if (state.playMode === "online") {
        syncOnlinePhaseOverlay();
      }
    }

    if (name !== "main" && rulesModalOpen) {
      closeRulesModal();
    }
    if (name !== "main" && aboutModalOpen) {
      closeAboutModal();
    }
    if (name !== "race") {
      clearTouchJoystickControl();
    }

    syncOnlineRoomPickerVisibility();
    syncTouchControlsVisibility();
    if (name === "track" && state.playMode === "online") {
      if (state.onlineRoomOptionsTrackId !== state.selectedTrackId) {
        void refreshOnlineRooms({ silent: true });
      } else {
        renderOnlineRoomOptions();
      }
    }
    if (name === "leaderboard") {
      renderLeaderboardTrackOptions();
      void refreshLeaderboard({ silent: true });
    }

    syncRaceMusic();
  }

  function getSnakeSpritePath(snakeId, fileName) {
    return `/assets/sprites/snakes/${snakeId}/${fileName}`;
  }

  function renderSnakeCards() {
    ui.snakeCards.innerHTML = "";
    for (const snake of SNAKES) {
      const localizedSnake = localizeSnakeText(snake);
      const headSprite = getSnakeSpritePath(snake.id, "head.png");
      const segmentSprite = getSnakeSpritePath(snake.id, "segment.png");
      const card = document.createElement("button");
      card.className = "card card--snake";
      card.type = "button";
      card.innerHTML = `
      <div class="snake-card__header">
        <div class="snake-card__preview" aria-hidden="true">
          <img class="snake-card__segment snake-card__segment--tip" src="${segmentSprite}" alt="">
          <img class="snake-card__segment snake-card__segment--tail" src="${segmentSprite}" alt="">
          <img class="snake-card__segment snake-card__segment--mid" src="${segmentSprite}" alt="">
          <img class="snake-card__segment snake-card__segment--front" src="${segmentSprite}" alt="">
          <img class="snake-card__head" src="${headSprite}" alt="${localizedSnake.name}">
        </div>
        <div>
          <h3 style="color:${snake.color}">${localizedSnake.name}</h3>
          <p>${localizedSnake.flavor}</p>
        </div>
      </div>
      <ul>
        <li>${tr("snake.stat.maxSpeed", { value: Math.round(snake.stats.maxSpeed) })}</li>
        <li>${tr("snake.stat.turn", { value: snake.stats.turnRate.toFixed(2) })}</li>
        <li>${tr("snake.stat.offroadPenalty", { value: (snake.stats.offroadPenalty * 100).toFixed(0) })}</li>
      </ul>
    `;
      bindPress(card, () => {
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
      const localizedTrack = localizeTrackText(track);
      const best = loadBestTime(track.id);
      const card = document.createElement("button");
      card.className = "card card--track";
      card.type = "button";
      card.innerHTML = `
      <h3>${localizedTrack.name}</h3>
      <p>${localizedTrack.subtitle}</p>
      <ul>
        <li>${tr("track.bestLocal", { value: Number.isFinite(best) ? formatMs(best) : "-" })}</li>
        <li>${tr("track.roadWidth", { value: track.roadWidth })}</li>
      </ul>
      `;
      bindPress(card, () => {
        const previousTrackId = state.selectedTrackId;
        state.selectedTrackId = track.id;
        ui.trackStart.disabled = false;
        [...ui.trackCards.children].forEach((node) => node.classList.remove("selected"));
        card.classList.add("selected");
        if (state.playMode === "online") {
          if (state.onlineRoomOptionsTrackId !== track.id || previousTrackId !== track.id) {
            void refreshOnlineRooms({ silent: true });
          } else {
            renderOnlineRoomOptions();
          }
        }
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

  function shortestAngleDelta(current, target) {
    let diff = (Number(target) || 0) - (Number(current) || 0);
    while (diff > Math.PI) {
      diff -= Math.PI * 2;
    }
    while (diff < -Math.PI) {
      diff += Math.PI * 2;
    }
    return diff;
  }

  function resolveOnlineControlledHeading() {
    const snapshotPlayers = Array.isArray(state.online?.snapshot?.players) ? state.online.snapshot.players : [];
    if (!snapshotPlayers.length) {
      return NaN;
    }

    const sessionId = String(state.online?.sessionId || "");
    const bySession = sessionId
      ? snapshotPlayers.find((player) => String(player?.sessionId || "") === sessionId)
      : null;

    if (bySession && Number.isFinite(Number(bySession.heading))) {
      return Number(bySession.heading);
    }

    const localName = String(state.playerName || "")
      .trim()
      .toLowerCase();
    const byName = localName
      ? snapshotPlayers.find(
          (player) =>
            !player?.isBot && String(player?.displayName || "").trim().toLowerCase() === localName,
        )
      : null;
    return Number.isFinite(Number(byName?.heading)) ? Number(byName.heading) : NaN;
  }

  function deriveVirtualTurnFromAim(baseVirtualTurn = 0) {
    const aimAngle = Number(state.virtualInput?.aimAngle);
    const magnitude = clamp01(state.virtualInput?.magnitude || 0);
    if (!Number.isFinite(aimAngle) || magnitude < TOUCH_THROTTLE_DEADZONE) {
      return clampUnit(baseVirtualTurn);
    }

    const heading = resolveOnlineControlledHeading();
    if (!Number.isFinite(heading)) {
      return clampUnit(baseVirtualTurn);
    }

    const delta = shortestAngleDelta(heading, aimAngle);
    return clampUnit(delta * TOUCH_AIM_TURN_GAIN);
  }

  function buildOnlineInputFromKeys() {
    const left = state.keyMap.has("ArrowLeft") || state.keyMap.has("KeyA");
    const right = state.keyMap.has("ArrowRight") || state.keyMap.has("KeyD");
    const up = state.keyMap.has("ArrowUp") || state.keyMap.has("KeyW");
    const down = state.keyMap.has("ArrowDown") || state.keyMap.has("KeyS");
    const virtualTurnBase = clampUnit(state.virtualInput?.turn || 0);
    const virtualTurn = deriveVirtualTurnFromAim(virtualTurnBase);
    const virtualThrottle = clamp01(state.virtualInput?.throttle || 0);
    const virtualBrake = clamp01(state.virtualInput?.brake || 0);
    return {
      turn: clampUnit((left ? -1 : 0) + (right ? 1 : 0) + virtualTurn),
      throttle: Math.max(up ? 1 : 0, virtualThrottle),
      brake: Math.max(down ? 1 : 0, virtualBrake),
    };
  }

  function pushOnlineInput(force = false) {
    if (state.playMode !== "online" || state.currentScreen !== "race") {
      lastOnlineInputSignature = "";
      return;
    }

    const payload = buildOnlineInputFromKeys();
    const signature = `${payload.turn}|${payload.throttle}|${payload.brake}`;
    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    const shouldSend =
      force ||
      signature !== lastOnlineInputSignature ||
      nowMs - lastOnlineInputSentAtMs >= ONLINE_INPUT_KEEPALIVE_MS;
    if (!shouldSend) {
      return;
    }

    const sent = sendOnlineInput?.(payload);
    if (sent) {
      lastOnlineInputSignature = signature;
      lastOnlineInputSentAtMs = nowMs;
    }
  }

  function getNextTrackDef(currentTrackId) {
    const currentIndex = getTrackIndexById(currentTrackId);
    let next = TRACK_DEFS[(currentIndex + 1) % TRACK_DEFS.length];
    if (TRACK_DEFS.length > 1 && next.id === currentTrackId) {
      next = TRACK_DEFS[(currentIndex + 2) % TRACK_DEFS.length];
    }
    return next;
  }

  async function startRace(trackId) {
    const trackDef = TRACK_DEFS.find((item) => item.id === trackId);
    if (!trackDef) {
      return false;
    }

    state.lastRestartAtMs = performance.now();
    state.selectedTrackId = trackDef.id;
    state.lastFinishedTrackId = null;
    state.keyMap.clear();
    resetVirtualInputState();
    setTouchJoystickVisual(0, 0);
    resetOnlineFinishWatchers();

    if (state.playMode === "online") {
      state.race = null;
      clearRaceOverlay();
      showScreen("race");
      syncRaceMusic();

      const selectedSnake = SNAKES.find((item) => item.id === state.selectedSnakeId) || SNAKES[0];
      const selectedSnakeLocalized = localizeSnakeText(selectedSnake);
      const selectedRoomId = getResolvedOnlineRoomId();
      state.onlineRoomId = selectedRoomId;
      const connectResult = await startOnlineRace?.({
        trackId: trackDef.id,
        playerName: getResolvedPlayerName() || `${tr("fallback.player")} (${selectedSnakeLocalized.name})`,
        roomId: selectedRoomId,
        snakeId: selectedSnake.id,
      });

      if (!connectResult?.ok) {
        showScreen("track");
        showToast(tr("toast.onlineConnectFailed", { error: connectResult?.error || "unknown_error" }));
        return false;
      }

      const connectedRoomId = normalizeOnlineRoomId(connectResult.roomId || selectedRoomId);
      state.onlineRoomId = connectedRoomId;
      if (connectedRoomId && !state.onlineRoomOptions.some((room) => room.roomId === connectedRoomId)) {
        state.onlineRoomOptions = [
          {
            roomId: connectedRoomId,
            trackId: trackDef.id,
            phase: "lobby",
            clients: 1,
            maxClients: 4,
            locked: false,
          },
          ...state.onlineRoomOptions,
        ];
      }
      if (ui.onlineRoomIdInput && ui.onlineRoomIdInput.value.trim()) {
        ui.onlineRoomIdInput.value = connectedRoomId;
      }
      renderOnlineRoomOptions();
      if (ui.onlineRoomSelect && connectedRoomId) {
        ui.onlineRoomSelect.value = connectedRoomId;
      }

      syncRaceMusic();
      const endpointLabel = connectResult.endpoint ? ` (${connectResult.endpoint})` : "";
      showToast(
        tr("toast.onlineConnected", {
          room: connectResult.roomId || "-",
          endpoint: endpointLabel,
        }),
      );
      pushOnlineInput(true);
      return true;
    }

    await disconnectOnlineRace?.();

    const debugMode = isDebugMode();
    const selectedSnake = SNAKES.find((item) => item.id === state.selectedSnakeId) || SNAKES[0];
    const sceneNowMs = Number.isFinite(state.raceScene?.time?.now) ? state.raceScene.time.now : performance.now();
    state.race = createRaceState(trackDef, selectedSnake, debugMode, sceneNowMs);

    clearRaceOverlay();
    showScreen("race");
    syncRaceMusic();

    if (debugMode) {
      showToast(tr("toast.debugRace"));
    } else {
      showToast(tr("toast.classicRace"));
    }
    return true;
  }

  return {
    wireUi,
    onKeyDown,
    onKeyUp,
    showScreen,
    renderSnakeCards,
    renderTrackCards,
    getTrackIndexById,
    getNextTrackDef,
    startRace,
  };
}
