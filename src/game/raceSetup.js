import {
  TOTAL_RACERS,
  TAU,
  LAPS_TO_FINISH,
  BODY_ITEM_COUNT,
  START_BODY_SEGMENTS,
  BODY_ITEM_MIN_SEPARATION,
  BODY_ITEM_TO_CHECKPOINT_MIN_DIST,
  BODY_ITEM_TO_START_CHECKPOINT_MIN_DIST,
  BODY_ITEM_TO_PICKUP_MIN_DIST,
} from "./config.js";
import { SNAKES, PICKUP_ORDER, NPC_PROFILES } from "./catalog.js";
import { clamp, sqrDistance, mod1 } from "./utils.js";
import { buildTrackRuntime, sampleTrack, projectOnTrack } from "./trackMath.js";

const PICKUP_LANE_RATIOS = [-0.04, 0.04, 0];
const BODY_ITEM_LANE_RATIOS = [-0.07, -0.03, 0, 0.03, 0.07];
const BODY_ITEM_FRACTION_JITTER = 0.06;
const BODY_ITEM_LANE_JITTER = 0.03;
const BODY_ITEM_ROUTE_ATTEMPTS = 48;
const MAX_OBJECT_LANE_RATIO = 0.1;

export function createRaceState(trackDef, selectedSnake, debugMode, startMs = performance.now()) {
  const track = buildTrackRuntime(trackDef);
  const racers = [];
  const slotOffsets = [-22, -8, 8, 22];
  const selectedForProbe = selectedSnake;
  const clockNowMs = Number.isFinite(startMs) ? startMs : performance.now();

  for (let i = 0; i < TOTAL_RACERS; i += 1) {
    const profile = NPC_PROFILES[i % NPC_PROFILES.length];
    const snake = i === 0 ? selectedForProbe : SNAKES[(i + 1) % SNAKES.length];
    const spawnFraction = mod1(0.992 - i * 0.008);
    const spawn = sampleTrack(track, spawnFraction);
    const normal = { x: -spawn.tangent.y, y: spawn.tangent.x };
    const offset = slotOffsets[i] || 0;

    const racer = {
      id: `racer_${i + 1}`,
      name: buildRacerDisplayName({
        snake,
        profile,
        isPlayer: !debugMode && i === 0,
        isProbe: debugMode && i === 0,
      }),
      typeId: snake.id,
      color: snake.color,
      stats: snake.stats,
      bodyConfig: snake.body,
      venomConfig: snake.venom,
      baseBodySegments: START_BODY_SEGMENTS,
      lengthBonusSegments: 0,
      profile,
      isPlayer: !debugMode && i === 0,
      x: spawn.x + normal.x * offset,
      y: spawn.y + normal.y * offset,
      heading: Math.atan2(spawn.tangent.y, spawn.tangent.x),
      speed: 0,
      surface: "road",
      shieldCharges: 0,
      effects: [],
      nextCheckpointIndex: 1,
      checkpointsPassed: 0,
      readyToFinish: false,
      lapsCompleted: 0,
      finished: false,
      finishTimeMs: NaN,
      completedLap: false,
      timePenaltyMs: 0,
      progressScore: 0,
      trail: [],
      history: [],
      bodySegments: [],
      bodyWaveSeed: Math.random() * TAU,
      lastProjection: null,
      impactUntilMs: 0,
      exhaustionSteps: 0,
      eliminationReason: null,
      nextHungerTickMs: 0,
      tailBiteCooldownUntilMs: 0,
      nextBodyCrossEffectAtMs: 0,
      stallWatch: null,
      unstuckUntilMs: 0,
      nextVenomShotAtMs: 0,
      nextBombHitAllowedAtMs: 0,
    };
    initializeRacerBodyHistory(racer);
    racers.push(racer);
  }

  const pickups = createPickups(track);
  const bodyItems = createBodyItems(track, pickups);

  return {
    trackDef,
    track,
    racers,
    pickups,
    bodyItems,
    venomShots: [],
    phase: "rules",
    createdAtMs: clockNowMs,
    rulesStartMs: clockNowMs,
    countdownStartMs: 0,
    countdownLastSecond: null,
    raceStartMs: 0,
    bodyCrossingGraceUntilMs: 0,
    finishedAtMs: 0,
    overlayUntilMs: 0,
    lapsToFinish: Number.isFinite(trackDef?.lapsToFinish)
      ? Math.max(1, Math.floor(trackDef.lapsToFinish))
      : LAPS_TO_FINISH,
    focusRacerId: racers[0].id,
    standings: [],
    resultsPushed: false,
  };
}

export function buildRacerDisplayName({ snake, profile, isPlayer, isProbe }) {
  const snakeToken = normalizeNameToken(snake?.id || "snake");
  if (isPlayer) {
    return `игрок_${snakeToken}`;
  }
  const profileSource = isProbe ? "проба" : profile?.name || profile?.id || "бот";
  const profileToken = normalizeNameToken(profileSource);
  return `бот_${profileToken}_${snakeToken}`;
}

