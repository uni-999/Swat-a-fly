import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  MENU_MUSIC,
  TRACK_BACKDROP_IMAGES,
  TRACK_MUSIC,
  TRACK_SURFACE_TILES,
} from "./config.js";
import {
  SNAKES,
  TRACK_DEFS,
  PICKUP_ORDER,
  snakeHeadTextureKey,
  snakeSegmentTextureKey,
  snakeHeadTexturePath,
  snakeSegmentTexturePath,
  ITEM_SPRITES,
} from "./catalog.js";
import { buildTrackRuntime, sampleTrack } from "./trackMath.js";
import { drawBackground, drawRaceWorld, ensureTrackBackdrop } from "./renderWorld.js";
import { drawRacers, syncRacerRenderSprites, syncRacerLabels } from "./renderRacers.js";

const ONLINE_PROGRESS_LAP_METERS = 12000;
const ONLINE_TRAIL_MIN_STEP = 2.5;
const ONLINE_TRAIL_MAX_POINTS = 220;
const ONLINE_BODY_SEGMENT_COUNT = 10;
const ONLINE_BODY_SEGMENT_SPACING = 8.4;
const ONLINE_BODY_ITEM_COUNT = 12;
const ONLINE_MAX_OBJECT_LANE_RATIO = 0.88;
const ONLINE_BODY_ITEM_MIN_SEPARATION = 64;
const ONLINE_BODY_ITEM_TO_CHECKPOINT_MIN_DIST = 62;
const ONLINE_BODY_ITEM_TO_PICKUP_MIN_DIST = 40;
const ONLINE_LANE_OFFSETS = [-13, -5, 5, 13];
const ONLINE_LANE_STEER_GAIN = 58;
const ONLINE_LANE_RETURN_DAMP = 0.9;
const ONLINE_POSE_SMOOTH_GAIN = 18;
const ONLINE_HEADING_SMOOTH_GAIN = 14;
const ONLINE_POSE_TELEPORT_DIST = 160;
const ONLINE_POSE_PREDICTION_MAX_SEC = 0.18;
const TRACK_DEF_BY_ID = new Map(TRACK_DEFS.map((def) => [def.id, def]));
const TRACK_DEF_BY_NORMALIZED_ID = new Map(
  TRACK_DEFS.map((def) => [normalizeTrackIdValue(def.id), def])
);
const ONLINE_TRACK_CACHE = new Map();

