import { Room } from "@colyseus/core";

import { TRACK_DEFS, PICKUP_ORDER } from "../shared-game/catalog.js";
import { buildTrackRuntime, sampleTrack, projectOnTrack } from "../shared-game/trackMath.js";

const DEFAULT_TRACK_LENGTH = 12000;
const COUNTDOWN_MS = 3000;
const LAPS_TO_FINISH = 0;

const STEER_RESPONSE_PER_SEC = 30.0;
const BASE_TURN_RATE = 2.9;
const TURN_RATE_SPEED_LOSS = 1.15;

const MAX_SPEED_BASE = 250;
const ACCEL_BASE = 280;
const BRAKE_FORCE = 380;
const DRAG = 1.15;

const GRID_OFFSETS = [-18, -6, 6, 18];
const TRACK_SPAWN_POSES = {
  canyon_loop: { x: 881.52, y: 298.41, heading: 1.6004 },
  switchback_run: { x: 68.76, y: 307.23, heading: -1.4717 },
  twin_fang: { x: 130.0, y: 300.0, heading: -1.3260 },
};

const OFFROAD_SPEED_MUL = 0.72;
const OUTSIDE_SPEED_MUL = 0.38;
const OUTSIDE_PULL_SPEED = 56;
const OUTSIDE_STEER_GAIN = 3.4;

const PLAYER_RADIUS = 10;
const PICKUP_RESPAWN_MS = 8000;
const BODY_ITEM_RESPAWN_MS = 3600;
const START_BODY_SEGMENTS = 8;
const MIN_BODY_SEGMENTS = 1;
const MAX_BODY_SEGMENTS = 56;

const APPLE_BOOST_DURATION_MS = 680;
const APPLE_BOOST_INSTANT_SPEED_FACTOR = 0.44;

const PICKUP_LANE_RATIOS = [-0.04, 0.04, 0];
const ONLINE_PICKUP_LANE_RATIOS = [-0.04, 0.04, 0];
const ONLINE_BODY_ITEM_COUNT = 12;
const ONLINE_BODY_LANE_RATIOS = [-0.07, -0.03, 0, 0.03, 0.07];
const ONLINE_BODY_ITEM_MIN_SEPARATION = 64;
const ONLINE_BODY_ITEM_TO_CHECKPOINT_MIN_DIST = 62;
const ONLINE_BODY_ITEM_TO_PICKUP_MIN_DIST = 40;

const TRACK_DEF_BY_ID = new Map(TRACK_DEFS.map((def) => [normalizeTrackId(def.id), def]));

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTrackId(trackId) {
  return String(trackId || "canyon_loop")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
}

function mod1(value) {
  return ((value % 1) + 1) % 1;
}

