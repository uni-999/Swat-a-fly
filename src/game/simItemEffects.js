import {
  PICKUP_RESPAWN_MS,
  BODY_ITEM_RESPAWN_MS,
  CACTUS_SEGMENT_LOSS_CHANCE,
  STARVATION_DECAY_INTERVAL_MS,
  STARVATION_DECAY_SEGMENTS,
  APPLE_BOOST_DURATION_MS,
  APPLE_BOOST_SPEED_MUL,
  APPLE_BOOST_ACCEL_MUL,
  APPLE_BOOST_INSTANT_SPEED_FACTOR,
  BOMB_HIT_IMMUNITY_MS,
  BOMB_RECOVERY_SPEED_FACTOR,
} from "./config.js";
import { BODY_ITEMS, PICKUP_TYPES } from "./catalog.js";
import { sqrDistance } from "./utils.js";
import {
  applyBodySegmentDelta,
  getLowBodySpeedFactor,
  getExhaustionSpeedFactor,
  ensureAlwaysMoveSpeed,
} from "./simBodyCore.js";

function updatePickups(race, nowMs, randomizePickupPositionFn) {
  for (const pickup of race.pickups) {
    if (!pickup.active && nowMs >= pickup.respawnAtMs) {
      if (typeof randomizePickupPositionFn === "function") {
        randomizePickupPositionFn(pickup, race.track, race.pickups);
      }
      pickup.active = true;
    }
  }
}


function updateBodyItems(race, nowMs, randomizeBodyItemPositionFn) {
  for (const item of race.bodyItems) {
    if (!item.active && nowMs >= item.respawnAtMs) {
      item.active = true;
      if (typeof randomizeBodyItemPositionFn === "function") {
        randomizeBodyItemPositionFn(item, race.track, race.bodyItems, race.pickups);
      }
    }
  }
}


function updateRacerHunger(racer, nowMs) {
  if (racer.finished) {
    return;
  }
  if (!Number.isFinite(racer.nextHungerTickMs) || racer.nextHungerTickMs <= 0) {
    racer.nextHungerTickMs = nowMs + STARVATION_DECAY_INTERVAL_MS;
    return;
  }

  while (nowMs >= racer.nextHungerTickMs && !racer.finished) {
    applyBodySegmentDelta(racer, -STARVATION_DECAY_SEGMENTS, nowMs, "STARVATION");
    racer.nextHungerTickMs += STARVATION_DECAY_INTERVAL_MS;
  }
}


function checkPickupCollection(race, racer, nowMs) {
  for (const pickup of race.pickups) {
    if (!pickup.active) {
      continue;
    }
    const distSq = sqrDistance(racer.x, racer.y, pickup.x, pickup.y);
    if (distSq > (pickup.radius + 11) ** 2) {
      continue;
    }
    pickup.active = false;
    pickup.respawnAtMs = nowMs + PICKUP_RESPAWN_MS;
    applyPickup(race, racer, pickup.type, nowMs);
  }
}


function checkBodyItemCollection(race, racer, nowMs) {
  for (const item of race.bodyItems) {
    if (!item.active) {
      continue;
    }
    const distSq = sqrDistance(racer.x, racer.y, item.x, item.y);
    if (distSq > (item.radius + 11) ** 2) {
      continue;
    }
    item.active = false;
    item.respawnAtMs = nowMs + BODY_ITEM_RESPAWN_MS;
    applyBodyItem(racer, item.type, nowMs);
  }
}


function applyBodyItem(racer, itemType, nowMs) {
  let delta = BODY_ITEMS[itemType]?.deltaSegments ?? 0;
  if (itemType === "CACTUS" && delta < 0) {
    // Cactus now applies damage in ~66% of pickups (about one-third softer overall).
    delta = Math.random() < CACTUS_SEGMENT_LOSS_CHANCE ? delta : 0;
  }
  applyBodySegmentDelta(racer, delta, nowMs, itemType);
  if (itemType === "APPLE") {
    addEffect(racer, "APPLE_BOOST", APPLE_BOOST_DURATION_MS, nowMs, {
      speedMul: APPLE_BOOST_SPEED_MUL,
      accelMul: APPLE_BOOST_ACCEL_MUL,
    });
    const lowBodyMul = getLowBodySpeedFactor(racer);
    const exhaustionMul = getExhaustionSpeedFactor(racer);
    const instantFloor = racer.stats.maxSpeed * APPLE_BOOST_INSTANT_SPEED_FACTOR * lowBodyMul * exhaustionMul;
    racer.speed = Math.max(racer.speed, instantFloor);
    ensureAlwaysMoveSpeed(racer, lowBodyMul, exhaustionMul);
    racer.nextHungerTickMs = nowMs + STARVATION_DECAY_INTERVAL_MS;
  }
}


function applyPickup(race, racer, type, nowMs) {
  if (type === "BOOST") {
    addEffect(racer, "BOOST", PICKUP_TYPES.BOOST.durationMs, nowMs);
    return;
  }
  if (type === "SHIELD") {
    racer.shieldCharges = Math.max(racer.shieldCharges, PICKUP_TYPES.SHIELD.charges);
    addEffect(racer, "SHIELD", PICKUP_TYPES.SHIELD.durationMs, nowMs);
    return;
  }
  if (type === "OIL") {
    addEffect(racer, "OIL", PICKUP_TYPES.OIL.durationMs, nowMs);
    return;
  }
  if (type === "BOMB") {
    for (const target of race.racers) {
      if (target.id === racer.id || target.finished) {
        continue;
      }
      if (nowMs < (target.nextBombHitAllowedAtMs || 0)) {
        continue;
      }
      const distSq = sqrDistance(racer.x, racer.y, target.x, target.y);
      if (distSq > PICKUP_TYPES.BOMB.radius ** 2) {
        continue;
      }
      target.nextBombHitAllowedAtMs = nowMs + BOMB_HIT_IMMUNITY_MS;
      if (target.shieldCharges > 0) {
        target.shieldCharges -= 1;
        removeEffect(target, "SHIELD");
      } else {
        applyBodySegmentDelta(target, -1, nowMs, "BOMB");
        addEffect(target, "BOMB_SLOW", PICKUP_TYPES.BOMB.durationMs, nowMs);
        const lowBodyMul = getLowBodySpeedFactor(target);
        const exhaustionMul = getExhaustionSpeedFactor(target);
        const bombFloor = target.stats.maxSpeed * BOMB_RECOVERY_SPEED_FACTOR * lowBodyMul * exhaustionMul;
        target.speed = Math.max(target.speed, bombFloor);
        ensureAlwaysMoveSpeed(target, lowBodyMul, exhaustionMul);
      }
    }
  }
}


function addEffect(racer, type, durationMs, nowMs, extra = null) {
  removeEffect(racer, type);
  const effect = { type, untilMs: nowMs + durationMs };
  if (extra && typeof extra === "object") {
    Object.assign(effect, extra);
  }
  racer.effects.push(effect);
}


function removeEffect(racer, type) {
  racer.effects = racer.effects.filter((effect) => effect.type !== type);
}


export {
  updatePickups,
  updateBodyItems,
  updateRacerHunger,
  checkPickupCollection,
  checkBodyItemCollection,
  applyBodyItem,
  applyPickup,
  addEffect,
  removeEffect,
};
