import {
  ALWAYS_MOVE_MIN_SPEED,
} from "./config.js";
import {
  clamp,
  lerp,
  shortestAngle,
  mod1,
} from "./utils.js";
import { sampleTrack, projectOnTrack } from "./trackMath.js";
import { createNpcTargetingApi } from "./aiTargeting.js";
import { createNpcAvoidanceApi } from "./aiAvoidance.js";

export function createNpcSteeringApi({
  shouldNeverStop,
  getCurrentBodySegments,
  canNpcShootVenom,
} = {}) {
  const shouldCrawl = (racer) => (typeof shouldNeverStop === "function" ? shouldNeverStop(racer) : false);
  const targeting = createNpcTargetingApi({ getCurrentBodySegments });
  const avoidance = createNpcAvoidanceApi();

  function buildNpcControl(race, racer, nowMs) {
    const projection = racer.lastProjection || projectOnTrack(race.track, racer.x, racer.y);
    const lookAheadDistance = racer.profile.lookAhead + racer.speed * 0.32;
    const targetFraction = mod1(projection.tNorm + lookAheadDistance / race.track.totalLength);
    const trackTarget = sampleTrack(race.track, targetFraction);
    const appleTarget = targeting.findNpcAppleTarget(race, racer, projection);
    const blendedTarget = targeting.blendNpcTarget(trackTarget, appleTarget, racer);
    const hazardAvoidance = avoidance.findNpcHazardAvoidance(race, racer, projection);
    const edgeAvoidance = avoidance.findNpcEdgeAvoidance(race, racer, projection);
    const hazardTarget = avoidance.applyNpcHazardAvoidanceTarget(race, blendedTarget, hazardAvoidance);
    let target = hazardTarget;
    if (edgeAvoidance?.target) {
      const edgeBlend = lerp(0.62, 0.99, edgeAvoidance.intensity);
      target = {
        x: lerp(target.x, edgeAvoidance.target.x, edgeBlend),
        y: lerp(target.y, edgeAvoidance.target.y, edgeBlend),
      };
    }
    const appleAttraction = targeting.getNpcAppleAttraction(racer);
    const hazardIntensity = hazardAvoidance?.intensity || 0;
    const edgeIntensity = edgeAvoidance?.intensity || 0;
    const caution = clamp(hazardIntensity * 0.7 + edgeIntensity * 1.4, 0, 1);
    const desiredHeading = Math.atan2(target.y - racer.y, target.x - racer.x);
    const angle = shortestAngle(racer.heading, desiredHeading);
    const neverStop = shouldCrawl(racer);

    let throttle = 1;
    let brake = 0;
    if (Math.abs(angle) > racer.profile.brakeAngle) {
      throttle = 0.42;
      brake = 0.26;
    }
    if (racer.surface !== "road") {
      throttle = Math.min(throttle, racer.surface === "outside" ? 0.46 : 0.66);
      brake = Math.max(brake, racer.surface === "outside" ? 0.32 : 0.16);
    }
    const underBombSlow = racer.effects.some((effect) => effect.type === "BOMB_SLOW");
    if (underBombSlow) {
      throttle = Math.max(throttle, 0.82);
      brake = Math.max(brake, 0.06);
    }
    if (appleAttraction > 0 && caution < 0.34 && edgeIntensity < 0.22) {
      throttle = Math.max(throttle, lerp(0.9, 1, appleAttraction));
      brake = Math.min(brake, lerp(0.14, 0, appleAttraction));
    }
    if (caution > 0) {
      throttle = Math.min(throttle, lerp(0.84, 0.34, caution));
      brake = Math.max(brake, lerp(0.08, 0.42, caution));
    }
    if (edgeIntensity > 0.35) {
      throttle = Math.min(throttle, 0.62);
      brake = Math.max(brake, 0.14);
    }
    if (edgeIntensity > 0.58) {
      throttle = Math.min(throttle, 0.44);
      brake = Math.max(brake, 0.26);
    }
    if (edgeIntensity > 0.78) {
      throttle = Math.min(throttle, 0.28);
      brake = Math.max(brake, 0.42);
    }
    if (racer.speed < 12) {
      if (caution < 0.55) {
        throttle = Math.max(throttle, 0.92);
        brake = 0;
      } else {
        throttle = Math.max(throttle, 0.7);
        brake = Math.max(brake, 0.12);
      }
    }
    if (neverStop) {
      const cautiousMode = caution >= 0.2 || racer.surface !== "road";
      if (!cautiousMode) {
        throttle = Math.max(throttle, 0.96);
        brake = 0;
        if (racer.speed < ALWAYS_MOVE_MIN_SPEED * 0.7) {
          throttle = 1;
        }
      } else {
        throttle = Math.max(throttle, edgeIntensity > 0.62 ? 0.34 : 0.5);
        brake = Math.max(brake, lerp(0.1, 0.34, clamp(caution + edgeIntensity * 0.32, 0, 1)));
      }
    }

    const steerGain = racer.profile.steerGain * (1 + caution * 0.65 + edgeIntensity * 0.9);
    const spit = typeof canNpcShootVenom === "function" ? canNpcShootVenom(race, racer, nowMs) : false;

    return {
      throttle: clamp(throttle, 0, 1),
      brake: clamp(brake, 0, 1),
      turn: clamp(angle * steerGain, -1, 1),
      spit,
    };
  }

  return {
    buildNpcControl,
  };
}
