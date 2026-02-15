import {
  ALWAYS_MOVE_MIN_SPEED,
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
  ensureAlwaysMoveSpeed,
  shouldNeverStop,
} from "./simBodySystem.js";

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

  if (racer.isPlayer) {
    // For human players anti-stall should not hijack steering: only enforce crawl speed and grace window.
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


export { preventRacerStall };
