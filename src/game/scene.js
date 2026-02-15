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
  snakeHeadTextureKey,
  snakeSegmentTextureKey,
  snakeHeadTexturePath,
  snakeSegmentTexturePath,
  ITEM_SPRITES,
} from "./catalog.js";

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
            fontFamily: "\"Exo 2\", sans-serif",
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
  renderIdle(scene);
  const g = scene.graphics;
  const snapshot = onlineState?.snapshot || null;
  const status = onlineState?.status || "idle";

  if (!snapshot) {
    scene.infoText.setVisible(true);
    scene.infoText.setText([
      `Онлайн: ${status}`,
      onlineState?.roomId ? `Комната: ${onlineState.roomId}` : "Подключение к комнате...",
      onlineState?.endpoint ? `Endpoint: ${onlineState.endpoint}` : "Endpoint: -",
      Number.isFinite(onlineState?.latencyMs) ? `RTT: ${Math.round(onlineState.latencyMs)} ms` : "RTT: -",
      `Время: ${Math.round(nowMs)} ms`,
    ]);
    return;
  }

  const players = Array.isArray(snapshot.players) ? snapshot.players : [];
  const centerX = CANVAS_WIDTH * 0.5;
  const centerY = CANVAS_HEIGHT * 0.5;
  const scale = 0.28;
  const maxDx = CANVAS_WIDTH * 0.44;
  const maxDy = CANVAS_HEIGHT * 0.35;

  for (const player of players) {
    const px = centerX + Math.max(-maxDx, Math.min(maxDx, (Number(player.x) || 0) * scale));
    const py = centerY + Math.max(-maxDy, Math.min(maxDy, (Number(player.y) || 0) * scale));
    const isSelf = onlineState?.sessionId && player.sessionId === onlineState.sessionId;
    const color = isSelf ? 0xffd56d : player.isBot ? 0x7ec5ff : 0x7bf1a6;
    const radius = player.finished ? 5 : 8;
    g.fillStyle(color, 0.95);
    g.fillCircle(px, py, radius);
    if (player.finished) {
      g.lineStyle(1, 0xffffff, 0.8);
      g.strokeCircle(px, py, radius + 2);
    }
  }

  const topRows = players.slice(0, 4).map((player, idx) => {
    const progress = Math.round(Number(player.progress) || 0);
    return `${idx + 1}. ${player.displayName}: ${progress}м${player.finished ? " ✓" : ""}`;
  });
  const phase = snapshot.phase || status;
  const latencyLine = Number.isFinite(onlineState?.latencyMs) ? `RTT: ${Math.round(onlineState.latencyMs)} ms` : "RTT: -";
  scene.infoText.setVisible(true);
  scene.infoText.setText([
    `Онлайн комната: ${snapshot.roomId || onlineState?.roomId || "-"}`,
    `Фаза: ${phase} | ${latencyLine}`,
    onlineState?.endpoint ? `Endpoint: ${onlineState.endpoint}` : "Endpoint: -",
    ...topRows,
  ]);
}
