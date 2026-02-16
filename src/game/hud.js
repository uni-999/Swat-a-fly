import { TOTAL_RACERS, EXHAUSTION_CRAWL_THRESHOLD } from "./config.js";

export function createHudApi({ ui, state, t, computeStandings, getCurrentBodySegments, formatMs } = {}) {
  const tr = typeof t === "function" ? t : (key) => key;

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
    ui.speed.textContent = tr("hud.speedValue", { value: kmh });

    const rank = standings.findIndex((racer) => racer.id === focus.id) + 1;
    ui.position.textContent = `P${Math.max(1, rank)}/${TOTAL_RACERS} (${focus.name})`;

    const bodySegments = getCurrentBodySegments(focus);
    const hungerSteps = focus.exhaustionSteps || 0;
    const hungerLabel =
      hungerSteps >= EXHAUSTION_CRAWL_THRESHOLD
        ? tr("hud.hungerCrawl", { value: hungerSteps })
        : tr("hud.hunger", { value: hungerSteps });
    ui.effect.textContent = `${readActiveEffectLabel(focus)} | ${tr("hud.body", { value: bodySegments })} | ${hungerLabel}`;

    ui.standings.innerHTML = "";
    standings.forEach((racer) => {
      const li = document.createElement("li");
      const tail = racer.finished ? formatRacerStandingsTail(race, racer) : tr("hud.inRace");
      li.textContent = `${racer.name} - ${tail}`;
      ui.standings.appendChild(li);
    });
  }

  function formatRacerProgressLabel(race, racer) {
    const checkpointsDone = Math.max(0, racer.checkpointsPassed || 0);
    const nextIndex = Number.isFinite(racer.nextCheckpointIndex) ? racer.nextCheckpointIndex : 0;
    const nextCheckpoint = race?.track?.checkpoints?.[nextIndex];
    if (!nextCheckpoint) {
      return tr("hud.progressCp", { value: checkpointsDone });
    }
    const distToNext = Math.hypot(nextCheckpoint.x - racer.x, nextCheckpoint.y - racer.y);
    return tr("hud.progressNext", { checkpoints: checkpointsDone, distance: Math.round(distToNext) });
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
      return tr("hud.effect.shield", { value: racer.shieldCharges });
    }
    if (!racer.effects.length) {
      return tr("hud.none");
    }
    const top = racer.effects.reduce((acc, item) => (item.untilMs > acc.untilMs ? item : acc), racer.effects[0]);
    if (top.type === "BOMB_SLOW") {
      return tr("hud.effect.bombSlow");
    }
    if (top.type === "BOOST") {
      return tr("hud.effect.boost");
    }
    if (top.type === "APPLE_BOOST") {
      return tr("hud.effect.appleBoost");
    }
    if (top.type === "OIL") {
      return tr("hud.effect.oil");
    }
    if (top.type === "VENOM_SLOW") {
      return tr("hud.effect.venom");
    }
    if (top.type === "SHIELD") {
      return tr("hud.effect.shieldActive");
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
