import { CANVAS_WIDTH, CANVAS_HEIGHT, TRACK_BACKDROP_IMAGES, TRACK_SURFACE_TILES } from "./config.js";
import { BODY_ITEMS, PICKUP_TYPES, ITEM_SPRITES } from "./catalog.js";
import { hexToInt } from "./utils.js";

const PICKUP_SPRITE_DEPTH = 12;
const BODY_ITEM_SPRITE_DEPTH = 13;
const PICKUP_SPRITE_SIZE_MUL = 2.1;
const BODY_ITEM_SPRITE_SIZE_MUL = 2.35;

export function drawBackground(g, options = {}) {
  const skipBase = Boolean(options.skipBase);
  g.clear();
  if (skipBase) {
    return;
  }
  // Grass base with warmer tint for a more natural terrain look.
  g.fillGradientStyle(0x264827, 0x264827, 0x1d381f, 0x1d381f, 1);
  g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  g.fillStyle(0x335d2f, 0.22);
  g.fillEllipse(CANVAS_WIDTH * 0.24, CANVAS_HEIGHT * 0.2, 360, 240);
  g.fillEllipse(CANVAS_WIDTH * 0.74, CANVAS_HEIGHT * 0.25, 300, 220);
  g.fillEllipse(CANVAS_WIDTH * 0.62, CANVAS_HEIGHT * 0.74, 420, 260);
  g.fillStyle(0x1a311a, 0.18);
  g.fillEllipse(CANVAS_WIDTH * 0.45, CANVAS_HEIGHT * 0.46, 300, 170);
}

export function drawRaceWorld(scene, g, race, options = {}) {
  const skipTrack = Boolean(options.skipTrack);
  if (!skipTrack) {
    drawTrack(g, race.track);
  }
  drawCheckpoints(g, race.track);
  drawBodyItems(scene, g, race.bodyItems);
  drawPickups(scene, g, race.pickups);
  drawVenomShots(g, race.venomShots || []);
  syncTrackObjectSprites(scene, race, true);
}

export function ensureTrackBackdrop(scene, race) {
  if (!scene || !race?.track || !race?.trackDef?.id) {
    hideTrackBackdrop(scene);
    return false;
  }
  const trackId = race.trackDef.id;
  const directBackdropKey = TRACK_BACKDROP_IMAGES?.[trackId]?.key || null;
  if (directBackdropKey && scene.textures.exists(directBackdropKey)) {
    ensureBackdropSprite(scene, directBackdropKey);
    return true;
  }
  if (!hasTrackTileAssets(scene)) {
    hideTrackBackdrop(scene);
    return false;
  }

  const textureKey = `track_surface_${trackId}`;
  if (!scene.textures.exists(textureKey)) {
    const canvas = createTrackBackdropCanvas(scene, race.track);
    if (!canvas) {
      hideTrackBackdrop(scene);
      return false;
    }
    scene.textures.addCanvas(textureKey, canvas);
  }

  ensureBackdropSprite(scene, textureKey);
  return true;
}

export function hideTrackBackdrop(scene) {
  if (!scene?.trackBackdropSprite) {
    return;
  }
  scene.trackBackdropSprite.setVisible(false);
}

function ensureBackdropSprite(scene, textureKey) {
  let sprite = scene.trackBackdropSprite || null;
  if (!sprite) {
    sprite = scene.add.image(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.5, textureKey).setDepth(-5);
    scene.trackBackdropSprite = sprite;
  } else if (sprite.texture.key !== textureKey) {
    sprite.setTexture(textureKey);
  }

  sprite.setVisible(true);
  sprite.setPosition(CANVAS_WIDTH * 0.5, CANVAS_HEIGHT * 0.5);
  sprite.setDisplaySize(CANVAS_WIDTH, CANVAS_HEIGHT);
  sprite.setDepth(-5);
  scene.trackBackdropKey = textureKey;
}

function drawTrack(g, track) {
  // Outer verge (grass shoulder).
  g.lineStyle((track.outsideWidth + 16) * 2, 0x3f6d33, 0.38);
  strokeClosedPolyline(g, track.points);

  // Dirt layer between grass and asphalt.
  g.lineStyle(track.outsideWidth * 2, 0x8d6c45, 0.78);
  strokeClosedPolyline(g, track.points);

  // Dusty edge to soften transition into asphalt.
  g.lineStyle((track.roadWidth + 6) * 2, 0x8f7d61, 0.34);
  strokeClosedPolyline(g, track.points);

  // Asphalt.
  g.lineStyle(track.roadWidth * 2, 0x5c5d59, 0.95);
  strokeClosedPolyline(g, track.points);

  // Center marking.
  g.lineStyle(2, 0xf2dc9a, 0.76);
  drawDashedPolyline(g, track.points, 11, 11);
}

