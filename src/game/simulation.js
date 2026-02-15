// Core race simulation primitives extracted from script.js
import {
  MAX_HISTORY_POINTS,
  OFFROAD_EXTRA_SLOWDOWN,
  CROSS_ACCEL_SNAKE_ID,
  BODY_CROSS_SLOWDOWN_MUL,
  SPEEDSTER_BODY_BLOCK_PUSH,
  BULLY_PUSH_DISTANCE,
  BODY_CROSSING_EFFECT_COOLDOWN_MS,
  ALWAYS_MOVE_MIN_SPEED,
  SPEEDSTER_BLOCK_EXTRA_TURN,
  SPEEDSTER_BLOCK_NUDGE,
  SPEEDSTER_BLOCK_MAX_SHIFT,
  SPEEDSTER_BLOCK_FORWARD_STEP,
  STALL_CHECK_WINDOW_MS,
  STALL_UNSTUCK_COOLDOWN_MS,
  STALL_MOVEMENT_EPSILON_SQ,
  STALL_PROGRESS_EPSILON,
  STALL_NO_PROGRESS_WINDOW_MS,
  STALL_UNSTUCK_LOOKAHEAD,
  STALL_RECOVERY_STEER_GAIN,
  STALL_HARD_RECOVERY_STEER_GAIN,
  STALL_OUTSIDE_RECOVERY_STEER_GAIN,
  STALL_UNSTUCK_GHOST_MS,
  STALL_HARD_UNSTUCK_LOOKAHEAD,
  STALL_HARD_UNSTUCK_GHOST_MS,
  OUTSIDE_EXTRA_SLOWDOWN,
  OUTSIDE_RECOVERY_STEER_GAIN,
  OUTSIDE_RECOVERY_PULL_SPEED,
  FINISHED_COAST_SPEED_FACTOR,
  FINISHED_COAST_STEER_GAIN,
  FINISHED_COAST_LOOKAHEAD,
} from "./config.js";
import {
  clamp,
  sqrDistance,
  shortestAngle,
  wrapAngle,
  mod1,
  signedTrackDelta,
} from "./utils.js";
import { projectOnTrack, sampleTrack } from "./trackMath.js";
import {
  updatePickups,
  updateBodyItems,
  updateRacerHunger,
  checkPickupCollection,
  checkBodyItemCollection,
  applyBodyItem,
  getCurrentBodySegments,
  applyBodySegmentDelta,
  applyPickup,
  addEffect,
  removeEffect,
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
} from "./simBodySystem.js";
import { updateCheckpointProgress, computeStandings } from "./simProgress.js";

function stepFinishedRacer(race, racer, dt) {
  if (!racer || !race?.track) {
    return;
  }
  const projection = racer.lastProjection || projectOnTrack(race.track, racer.x, racer.y);
  racer.lastProjection = projection;
  const ahead = sampleTrack(race.track, mod1(projection.tNorm + FINISHED_COAST_LOOKAHEAD));
  const desiredHeading = Math.atan2(ahead.y - racer.y, ahead.x - racer.x);
  const angle = shortestAngle(racer.heading, desiredHeading);
  racer.heading = wrapAngle(racer.heading + clamp(angle, -1, 1) * FINISHED_COAST_STEER_GAIN * dt);

  const coastFloor = racer.stats.maxSpeed * FINISHED_COAST_SPEED_FACTOR;
  racer.speed = Math.max(racer.speed * 0.988, coastFloor);
  racer.x += Math.cos(racer.heading) * racer.speed * dt;
  racer.y += Math.sin(racer.heading) * racer.speed * dt;

  racer.trail.push({ x: racer.x, y: racer.y });
  if (racer.trail.length > 22) {
    racer.trail.shift();
  }

  racer.history.unshift({ x: racer.x, y: racer.y, heading: racer.heading });
  if (racer.history.length > MAX_HISTORY_POINTS) {
    racer.history.length = MAX_HISTORY_POINTS;
  }
  alignRacerHeadingToMotion(racer, 0.02, 16);

  const updatedProjection = projectOnTrack(race.track, racer.x, racer.y);
  if (updatedProjection) {
    racer.lastProjection = updatedProjection;
  }
}


