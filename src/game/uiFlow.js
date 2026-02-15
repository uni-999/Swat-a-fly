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

  function normalizeOnlineRoomId(rawRoomId) {
    return String(rawRoomId ?? "")
      .trim()
      .slice(0, ONLINE_ROOM_ID_MAX_LENGTH);
  }

  function syncOnlineRoomPickerVisibility() {
    if (!ui.onlineRoomPicker) {
      return;
    }
    ui.onlineRoomPicker.hidden = !(state.playMode === "online" && state.currentScreen === "track");
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

  function wireUi() {
    initPlayerNameUi();
    initOnlineRoomUi();

    document.getElementById("btn-offline").addEventListener("click", () => {
      state.playMode = "offline";
      state.onlineRoomId = "";
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

    document.getElementById("btn-leaderboards").addEventListener("click", () =>
      showToast("Таблица лидеров будет подключена отдельным экраном в следующем шаге.")
    );

    document.getElementById("btn-settings").addEventListener("click", () =>
      showToast("Настройки будут доработаны после стабилизации online-flow.")
    );

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
      void disconnectOnlineRace?.();
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
    const restartTrackId = state.race?.trackDef?.id || state.selectedTrackId || state.online?.trackId;
    pushOnlineInput();

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
    pushOnlineInput();
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

    syncOnlineRoomPickerVisibility();
    if (name === "track" && state.playMode === "online") {
      if (state.onlineRoomOptionsTrackId !== state.selectedTrackId) {
        void refreshOnlineRooms({ silent: true });
      } else {
        renderOnlineRoomOptions();
      }
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
    return {
      turn: (left ? -1 : 0) + (right ? 1 : 0),
      throttle: up ? 1 : 0,
      brake: down ? 1 : 0,
    };
  }

  function pushOnlineInput() {
    if (state.playMode !== "online" || state.currentScreen !== "race") {
      return;
    }
    sendOnlineInput?.(buildOnlineInputFromKeys());
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

    if (state.playMode === "online") {
      state.race = null;
      showScreen("race");
      syncRaceMusic();

      const selectedSnake = SNAKES.find((item) => item.id === state.selectedSnakeId) || SNAKES[0];
      const selectedRoomId = getResolvedOnlineRoomId();
      state.onlineRoomId = selectedRoomId;
      const connectResult = await startOnlineRace?.({
        trackId: trackDef.id,
        playerName: getResolvedPlayerName() || `Player (${selectedSnake.name})`,
        roomId: selectedRoomId,
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
      pushOnlineInput();
      return true;
    }

    await disconnectOnlineRace?.();

    const debugMode = isDebugMode();
    const selectedSnake = SNAKES.find((item) => item.id === state.selectedSnakeId) || SNAKES[0];
    const sceneNowMs = Number.isFinite(state.raceScene?.time?.now) ? state.raceScene.time.now : performance.now();
    state.race = createRaceState(trackDef, selectedSnake, debugMode, sceneNowMs);

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