export function createSceneApi({ ui, state, updateRace, renderRace, renderIdle } = {}) {
  function initPhaser() {
    class RaceScene extends Phaser.Scene {
      constructor() {
        super("RaceScene");
        this.graphics = null;
        this.infoText = null;
        this.labelMap = new Map();
        this.spriteSupportMap = new Map();
        this.itemSpriteSupportMap = new Map();
        this.headSpriteMap = new Map();
        this.segmentSpriteMap = new Map();
        this.bodyItemSpriteMap = new Map();
        this.pickupSpriteMap = new Map();
        this.trackMusicMap = new Map();
        this.onlineTrailMap = new Map();
        this.onlinePoseMap = new Map();
        this.onlineLaneStateMap = new Map();
      }

      preload() {
        for (const snake of SNAKES) {
          this.load.image(snakeHeadTextureKey(snake.id), snakeHeadTexturePath(snake.id));
          this.load.image(snakeSegmentTextureKey(snake.id), snakeSegmentTexturePath(snake.id));
        }
        for (const spriteCfg of Object.values(ITEM_SPRITES)) {
          if (!spriteCfg?.key || !spriteCfg?.path) {
            continue;
          }
          this.load.image(spriteCfg.key, spriteCfg.path);
        }
        for (const musicCfg of Object.values(TRACK_MUSIC)) {
          this.load.audio(musicCfg.key, musicCfg.path);
        }
        if (MENU_MUSIC?.key && MENU_MUSIC?.path) {
          this.load.audio(MENU_MUSIC.key, MENU_MUSIC.path);
        }
        for (const backdropCfg of Object.values(TRACK_BACKDROP_IMAGES)) {
          if (!backdropCfg?.key || !backdropCfg?.path) {
            continue;
          }
          this.load.image(backdropCfg.key, backdropCfg.path);
        }
        for (const tileCfg of Object.values(TRACK_SURFACE_TILES)) {
          this.load.image(tileCfg.key, tileCfg.path);
        }
      }

      create() {
        this.graphics = this.add.graphics();
        this.infoText = this.add
          .text(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT - 12, "", {
            fontFamily: '"Exo 2", sans-serif',
            fontSize: "12px",
            color: "#d8e7ff",
            align: "center",
            stroke: "#07111f",
            strokeThickness: 2,
          })
          .setOrigin(0.5, 1)
          .setDepth(30);

        for (const snake of SNAKES) {
          this.spriteSupportMap.set(snake.id, {
            head: this.textures.exists(snakeHeadTextureKey(snake.id)),
            segment: this.textures.exists(snakeSegmentTextureKey(snake.id)),
          });
        }
        for (const [itemType, spriteCfg] of Object.entries(ITEM_SPRITES)) {
          this.itemSpriteSupportMap.set(itemType, Boolean(spriteCfg?.key && this.textures.exists(spriteCfg.key)));
        }

        for (const [trackId, musicCfg] of Object.entries(TRACK_MUSIC)) {
          if (!this.cache.audio.exists(musicCfg.key)) {
            continue;
          }
          const trackMusic = this.sound.add(musicCfg.key, { volume: musicCfg.volume });
          trackMusic.setLoop(true);
          this.trackMusicMap.set(trackId, trackMusic);
        }
        if (MENU_MUSIC?.key && this.cache.audio.exists(MENU_MUSIC.key)) {
          this.menuMusic = this.sound.add(MENU_MUSIC.key, { volume: MENU_MUSIC.volume });
          this.menuMusic.setLoop(true);
        }
        if (this.sound?.locked) {
          this.sound.once("unlocked", () => {
            syncRaceMusic();
          });
        }

        applyBackgroundRunPolicy(this.game);
        state.raceScene = this;
        syncRaceMusic();
      }

      update(time, delta) {
        const dt = Math.min(0.033, Math.max(0.001, delta / 1000));
        const raceBeforeUpdate = state.race;
        if (!raceBeforeUpdate) {
          if (state.currentScreen === "race" && state.online?.active) {
            try {
              renderOnlineSnapshot(this, state.online, time, renderIdle);
            } catch (error) {
              console.error("[online] render snapshot failed:", error);
              renderIdle(this);
            }
            return;
          }
          renderIdle(this);
          return;
        }

        updateRace(raceBeforeUpdate, time, dt);

        const raceAfterUpdate = state.race;
        if (raceAfterUpdate) {
          try {
            renderRace(this, raceAfterUpdate, time);
          } catch (error) {
            console.error("[race] render failed:", error);
            renderIdle(this);
          }
        } else {
          renderIdle(this);
        }
      }
    }

    state.phaserGame = new Phaser.Game({
      type: Phaser.AUTO,
      parent: ui.raceStage,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: "#081122",
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
      },
      fps: {
        forceSetTimeOut: true,
        target: 60,
        min: 5,
        panicMax: 120,
      },
      scene: [RaceScene],
    });
  }

  function applyBackgroundRunPolicy(game) {
    if (!game || state.visibilityPolicyApplied) {
      return;
    }

    const events = game.events;
    if (!events) {
      return;
    }

    // Disable Phaser auto-pause on hidden state and keep the loop alive.
    events.off(Phaser.Core.Events.HIDDEN, game.onHidden, game);
    events.off(Phaser.Core.Events.VISIBLE, game.onVisible, game);

    const onHiddenKeepAlive = () => {
      game.loop.blur();
    };
    const onVisibleKeepAlive = () => {
      game.loop.focus();
      events.emit(Phaser.Core.Events.RESUME, 0);
    };

    events.on(Phaser.Core.Events.HIDDEN, onHiddenKeepAlive);
    events.on(Phaser.Core.Events.VISIBLE, onVisibleKeepAlive);

    state.visibilityKeepAliveHandlers = { onHiddenKeepAlive, onVisibleKeepAlive };
    state.visibilityPolicyApplied = true;
  }

  function syncRaceMusic() {
    const scene = state.raceScene;
    if (!scene) {
      return;
    }
    if (scene.sound?.locked) {
      return;
    }
    const activeTrackId =
      state.currentScreen === "race"
        ? state.race?.trackDef?.id || (state.online?.active ? state.online?.trackId : null) || null
        : null;

    scene.trackMusicMap?.forEach((music, trackId) => {
      if (!music) {
        return;
      }
      const shouldPlay = activeTrackId === trackId;
      if (shouldPlay) {
        if (!music.loop) {
          music.setLoop(true);
        }
        if (!music.isPlaying) {
          try {
            const cfg = TRACK_MUSIC[trackId];
            music.play({ loop: true, volume: cfg?.volume ?? music.volume ?? 1 });
          } catch (error) {
            console.warn("[audio] track music play failed:", error);
          }
        }
      } else if (music.isPlaying) {
        music.stop();
      }
    });

    const menuMusic = scene.menuMusic || null;
    if (!menuMusic) {
      return;
    }
    const shouldPlayMenu = !activeTrackId;
    if (shouldPlayMenu) {
      if (!menuMusic.loop) {
        menuMusic.setLoop(true);
      }
      if (!menuMusic.isPlaying) {
        try {
          menuMusic.play({ loop: true, volume: MENU_MUSIC?.volume ?? menuMusic.volume ?? 1 });
        } catch (error) {
          console.warn("[audio] menu music play failed:", error);
        }
      }
    } else if (menuMusic.isPlaying) {
      menuMusic.stop();
    }
  }

  return {
    initPhaser,
    syncRaceMusic,
  };
}