export function normalizeNameToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9а-яё_-]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function createPickups(track) {
  return track.pickupFractions.map((fraction, index) => {
    const baseLane = PICKUP_LANE_RATIOS[index % PICKUP_LANE_RATIOS.length];
    const placement = placeTrackObject(track, fraction, baseLane);
    return {
      id: `pickup_${index + 1}`,
      type: PICKUP_ORDER[index % PICKUP_ORDER.length],
      x: placement.x,
      y: placement.y,
      active: true,
      respawnAtMs: 0,
      radius: 12,
      routeFraction: placement.fraction,
      laneRatio: placement.laneRatio,
    };
  });
}

export function createBodyItems(track, pickups) {
  const items = [];
  const baseOffset = Math.random();
  for (let i = 0; i < BODY_ITEM_COUNT; i += 1) {
    const routeFraction = mod1(baseOffset + i / BODY_ITEM_COUNT + (Math.random() - 0.5) * 0.04);
    const laneRatio = BODY_ITEM_LANE_RATIOS[i % BODY_ITEM_LANE_RATIOS.length];
    const item = {
      id: `body_item_${i + 1}`,
      type: Math.random() < 0.58 ? "APPLE" : "CACTUS",
      x: 0,
      y: 0,
      radius: 11,
      active: true,
      respawnAtMs: 0,
      routeFraction,
      laneRatio,
    };
    randomizeBodyItemPosition(item, track, items, pickups);
    items.push(item);
  }
  return items;
}

export function randomizeBodyItemPosition(item, track, occupiedItems = [], pickups = []) {
  const baseFraction = Number.isFinite(item.routeFraction) ? item.routeFraction : Math.random();
  const baseLaneRatio = Number.isFinite(item.laneRatio)
    ? item.laneRatio
    : BODY_ITEM_LANE_RATIOS[Math.floor(Math.random() * BODY_ITEM_LANE_RATIOS.length)];
  let chosen = null;

  for (let attempt = 0; attempt < BODY_ITEM_ROUTE_ATTEMPTS; attempt += 1) {
    const attemptFraction = mod1(baseFraction + (Math.random() - 0.5) * BODY_ITEM_FRACTION_JITTER);
    const attemptLaneRatio = clamp(
      baseLaneRatio + (Math.random() - 0.5) * BODY_ITEM_LANE_JITTER,
      -MAX_OBJECT_LANE_RATIO,
      MAX_OBJECT_LANE_RATIO,
    );
    const placement = placeTrackObject(track, attemptFraction, attemptLaneRatio);
    if (isBodyItemPositionValid(item, placement.x, placement.y, track, occupiedItems, pickups)) {
      chosen = placement;
      break;
    }
  }

  if (!chosen) {
    chosen = placeTrackObject(track, baseFraction, baseLaneRatio);
  }

  item.x = chosen.x;
  item.y = chosen.y;
  item.routeFraction = chosen.fraction;
  item.laneRatio = chosen.laneRatio;

  if (Math.random() < 0.35) {
    item.type = item.type === "APPLE" ? "CACTUS" : "APPLE";
  }
}

export function isBodyItemPositionValid(item, x, y, track, occupiedItems, pickups) {
  const projection = projectOnTrack(track, x, y);
  if (!projection || projection.distance > track.roadWidth * 0.32) {
    return false;
  }
  for (let i = 0; i < track.checkpoints.length; i += 1) {
    const cp = track.checkpoints[i];
    const minDist = i === 0 ? BODY_ITEM_TO_START_CHECKPOINT_MIN_DIST : BODY_ITEM_TO_CHECKPOINT_MIN_DIST;
    if (sqrDistance(x, y, cp.x, cp.y) < minDist ** 2) {
      return false;
    }
  }
  for (const pickup of pickups) {
    if (sqrDistance(x, y, pickup.x, pickup.y) < BODY_ITEM_TO_PICKUP_MIN_DIST ** 2) {
      return false;
    }
  }
  for (const other of occupiedItems) {
    if (!other || other.id === item.id || !other.active) {
      continue;
    }
    if (sqrDistance(x, y, other.x, other.y) < BODY_ITEM_MIN_SEPARATION ** 2) {
      return false;
    }
  }
  return true;
}

function placeTrackObject(track, fraction, laneRatio = 0) {
  const sample = sampleTrack(track, fraction);
  const normal = { x: -sample.tangent.y, y: sample.tangent.x };
  const cleanLaneRatio = clamp(laneRatio, -MAX_OBJECT_LANE_RATIO, MAX_OBJECT_LANE_RATIO);
  const lateral = track.roadWidth * cleanLaneRatio;
  return {
    x: sample.x + normal.x * lateral,
    y: sample.y + normal.y * lateral,
    fraction: sample.fraction,
    laneRatio: cleanLaneRatio,
  };
}

export function initializeRacerBodyHistory(racer) {
  racer.history.length = 0;
  const backX = -Math.cos(racer.heading);
  const backY = -Math.sin(racer.heading);
  for (let i = 0; i < 90; i += 1) {
    racer.history.push({
      x: racer.x + backX * i * 2.2,
      y: racer.y + backY * i * 2.2,
      heading: racer.heading,
    });
  }
  racer.bodySegments.length = 0;
}

