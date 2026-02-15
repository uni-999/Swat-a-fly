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
const ONLINE_BODY_SEGMENT_COUNT = 16;
const ONLINE_BODY_SEGMENT_SPACING = 8.4;
const ONLINE_LANE_OFFSETS = [-13, -5, 5, 13];
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
  const raceView = {
    trackDef,
    track: runtime,
    bodyItems: [],
    pickups: [],
    venomShots: [],
  };
  const built = { trackDef, runtime, raceView };
  ONLINE_TRACK_CACHE.set(trackId, built);
  return built;
}

function buildOnlineRacer(scene, player, playerIndex, onlineTrack, selfSessionId) {
  const marker = getOnlinePlayerPose(player, playerIndex, onlineTrack);
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

function getOnlinePlayerPose(player, playerIndex, onlineTrack) {
  if (onlineTrack?.runtime) {
    const progressMeters = Number(player?.progress) || 0;
    const lapFractionRaw = progressMeters / ONLINE_PROGRESS_LAP_METERS;
    const lapFraction = lapFractionRaw - Math.floor(lapFractionRaw);
    const sample = sampleTrack(onlineTrack.runtime, lapFraction);
    const normal = { x: -sample.tangent.y, y: sample.tangent.x };
    const laneOffset = ONLINE_LANE_OFFSETS[Math.abs(playerIndex) % ONLINE_LANE_OFFSETS.length];
    return {
      x: sample.x + normal.x * laneOffset,
      y: sample.y + normal.y * laneOffset,
      heading: Math.atan2(sample.tangent.y, sample.tangent.x),
    };
  }

  const centerX = CANVAS_WIDTH * 0.5;
  const centerY = CANVAS_HEIGHT * 0.5;
  const scale = 0.28;
  const maxDx = CANVAS_WIDTH * 0.44;
  const maxDy = CANVAS_HEIGHT * 0.35;
  const x = centerX + Math.max(-maxDx, Math.min(maxDx, (Number(player?.x) || 0) * scale));
  const y = centerY + Math.max(-maxDy, Math.min(maxDy, (Number(player?.y) || 0) * scale));
  return {
    x,
    y,
    heading: Number.isFinite(Number(player?.heading)) ? Number(player.heading) : 0,
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
}

function buildOnlineBodySegmentsFromTrail(trail, fallbackHeading) {
  if (!Array.isArray(trail) || trail.length < 2) {
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

  return segments;
}

function getOnlineRacerMotionHeading(racer) {
  if (racer?.bodySegments?.length) {
    const first = racer.bodySegments[0];
    const dx = racer.x - first.x;
    const dy = racer.y - first.y;
    if (Math.hypot(dx, dy) > 0.01) {
      return Math.atan2(dy, dx);
    }
  }
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
