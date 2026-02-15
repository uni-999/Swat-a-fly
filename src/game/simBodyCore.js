import {
  START_BODY_SEGMENTS,
  MIN_BODY_SEGMENTS,
  MAX_BODY_SEGMENTS,
  EXHAUSTION_CRAWL_THRESHOLD,
  EXHAUSTION_CRAWL_SPEED_FACTOR,
  EXHAUSTION_SLOWDOWN_PER_STEP,
  EXHAUSTION_SLOWDOWN_MIN_FACTOR,
  CRITICAL_SEGMENTS_THRESHOLD,
  CRITICAL_SEGMENTS_SLOWDOWN,
  ALWAYS_MOVE_SNAKE_IDS,
  ALWAYS_MOVE_MIN_SPEED,
  ALWAYS_MOVE_OFFROAD_FACTOR,
  BOMB_RECOVERY_SPEED_FACTOR,
  OUTSIDE_EXTRA_SLOWDOWN,
  OUTSIDE_MIN_CRAWL_SPEED,
  APPLE_BOOST_SPEED_MUL,
  APPLE_BOOST_ACCEL_MUL,
} from "./config.js";
import { clamp, lerp, wrapAngle } from "./utils.js";

function getCurrentBodySegments(racer) {
  return clamp(racer.baseBodySegments + racer.lengthBonusSegments, MIN_BODY_SEGMENTS, MAX_BODY_SEGMENTS);
}


function applyBodySegmentDelta(racer, delta, nowMs, source = "UNKNOWN") {
  if (!Number.isFinite(delta) || delta === 0 || racer.finished) {
    return false;
  }

  const before = getCurrentBodySegments(racer);
  const minBonus = MIN_BODY_SEGMENTS - racer.baseBodySegments;
  const maxBonus = MAX_BODY_SEGMENTS - racer.baseBodySegments;
  racer.lengthBonusSegments = clamp(racer.lengthBonusSegments + delta, minBonus, maxBonus);
  const after = getCurrentBodySegments(racer);

  if (after < before && source === "STARVATION") {
    racer.exhaustionSteps = Math.max(0, (racer.exhaustionSteps || 0) + 1);
  } else if (after > before && source === "APPLE") {
    racer.exhaustionSteps = 0;
  }

  return after !== before;
}


function updateBodySegmentsForRace(race, nowMs) {
  for (const racer of race.racers) {
    updateRacerBodySegments(racer, nowMs);
  }
}


function getRacerMotionHeading(racer, minStep = 0.04, maxLookback = 12) {
  if (!racer?.history || racer.history.length < 2) {
    return null;
  }
  const head = racer.history[0];
  const minDistSq = Math.max(0.0001, minStep * minStep);
  const maxIndex = Math.min(racer.history.length - 1, Math.max(1, Math.floor(maxLookback)));

  for (let i = 1; i <= maxIndex; i += 1) {
    const prev = racer.history[i];
    const dx = head.x - prev.x;
    const dy = head.y - prev.y;
    if (dx * dx + dy * dy < minDistSq) {
      continue;
    }
    return wrapAngle(Math.atan2(dy, dx));
  }

  return null;
}


function alignRacerHeadingToMotion(racer, minStep = 0.04, maxLookback = 12) {
  const motionHeading = getRacerMotionHeading(racer, minStep, maxLookback);
  if (!Number.isFinite(motionHeading)) {
    return false;
  }
  racer.heading = motionHeading;
  if (racer.history?.length) {
    racer.history[0].heading = motionHeading;
  }
  return true;
}