function stepRacer(race, racer, control, nowMs, dt) {
  racer.effects = racer.effects.filter((effect) => effect.untilMs > nowMs);

  const projection = projectOnTrack(race.track, racer.x, racer.y);
  racer.lastProjection = projection;
  racer.surface = projection.distance <= race.track.roadWidth ? "road" : projection.distance <= race.track.outsideWidth ? "offroad" : "outside";

  const modifiers = getRacerModifiers(racer);
  const outsideNow = racer.surface === "outside";
  const offroadNow = racer.surface === "offroad" || outsideNow;
  let surfaceMul = offroadNow ? racer.stats.offroadPenalty * OFFROAD_EXTRA_SLOWDOWN : 1;
  if (outsideNow) {
    surfaceMul *= OUTSIDE_EXTRA_SLOWDOWN;
  }
  const lowBodyMul = getLowBodySpeedFactor(racer);
  const exhaustionMul = getExhaustionSpeedFactor(racer);

  const maxSpeed = racer.stats.maxSpeed * surfaceMul * modifiers.speedMul * racer.profile.speedFactor * lowBodyMul * exhaustionMul;
  const accel = racer.stats.accel * surfaceMul * modifiers.accelMul * lowBodyMul * exhaustionMul;
  const drag = racer.stats.drag;
  const brakeForce = 460;

  const throttleInput = clamp(control.throttle, 0, 1);
  const brakeInput = clamp(control.brake, 0, 1);
  const turnInput = clamp(control.turn, -1, 1);

  const accelTerm = throttleInput * accel;
  const dragTerm = drag * racer.speed;
  const brakeTerm = brakeInput * brakeForce;

  racer.speed += (accelTerm - dragTerm - brakeTerm) * dt;
  racer.speed = clamp(racer.speed, 0, maxSpeed * 1.06);
  ensureAlwaysMoveSpeed(racer, lowBodyMul, exhaustionMul);
  ensureBombSlowFloorSpeed(racer, lowBodyMul, exhaustionMul);
  ensureOutsideCrawlSpeed(racer, lowBodyMul, exhaustionMul);

  const speedRatio = clamp(maxSpeed > 0 ? racer.speed / maxSpeed : 0, 0, 1);
  const turnRate = racer.stats.turnRate * modifiers.turnMul * (1 - speedRatio * 0.35);
  racer.heading = wrapAngle(racer.heading + turnInput * turnRate * dt);

  if (outsideNow && projection) {
    const toTrackHeading = Math.atan2(projection.y - racer.y, projection.x - racer.x);
    const recoverTurn = clamp(shortestAngle(racer.heading, toTrackHeading), -1, 1);
    racer.heading = wrapAngle(racer.heading + recoverTurn * OUTSIDE_RECOVERY_STEER_GAIN * dt);
  }

  racer.x += Math.cos(racer.heading) * racer.speed * dt;
  racer.y += Math.sin(racer.heading) * racer.speed * dt;

  if (outsideNow && projection) {
    const toTrackX = projection.x - racer.x;
    const toTrackY = projection.y - racer.y;
    const toTrackLen = Math.hypot(toTrackX, toTrackY);
    if (toTrackLen > 0.001) {
      const pullStep = Math.min(OUTSIDE_RECOVERY_PULL_SPEED * dt, toTrackLen);
      racer.x += (toTrackX / toTrackLen) * pullStep;
      racer.y += (toTrackY / toTrackLen) * pullStep;
    }
  }

  const updatedProjection = projectOnTrack(race.track, racer.x, racer.y);
  if (updatedProjection) {
    racer.lastProjection = updatedProjection;
    racer.surface =
      updatedProjection.distance <= race.track.roadWidth
        ? "road"
        : updatedProjection.distance <= race.track.outsideWidth
          ? "offroad"
          : "outside";
  }

  racer.trail.push({ x: racer.x, y: racer.y });
  if (racer.trail.length > 22) {
    racer.trail.shift();
  }

  racer.history.unshift({ x: racer.x, y: racer.y, heading: racer.heading });
  if (racer.history.length > MAX_HISTORY_POINTS) {
    racer.history.length = MAX_HISTORY_POINTS;
  }
}