function renderOnlineSnapshot(scene, onlineState, nowMs, renderIdle) {
  const g = scene.graphics;
  const snapshot = onlineState?.snapshot || null;
  const status = onlineState?.status || "idle";
  const trackId = normalizeTrackIdValue(snapshot?.trackId || onlineState?.trackId || "canyon_loop");
  const onlineTrack = resolveOnlineTrack(trackId);
  const onlineRaceView = buildOnlineRaceViewFromSnapshot(onlineTrack, snapshot);

  if (onlineRaceView) {
    const hasTrackBackdrop = ensureTrackBackdrop(scene, onlineRaceView);
    drawBackground(g, { skipBase: hasTrackBackdrop });
    drawRaceWorld(scene, g, onlineRaceView, { skipTrack: hasTrackBackdrop });
  } else {
    renderIdle(scene);
  }

  if (!snapshot) {
    syncRacerRenderSprites(scene, [], false, getOnlineRacerMotionHeading);
    syncRacerLabels(scene, [], false);
    scene.onlineTrailMap?.clear?.();
    scene.onlinePoseMap?.clear?.();
    scene.onlineLaneStateMap?.clear?.();
    scene.infoText.setVisible(true);
    scene.infoText.setText([
      `Online: ${status}`,
      onlineState?.roomId ? `Room: ${onlineState.roomId}` : "Connecting to room...",
      onlineState?.endpoint ? `Endpoint: ${onlineState.endpoint}` : "Endpoint: -",
      Number.isFinite(onlineState?.latencyMs) ? `RTT: ${Math.round(onlineState.latencyMs)} ms` : "RTT: -",
      `Time: ${Math.round(nowMs)} ms`,
    ]);
    return;
  }

  const players = Array.isArray(snapshot.players) ? snapshot.players : [];
  const snapshotTick = Number(snapshot.tick);
  const onlineRacers = players.map((player, playerIndex) =>
    buildOnlineRacer(scene, player, playerIndex, onlineTrack, onlineState?.sessionId, nowMs, snapshotTick)
  );
  pruneOnlineTrails(scene, onlineRacers);

  drawRacers(scene, g, onlineRacers, getOnlineRacerMotionHeading);
  syncRacerRenderSprites(scene, onlineRacers, true, getOnlineRacerMotionHeading);
  syncRacerLabels(scene, onlineRacers, true);

  const topRows = players.slice(0, 4).map((player, idx) => {
    const progress = Math.round(Number(player.progress) || 0);
    return `${idx + 1}. ${player.displayName}: ${progress}m${player.finished ? " ✓" : ""}`;
  });
  const phase = snapshot.phase || status;
  const latencyLine = Number.isFinite(onlineState?.latencyMs) ? `RTT: ${Math.round(onlineState.latencyMs)} ms` : "RTT: -";
  const connectedPlayers = players.filter((player) => player.connected).length;
  const readyPlayers = players.filter((player) => player.connected && player.ready).length;
  const lobbyHint = phase === "lobby" ? `Lobby: ${readyPlayers}/${Math.max(2, connectedPlayers)} ready (need 2 players)` : null;

  scene.infoText.setVisible(true);
  scene.infoText.setText([
    `Online room: ${snapshot.roomId || onlineState?.roomId || "-"}`,
    `Phase: ${phase} | ${latencyLine}`,
    onlineState?.endpoint ? `Endpoint: ${onlineState.endpoint}` : "Endpoint: -",
    ...(lobbyHint ? [lobbyHint] : []),
    ...topRows,
  ]);
}

