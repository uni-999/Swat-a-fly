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
const ONLINE_PICKUP_LANE_RATIOS = [-0.04, 0.04, 0];
const ONLINE_BODY_LANE_RATIOS = [-0.07, -0.03, 0, 0.03, 0.07];
const ONLINE_BODY_ITEM_MIN_SEPARATION = 64;
const ONLINE_BODY_ITEM_TO_CHECKPOINT_MIN_DIST = 62;
const ONLINE_BODY_ITEM_TO_PICKUP_MIN_DIST = 40;
const ONLINE_LANE_OFFSETS = [-13, -5, 5, 13];
const ONLINE_LANE_STEER_GAIN = 58;
const ONLINE_LANE_RETURN_DAMP = 0.9;
const TRACK_DEF_BY_ID = new Map(TRACK_DEFS.map((def) => [def.id, def]));
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
        this.headSpriteMap = new Map();
        this.segmentSpriteMap = new Map();
        this.trackMusicMap = new Map();
        this.onlineTrailMap = new Map();
        this.onlineLaneStateMap = new Map();
      }

      preload() {
        for (const snake of SNAKES) {
          this.load.image(snakeHeadTextureKey(snake.id), snakeHeadTexturePath(snake.id));
          this.load.image(snakeSegmentTextureKey(snake.id), snakeSegmentTexturePath(snake.id));
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
            renderOnlineSnapshot(this, state.online, time, renderIdle);
            return;
          }
          renderIdle(this);
          return;
        }

        updateRace(raceBeforeUpdate, time, dt);

        const raceAfterUpdate = state.race;
        if (raceAfterUpdate) {
          renderRace(this, raceAfterUpdate, time);
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
  const trackId = snapshot?.trackId || onlineState?.trackId || "canyon_loop";
  const onlineTrack = resolveOnlineTrack(trackId);

  if (onlineTrack) {
    const hasTrackBackdrop = ensureTrackBackdrop(scene, onlineTrack.raceView);
    drawBackground(g, { skipBase: hasTrackBackdrop });
    drawRaceWorld(g, onlineTrack.raceView, { skipTrack: hasTrackBackdrop });
  } else {
    renderIdle(scene);
  }

  if (!snapshot) {
    syncRacerRenderSprites(scene, [], false, getOnlineRacerMotionHeading);
    syncRacerLabels(scene, [], false);
    scene.onlineTrailMap?.clear?.();
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
  const onlineRacers = players.map((player, playerIndex) =>
    buildOnlineRacer(scene, player, playerIndex, onlineTrack, onlineState?.sessionId)
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
  if (!trackId) {
    return null;
  }
  const cached = ONLINE_TRACK_CACHE.get(trackId);
  if (cached) {
    return cached;
  }

  const trackDef = TRACK_DEF_BY_ID.get(trackId);
  if (!trackDef) {
    return null;
  }

  const runtime = buildTrackRuntime(trackDef);
  const pickups = createOnlinePickups(runtime);
  const bodyItems = createOnlineBodyItems(runtime, trackId, pickups);
  const raceView = {
    trackDef,
    track: runtime,
    bodyItems,
    pickups,
    venomShots: [],
  };
  const built = { trackDef, runtime, raceView };
  ONLINE_TRACK_CACHE.set(trackId, built);
  return built;
}

function createOnlinePickups(track) {
  const fractions = Array.isArray(track?.pickupFractions) ? track.pickupFractions : [];
  return fractions.map((fraction, index) => {
    const sample = sampleTrack(track, fraction);
    const normal = { x: -sample.tangent.y, y: sample.tangent.x };
    const laneRatio = ONLINE_PICKUP_LANE_RATIOS[index % ONLINE_PICKUP_LANE_RATIOS.length];
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
      type: rng() < 0.58 ? "APPLE" : "CACTUS",
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

function buildOnlineRacer(scene, player, playerIndex, onlineTrack, selfSessionId) {
  const marker = getOnlinePlayerPose(scene, player, playerIndex, onlineTrack);
  const sessionKey = String(player?.sessionId || "unknown");
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

function getOnlinePlayerPose(scene, player, playerIndex, onlineTrack) {
  const rawX = Number(player?.x);
  const rawY = Number(player?.y);
  const rawHeading = Number(player?.heading);
  if (Number.isFinite(rawX) && Number.isFinite(rawY)) {
    return {
      x: rawX,
      y: rawY,
      heading: Number.isFinite(rawHeading) ? rawHeading : 0,
    };
  }

  if (onlineTrack?.runtime) {
    const progressMeters = Number(player?.progress) || 0;
    const lapFractionRaw = progressMeters / ONLINE_PROGRESS_LAP_METERS;
    const lapFraction = lapFractionRaw - Math.floor(lapFractionRaw);
    const sample = sampleTrack(onlineTrack.runtime, lapFraction);
    return {
      x: sample.x,
      y: sample.y,
      heading: Number.isFinite(rawHeading) ? rawHeading : Math.atan2(sample.tangent.y, sample.tangent.x),
    };
  }

  return {
    x: CANVAS_WIDTH * 0.5,
    y: CANVAS_HEIGHT * 0.5,
    heading: Number.isFinite(rawHeading) ? rawHeading : 0,
  };
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
