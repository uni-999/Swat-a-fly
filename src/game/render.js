import { CANVAS_WIDTH, CANVAS_HEIGHT, SEGMENT_RENDER_SCALE } from "./config.js";
import { BODY_ITEMS, PICKUP_TYPES, snakeHeadTextureKey, snakeSegmentTextureKey } from "./catalog.js";
import { hexToInt, wrapAngle } from "./utils.js";

export function renderRace(scene, race, nowMs, helpers = {}) {
  const formatMs = helpers.formatMs || ((value) => String(value ?? ""));
  const getRacerMotionHeading = helpers.getRacerMotionHeading || (() => null);
  const g = scene.graphics;
  drawBackground(g);
  drawTrack(g, race.track);
  drawCheckpoints(g, race.track);
  drawBodyItems(g, race.bodyItems);
  drawPickups(g, race.pickups);
  drawVenomShots(g, race.venomShots || []);
  drawRacers(scene, g, race.racers, getRacerMotionHeading);
  syncRacerRenderSprites(scene, race.racers, true, getRacerMotionHeading);
  syncRacerLabels(scene, race.racers, true);

  const phaseText = race.phase === "countdown" ? "РћС‚СЃС‡РµС‚" : race.phase === "running" ? "Р“РѕРЅРєР°" : "Р¤РёРЅРёС€";
  scene.infoText.setVisible(true);
  scene.infoText.setText([
    `РўСЂР°СЃСЃР°: ${race.trackDef.name}`,
    `Р¤Р°Р·Р°: ${phaseText}`,
    `Р’СЂРµРјСЏ: ${formatMs(Math.max(0, nowMs - race.raceStartMs))}`,
  ]);
}

export function renderIdle(scene, helpers = {}) {
  const getRacerMotionHeading = helpers.getRacerMotionHeading || (() => null);
  drawBackground(scene.graphics);
  scene.infoText.setVisible(false);
  syncRacerRenderSprites(scene, [], false, getRacerMotionHeading);
  syncRacerLabels(scene, [], false);
}