function resolveOnlineTrack(trackId) {
  const defaultTrackId = normalizeTrackIdValue(TRACK_DEFS[0]?.id || "canyon_loop");
  const normalizedTrackId = normalizeTrackIdValue(trackId) || defaultTrackId;
  const cached = ONLINE_TRACK_CACHE.get(normalizedTrackId);
  if (cached) {
    return cached;
  }

  const trackDef =
    TRACK_DEF_BY_ID.get(normalizedTrackId) ||
    TRACK_DEF_BY_NORMALIZED_ID.get(normalizedTrackId) ||
    TRACK_DEF_BY_ID.get(defaultTrackId) ||
    TRACK_DEF_BY_NORMALIZED_ID.get(defaultTrackId) ||
    null;
  if (!trackDef) {
    return null;
  }

  const runtime = buildTrackRuntime(trackDef);
  const pickups = createOnlinePickups(runtime, normalizedTrackId);
  const bodyItems = createOnlineBodyItems(runtime, trackId, pickups);
  const raceView = {
    trackDef,
    track: runtime,
    bodyItems,
    pickups,
    venomShots: [],
  };
  const built = { trackDef, runtime, raceView };
  ONLINE_TRACK_CACHE.set(normalizedTrackId, built);
  return built;
}

function normalizeTrackIdValue(trackId) {
  return String(trackId || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
}

function buildOnlineRaceViewFromSnapshot(onlineTrack, snapshot) {
  if (!onlineTrack?.raceView) {
    return null;
  }
  const baseView = onlineTrack.raceView;
  const snapshotPickups = normalizeOnlineObjects(snapshot?.pickups, baseView.pickups);
  const snapshotBodyItems = normalizeOnlineObjects(snapshot?.bodyItems, baseView.bodyItems);
  return {
    ...baseView,
    pickups: snapshotPickups,
    bodyItems: snapshotBodyItems,
  };
}

function normalizeOnlineObjects(snapshotList, fallbackList) {
  if (!Array.isArray(snapshotList) || !snapshotList.length) {
    return Array.isArray(fallbackList) ? fallbackList : [];
  }
  return snapshotList.map((item, index) => ({
    id: String(item?.id || `online_obj_${index + 1}`),
    type: String(item?.type || "APPLE"),
    x: Number.isFinite(Number(item?.x)) ? Number(item.x) : 0,
    y: Number.isFinite(Number(item?.y)) ? Number(item.y) : 0,
    active: item?.active !== false,
    radius: Number.isFinite(Number(item?.radius)) ? Number(item.radius) : 12,
  }));
}

function createOnlinePickups(track, trackId = "") {
  const rng = createSeededRng(hashString(`online_pickups_${trackId || "track"}`));
  const fractions = Array.isArray(track?.pickupFractions) ? track.pickupFractions : [];
  return fractions.map((fraction, index) => {
    const sample = sampleTrack(track, fraction);
    const normal = { x: -sample.tangent.y, y: sample.tangent.x };
    const laneRatio = randomLaneRatioFromRng(rng);
    const lateral = track.roadWidth * laneRatio;
    return {
      id: `online_pickup_${index + 1}`,
      type: PICKUP_ORDER[index % PICKUP_ORDER.length],
      x: sample.x + normal.x * lateral,
      y: sample.y + normal.y * lateral,
      active: true,
      radius: 12,
    };
  });
}

function createOnlineBodyItems(track, trackId, pickups = []) {
  const items = [];
  const rng = createSeededRng(hashString(`online_body_${trackId || "track"}`));
  const baseOffset = rng();
  const bodyItemTypes = buildBalancedBodyItemTypes(ONLINE_BODY_ITEM_COUNT, rng);

  for (let i = 0; i < ONLINE_BODY_ITEM_COUNT; i += 1) {
    let chosen = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const fraction = mod1(baseOffset + i / ONLINE_BODY_ITEM_COUNT + (rng() - 0.5) * 0.08);
      const sample = sampleTrack(track, fraction);
      const normal = { x: -sample.tangent.y, y: sample.tangent.x };
      const laneRatio = randomLaneRatioFromRng(rng);
      const lateral = track.roadWidth * laneRatio;
      const x = sample.x + normal.x * lateral;
      const y = sample.y + normal.y * lateral;
      if (isOnlineBodyItemPositionValid(x, y, track, items, pickups)) {
        chosen = { x, y };
        break;
      }
    }

    if (!chosen) {
      const fallbackSample = sampleTrack(track, mod1(baseOffset + i / ONLINE_BODY_ITEM_COUNT));
      chosen = { x: fallbackSample.x, y: fallbackSample.y };
    }

    items.push({
      id: `online_body_item_${i + 1}`,
      type: bodyItemTypes[i] || "APPLE",
      x: chosen.x,
      y: chosen.y,
      radius: 11,
      active: true,
    });
  }

  return items;
}

