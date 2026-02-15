import { TAU } from "./config.js";

// Math and tiny helpers
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function sqrDistance(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function shortestAngle(from, to) {
  let delta = to - from;
  while (delta > Math.PI) {
    delta -= TAU;
  }
  while (delta < -Math.PI) {
    delta += TAU;
  }
  return delta;
}

export function wrapAngle(angle) {
  while (angle > Math.PI) {
    angle -= TAU;
  }
  while (angle < -Math.PI) {
    angle += TAU;
  }
  return angle;
}

export function normalizeVec(x, y) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

export function mod1(value) {
  return ((value % 1) + 1) % 1;
}

export function forwardTrackDelta(fromNorm, toNorm) {
  return toNorm >= fromNorm ? toNorm - fromNorm : 1 - fromNorm + toNorm;
}

export function signedTrackDelta(fromNorm, toNorm) {
  let delta = toNorm - fromNorm;
  if (delta > 0.5) {
    delta -= 1;
  } else if (delta < -0.5) {
    delta += 1;
  }
  return delta;
}

export function hexToInt(hex) {
  const c = hex.replace("#", "");
  const value = c.length === 3 ? c.split("").map((part) => `${part}${part}`).join("") : c;
  return Number.parseInt(value, 16);
}

