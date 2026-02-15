import { SEGMENT_RENDER_SCALE } from "./config.js";
import { snakeHeadTextureKey, snakeSegmentTextureKey } from "./catalog.js";
import { hexToInt, wrapAngle } from "./utils.js";

const HEAD_SPRITE_ROTATION_OFFSET = Math.PI;

export function drawRacers(scene, g, racers, getRacerMotionHeading) {
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

export function syncRacerRenderSprites(scene, racers, visible, getRacerMotionHeading) {
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

export function syncRacerLabels(scene, racers, visible) {
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

function supportsSnakeHeadSprite(scene, snakeId) {
  const support = scene.spriteSupportMap?.get(snakeId);
  return Boolean(support && support.head);
}

function supportsSnakeSegmentSprite(scene, snakeId) {
  const support = scene.spriteSupportMap?.get(snakeId);
  return Boolean(support && support.segment);
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
  sprite.setRotation(wrapAngle(renderHeading + HEAD_SPRITE_ROTATION_OFFSET));
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