function hasTrackTileAssets(scene) {
  return (
    scene?.textures?.exists(TRACK_SURFACE_TILES.grass.key) &&
    scene?.textures?.exists(TRACK_SURFACE_TILES.dirt.key) &&
    scene?.textures?.exists(TRACK_SURFACE_TILES.asphalt.key)
  );
}

function getTextureSource(scene, key) {
  const texture = scene?.textures?.get(key);
  if (!texture || typeof texture.getSourceImage !== "function") {
    return null;
  }
  const source = texture.getSourceImage();
  if (Array.isArray(source)) {
    return source[0] || null;
  }
  return source || null;
}

function resolvePattern(ctx, scene, textureKey, fallbackColor) {
  const source = getTextureSource(scene, textureKey);
  if (source) {
    const pattern = ctx.createPattern(source, "repeat");
    if (pattern) {
      return pattern;
    }
  }
  return fallbackColor;
}

function createTrackBackdropCanvas(scene, track) {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const grassFill = resolvePattern(ctx, scene, TRACK_SURFACE_TILES.grass.key, "#264827");
  const dirtFill = resolvePattern(ctx, scene, TRACK_SURFACE_TILES.dirt.key, "#8d6c45");
  const asphaltFill = resolvePattern(ctx, scene, TRACK_SURFACE_TILES.asphalt.key, "#5c5d59");

  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = grassFill;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = dirtFill;
  ctx.lineWidth = (track.outsideWidth + 16) * 2;
  strokeClosedPolylineCanvas(ctx, track.points);

  ctx.strokeStyle = dirtFill;
  ctx.lineWidth = track.outsideWidth * 2;
  strokeClosedPolylineCanvas(ctx, track.points);

  ctx.strokeStyle = asphaltFill;
  ctx.lineWidth = track.roadWidth * 2;
  strokeClosedPolylineCanvas(ctx, track.points);

  ctx.strokeStyle = "rgba(255, 245, 205, 0.78)";
  ctx.lineWidth = 2.2;
  drawDashedPolylineCanvas(ctx, track.points, 11, 11);

  return canvas;
}

function strokeClosedPolylineCanvas(ctx, points) {
  if (!points || !points.length) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.stroke();
}

function drawDashedPolylineCanvas(ctx, points, dash, gap) {
  if (!points || points.length < 2) {
    return;
  }
  ctx.setLineDash([dash, gap]);
  strokeClosedPolylineCanvas(ctx, points);
  ctx.setLineDash([]);
}

function strokeClosedPolyline(g, points) {
  if (!points.length) {
    return;
  }
  g.beginPath();
  g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    g.lineTo(points[i].x, points[i].y);
  }
  g.lineTo(points[0].x, points[0].y);
  g.strokePath();
}

function drawDashedPolyline(g, points, dash, gap) {
  if (points.length < 2) {
    return;
  }
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) {
      continue;
    }
    const nx = dx / len;
    const ny = dy / len;
    let pos = 0;
    let paint = true;
    while (pos < len) {
      const segLen = Math.min(paint ? dash : gap, len - pos);
      if (paint) {
        const x1 = a.x + nx * pos;
        const y1 = a.y + ny * pos;
        const x2 = a.x + nx * (pos + segLen);
        const y2 = a.y + ny * (pos + segLen);
        g.lineBetween(x1, y1, x2, y2);
      }
      pos += segLen;
      paint = !paint;
    }
  }
}

function drawCheckpoints(g, track) {
  for (let i = 0; i < track.checkpoints.length; i += 1) {
    const cp = track.checkpoints[i];
    g.fillStyle(i === 0 ? 0xff6565 : 0x62dbff, i === 0 ? 0.9 : 0.85);
    g.fillCircle(cp.x, cp.y, i === 0 ? 8 : 6);
  }
}

function drawBodyItems(scene, g, bodyItems) {
  for (const item of bodyItems) {
    if (!item.active) {
      continue;
    }
    if (supportsItemSprite(scene, item.type)) {
      continue;
    }
    if (item.type === "APPLE") {
      drawApple(g, item.x, item.y, item.radius);
    } else {
      drawCactus(g, item.x, item.y, item.radius);
    }
  }
}

function drawApple(g, x, y, radius) {
  g.fillStyle(hexToInt(BODY_ITEMS.APPLE.color), 0.95);
  g.fillCircle(x, y, radius * 0.9);
  g.fillStyle(0x8d2e35, 0.34);
  g.fillCircle(x + radius * 0.28, y - radius * 0.1, radius * 0.28);
  g.lineStyle(2, 0x6b4a2d, 1);
  g.lineBetween(x, y - radius, x + 2, y - radius - 7);
  g.fillStyle(0x67d275, 0.95);
  g.fillEllipse(x + 6, y - radius - 6, 8, 5);
}

