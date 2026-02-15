import {
  NPC_HAZARD_LOOKAHEAD_DELTA,
  NPC_BOMB_AVOID_RADIUS,
  NPC_CACTUS_AVOID_RADIUS,
  NPC_BOMB_AVOID_WEIGHT,
  NPC_CACTUS_AVOID_WEIGHT,
  NPC_HAZARD_AVOID_MAX_SHIFT,
  NPC_EDGE_CAUTION_START_RATIO,
  NPC_EDGE_AVOID_LOOKAHEAD,
} from "./config.js";
import {
  clamp,
  lerp,
  normalizeVec,
  mod1,
  forwardTrackDelta,
} from "./utils.js";
import { sampleTrack, projectOnTrack } from "./trackMath.js";

export function createNpcAvoidanceApi() {
  function findNpcHazardAvoidance(race, racer, racerProjection) {
    if (!race?.track || !racer || !racerProjection) {
      return { x: 0, y: 0, intensity: 0 };
    }

    let avoidX = 0;
    let avoidY = 0;
    let totalInfluence = 0;

    const hazards = [];
    for (const pickup of race.pickups) {
      if (pickup.active && pickup.type === "BOMB") {
        hazards.push({
          x: pickup.x,
          y: pickup.y,
          radius: NPC_BOMB_AVOID_RADIUS,
          weight: NPC_BOMB_AVOID_WEIGHT,
        });
      }
    }
    for (const item of race.bodyItems) {
      if (item.active && item.type === "CACTUS") {
        hazards.push({
          x: item.x,
          y: item.y,
          radius: NPC_CACTUS_AVOID_RADIUS,
          weight: NPC_CACTUS_AVOID_WEIGHT,
        });
      }
    }

    for (const hazard of hazards) {
      const hazardProjection = projectOnTrack(race.track, hazard.x, hazard.y);
      if (!hazardProjection) {
        continue;
      }

      const forwardDelta = forwardTrackDelta(racerProjection.tNorm, hazardProjection.tNorm);
      if (forwardDelta <= 0.0001 || forwardDelta > NPC_HAZARD_LOOKAHEAD_DELTA) {
        continue;
      }

      const dist = Math.hypot(racer.x - hazard.x, racer.y - hazard.y);
      if (dist >= hazard.radius) {
        continue;
      }

      const distanceFactor = 1 - dist / hazard.radius;
      const forwardFactor = 1 - forwardDelta / NPC_HAZARD_LOOKAHEAD_DELTA;
      const influence = hazard.weight * distanceFactor * forwardFactor;
      if (influence <= 0) {
        continue;
      }

      const repel = normalizeVec(racer.x - hazard.x, racer.y - hazard.y);
      avoidX += repel.x * influence;
      avoidY += repel.y * influence;
      totalInfluence += influence;
    }

    if (totalInfluence <= 0.0001) {
      return { x: 0, y: 0, intensity: 0 };
    }

    const dir = normalizeVec(avoidX, avoidY);
    const intensity = clamp(totalInfluence / (NPC_BOMB_AVOID_WEIGHT + NPC_CACTUS_AVOID_WEIGHT), 0, 1);
    return {
      x: dir.x,
      y: dir.y,
      intensity,
    };
  }

  function applyNpcHazardAvoidanceTarget(race, target, hazardAvoidance) {
    if (!target || !hazardAvoidance || hazardAvoidance.intensity <= 0) {
      return target;
    }

    const shift = NPC_HAZARD_AVOID_MAX_SHIFT * hazardAvoidance.intensity;
    const shiftedX = target.x + hazardAvoidance.x * shift;
    const shiftedY = target.y + hazardAvoidance.y * shift;

    const projection = projectOnTrack(race.track, shiftedX, shiftedY);
    if (!projection) {
      return { x: shiftedX, y: shiftedY };
    }
    const normal = { x: -projection.tangent.y, y: projection.tangent.x };
    const dx = shiftedX - projection.x;
    const dy = shiftedY - projection.y;
    const lateral = clamp(dx * normal.x + dy * normal.y, -race.track.roadWidth * 0.74, race.track.roadWidth * 0.74);
    return {
      x: projection.x + normal.x * lateral,
      y: projection.y + normal.y * lateral,
    };
  }

  function findNpcEdgeAvoidance(race, racer, racerProjection) {
    if (!race?.track || !racerProjection) {
      return { target: null, intensity: 0 };
    }

    const cautionStart = race.track.roadWidth * NPC_EDGE_CAUTION_START_RATIO;
    const range = Math.max(1, race.track.outsideWidth - cautionStart);
    const raw = clamp((racerProjection.distance - cautionStart) / range, 0, 1);
    let intensity = clamp(Math.pow(raw, 0.62) * 1.08, 0, 1);
    if (racer.surface === "outside") {
      intensity = 1;
    } else if (racer.surface === "offroad") {
      intensity = Math.max(intensity, 0.68);
    }
    if (intensity <= 0.001) {
      return { target: null, intensity: 0 };
    }

    const ahead = sampleTrack(race.track, mod1(racerProjection.tNorm + NPC_EDGE_AVOID_LOOKAHEAD + intensity * 0.018));
    const normal = { x: -ahead.tangent.y, y: ahead.tangent.x };
    const dx = racer.x - ahead.x;
    const dy = racer.y - ahead.y;
    const lateral = dx * normal.x + dy * normal.y;
    const lateralSign = Math.sign(lateral) || 1;
    const headingX = Math.cos(racer.heading);
    const headingY = Math.sin(racer.heading);
    const outwardNormalX = normal.x * lateralSign;
    const outwardNormalY = normal.y * lateralSign;
    const outwardDot = headingX * outwardNormalX + headingY * outwardNormalY;
    if (outwardDot > 0) {
      intensity = clamp(intensity + outwardDot * 0.26, 0, 1);
    }

    const safeLimit = lerp(race.track.roadWidth * 0.52, race.track.roadWidth * 0.16, intensity);
    const safeLateral = clamp(lateral, -safeLimit, safeLimit);
    const laneTarget = {
      x: ahead.x + normal.x * safeLateral,
      y: ahead.y + normal.y * safeLateral,
    };
    const centerBlend = lerp(0.54, 0.96, intensity);

    return {
      target: {
        x: lerp(laneTarget.x, ahead.x, centerBlend),
        y: lerp(laneTarget.y, ahead.y, centerBlend),
      },
      intensity,
    };
  }

  return {
    findNpcHazardAvoidance,
    applyNpcHazardAvoidanceTarget,
    findNpcEdgeAvoidance,
  };
}