function drawBackground(g) {
  g.clear();
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

function drawBodyItems(g, bodyItems) {
  for (const item of bodyItems) {
    if (!item.active) {
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

function drawPickups(g, pickups) {
  for (const pickup of pickups) {
    if (!pickup.active) {
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

function drawVenomShots(g, venomShots) {
  for (const shot of venomShots) {
    const base = shot.color || 0x8df36a;
    g.fillStyle(base, 0.88);
    g.fillCircle(shot.x, shot.y, shot.radius);
    g.lineStyle(1, 0xeaffdf, 0.78);
    g.strokeCircle(shot.x, shot.y, shot.radius + 1.8);
  }
}

function drawRacers(scene, g, racers, getRacerMotionHeading) {
  racers.forEach((racer) => {
    if (!supportsSnakeSegmentSprite(scene, racer.typeId)) {
      drawBodySegments(g, racer);
    }
    drawTrail(g, racer);
  });
  racers.forEach((racer) => {
    if (!supportsSnakeHeadSprite(scene, racer.typeId)) {
      drawRacerBody(g, racer, getRacerMotionHeading);
    }
  });
}

function supportsSnakeHeadSprite(scene, snakeId) {
  const support = scene.spriteSupportMap?.get(snakeId);
  return Boolean(support && support.head);
}

function supportsSnakeSegmentSprite(scene, snakeId) {
  const support = scene.spriteSupportMap?.get(snakeId);
  return Boolean(support && support.segment);
}

function syncRacerRenderSprites(scene, racers, visible, getRacerMotionHeading) {
  const live = new Set();

  for (const racer of racers) {
    live.add(racer.id);
    syncRacerHeadSprite(scene, racer, visible, getRacerMotionHeading);
    syncRacerSegmentSprites(scene, racer, visible);
  }

  scene.headSpriteMap.forEach((sprite, racerId) => {
    if (!live.has(racerId) || !visible) {
      sprite.setVisible(false);
    }
  });

  scene.segmentSpriteMap.forEach((pool, racerId) => {
    if (!live.has(racerId) || !visible) {
      for (const sprite of pool) {
        sprite.setVisible(false);
      }
    }
  });
}

function syncRacerHeadSprite(scene, racer, visible, getRacerMotionHeading) {
  if (!supportsSnakeHeadSprite(scene, racer.typeId)) {
    const existing = scene.headSpriteMap.get(racer.id);
    if (existing) {
      existing.setVisible(false);
    }
    return;
  }

  const key = snakeHeadTextureKey(racer.typeId);
  let sprite = scene.headSpriteMap.get(racer.id);
  if (!sprite) {
    sprite = scene.add.image(0, 0, key).setDepth(23);
    sprite.setOrigin(0.5, 0.5);
    scene.headSpriteMap.set(racer.id, sprite);
  } else if (sprite.texture.key !== key) {
    sprite.setTexture(key);
  }

  sprite.setVisible(visible);
  sprite.setPosition(racer.x, racer.y);
  const renderHeading = getRacerMotionHeading(racer, 0.02, 16) ?? racer.heading;
  sprite.setRotation(renderHeading);
  const headSize = 28;
  sprite.setDisplaySize(headSize, headSize);
  sprite.setAlpha(1);
}

function syncRacerSegmentSprites(scene, racer, visible) {
  let pool = scene.segmentSpriteMap.get(racer.id);
  if (!pool) {
    pool = [];
    scene.segmentSpriteMap.set(racer.id, pool);
  }

  if (!supportsSnakeSegmentSprite(scene, racer.typeId)) {
    for (const sprite of pool) {
      sprite.setVisible(false);
    }
    return;
  }

  const key = snakeSegmentTextureKey(racer.typeId);
  const segments = racer.bodySegments || [];

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    let sprite = pool[i];
    if (!sprite) {
      sprite = scene.add.image(0, 0, key).setDepth(17);
      sprite.setOrigin(0.5, 0.5);
      pool.push(sprite);
    } else if (sprite.texture.key !== key) {
      sprite.setTexture(key);
    }

    sprite.setVisible(visible);
    sprite.setPosition(segment.x, segment.y);
    // Segment sprite must face opposite to movement (tail direction).
    sprite.setRotation(wrapAngle(segment.heading + Math.PI));
    const size = Math.max(4, segment.radius * 2.25 * SEGMENT_RENDER_SCALE);
    sprite.setDisplaySize(size, size);
    sprite.setAlpha(segment.alpha);
  }

  for (let i = segments.length; i < pool.length; i += 1) {
    pool[i].setVisible(false);
  }
}

function drawBodySegments(g, racer) {
  if (!racer.bodySegments || !racer.bodySegments.length) {
    return;
  }
  const color = hexToInt(racer.color);
  for (let i = racer.bodySegments.length - 1; i >= 0; i -= 1) {
    const segment = racer.bodySegments[i];
    g.fillStyle(color, segment.alpha);
    g.fillCircle(segment.x, segment.y, segment.radius * SEGMENT_RENDER_SCALE);
  }
}

function drawTrail(g, racer) {
  if (!racer.trail.length) {
    return;
  }
  const color = hexToInt(racer.color);
  for (let i = 0; i < racer.trail.length; i += 1) {
    const point = racer.trail[i];
    const alpha = i / racer.trail.length;
    const radius = 3 + alpha * 4;
    g.fillStyle(color, 0.05 + alpha * 0.12);
    g.fillCircle(point.x, point.y, radius);
  }
}

function drawRacerBody(g, racer, getRacerMotionHeading) {
  const renderHeading = getRacerMotionHeading(racer, 0.02, 16) ?? racer.heading;
  const p1 = rotatePoint(15, 0, renderHeading, racer.x, racer.y);
  const p2 = rotatePoint(-11, 8, renderHeading, racer.x, racer.y);
  const p3 = rotatePoint(-6, 0, renderHeading, racer.x, racer.y);
  const p4 = rotatePoint(-11, -8, renderHeading, racer.x, racer.y);

  g.fillStyle(hexToInt(racer.color), 1);
  g.fillPoints([p1, p2, p3, p4], true);

  g.lineStyle(1.3, 0x080a0e, 0.65);
  g.beginPath();
  g.moveTo(p1.x, p1.y);
  g.lineTo(p2.x, p2.y);
  g.lineTo(p3.x, p3.y);
  g.lineTo(p4.x, p4.y);
  g.closePath();
  g.strokePath();

  if (racer.shieldCharges > 0) {
    g.lineStyle(2, 0x63cfff, 0.86);
    g.strokeCircle(racer.x, racer.y, 16);
  }
}

function rotatePoint(localX, localY, angle, baseX, baseY) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: baseX + localX * c - localY * s,
    y: baseY + localX * s + localY * c,
  };
}

function syncRacerLabels(scene, racers, visible) {
  const live = new Set();
  for (const racer of racers) {
    let label = scene.labelMap.get(racer.id);
    if (!label) {
      label = scene.add
        .text(0, 0, "", {
          fontFamily: "\"Exo 2\", sans-serif",
          fontSize: "12px",
          color: "#e9f2ff",
          stroke: "#0a1020",
          strokeThickness: 2,
        })
        .setDepth(25);
      scene.labelMap.set(racer.id, label);
    }
    label.setVisible(visible);
    label.setText(racer.name);
    label.setPosition(racer.x - 24, racer.y - 26);
    live.add(racer.id);
  }

  scene.labelMap.forEach((label, id) => {
    if (!live.has(id) || !visible) {
      label.setVisible(false);
    }
  });
}