function isOnlineBodyItemPositionValid(x, y, track, bodyItems, pickups) {
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

function buildOnlineRacer(scene, player, playerIndex, onlineTrack, selfSessionId, nowMs, snapshotTick) {
  const sessionKey = resolveOnlineSessionKey(player, playerIndex);
  const marker = getOnlinePlayerPose(scene, player, playerIndex, onlineTrack, sessionKey, nowMs, snapshotTick);
  const trail = updateOnlineTrail(scene, sessionKey, marker.x, marker.y, marker.heading);
  const snake = pickOnlineSnakeVariant(player);
  const bodySegments = buildOnlineBodySegmentsFromTrail(trail, marker.heading);
  const isSelf = Boolean(selfSessionId && player.sessionId === selfSessionId);

  return {
    id: `online_${player.sessionId || player.userId || playerIndex}`,
    sessionKey,
    name: player.displayName || `P${playerIndex + 1}`,
    typeId: snake.id,
    color: isSelf ? "#ffd56d" : snake.color,
    x: marker.x,
    y: marker.y,
    heading: marker.heading,
    bodySegments,
    trail,
    shieldCharges: 0,
  };
}

function resolveOnlineSessionKey(player, playerIndex) {
  if (player?.sessionId) {
    return String(player.sessionId);
  }
  if (player?.userId) {
    return String(player.userId);
  }
  return `online_${playerIndex}`;
}

function getOnlinePlayerPose(scene, player, playerIndex, onlineTrack, sessionKey, nowMs, snapshotTick) {
  const rawX = Number(player?.x);
  const rawY = Number(player?.y);
  const rawHeading = Number(player?.heading);
  const rawSpeed = Math.max(0, Number(player?.speed) || 0);

  let targetX = rawX;
  let targetY = rawY;
  let targetHeading = rawHeading;

  if (!(Number.isFinite(targetX) && Number.isFinite(targetY)) && onlineTrack?.runtime) {
    const progressMeters = Number(player?.progress) || 0;
    const lapFractionRaw = progressMeters / ONLINE_PROGRESS_LAP_METERS;
    const lapFraction = lapFractionRaw - Math.floor(lapFractionRaw);
    const sample = sampleTrack(onlineTrack.runtime, lapFraction);
    targetX = sample.x;
    targetY = sample.y;
    targetHeading = Number.isFinite(rawHeading) ? rawHeading : Math.atan2(sample.tangent.y, sample.tangent.x);
  }

  if (!(Number.isFinite(targetX) && Number.isFinite(targetY))) {
    targetX = CANVAS_WIDTH * 0.5;
    targetY = CANVAS_HEIGHT * 0.5;
  }
  if (!Number.isFinite(targetHeading)) {
    targetHeading = 0;
  }

  const renderNowMs =
    Number.isFinite(nowMs)
      ? nowMs
      : typeof performance !== "undefined" && Number.isFinite(performance.now())
      ? performance.now()
      : Date.now();

  return resolveSmoothedOnlinePose(scene, sessionKey, {
    x: targetX,
    y: targetY,
    heading: targetHeading,
    speed: rawSpeed,
    tick: Number.isFinite(snapshotTick) ? snapshotTick : null,
    nowMs: renderNowMs,
  });
}

function resolveSmoothedOnlinePose(scene, sessionKey, target) {
  if (!scene.onlinePoseMap) {
    scene.onlinePoseMap = new Map();
  }

  let pose = scene.onlinePoseMap.get(sessionKey);
  if (!pose) {
    pose = {
      x: target.x,
      y: target.y,
      heading: target.heading,
      targetX: target.x,
      targetY: target.y,
      targetHeading: target.heading,
      targetSpeed: target.speed || 0,
      lastSnapshotTick: target.tick,
      lastSnapshotAtMs: target.nowMs,
      lastUpdateAtMs: target.nowMs,
    };
    scene.onlinePoseMap.set(sessionKey, pose);
    return { x: pose.x, y: pose.y, heading: pose.heading };
  }

  const dxToTarget = target.x - pose.targetX;
  const dyToTarget = target.y - pose.targetY;
  const headingToTarget = Math.abs(shortestAngleDelta(target.heading, pose.targetHeading));
  const tickChanged = Number.isFinite(target.tick) && target.tick !== pose.lastSnapshotTick;
  const targetChanged = Math.hypot(dxToTarget, dyToTarget) > 0.5 || headingToTarget > 0.015;
  if (tickChanged || targetChanged) {
    pose.targetX = target.x;
    pose.targetY = target.y;
    pose.targetHeading = target.heading;
    pose.targetSpeed = target.speed || 0;
    pose.lastSnapshotTick = target.tick;
    pose.lastSnapshotAtMs = target.nowMs;
  }

  const dtSec = clamp((target.nowMs - pose.lastUpdateAtMs) / 1000, 0.001, 0.2);
  pose.lastUpdateAtMs = target.nowMs;

  const snapshotAgeSec = clamp((target.nowMs - pose.lastSnapshotAtMs) / 1000, 0, ONLINE_POSE_PREDICTION_MAX_SEC);
  const projectedX = pose.targetX + Math.cos(pose.targetHeading) * pose.targetSpeed * snapshotAgeSec;
  const projectedY = pose.targetY + Math.sin(pose.targetHeading) * pose.targetSpeed * snapshotAgeSec;
  const projectedHeading = pose.targetHeading;

  const jumpDistance = Math.hypot(projectedX - pose.x, projectedY - pose.y);
  if (jumpDistance > ONLINE_POSE_TELEPORT_DIST) {
    pose.x = projectedX;
    pose.y = projectedY;
    pose.heading = projectedHeading;
    return { x: pose.x, y: pose.y, heading: pose.heading };
  }

  const followAlpha = 1 - Math.exp(-ONLINE_POSE_SMOOTH_GAIN * dtSec);
  pose.x += (projectedX - pose.x) * followAlpha;
  pose.y += (projectedY - pose.y) * followAlpha;

  const headingAlpha = 1 - Math.exp(-ONLINE_HEADING_SMOOTH_GAIN * dtSec);
  pose.heading += shortestAngleDelta(projectedHeading, pose.heading) * headingAlpha;

  return { x: pose.x, y: pose.y, heading: pose.heading };
}

function pickOnlineSnakeVariant(player) {
  const seed = hashString(player?.sessionId || player?.userId || player?.displayName || "online");
  return SNAKES[Math.abs(seed) % SNAKES.length];
}

function updateOnlineTrail(scene, sessionKey, x, y, heading) {
  if (!scene.onlineTrailMap) {
    scene.onlineTrailMap = new Map();
  }

  let trail = scene.onlineTrailMap.get(sessionKey);
  if (!trail) {
    trail = [];
    scene.onlineTrailMap.set(sessionKey, trail);
  }

  const now = Date.now();
  const last = trail[trail.length - 1];
  if (!last) {
    trail.push({ x, y, heading, at: now });
  } else {
    const dx = x - last.x;
    const dy = y - last.y;
    if (Math.hypot(dx, dy) >= ONLINE_TRAIL_MIN_STEP) {
      trail.push({ x, y, heading, at: now });
    } else {
      last.x = x;
      last.y = y;
      last.heading = heading;
      last.at = now;
    }
  }

  while (trail.length > ONLINE_TRAIL_MAX_POINTS) {
    trail.shift();
  }

  return trail;
}

function pruneOnlineTrails(scene, onlineRacers) {
  if (!scene.onlineTrailMap) {
    return;
  }

  const liveKeys = new Set(onlineRacers.map((racer) => racer.sessionKey));
  for (const key of scene.onlineTrailMap.keys()) {
    if (!liveKeys.has(key)) {
      scene.onlineTrailMap.delete(key);
    }
  }
  if (scene.onlineLaneStateMap) {
    for (const key of scene.onlineLaneStateMap.keys()) {
      if (!liveKeys.has(key)) {
        scene.onlineLaneStateMap.delete(key);
      }
    }
  }
  if (scene.onlinePoseMap) {
    for (const key of scene.onlinePoseMap.keys()) {
      if (!liveKeys.has(key)) {
        scene.onlinePoseMap.delete(key);
      }
    }
  }
}

function resolveOnlineLaneOffset(scene, sessionKey, rawHeading, roadWidth, baseLaneOffset) {
  if (!scene.onlineLaneStateMap) {
    scene.onlineLaneStateMap = new Map();
  }
  const maxLane = Math.max(26, roadWidth * 0.62);
  const heading = Number.isFinite(rawHeading) ? rawHeading : 0;
  let laneState = scene.onlineLaneStateMap.get(sessionKey);
  if (!laneState) {
    laneState = { laneOffset: baseLaneOffset, lastHeading: heading };
    scene.onlineLaneStateMap.set(sessionKey, laneState);
    return laneState.laneOffset;
  }

  const delta = shortestAngleDelta(heading, laneState.lastHeading);
  laneState.laneOffset += delta * ONLINE_LANE_STEER_GAIN;
  laneState.laneOffset = baseLaneOffset + (laneState.laneOffset - baseLaneOffset) * ONLINE_LANE_RETURN_DAMP;
  laneState.laneOffset = Math.max(-maxLane, Math.min(maxLane, laneState.laneOffset));
  laneState.lastHeading = heading;
  return laneState.laneOffset;
}

function buildOnlineBodySegmentsFromTrail(trail, fallbackHeading) {
  if (!Array.isArray(trail) || !trail.length) {
    return [];
  }

  const segments = [];
  let consumedDistance = 0;
  let nextDistance = ONLINE_BODY_SEGMENT_SPACING;
  let newer = trail[trail.length - 1];

  for (let i = trail.length - 2; i >= 0 && segments.length < ONLINE_BODY_SEGMENT_COUNT; i -= 1) {
    const older = trail[i];
    const vx = older.x - newer.x;
    const vy = older.y - newer.y;
    const len = Math.hypot(vx, vy);
    if (len < 0.0001) {
      newer = older;
      continue;
    }

    while (consumedDistance + len >= nextDistance && segments.length < ONLINE_BODY_SEGMENT_COUNT) {
      const t = (nextDistance - consumedDistance) / len;
      const x = newer.x + vx * t;
      const y = newer.y + vy * t;
      const heading = Math.atan2(newer.y - y, newer.x - x) || fallbackHeading || 0;
      const ratio = segments.length / Math.max(1, ONLINE_BODY_SEGMENT_COUNT - 1);
      segments.push({
        x,
        y,
        heading,
        radius: Math.max(2.8, 5.8 - ratio * 2.5),
        alpha: Math.max(0.2, 0.88 - ratio * 0.55),
      });
      nextDistance += ONLINE_BODY_SEGMENT_SPACING;
    }

    consumedDistance += len;
    newer = older;
  }

  const tailAnchor = segments[segments.length - 1] || {
    x: trail[0].x,
    y: trail[0].y,
    heading: fallbackHeading || trail[trail.length - 1].heading || 0,
    radius: 3,
    alpha: 0.2,
  };

  while (segments.length < ONLINE_BODY_SEGMENT_COUNT) {
    const ratio = segments.length / Math.max(1, ONLINE_BODY_SEGMENT_COUNT - 1);
    segments.push({
      x: tailAnchor.x,
      y: tailAnchor.y,
      heading: tailAnchor.heading,
      radius: Math.max(2.8, 5.8 - ratio * 2.5),
      alpha: Math.max(0.2, 0.88 - ratio * 0.55),
    });
  }

  return segments;
}

function getOnlineRacerMotionHeading(racer) {
  return racer?.heading || 0;
}

function randomLaneRatioFromRng(rng) {
  const unit = clamp(Number(rng?.()) || 0, 0, 1);
  return (unit * 2 - 1) * ONLINE_MAX_OBJECT_LANE_RATIO;
}

function buildBalancedBodyItemTypes(count, rng) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const appleCount = Math.ceil(total * 0.5);
  const cactusCount = Math.max(0, total - appleCount);
  const types = [
    ...new Array(appleCount).fill("APPLE"),
    ...new Array(cactusCount).fill("CACTUS"),
  ];
  for (let i = types.length - 1; i > 0; i -= 1) {
    const j = Math.floor(clamp(Number(rng?.()) || 0, 0, 0.999999) * (i + 1));
    const tmp = types[i];
    types[i] = types[j];
    types[j] = tmp;
  }
  return types;
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

function mod1(value) {
  return ((value % 1) + 1) % 1;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sqrDistance(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function createSeededRng(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
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