function applyBodyCrossingRules(race, racer, nowMs) {
  if (racer.finished) {
    return;
  }
  if (nowMs < (racer.unstuckUntilMs || 0)) {
    return;
  }
  if (nowMs < (race.bodyCrossingGraceUntilMs || 0)) {
    return;
  }

  const headRadius = 10;
  for (const other of race.racers) {
    if (other.id === racer.id || other.finished || nowMs < (other.unstuckUntilMs || 0) || !other.bodySegments?.length) {
      continue;
    }

    const tail = other.bodySegments[other.bodySegments.length - 1];
    if (
      racer.typeId === "trickster" &&
      tail &&
      nowMs >= (racer.tailBiteCooldownUntilMs || 0) &&
      sqrDistance(racer.x, racer.y, tail.x, tail.y) <= (headRadius + tail.radius + 2) ** 2
    ) {
      const bitten = applyBodySegmentDelta(other, -1, nowMs, "BITE");
      if (bitten) {
        racer.tailBiteCooldownUntilMs = nowMs + 900;
      }
    }

    for (const segment of other.bodySegments) {
      const limit = headRadius + segment.radius;
      const dx = racer.x - segment.x;
      const dy = racer.y - segment.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > limit * limit) {
        continue;
      }

      if (racer.typeId === "speedster") {
        const dist = Math.sqrt(Math.max(0.0001, distSq));
        const nx = dx / dist;
        const ny = dy / dist;
        const push = limit + Math.max(2, SPEEDSTER_BODY_BLOCK_PUSH * 0.5);
        const desiredX = segment.x + nx * push;
        const desiredY = segment.y + ny * push;
        const shiftX = desiredX - racer.x;
        const shiftY = desiredY - racer.y;
        const shiftLen = Math.hypot(shiftX, shiftY);
        if (shiftLen > 0.001) {
          const shiftStep = Math.min(SPEEDSTER_BLOCK_MAX_SHIFT, shiftLen);
          racer.x += (shiftX / shiftLen) * shiftStep;
          racer.y += (shiftY / shiftLen) * shiftStep;
        }
        const tangentSign = Math.sign(shortestAngle(racer.heading, segment.heading || racer.heading)) || 1;
        racer.heading = wrapAngle(racer.heading + SPEEDSTER_BLOCK_EXTRA_TURN * tangentSign);
        const projection = racer.lastProjection || projectOnTrack(race.track, racer.x, racer.y);
        const ahead = sampleTrack(race.track, mod1(projection.tNorm + 0.011));
        const forwardHeading = Math.atan2(ahead.y - racer.y, ahead.x - racer.x);
        racer.heading = wrapAngle(racer.heading + shortestAngle(racer.heading, forwardHeading) * 0.55);
        const forwardStep = Math.min(SPEEDSTER_BLOCK_FORWARD_STEP, SPEEDSTER_BLOCK_NUDGE + 1.5);
        racer.x += Math.cos(racer.heading) * forwardStep;
        racer.y += Math.sin(racer.heading) * forwardStep;
        if (nowMs >= (racer.nextBodyCrossEffectAtMs || 0)) {
          racer.speed *= 0.96;
          racer.nextBodyCrossEffectAtMs = nowMs + BODY_CROSSING_EFFECT_COOLDOWN_MS;
        }
        ensureAlwaysMoveSpeed(racer);
      } else if (racer.typeId === CROSS_ACCEL_SNAKE_ID) {
        if (nowMs >= (racer.nextBodyCrossEffectAtMs || 0)) {
          racer.speed = Math.min(racer.speed * 1.08, racer.stats.maxSpeed * 1.18);
          racer.nextBodyCrossEffectAtMs = nowMs + BODY_CROSSING_EFFECT_COOLDOWN_MS;
        }
        ensureAlwaysMoveSpeed(racer);
      } else {
        if (nowMs >= (racer.nextBodyCrossEffectAtMs || 0)) {
          racer.speed *= BODY_CROSS_SLOWDOWN_MUL;
          racer.nextBodyCrossEffectAtMs = nowMs + BODY_CROSSING_EFFECT_COOLDOWN_MS;
        }
        ensureAlwaysMoveSpeed(racer);
      }
      break;
    }
  }
}


