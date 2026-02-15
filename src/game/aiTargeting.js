import {
  APPLE_STARTLINE_AVOID_RADIUS,
  MIN_BODY_SEGMENTS,
} from "./config.js";
import {
  clamp,
  lerp,
  sqrDistance,
  forwardTrackDelta,
} from "./utils.js";
import { projectOnTrack } from "./trackMath.js";

export function createNpcTargetingApi({ getCurrentBodySegments } = {}) {
  const getSegments = (racer) =>
    typeof getCurrentBodySegments === "function"
      ? getCurrentBodySegments(racer)
      : Number.isFinite(racer?.bodySegments)
        ? racer.bodySegments
        : MIN_BODY_SEGMENTS;

  function getNpcAppleAttraction(racer) {
    if (!racer) {
      return 0;
    }
    const hungerSteps = Math.max(0, racer.exhaustionSteps || 0);
    const hungerAttraction = clamp(hungerSteps / 5, 0, 1);
    const bodySegments = getSegments(racer);
    const emergencyBonus = bodySegments <= MIN_BODY_SEGMENTS + 1 ? 0.18 : 0;
    return clamp(hungerAttraction + emergencyBonus, 0, 1);
  }

  function findNpcAppleTarget(race, racer, racerProjection) {
    const bodySegments = getSegments(racer);
    const attraction = getNpcAppleAttraction(racer);
    if (attraction <= 0.02 && bodySegments >= racer.baseBodySegments + 2) {
      return null;
    }
    const startCheckpoint = race.track.checkpoints?.[0];
    const maxForwardDelta = lerp(0.18, 0.42, attraction);
    const maxDistance = lerp(235, 520, attraction);
    const forwardWeight = lerp(0.75, 0.34, attraction);
    const distanceNorm = lerp(850, 1300, attraction);
    let best = null;
    for (const item of race.bodyItems) {
      if (!item.active || item.type !== "APPLE") {
        continue;
      }
      if (startCheckpoint && sqrDistance(item.x, item.y, startCheckpoint.x, startCheckpoint.y) < APPLE_STARTLINE_AVOID_RADIUS ** 2) {
        continue;
      }
      const itemProjection = projectOnTrack(race.track, item.x, item.y);
      const forwardDelta = forwardTrackDelta(racerProjection.tNorm, itemProjection.tNorm);
      if (forwardDelta <= 0.0001 || forwardDelta > maxForwardDelta) {
        continue;
      }
      const dist = Math.hypot(item.x - racer.x, item.y - racer.y);
      if (dist > maxDistance) {
        continue;
      }
      const score = forwardDelta * forwardWeight + dist / distanceNorm;
      if (!best || score < best.score) {
        best = { item, score };
      }
    }
    return best ? best.item : null;
  }

  function blendNpcTarget(trackTarget, appleTarget, racer) {
    if (!appleTarget) {
      return trackTarget;
    }
    const attraction = getNpcAppleAttraction(racer);
    const appleDist = Math.hypot(appleTarget.x - racer.x, appleTarget.y - racer.y);
    const maxDistance = lerp(300, 700, attraction);
    const minWeight = lerp(0.1, 0.72, attraction);
    const maxWeight = lerp(0.44, 0.95, attraction);
    const appleWeight = clamp(1 - appleDist / maxDistance, minWeight, maxWeight);
    return {
      x: lerp(trackTarget.x, appleTarget.x, appleWeight),
      y: lerp(trackTarget.y, appleTarget.y, appleWeight),
    };
  }

  return {
    getNpcAppleAttraction,
    findNpcAppleTarget,
    blendNpcTarget,
  };
}