function updateRacerBodySegments(racer, nowMs) {
  const cfg = racer.bodyConfig || { segments: 14, spacing: 8, waveAmp: 3.5, waveFreq: 1, waveSpeed: 4.2, taper: 0.6 };
  const required = getCurrentBodySegments(racer);
  const spacing = Math.max(5, cfg.spacing);
  const waveTime = nowMs * 0.001 * cfg.waveSpeed + racer.bodyWaveSeed;
  const segments = [];
  let targetDist = spacing;
  let traversed = 0;

  // Keep head orientation strictly aligned with actual displacement.
  alignRacerHeadingToMotion(racer, 0.03, 18);

  if (racer.history.length < 2) {
    racer.bodySegments = segments;
    return;
  }

  for (let i = 1; i < racer.history.length && segments.length < required; i += 1) {
    const prev = racer.history[i - 1];
    const curr = racer.history[i];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const pieceLen = Math.hypot(dx, dy);
    if (pieceLen < 0.001) {
      continue;
    }

    while (traversed + pieceLen >= targetDist && segments.length < required) {
      const t = (targetDist - traversed) / pieceLen;
      const baseX = lerp(prev.x, curr.x, t);
      const baseY = lerp(prev.y, curr.y, t);
      const heading = Math.atan2(prev.y - curr.y, prev.x - curr.x);
      const idx = segments.length + 1;
      const fade = 1 - idx / required;
      const wave = Math.sin(waveTime + idx * cfg.waveFreq) * cfg.waveAmp * (0.45 + fade * 0.55);
      const nx = -Math.sin(heading);
      const ny = Math.cos(heading);
      const radius = 2.6 + fade * 5.4 * cfg.taper;
      segments.push({
        x: baseX + nx * wave,
        y: baseY + ny * wave,
        heading,
        radius,
        alpha: 0.2 + fade * 0.68,
      });
      targetDist += spacing;
    }

    traversed += pieceLen;
  }

  racer.bodySegments = segments;
}


function shouldNeverStop(racer) {
  if (!racer || racer.finished) {
    return false;
  }
  if ((racer.exhaustionSteps || 0) >= EXHAUSTION_CRAWL_THRESHOLD) {
    return true;
  }
  if (!racer.isPlayer) {
    return true;
  }
  return ALWAYS_MOVE_SNAKE_IDS.has(racer.typeId);
}


function getLowBodySpeedFactor(racer) {
  return getCurrentBodySegments(racer) < CRITICAL_SEGMENTS_THRESHOLD ? CRITICAL_SEGMENTS_SLOWDOWN : 1;
}


function getExhaustionSpeedFactor(racer) {
  const steps = Math.max(0, racer?.exhaustionSteps || 0);
  if (steps <= 0) {
    return 1;
  }
  if (steps >= EXHAUSTION_CRAWL_THRESHOLD) {
    return EXHAUSTION_CRAWL_SPEED_FACTOR;
  }
  return clamp(1 - steps * EXHAUSTION_SLOWDOWN_PER_STEP, EXHAUSTION_SLOWDOWN_MIN_FACTOR, 1);
}


function ensureAlwaysMoveSpeed(
  racer,
  lowBodyMul = getLowBodySpeedFactor(racer),
  exhaustionMul = getExhaustionSpeedFactor(racer),
) {
  if (!shouldNeverStop(racer)) {
    return;
  }
  const baseFloor = ALWAYS_MOVE_MIN_SPEED * lowBodyMul * exhaustionMul;
  let floor = racer.surface !== "road" ? baseFloor * ALWAYS_MOVE_OFFROAD_FACTOR : baseFloor;
  if (racer.surface === "outside") {
    floor *= OUTSIDE_EXTRA_SLOWDOWN;
  }
  racer.speed = Math.max(racer.speed, floor);
}


function ensureBombSlowFloorSpeed(
  racer,
  lowBodyMul = getLowBodySpeedFactor(racer),
  exhaustionMul = getExhaustionSpeedFactor(racer),
) {
  if (!racer.effects?.some((effect) => effect.type === "BOMB_SLOW")) {
    return;
  }
  const baseFloor = racer.stats.maxSpeed * BOMB_RECOVERY_SPEED_FACTOR * lowBodyMul * exhaustionMul;
  let floor = racer.surface !== "road" ? baseFloor * ALWAYS_MOVE_OFFROAD_FACTOR : baseFloor;
  if (racer.surface === "outside") {
    floor *= OUTSIDE_EXTRA_SLOWDOWN;
  }
  racer.speed = Math.max(racer.speed, floor);
}