function preventRacerStall(race, racer, nowMs, dt) {
  if (racer.finished || race.phase !== "running") {
    return;
  }

  const projection = racer.lastProjection || projectOnTrack(race.track, racer.x, racer.y);
  racer.lastProjection = projection;
  ensureAlwaysMoveSpeed(racer);
  const safeDt = Math.min(0.05, Math.max(0.001, Number.isFinite(dt) ? dt : 0.016));

  if (!racer.stallWatch) {
    racer.stallWatch = {
      x: racer.x,
      y: racer.y,
      progressT: projection.tNorm,
      lastMoveAtMs: nowMs,
      lastProgressAtMs: nowMs,
      lastUnstuckAtMs: 0,
    };
    return;
  }

  const watch = racer.stallWatch;
  const movedSq = sqrDistance(racer.x, racer.y, watch.x, watch.y);
  const progressDelta = signedTrackDelta(watch.progressT, projection.tNorm);
  const movedEnough = movedSq >= STALL_MOVEMENT_EPSILON_SQ;
  const madeForwardProgress = progressDelta >= STALL_PROGRESS_EPSILON;

  if (movedEnough) {
    watch.x = racer.x;
    watch.y = racer.y;
    watch.lastMoveAtMs = nowMs;
  }
  if (madeForwardProgress) {
    watch.progressT = projection.tNorm;
    watch.lastProgressAtMs = nowMs;
  }

  const noProgressForMs = nowMs - (watch.lastProgressAtMs || watch.lastMoveAtMs);
  const noMovementForMs = nowMs - watch.lastMoveAtMs;
  const hardDeadlock = noProgressForMs >= STALL_NO_PROGRESS_WINDOW_MS;

  if (!hardDeadlock && noMovementForMs < STALL_CHECK_WINDOW_MS) {
    return;
  }
  if (movedEnough && !hardDeadlock) {
    return;
  }
  if (nowMs - watch.lastUnstuckAtMs < STALL_UNSTUCK_COOLDOWN_MS) {
    return;
  }

  const lookAhead = hardDeadlock ? STALL_HARD_UNSTUCK_LOOKAHEAD : STALL_UNSTUCK_LOOKAHEAD;
  const ahead = sampleTrack(race.track, mod1(projection.tNorm + lookAhead));
  const normal = { x: -ahead.tangent.y, y: ahead.tangent.x };
  let laneSign = Number.parseInt(racer.id.replace(/\D+/g, ""), 10) % 2 === 0 ? 1 : -1;
  if (hardDeadlock) {
    laneSign *= Math.floor(nowMs / STALL_NO_PROGRESS_WINDOW_MS) % 2 === 0 ? 1 : -1;
  }
  const lateral = Math.min(race.track.roadWidth * 0.16, 9) * laneSign;
  const targetX = ahead.x + normal.x * lateral;
  const targetY = ahead.y + normal.y * lateral;
  const desiredHeading = Math.atan2(targetY - racer.y, targetX - racer.x);
  const headingDelta = shortestAngle(racer.heading, desiredHeading);
  const steerGain = hardDeadlock ? STALL_HARD_RECOVERY_STEER_GAIN : STALL_RECOVERY_STEER_GAIN;
  racer.heading = wrapAngle(racer.heading + clamp(headingDelta, -1, 1) * steerGain * safeDt);

  // If snake is deeply outside, bias steering back toward nearest track projection,
  // but keep movement continuous (no coordinate snap).
  if (projection.distance > race.track.outsideWidth * 0.98) {
    const toTrackHeading = Math.atan2(projection.y - racer.y, projection.x - racer.x);
    const toTrackDelta = shortestAngle(racer.heading, toTrackHeading);
    racer.heading = wrapAngle(racer.heading + clamp(toTrackDelta, -1, 1) * STALL_OUTSIDE_RECOVERY_STEER_GAIN * safeDt);
  }

  const forcedSpeed = shouldNeverStop(racer)
    ? Math.max(ALWAYS_MOVE_MIN_SPEED * (hardDeadlock ? 1.24 : 1.08), racer.stats.maxSpeed * (hardDeadlock ? 0.3 : 0.22))
    : Math.max(16, racer.stats.maxSpeed * (hardDeadlock ? 0.22 : 0.14));
  racer.speed = Math.max(racer.speed, forcedSpeed);
  const ghostMs = hardDeadlock ? STALL_HARD_UNSTUCK_GHOST_MS : STALL_UNSTUCK_GHOST_MS;
  racer.nextBodyCrossEffectAtMs = nowMs + ghostMs;
  racer.impactUntilMs = nowMs + ghostMs;
  racer.unstuckUntilMs = nowMs + ghostMs;

  watch.x = racer.x;
  watch.y = racer.y;
  watch.progressT = projection.tNorm;
  watch.lastMoveAtMs = nowMs;
  watch.lastUnstuckAtMs = nowMs;
}