function drawCactus(g, x, y, radius) {
  const color = hexToInt(BODY_ITEMS.CACTUS.color);
  const h = radius * 1.8;
  const arm = radius * 0.9;
  g.fillStyle(color, 0.95);
  g.fillRoundedRect(x - radius * 0.35, y - h * 0.5, radius * 0.7, h, 3);
  g.fillRoundedRect(x - arm, y - h * 0.2, arm * 0.65, radius * 0.5, 3);
  g.fillRoundedRect(x + radius * 0.35, y - h * 0.06, arm * 0.65, radius * 0.5, 3);
  g.lineStyle(1, 0x2f874f, 0.95);
  g.lineBetween(x - radius * 0.12, y - h * 0.45, x - radius * 0.12, y + h * 0.43);
  g.lineBetween(x + radius * 0.12, y - h * 0.45, x + radius * 0.12, y + h * 0.43);
}

function drawPickups(scene, g, pickups) {
  for (const pickup of pickups) {
    if (!pickup.active) {
      continue;
    }
    if (supportsItemSprite(scene, pickup.type)) {
      continue;
    }
    const color = hexToInt(PICKUP_TYPES[pickup.type].color);
    const size = 7;
    g.fillStyle(color, 1);
    g.fillPoints(
      [
        { x: pickup.x, y: pickup.y - size },
        { x: pickup.x + size, y: pickup.y },
        { x: pickup.x, y: pickup.y + size },
        { x: pickup.x - size, y: pickup.y },
      ],
      true
    );
  }
}

export function syncTrackObjectSprites(scene, race, visible = true) {
  if (!scene) {
    return;
  }

  const bodyItemSpriteMap = ensureObjectSpriteMap(scene, "bodyItemSpriteMap");
  const pickupSpriteMap = ensureObjectSpriteMap(scene, "pickupSpriteMap");

  if (!visible || !race) {
    hideObjectSpriteMap(bodyItemSpriteMap);
    hideObjectSpriteMap(pickupSpriteMap);
    return;
  }

  syncObjectSpriteMap(scene, bodyItemSpriteMap, race.bodyItems || [], {
    depth: BODY_ITEM_SPRITE_DEPTH,
    sizeMul: BODY_ITEM_SPRITE_SIZE_MUL,
  });
  syncObjectSpriteMap(scene, pickupSpriteMap, race.pickups || [], {
    depth: PICKUP_SPRITE_DEPTH,
    sizeMul: PICKUP_SPRITE_SIZE_MUL,
  });
}

function supportsItemSprite(scene, itemType) {
  const support = scene?.itemSpriteSupportMap?.get(itemType);
  if (typeof support === "boolean") {
    return support;
  }
  const key = ITEM_SPRITES[itemType]?.key;
  return Boolean(key && scene?.textures?.exists(key));
}

function ensureObjectSpriteMap(scene, key) {
  if (!(scene[key] instanceof Map)) {
    scene[key] = new Map();
  }
  return scene[key];
}

function hideObjectSpriteMap(spriteMap) {
  if (!(spriteMap instanceof Map)) {
    return;
  }
  spriteMap.forEach((sprite) => sprite.setVisible(false));
}

function syncObjectSpriteMap(scene, spriteMap, objects, options) {
  const live = new Set();
  const depth = options.depth;
  const sizeMul = options.sizeMul;

  for (const object of objects) {
    live.add(object.id);
    const spriteCfg = ITEM_SPRITES[object.type];
    const spriteKey = spriteCfg?.key;
    const canUseSprite = object.active && supportsItemSprite(scene, object.type) && Boolean(spriteKey);

    let sprite = spriteMap.get(object.id);
    if (!canUseSprite) {
      if (sprite) {
        sprite.setVisible(false);
      }
      continue;
    }

    if (!sprite) {
      sprite = scene.add.image(0, 0, spriteKey).setOrigin(0.5, 0.5).setDepth(depth);
      spriteMap.set(object.id, sprite);
    } else if (sprite.texture.key !== spriteKey) {
      sprite.setTexture(spriteKey);
    }

    const radius = Number.isFinite(object.radius) ? object.radius : 10;
    const size = Math.max(16, radius * sizeMul);
    sprite.setVisible(true);
    sprite.setPosition(object.x, object.y);
    sprite.setDisplaySize(size, size);
    sprite.setDepth(depth);
    sprite.setAlpha(1);
    sprite.setRotation(0);
  }

  spriteMap.forEach((sprite, objectId) => {
    if (!live.has(objectId)) {
      sprite.setVisible(false);
    }
  });
}

function drawVenomShots(g, venomShots) {
  for (const shot of venomShots) {
    const base = shot.color || 0x8df36a;
    g.fillStyle(base, 0.88);
    g.fillCircle(shot.x, shot.y, shot.radius);
    g.lineStyle(1, 0xeaffdf, 0.78);
    g.strokeCircle(shot.x, shot.y, shot.radius + 1.8);
  }
}
