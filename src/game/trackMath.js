import { clamp, lerp, mod1, normalizeVec } from "./utils.js";

export function buildTrackRuntime(def) {
  const points = def.createPoints();
  const segments = [];
  let totalLength = 0;

  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segments.push({ a, b, len, start: totalLength });
    totalLength += len;
  }

  const checkpoints = def.checkpointFractions.map((fraction) => sampleTrack({ points, segments, totalLength }, fraction));
  const pickupFractions = [...def.pickupFractions];

  return {
    defId: def.id,
    points,
    segments,
    totalLength,
    roadWidth: def.roadWidth,
    outsideWidth: def.outsideWidth,
    checkpoints: checkpoints.map((cp) => ({ x: cp.x, y: cp.y, fraction: cp.fraction })),
    checkpointRadius: def.roadWidth * 0.48,
    pickupFractions,
  };
}

export function sampleTrack(track, fractionRaw) {
  const fraction = mod1(fractionRaw);
  const target = fraction * track.totalLength;
  for (const segment of track.segments) {
    if (target <= segment.start + segment.len) {
      const local = segment.len === 0 ? 0 : (target - segment.start) / segment.len;
      const x = lerp(segment.a.x, segment.b.x, local);
      const y = lerp(segment.a.y, segment.b.y, local);
      const tangent = normalizeVec(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
      return { x, y, tangent, fraction };
    }
  }
  const last = track.segments[track.segments.length - 1];
  const tangent = normalizeVec(last.b.x - last.a.x, last.b.y - last.a.y);
  return { x: last.b.x, y: last.b.y, tangent, fraction };
}

export function projectOnTrack(track, x, y) {
  let bestDistSq = Infinity;
  let bestProjection = null;
  for (const segment of track.segments) {
    const proj = projectPointOnSegment(x, y, segment.a.x, segment.a.y, segment.b.x, segment.b.y);
    if (proj.distSq < bestDistSq) {
      bestDistSq = proj.distSq;
      const distOnTrack = segment.start + segment.len * proj.t;
      const tangent = normalizeVec(segment.b.x - segment.a.x, segment.b.y - segment.a.y);
      bestProjection = {
        x: proj.x,
        y: proj.y,
        distance: Math.sqrt(bestDistSq),
        tNorm: distOnTrack / track.totalLength,
        tangent,
      };
    }
  }
  return bestProjection;
}

export function projectPointOnSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby || 1;
  const apx = px - ax;
  const apy = py - ay;
  const t = clamp((apx * abx + apy * aby) / abLenSq, 0, 1);
  const x = ax + abx * t;
  const y = ay + aby * t;
  const dx = px - x;
  const dy = py - y;
  return { x, y, t, distSq: dx * dx + dy * dy };
}