function resolveRacerCollisions(race, nowMs) {
  const radius = 13;
  for (let i = 0; i < race.racers.length; i += 1) {
    const a = race.racers[i];
    if (a.finished) {
      continue;
    }
    for (let j = i + 1; j < race.racers.length; j += 1) {
      const b = race.racers[j];
      if (b.finished) {
        continue;
      }
      if (nowMs < (a.unstuckUntilMs || 0) || nowMs < (b.unstuckUntilMs || 0)) {
        continue;
      }
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 0.001 || dist > radius * 2) {
        continue;
      }
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = radius * 2 - dist;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;

      const aIsBully = a.typeId === "bully";
      const bIsBully = b.typeId === "bully";
      if (aIsBully && !bIsBully) {
        b.x += nx * BULLY_PUSH_DISTANCE;
        b.y += ny * BULLY_PUSH_DISTANCE;
      } else if (bIsBully && !aIsBully) {
        a.x -= nx * BULLY_PUSH_DISTANCE;
        a.y -= ny * BULLY_PUSH_DISTANCE;
      }

      if (nowMs < a.impactUntilMs || nowMs < b.impactUntilMs) {
        continue;
      }
      a.impactUntilMs = nowMs + 220;
      b.impactUntilMs = nowMs + 220;
      if (!aIsBully) {
        applyCollisionPenalty(a);
      }
      if (!bIsBully) {
        applyCollisionPenalty(b);
      }
    }
  }

  for (const racer of race.racers) {
    if (racer.history && racer.history.length) {
      racer.history[0].x = racer.x;
      racer.history[0].y = racer.y;
      racer.history[0].heading = racer.heading;
      alignRacerHeadingToMotion(racer, 0.02, 18);
    }
  }
}


function applyCollisionPenalty(racer) {
  if (racer.shieldCharges > 0) {
    racer.shieldCharges -= 1;
    removeEffect(racer, "SHIELD");
    return;
  }
  racer.speed *= shouldNeverStop(racer) ? 0.9 : 0.72;
  ensureAlwaysMoveSpeed(racer);
}


export {
  stepFinishedRacer,
  updatePickups,
  updateBodyItems,
  updateRacerHunger,
  checkPickupCollection,
  checkBodyItemCollection,
  applyBodyItem,
  getCurrentBodySegments,
  applyBodySegmentDelta,
  applyPickup,
  addEffect,
  removeEffect,
  updateBodySegmentsForRace,
  getRacerMotionHeading,
  alignRacerHeadingToMotion,
  updateRacerBodySegments,
  stepRacer,
  shouldNeverStop,
  getLowBodySpeedFactor,
  getExhaustionSpeedFactor,
  ensureAlwaysMoveSpeed,
  ensureBombSlowFloorSpeed,
  ensureOutsideCrawlSpeed,
  getRacerModifiers,
  getBodyInfluence,
  applyHarmfulMitigation,
  applyBodyCrossingRules,
  preventRacerStall,
  resolveRacerCollisions,
  applyCollisionPenalty,
  updateCheckpointProgress,
  computeStandings,
};
