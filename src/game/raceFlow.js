import {
  RACE_RULES_SPLASH_MS,
  RACE_RULES_SPLASH_TEXT,
  RACE_COUNTDOWN_TOTAL_MS,
  RACE_COUNTDOWN_SECONDS,
  BODY_CROSSING_START_GRACE_MS,
  STARVATION_DECAY_INTERVAL_MS,
  RACE_START_LAUNCH_SPEED_FACTOR,
  RACE_START_GHOST_MS,
  COUNTDOWN_BURST_ANIM_CLASS,
  RACE_TIMEOUT_MS,
  STORAGE_PREFIX,
} from "./config.js";
import { SNAKES } from "./catalog.js";
import { clamp } from "./utils.js";

const snakeNameById = new Map(
  (Array.isArray(SNAKES) ? SNAKES : [])
    .filter((snake) => snake?.id && snake?.name)
    .map((snake) => [String(snake.id).toLowerCase(), String(snake.name)])
);

function resolveSnakeName(rawSnakeId) {
  const normalized = String(rawSnakeId ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return "Змея";
  }
  return snakeNameById.get(normalized) || String(rawSnakeId);
}

export function createRaceFlowApi({
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
} = {}) {
  function updateRace(race, nowMs, dt) {
    if (race.phase === "rules") {
      const remain = Math.max(0, RACE_RULES_SPLASH_MS - (nowMs - race.rulesStartMs));
      if (remain <= 0) {
        race.phase = "countdown";
        race.countdownStartMs = nowMs;
        race.countdownLastSecond = null;
      } else {
        showOverlayMessage(RACE_RULES_SPLASH_TEXT, "overlay-rules", "#ffe4bd");
      }
      updateBodySegmentsForRace(race, nowMs);
      updateHud(race, nowMs);
      return;
    }

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
        ui.overlay.classList.remove("visible", "overlay-go", "overlay-finish", "overlay-rules", "countdown", COUNTDOWN_BURST_ANIM_CLASS);
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
      ui.overlay.classList.remove("visible", "overlay-go", "overlay-finish", "overlay-rules", "countdown", COUNTDOWN_BURST_ANIM_CLASS);
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
    const hasLapWinner = race.racers.some((racer) => racer.completedLap);
    if (elapsedMs > RACE_TIMEOUT_MS) {
      for (const racer of race.racers) {
        if (!racer.finished) {
          racer.finished = true;
          racer.completedLap = false;
          racer.finishTimeMs = Math.max(0, elapsedMs + racer.timePenaltyMs);
        }
      }
      finishRace(race, nowMs);
    } else if (hasLapWinner) {
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
      snake: resolveSnakeName(racer.typeId),
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
      <td>${resolveSnakeName(row.snake)}</td>
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
    const virtualTurn = clamp(Number(state.virtualInput?.turn) || 0, -1, 1);
    const virtualThrottle = clamp(Number(state.virtualInput?.throttle) || 0, 0, 1);
    const virtualBrake = clamp(Number(state.virtualInput?.brake) || 0, 0, 1);
    return {
      turn: clamp((left ? -1 : 0) + (right ? 1 : 0) + virtualTurn, -1, 1),
      throttle: Math.max(up ? 1 : 0, virtualThrottle),
      brake: Math.max(down ? 1 : 0, virtualBrake),
      spit: state.keyMap.has("Space"),
    };
  }

  return {
    updateRace,
    finishRace,
    finalizeResults,
    persistBestTimeFromRace,
    renderResultsTable,
    readPlayerControl,
  };
}
