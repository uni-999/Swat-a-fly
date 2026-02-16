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
} = {}) {
  const PLAYER_NAME_STORAGE_KEY = "polzunki_player_name_v1";
  const PLAYER_NAME_MAX_LENGTH = 24;
  const DEFAULT_PLAYER_NAME = "Player";
  const ONLINE_ROOM_ID_MAX_LENGTH = 64;
  const ONLINE_INPUT_PUSH_INTERVAL_MS = 50;
  const ONLINE_INPUT_KEEPALIVE_MS = 220;
  const LEADERBOARD_LIMIT = 20;
  const RULES_GOAL_TEXT = "ЦЕЛЬ: ПРОЙТИ 3 КРУГА НА МАКСИМАЛЬНОЙ СКОРОСТИ";
  const ONLINE_COUNTDOWN_MAX_SECONDS = 3;
  const COUNTDOWN_BURST_CLASS = "countdown-burst";
  const TOUCH_JOYSTICK_RADIUS_PX = 46;
  const TOUCH_TURN_DEADZONE = 0.12;
  const TOUCH_THROTTLE_DEADZONE = 0.08;
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
    return normalizePlayerName(state.playerName) || DEFAULT_PLAYER_NAME;
  }

  function applyPlayerNameFromInput() {
    if (!ui.playerNameInput) {
      state.playerName = getResolvedPlayerName();
      return;
    }

    const normalized = normalizePlayerName(ui.playerNameInput.value);
    const resolved = normalized || DEFAULT_PLAYER_NAME;
    state.playerName = resolved;
    if (ui.playerNameInput.value !== normalized) {
      ui.playerNameInput.value = normalized;
    }
    persistPlayerName(resolved);
  }

  function initPlayerNameUi() {
    const normalizedStoredName = normalizePlayerName(loadStoredPlayerName());
    state.playerName = normalizedStoredName || DEFAULT_PLAYER_NAME;

    if (!ui.playerNameInput) {
      return;
    }

    ui.playerNameInput.value = normalizedStoredName;
    ui.playerNameInput.addEventListener("input", () => applyPlayerNameFromInput());
    ui.playerNameInput.addEventListener("change", () => applyPlayerNameFromInput());
    ui.playerNameInput.addEventListener("blur", () => applyPlayerNameFromInput());
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

  function initRulesModalUi() {
    if (ui.rulesButton) {
      ui.rulesButton.addEventListener("click", () => openRulesModal());
    }
    if (ui.rulesClose) {
      ui.rulesClose.addEventListener("click", () => closeRulesModal());
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
      ui.aboutButton.addEventListener("click", () => openAboutModal());
    }
    if (ui.aboutClose) {
      ui.aboutClose.addEventListener("click", () => closeAboutModal());
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
      state.virtualInput = { turn: 0, throttle: 0, brake: 0, active: false };
      return;
    }
    state.virtualInput.turn = 0;
    state.virtualInput.throttle = 0;
    state.virtualInput.brake = 0;
    state.virtualInput.active = false;
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

    const turnRaw = clampUnit(dx / TOUCH_JOYSTICK_RADIUS_PX);
    const upRaw = clamp01((-dy) / TOUCH_JOYSTICK_RADIUS_PX);
    const downRaw = clamp01(dy / TOUCH_JOYSTICK_RADIUS_PX);
    const turn = Math.abs(turnRaw) >= TOUCH_TURN_DEADZONE ? turnRaw : 0;
    const throttle = upRaw >= TOUCH_THROTTLE_DEADZONE ? upRaw : 0;
    const brake = downRaw >= TOUCH_THROTTLE_DEADZONE ? downRaw : 0;

    state.virtualInput.turn = turn;
    state.virtualInput.throttle = throttle;
    state.virtualInput.brake = brake;
    state.virtualInput.active = Math.abs(turn) > 0 || throttle > 0 || brake > 0;
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
      ui.touchJoystick.setPointerCapture(event.pointerId);
      applyTouchJoystickFromPointer(event);
      event.preventDefault();
    });

    ui.touchJoystick.addEventListener("pointermove", (event) => {
      if (touchJoystickPointerId !== event.pointerId) {
        return;
      }
      applyTouchJoystickFromPointer(event);
      event.preventDefault();
    });

    const clearPointer = (event) => {
      if (touchJoystickPointerId !== event.pointerId) {
        return;
      }
      clearTouchJoystickControl();
      event.preventDefault();
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
        <span>Комната (онлайн)</span>
        <select id="online-room-select">
          <option value="">Авто: подключиться или создать</option>
        </select>
      </label>
      <div class="online-room-actions">
        <input
          id="online-room-id-input"
          type="text"
          maxlength="64"
          autocomplete="off"
          spellcheck="false"
          placeholder="Или введите ID комнаты вручную"
        >
        <button id="online-room-refresh" class="btn ghost" type="button">Обновить список</button>
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
    autoOption.textContent = "Авто: подключиться или создать";
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
      const phaseLabel = room.phase || "lobby";
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
        showToast(`Не удалось получить список комнат: ${result?.error || "unknown_error"}`);
      }
      return;
    }

    state.onlineRoomOptions = Array.isArray(result.rooms) ? result.rooms : [];
    state.onlineRoomOptionsTrackId = trackId;
    renderOnlineRoomOptions();
    if (!silent) {
      showToast(`Комнат найдено: ${state.onlineRoomOptions.length}`);
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
      ui.onlineRoomRefresh.addEventListener("click", () => {
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
      option.textContent = track.name;
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
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="4">Нет записей для выбранной трассы.</td>`;
      ui.leaderboardBody.appendChild(tr);
      return;
    }
    rows.forEach((row, index) => {
      const tr = document.createElement("tr");
      const rowTrackDef = resolveTrackDef(row?.metadata?.track_id || row?.trackId || state.leaderboardTrackId);
      const rowTrackName = rowTrackDef?.name || state.leaderboardTrackId || "-";
      tr.innerHTML = `
      <td>${Number.isFinite(row?.rank) ? row.rank : index + 1}</td>
      <td>${row?.username || "-"}</td>
      <td>${rowTrackName}</td>
      <td>${Number.isFinite(row?.score) ? formatMs(row.score) : "-"}</td>
    `;
      ui.leaderboardBody.appendChild(tr);
    });
  }

  async function refreshLeaderboard({ silent = false } = {}) {
    if (!ui.leaderboardTrackSelect || !ui.leaderboardBody) {
      if (!silent) {
        showToast("Экран таблицы лидеров недоступен в этой сборке интерфейса.");
      }
      return;
    }

    const trackDef = resolveTrackDef(getResolvedLeaderboardTrackId());
    if (!trackDef) {
      setLeaderboardStatus("Не удалось определить трассу.", { error: true });
      renderLeaderboardRows([]);
      return;
    }

    state.leaderboardTrackId = trackDef.id;
    ui.leaderboardTrackSelect.value = trackDef.id;
    if (leaderboardLoading) {
      return;
    }

    if (typeof getTrackLeaderboard !== "function") {
      setLeaderboardStatus("Сервис лидерборда недоступен.", { error: true });
      renderLeaderboardRows([]);
      if (!silent) {
        showToast("Не удалось загрузить лидерборд: клиентский API не подключен.");
      }
      return;
    }

    leaderboardLoading = true;
    if (ui.leaderboardRefresh) {
      ui.leaderboardRefresh.disabled = true;
    }
    setLeaderboardStatus(`Загрузка: ${trackDef.name}...`);

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
      setLeaderboardStatus(`Не удалось загрузить таблицу: ${result?.error || "unknown_error"}`, { error: true });
      if (!silent) {
        showToast(`Лидерборд недоступен: ${result?.error || "unknown_error"}`);
      }
      return;
    }

    const rows = Array.isArray(result.records) ? result.records : [];
    renderLeaderboardRows(rows);
    if (result.disabled) {
      setLeaderboardStatus("Nakama отключен: таблица пока пустая.");
    } else {
      setLeaderboardStatus(`Трасса: ${trackDef.name}. Записей: ${rows.length}.`);
    }
    if (!silent) {
      showToast(`Лидерборд обновлён: ${rows.length} записей.`);
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
      <td>${row.snake}</td>
      <td>${row.completedLap ? formatMs(row.timeMs) : row.progressLabel}</td>
    `;
      ui.resultsBody.appendChild(tr);
    }
  }

  function buildOnlineResultsRows(snapshot) {
    const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
    const sorted = players
      .map((player) => {
        const finishTimeMs = Number(player?.finishTimeMs);
        const hasFinishTime = Number.isFinite(finishTimeMs) && finishTimeMs >= 0;
        const progress = Math.max(0, Number(player?.progress) || 0);
        return {
          name: String(player?.displayName || "Player"),
          snake: String(player?.typeId || player?.snakeId || "online"),
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
      progressLabel: `Прогресс: ${Math.round(entry.progress)} м`,
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
      showToast("Онлайн-заезд завершен по прогрессу: движения нет слишком долго.");
    } else {
      showToast("Финиш онлайн-заезда: таблица результатов обновлена.");
    }
  }

  function showOnlineRulesOverlay() {
    if (!ui.overlay) {
      return;
    }
    ui.overlay.textContent = RULES_GOAL_TEXT;
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
    initRulesModalUi();
    initAboutModalUi();
    initTouchControlsUi();
    initOnlineRoomUi();
    renderLeaderboardTrackOptions();
    renderLeaderboardRows([]);

    document.getElementById("btn-offline").addEventListener("click", () => {
      state.playMode = "offline";
      state.onlineRoomId = "";
      resetOnlineFinishWatchers();
      void disconnectOnlineRace?.();
      showScreen("snake");
      showToast("Офлайн-режим активирован.");
    });

    document.getElementById("btn-online").addEventListener("click", () => {
      state.playMode = "online";
      showScreen("snake");
      showToast("Онлайн MVP: выбери змею и трассу, затем нажми Старт для подключения к комнате.");
      if (state.onlineRoomOptionsTrackId !== state.selectedTrackId) {
        void refreshOnlineRooms({ silent: true });
      }
    });

    document.getElementById("btn-leaderboards").addEventListener("click", () => {
      const baseTrack = resolveTrackDef(state.selectedTrackId || TRACK_DEFS[0]?.id);
      if (baseTrack) {
        state.leaderboardTrackId = baseTrack.id;
      }
      renderLeaderboardTrackOptions();
      showScreen("leaderboard");
      void refreshLeaderboard();
    });

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
      void startRace(state.selectedTrackId);
    });

    document.getElementById("results-retry").addEventListener("click", () => {
      if (state.selectedTrackId) {
        void startRace(state.selectedTrackId);
      }
    });

    document.getElementById("results-next").addEventListener("click", () => {
      if (!TRACK_DEFS.length) {
        return;
      }
      const currentTrackId = state.lastFinishedTrackId || state.selectedTrackId || TRACK_DEFS[0].id;
      const nextTrack = getNextTrackDef(currentTrackId);
      state.selectedTrackId = nextTrack.id;
      void startRace(nextTrack.id);
    });

    document.getElementById("results-back").addEventListener("click", () => {
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
      ui.leaderboardRefresh.addEventListener("click", () => {
        void refreshLeaderboard();
      });
    }

    const leaderboardBack = document.getElementById("leaderboard-back");
    if (leaderboardBack) {
      leaderboardBack.addEventListener("click", () => showScreen("main"));
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

  function buildOnlineInputFromKeys() {
    const left = state.keyMap.has("ArrowLeft") || state.keyMap.has("KeyA");
    const right = state.keyMap.has("ArrowRight") || state.keyMap.has("KeyD");
    const up = state.keyMap.has("ArrowUp") || state.keyMap.has("KeyW");
    const down = state.keyMap.has("ArrowDown") || state.keyMap.has("KeyS");
    const virtualTurn = clampUnit(state.virtualInput?.turn || 0);
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
      const selectedRoomId = getResolvedOnlineRoomId();
      state.onlineRoomId = selectedRoomId;
      const connectResult = await startOnlineRace?.({
        trackId: trackDef.id,
        playerName: getResolvedPlayerName() || `Player (${selectedSnake.name})`,
        roomId: selectedRoomId,
        snakeId: selectedSnake.id,
      });

      if (!connectResult?.ok) {
        showScreen("track");
        showToast(`Не удалось подключиться к онлайн-комнате: ${connectResult?.error || "unknown_error"}`);
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
      showToast(`Онлайн: подключено к комнате ${connectResult.roomId || "-"}${endpointLabel}.`);
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
      showToast("DEBUG: 4 бота на автопилоте.");
    } else {
      showToast("Классический офлайн: 1 игрок + 3 бота.");
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