function ensureOutsideCrawlSpeed(
  racer,
  lowBodyMul = getLowBodySpeedFactor(racer),
  exhaustionMul = getExhaustionSpeedFactor(racer),
) {
  if (racer.surface !== "outside" || racer.finished) {
    return;
  }
  const floor = Math.max(OUTSIDE_MIN_CRAWL_SPEED, racer.stats.maxSpeed * 0.08) * lowBodyMul * exhaustionMul;
  racer.speed = Math.max(racer.speed, floor);
}


function getRacerModifiers(racer) {
  let speedMul = 1;
  let accelMul = 1;
  let turnMul = 1;
  const bodyInfluence = getBodyInfluence(racer);
  for (const effect of racer.effects) {
    if (effect.type === "BOOST") {
      speedMul *= 1 + (1.34 - 1) * bodyInfluence.beneficialScale;
      accelMul *= 1 + (1.18 - 1) * bodyInfluence.beneficialScale;
    } else if (effect.type === "APPLE_BOOST") {
      speedMul *= 1 + ((effect.speedMul ?? APPLE_BOOST_SPEED_MUL) - 1) * bodyInfluence.beneficialScale;
      accelMul *= 1 + ((effect.accelMul ?? APPLE_BOOST_ACCEL_MUL) - 1) * bodyInfluence.beneficialScale;
    } else if (effect.type === "OIL") {
      turnMul *= applyHarmfulMitigation(0.64, bodyInfluence.harmfulMitigation);
      accelMul *= applyHarmfulMitigation(0.82, bodyInfluence.harmfulMitigation);
    } else if (effect.type === "BOMB_SLOW") {
      speedMul *= applyHarmfulMitigation(0.84, bodyInfluence.harmfulMitigation);
      accelMul *= applyHarmfulMitigation(0.86, bodyInfluence.harmfulMitigation);
      turnMul *= applyHarmfulMitigation(0.93, bodyInfluence.harmfulMitigation);
    } else if (effect.type === "VENOM_SLOW") {
      speedMul *= applyHarmfulMitigation(effect.speedMul ?? 0.86, bodyInfluence.harmfulMitigation);
      accelMul *= applyHarmfulMitigation((effect.speedMul ?? 0.86) * 0.98, bodyInfluence.harmfulMitigation);
      turnMul *= applyHarmfulMitigation(0.93, bodyInfluence.harmfulMitigation);
    }
  }
  return { speedMul, accelMul, turnMul };
}


function getBodyInfluence(racer) {
  const base = Math.max(START_BODY_SEGMENTS, racer.baseBodySegments || START_BODY_SEGMENTS);
  const current = getCurrentBodySegments(racer);
  const ratio = (current - base) / base;
  const beneficialScale = 1 + Math.max(0, ratio) * 0.9;
  const harmfulMitigation = clamp(Math.max(0, -ratio) * 0.95, 0, 0.8);
  return { beneficialScale, harmfulMitigation, currentSegments: current };
}


function applyHarmfulMitigation(baseMultiplier, harmfulMitigation) {
  const penalty = 1 - baseMultiplier;
  const mitigatedPenalty = penalty * (1 - harmfulMitigation);
  return 1 - mitigatedPenalty;
}


export {
  getCurrentBodySegments,
  applyBodySegmentDelta,
  updateBodySegmentsForRace,
  getRacerMotionHeading,
  alignRacerHeadingToMotion,
  updateRacerBodySegments,
  shouldNeverStop,
  getLowBodySpeedFactor,
  getExhaustionSpeedFactor,
  ensureAlwaysMoveSpeed,
  ensureBombSlowFloorSpeed,
  ensureOutsideCrawlSpeed,
  getRacerModifiers,
  getBodyInfluence,
  applyHarmfulMitigation,
};
