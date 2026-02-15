import { FINISHED_COAST_SPEED_FACTOR } from "./config.js";
import { projectOnTrack } from "./trackMath.js";

function updateCheckpointProgress(race, racer, nowMs) {
  const checkpoints = race.track.checkpoints;
  const startCheckpoint = checkpoints[0];
  const startDist = Math.hypot(startCheckpoint.x - racer.x, startCheckpoint.y - racer.y);

  if (racer.readyToFinish && startDist <= race.track.checkpointRadius && nowMs - race.raceStartMs > 4500) {
    racer.finished = true;
    racer.completedLap = true;
    racer.finishTimeMs = Math.max(0, nowMs - race.raceStartMs + racer.timePenaltyMs);
    racer.speed = Math.max(racer.speed, racer.stats.maxSpeed * FINISHED_COAST_SPEED_FACTOR);
    return;
  }

  const next = checkpoints[racer.nextCheckpointIndex];
  const distToNext = Math.hypot(next.x - racer.x, next.y - racer.y);
  if (distToNext <= race.track.checkpointRadius && racer.nextCheckpointIndex !== 0) {
    racer.checkpointsPassed += 1;
    racer.nextCheckpointIndex = (racer.nextCheckpointIndex + 1) % checkpoints.length;
    if (racer.nextCheckpointIndex === 0) {
      racer.readyToFinish = true;
    }
  }

  const projection = racer.lastProjection || projectOnTrack(race.track, racer.x, racer.y);
  const targetDist = racer.readyToFinish ? startDist : distToNext;
  racer.progressScore = racer.checkpointsPassed * 10000 - targetDist + projection.tNorm * 120;
}


function computeStandings(race) {
  return [...race.racers].sort((a, b) => {
    if (a.completedLap !== b.completedLap) {
      return a.completedLap ? -1 : 1;
    }
    if (a.completedLap && b.completedLap) {
      const timeA = Number.isFinite(a.finishTimeMs) ? a.finishTimeMs : Number.POSITIVE_INFINITY;
      const timeB = Number.isFinite(b.finishTimeMs) ? b.finishTimeMs : Number.POSITIVE_INFINITY;
      if (timeA !== timeB) {
        return timeA - timeB;
      }
    }
    if (a.progressScore !== b.progressScore) {
      return b.progressScore - a.progressScore;
    }
    if (a.checkpointsPassed !== b.checkpointsPassed) {
      return b.checkpointsPassed - a.checkpointsPassed;
    }
    return a.id.localeCompare(b.id);
  });
}


export { updateCheckpointProgress, computeStandings };