function sqrDistance(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function shortestAngleDelta(next, prev) {
  let diff = next - prev;
  while (diff > Math.PI) {
    diff -= Math.PI * 2;
  }
  while (diff < -Math.PI) {
    diff += Math.PI * 2;
  }
  return diff;
}

function hashString(value) {
  const text = String(value || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function createSeededRng(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function resolveTrackDef(trackId) {
  return TRACK_DEF_BY_ID.get(normalizeTrackId(trackId)) || TRACK_DEFS[0] || null;
}

function getSpawnPose(trackId, slotIndex = 0) {
  const key = normalizeTrackId(trackId);
  const base = TRACK_SPAWN_POSES[key] || TRACK_SPAWN_POSES.canyon_loop;
  const offset = GRID_OFFSETS[Math.abs(slotIndex) % GRID_OFFSETS.length];
  const normalX = -Math.sin(base.heading);
  const normalY = Math.cos(base.heading);
  return {
    x: base.x + normalX * offset,
    y: base.y + normalY * offset,
    heading: base.heading,
  };
}

function createTrackPickups(track) {
  const fractions = Array.isArray(track?.pickupFractions) ? track.pickupFractions : [];
  return fractions.map((fraction, index) => {
    const sample = sampleTrack(track, fraction);
    const normal = { x: -sample.tangent.y, y: sample.tangent.x };
    const laneRatio = ONLINE_PICKUP_LANE_RATIOS[index % ONLINE_PICKUP_LANE_RATIOS.length];
    const lateral = track.roadWidth * laneRatio;
    return {
      id: `pickup_${index + 1}`,
      type: PICKUP_ORDER[index % PICKUP_ORDER.length],
      x: sample.x + normal.x * lateral,
      y: sample.y + normal.y * lateral,
      active: true,
      radius: 12,
      respawnAtMs: 0,
    };
  });
}

function isBodyItemPositionValid(x, y, track, bodyItems, pickups) {
  for (let i = 0; i < track.checkpoints.length; i += 1) {
    const cp = track.checkpoints[i];
    if (sqrDistance(x, y, cp.x, cp.y) < ONLINE_BODY_ITEM_TO_CHECKPOINT_MIN_DIST ** 2) {
      return false;
    }
  }
  for (const pickup of pickups) {
    if (sqrDistance(x, y, pickup.x, pickup.y) < ONLINE_BODY_ITEM_TO_PICKUP_MIN_DIST ** 2) {
      return false;
    }
  }
  for (const item of bodyItems) {
    if (sqrDistance(x, y, item.x, item.y) < ONLINE_BODY_ITEM_MIN_SEPARATION ** 2) {
      return false;
    }
  }
  return true;
}

function createTrackBodyItems(track, trackId, pickups = []) {
  const items = [];
  const rng = createSeededRng(hashString(`online_body_${trackId || "track"}`));
  const baseOffset = rng();

  for (let i = 0; i < ONLINE_BODY_ITEM_COUNT; i += 1) {
    let chosen = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const fraction = mod1(baseOffset + i / ONLINE_BODY_ITEM_COUNT + (rng() - 0.5) * 0.08);
      const sample = sampleTrack(track, fraction);
      const normal = { x: -sample.tangent.y, y: sample.tangent.x };
      const laneBase = ONLINE_BODY_LANE_RATIOS[(i + attempt) % ONLINE_BODY_LANE_RATIOS.length];
      const laneRatio = clamp(laneBase + (rng() - 0.5) * 0.025, -0.12, 0.12);
      const lateral = track.roadWidth * laneRatio;
      const x = sample.x + normal.x * lateral;
      const y = sample.y + normal.y * lateral;
      if (isBodyItemPositionValid(x, y, track, items, pickups)) {
        chosen = { x, y };
        break;
      }
    }

    if (!chosen) {
      const fallbackSample = sampleTrack(track, mod1(baseOffset + i / ONLINE_BODY_ITEM_COUNT));
      chosen = { x: fallbackSample.x, y: fallbackSample.y };
    }

    items.push({
      id: `body_item_${i + 1}`,
      type: rng() < 0.58 ? "APPLE" : "CACTUS",
      x: chosen.x,
      y: chosen.y,
      radius: 11,
      active: true,
      respawnAtMs: 0,
    });
  }

  return items;
}

export class RaceRoom extends Room {
  onCreate(options) {
    this.maxClients = 4;
    this.tickRate = Math.max(10, safeNumber(process.env.SERVER_TICK_RATE, 20));
    this.raceMaxMs = Math.max(30000, safeNumber(process.env.RACE_MAX_MS, 180000));
    this.trackId = normalizeTrackId(typeof options?.trackId === "string" ? options.trackId : "canyon_loop");
    this.nakamaClient = options?.nakamaClient;

    this.trackDef = resolveTrackDef(this.trackId);
    this.trackRuntime = this.trackDef ? buildTrackRuntime(this.trackDef) : null;
    this.lapsToFinish = Math.max(0, Math.floor(safeNumber(options?.lapsToFinish, LAPS_TO_FINISH)));
    this.trackLengthMeters =
      this.lapsToFinish > 0
        ? Math.max(DEFAULT_TRACK_LENGTH, (this.trackRuntime?.totalLength || DEFAULT_TRACK_LENGTH) * this.lapsToFinish)
        : Number.POSITIVE_INFINITY;

    this.pickups = this.trackRuntime ? createTrackPickups(this.trackRuntime) : [];
    this.bodyItems = this.trackRuntime ? createTrackBodyItems(this.trackRuntime, this.trackId, this.pickups) : [];

    this.players = new Map();
    this.phase = "lobby";
    this.tickIndex = 0;
    this.lastTickAtMs = Date.now();
    this.countdownEndsAtMs = 0;
    this.raceStartedAtMs = 0;
    this.raceEndedAtMs = 0;
    this.resultsSubmitted = false;

    this.setPrivate(false);
    this.setMetadata({ trackId: this.trackId, phase: this.phase, tickRate: this.tickRate });

    this.onMessage("input", (client, payload) => this.handleInput(client, payload));
    this.onMessage("ready", (client, payload) => this.handleReady(client, payload));
    this.onMessage("ping", (client, payload) => {
      client.send("pong", { serverTimeMs: Date.now(), echo: payload ?? null });
    });

    this.clock.setInterval(() => this.tick(), Math.floor(1000 / this.tickRate));
  }

  onJoin(client, options) {
    const userId = options?.userId ? String(options.userId) : client.sessionId;
    const displayName = options?.name ? String(options.name) : `Player ${this.clients.length}`;
    const spawnPose = getSpawnPose(this.trackId, this.players.size);

    this.players.set(client.sessionId, {
      sessionId: client.sessionId,
      userId,
      displayName,
      connected: true,
      isBot: false,
      ready: true,
      input: { turn: 0, throttle: 0, brake: 0 },
      x: spawnPose.x,
      y: spawnPose.y,
      heading: spawnPose.heading,
      steer: 0,
      speed: 0,
      progress: 0,
      bodySegments: START_BODY_SEGMENTS,
      shieldCharges: 0,
      effects: [],
      finished: false,
      finishTimeMs: null,
      resultSubmitted: false,
    });

    this.broadcastState();
  }

  onLeave(client) {
    const player = this.players.get(client.sessionId);
    if (!player) {
      return;
    }

    if (this.phase === "running" && !player.finished) {
      player.connected = false;
      player.isBot = true;
      player.ready = true;
      player.displayName = `${player.displayName} [BOT]`;
    } else {
      this.players.delete(client.sessionId);
    }

    this.broadcastState();
  }

  onDispose() {
    this.players.clear();
  }

  handleInput(client, payload) {
    const player = this.players.get(client.sessionId);
    if (!player || player.isBot || this.phase === "finished") {
      return;
    }

    player.input.turn = clamp(safeNumber(payload?.turn, 0), -1, 1);
    player.input.throttle = clamp(safeNumber(payload?.throttle, 0), 0, 1);
    player.input.brake = clamp(safeNumber(payload?.brake, 0), 0, 1);
  }

  handleReady(client, payload) {
    const player = this.players.get(client.sessionId);
    if (!player || this.phase !== "lobby") {
      return;
    }

    player.ready = payload?.ready !== false;
    this.tryStartCountdown();
    this.broadcastState();
  }

  tryStartCountdown() {
    if (this.phase !== "lobby") {
      return;
    }

    const participants = Array.from(this.players.values()).filter((p) => p.connected);
    if (participants.length < 1) {
      return;
    }

    const allReady = participants.every((p) => p.ready);
    if (!allReady) {
      return;
    }

    this.phase = "countdown";
    this.countdownEndsAtMs = Date.now() + COUNTDOWN_MS;
    this.setMetadata({ ...this.metadata, phase: this.phase });
  }

  tick() {
    const nowMs = Date.now();
    const dt = Math.min(0.1, Math.max(0.001, (nowMs - this.lastTickAtMs) / 1000));
    this.lastTickAtMs = nowMs;
    this.tickIndex += 1;

    if (this.phase === "countdown" && nowMs >= this.countdownEndsAtMs) {
      this.phase = "running";
      this.raceStartedAtMs = nowMs;
      this.setMetadata({ ...this.metadata, phase: this.phase });
    }

    if (this.phase === "running") {
      this.simulate(dt, nowMs);
      if (nowMs - this.raceStartedAtMs >= this.raceMaxMs) {
        this.forceFinishTimeout(nowMs);
      }
    }

    this.broadcastState();
  }

  expireEffects(player, nowMs) {
    player.effects = Array.isArray(player.effects)
      ? player.effects.filter((effect) => safeNumber(effect?.untilMs, 0) > nowMs)
      : [];
  }

  addEffect(player, type, durationMs, nowMs) {
    if (!Array.isArray(player.effects)) {
      player.effects = [];
    }
    const untilMs = nowMs + Math.max(0, safeNumber(durationMs, 0));
    const idx = player.effects.findIndex((effect) => effect?.type === type);
    if (idx >= 0) {
      player.effects[idx].untilMs = Math.max(player.effects[idx].untilMs, untilMs);
      return;
    }
    player.effects.push({ type, untilMs });
  }

  getEffectMultipliers(player) {
    const multipliers = { speedMul: 1, accelMul: 1, turnMul: 1 };
    for (const effect of player.effects || []) {
      switch (effect.type) {
        case "BOOST":
          multipliers.speedMul *= 1.34;
          multipliers.accelMul *= 1.18;
          break;
        case "APPLE_BOOST":
          multipliers.speedMul *= 1.48;
          multipliers.accelMul *= 1.34;
          break;
        case "OIL":
          multipliers.turnMul *= 0.64;
          multipliers.accelMul *= 0.82;
          break;
        case "BOMB_SLOW":
          multipliers.speedMul *= 0.84;
          multipliers.accelMul *= 0.86;
          multipliers.turnMul *= 0.93;
          break;
        case "CACTUS_SLOW":
          multipliers.speedMul *= 0.9;
          multipliers.accelMul *= 0.88;
          break;
        default:
          break;
      }
    }
    return multipliers;
  }

  getBodySpeedMul(player) {
    const segments = clamp(Math.round(safeNumber(player.bodySegments, START_BODY_SEGMENTS)), MIN_BODY_SEGMENTS, MAX_BODY_SEGMENTS);
    player.bodySegments = segments;
    const deficit = Math.max(0, START_BODY_SEGMENTS - segments);
    return clamp(1 - deficit * 0.05, 0.6, 1);
  }

  updateObjectRespawns(nowMs) {
    for (const pickup of this.pickups) {
      if (!pickup.active && safeNumber(pickup.respawnAtMs, 0) <= nowMs) {
        pickup.active = true;
      }
    }
    for (const item of this.bodyItems) {
      if (!item.active && safeNumber(item.respawnAtMs, 0) <= nowMs) {
        item.active = true;
      }
    }
  }

  applyPickupEffect(player, pickup, nowMs) {
    switch (pickup.type) {
      case "BOOST":
        this.addEffect(player, "BOOST", 2600, nowMs);
        player.speed = Math.max(player.speed, MAX_SPEED_BASE * 0.45);
        break;
      case "SHIELD":
        player.shieldCharges = Math.max(1, safeNumber(player.shieldCharges, 0) + 1);
        break;
      case "OIL":
        this.addEffect(player, "OIL", 2200, nowMs);
        break;
      case "BOMB":
        if (safeNumber(player.shieldCharges, 0) > 0) {
          player.shieldCharges -= 1;
        } else {
          player.bodySegments = Math.max(MIN_BODY_SEGMENTS, safeNumber(player.bodySegments, START_BODY_SEGMENTS) - 1);
          this.addEffect(player, "BOMB_SLOW", 1450, nowMs);
          player.speed *= 0.84;
        }
        break;
      default:
        break;
    }
  }

  applyBodyItemEffect(player, item, nowMs) {
    if (item.type === "APPLE") {
      player.bodySegments = Math.min(MAX_BODY_SEGMENTS, safeNumber(player.bodySegments, START_BODY_SEGMENTS) + 1);
      this.addEffect(player, "APPLE_BOOST", APPLE_BOOST_DURATION_MS, nowMs);
      player.speed = Math.max(player.speed, MAX_SPEED_BASE * APPLE_BOOST_INSTANT_SPEED_FACTOR);
      return;
    }

    if (item.type === "CACTUS") {
      if (safeNumber(player.shieldCharges, 0) > 0) {
        player.shieldCharges -= 1;
      } else {
        player.bodySegments = Math.max(MIN_BODY_SEGMENTS, safeNumber(player.bodySegments, START_BODY_SEGMENTS) - 1);
        this.addEffect(player, "CACTUS_SLOW", 900, nowMs);
      }
    }
  }

  collectTrackObjects(player, nowMs) {
    const pickupHitRadiusSq = (PLAYER_RADIUS + 13) ** 2;
    const bodyItemHitRadiusSq = (PLAYER_RADIUS + 12) ** 2;

    for (const pickup of this.pickups) {
      if (!pickup.active) {
        continue;
      }
      if (sqrDistance(player.x, player.y, pickup.x, pickup.y) > pickupHitRadiusSq) {
        continue;
      }
      pickup.active = false;
      pickup.respawnAtMs = nowMs + PICKUP_RESPAWN_MS;
      this.applyPickupEffect(player, pickup, nowMs);
    }

    for (const item of this.bodyItems) {
      if (!item.active) {
        continue;
      }
      if (sqrDistance(player.x, player.y, item.x, item.y) > bodyItemHitRadiusSq) {
        continue;
      }
      item.active = false;
      item.respawnAtMs = nowMs + BODY_ITEM_RESPAWN_MS;
      this.applyBodyItemEffect(player, item, nowMs);
    }
  }

  simulate(dt, nowMs) {
    this.updateObjectRespawns(nowMs);

    for (const player of this.players.values()) {
      if (player.finished) {
        continue;
      }

      this.expireEffects(player, nowMs);

      const input = player.isBot ? this.generateBotInput(player, nowMs) : player.input;
      const throttleInput = clamp(safeNumber(input?.throttle, 0), 0, 1);
      const brakeInput = clamp(safeNumber(input?.brake, 0), 0, 1);
      const targetTurn = clamp(safeNumber(input?.turn, 0), -1, 1);

      const projection = this.trackRuntime ? projectOnTrack(this.trackRuntime, player.x, player.y) : null;
      let surfaceMul = 1;
      let outsideNow = false;
      if (projection) {
        if (projection.distance > this.trackRuntime.roadWidth) {
          surfaceMul *= OFFROAD_SPEED_MUL;
          if (projection.distance > this.trackRuntime.outsideWidth) {
            surfaceMul *= OUTSIDE_SPEED_MUL;
            outsideNow = true;
          }
        }
      }

      const effectMul = this.getEffectMultipliers(player);
      const bodyMul = this.getBodySpeedMul(player);

      const maxSpeed = Math.max(40, MAX_SPEED_BASE * surfaceMul * effectMul.speedMul * bodyMul);
      const accel = ACCEL_BASE * surfaceMul * effectMul.accelMul * bodyMul;

      player.speed += (throttleInput * accel - brakeInput * BRAKE_FORCE - DRAG * player.speed) * dt;
      player.speed = clamp(player.speed, 0, maxSpeed);

      if (player.isBot) {
        const steerBlend = Math.min(1, dt * STEER_RESPONSE_PER_SEC);
        player.steer += (targetTurn - player.steer) * steerBlend;
      } else {
        player.steer = targetTurn;
      }

      const speedRatio = clamp(player.speed / Math.max(1, maxSpeed), 0, 1);
      const turnRate = (BASE_TURN_RATE - speedRatio * TURN_RATE_SPEED_LOSS) * effectMul.turnMul;
      player.heading += player.steer * turnRate * dt;

      if (outsideNow && projection) {
        const toTrackHeading = Math.atan2(projection.y - player.y, projection.x - player.x);
        const recoverTurn = clamp(shortestAngleDelta(toTrackHeading, player.heading), -1, 1);
        player.heading += recoverTurn * OUTSIDE_STEER_GAIN * dt;
      }

      player.x += Math.cos(player.heading) * player.speed * dt;
      player.y += Math.sin(player.heading) * player.speed * dt;

      if (outsideNow && projection) {
        const toTrackX = projection.x - player.x;
        const toTrackY = projection.y - player.y;
        const toTrackLen = Math.hypot(toTrackX, toTrackY);
        if (toTrackLen > 0.001) {
          const pullStep = Math.min(OUTSIDE_PULL_SPEED * dt, toTrackLen);
          player.x += (toTrackX / toTrackLen) * pullStep;
          player.y += (toTrackY / toTrackLen) * pullStep;
        }
      }

      this.collectTrackObjects(player, nowMs);

      player.progress += player.speed * dt;
      if (this.lapsToFinish > 0 && player.progress >= this.trackLengthMeters) {
        player.finished = true;
        player.finishTimeMs = Math.max(0, nowMs - this.raceStartedAtMs);
      }
    }

    const unfinished = Array.from(this.players.values()).some((p) => !p.finished);
    if (!unfinished) {
      this.finishRace(nowMs);
    }
  }

  generateBotInput(player, nowMs) {
    const wobble = Math.sin((nowMs / 1000) * 0.8 + player.sessionId.length * 0.25);
    return {
      turn: clamp(wobble * 0.9, -1, 1),
      throttle: 0.88,
      brake: Math.abs(wobble) > 0.8 ? 0.1 : 0,
    };
  }

  forceFinishTimeout(nowMs) {
    for (const player of this.players.values()) {
      if (!player.finished) {
        player.finished = true;
        player.finishTimeMs = null;
      }
    }
    this.finishRace(nowMs);
  }

  finishRace(nowMs) {
    if (this.phase === "finished") {
      return;
    }

    this.phase = "finished";
    this.raceEndedAtMs = nowMs;
    this.setMetadata({ ...this.metadata, phase: this.phase });
    this.submitResults().catch((error) => {
      console.error("[match-server] submitResults failed:", error);
    });
  }

  async submitResults() {
    if (this.resultsSubmitted) {
      return;
    }
    if (!this.nakamaClient || !this.nakamaClient.enabled) {
      this.resultsSubmitted = true;
      return;
    }

    const results = Array.from(this.players.values())
      .filter((p) => Number.isFinite(p.finishTimeMs))
      .sort((a, b) => a.finishTimeMs - b.finishTimeMs);

    let allSubmitted = true;
    for (const player of results) {
      if (player.resultSubmitted) {
        continue;
      }
      const response = await this.nakamaClient.submitRaceTime({
        userId: player.userId,
        trackId: this.trackId,
        timeMs: player.finishTimeMs,
        metadata: {
          room_id: this.roomId,
          player_name: player.displayName,
          phase: this.phase,
        },
      });

      if (response?.ok) {
        player.resultSubmitted = true;
      } else {
        allSubmitted = false;
        console.warn("[match-server] result submit failed", {
          roomId: this.roomId,
          trackId: this.trackId,
          userId: player.userId,
          response,
        });
      }
    }

    this.resultsSubmitted = allSubmitted;
    if (!allSubmitted) {
      this.clock.setTimeout(() => {
        this.submitResults().catch((error) => {
          console.error("[match-server] submitResults retry failed:", error);
        });
      }, 5000);
    }
  }

  buildSnapshot() {
    const players = Array.from(this.players.values())
      .map((p) => ({
        sessionId: p.sessionId,
        userId: p.userId,
        displayName: p.displayName,
        connected: p.connected,
        isBot: p.isBot,
        ready: p.ready,
        x: Number(p.x.toFixed(2)),
        y: Number(p.y.toFixed(2)),
        heading: Number(p.heading.toFixed(4)),
        speed: Number(p.speed.toFixed(2)),
        progress: Number(p.progress.toFixed(2)),
        bodySegments: p.bodySegments,
        shieldCharges: p.shieldCharges,
        effects: Array.isArray(p.effects) ? p.effects.map((effect) => ({ type: effect.type, untilMs: effect.untilMs })) : [],
        finished: p.finished,
        finishTimeMs: p.finishTimeMs,
      }))
      .sort((a, b) => b.progress - a.progress);

    const pickups = this.pickups.map((item) => ({
      id: item.id,
      type: item.type,
      x: Number(item.x.toFixed(2)),
      y: Number(item.y.toFixed(2)),
      active: Boolean(item.active),
      radius: item.radius,
    }));

    const bodyItems = this.bodyItems.map((item) => ({
      id: item.id,
      type: item.type,
      x: Number(item.x.toFixed(2)),
      y: Number(item.y.toFixed(2)),
      active: Boolean(item.active),
      radius: item.radius,
    }));

    return {
      roomId: this.roomId,
      tick: this.tickIndex,
      phase: this.phase,
      trackId: this.trackId,
      raceStartedAtMs: this.raceStartedAtMs,
      raceEndedAtMs: this.raceEndedAtMs,
      players,
      pickups,
      bodyItems,
    };
  }

  broadcastState() {
    this.broadcast("snapshot", this.buildSnapshot());
  }
}
