import { TOTAL_RACERS, EXHAUSTION_CRAWL_THRESHOLD } from "./config.js";

export function createHudApi({ ui, computeStandings, getCurrentBodySegments, formatMs } = {}) {
  function updateHud(race, nowMs) {
    const standings = race.standings.length ? race.standings : computeStandings(race);
    const focus = race.racers.find((racer) => racer.id === race.focusRacerId) || race.racers[0];

    let timerMs = 0;
    if (race.phase === "running") {
      timerMs = focus.finished ? focus.finishTimeMs : Math.max(0, nowMs - race.raceStartMs + focus.timePenaltyMs);
    } else if (race.phase === "finished") {
      timerMs = focus.finishTimeMs;
    }
    ui.timer.textContent = Number.isFinite(timerMs) ? formatMs(timerMs) : "--:--.---";

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

  return {
    updateHud,
    formatRacerProgressLabel,
    formatRacerStandingsTail,
    readActiveEffectLabel,
  };
}
