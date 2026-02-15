import { TAU } from "./config.js";

// Gameplay catalogs and definitions
export const BODY_ITEMS = {
  APPLE: { color: "#ff5f6a", deltaSegments: 1 },
  CACTUS: { color: "#4fd17b", deltaSegments: -1 },
};
export const SNAKE_SPRITES_BASE_PATH = "assets/sprites/snakes";

export const SNAKES = [
  {
    id: "speedster",
    name: "Speedster",
    flavor: "Максималка выше всех, но тяжелее повернуть",
    color: "#58f4ff",
    stats: { maxSpeed: 238, accel: 330, drag: 1.3, turnRate: 2.52, offroadPenalty: 0.63, mass: 1.0 },
    body: { segments: 18, spacing: 7.6, waveAmp: 4.8, waveFreq: 0.9, waveSpeed: 5.2, taper: 0.62 },
    venom: { range: 128, cooldownMs: 2650, slowMul: 0.9, durationMs: 1450, speed: 385 },
  },
  {
    id: "handler",
    name: "Handler",
    flavor: "Лучший контроль в поворотах",
    color: "#9fff77",
    stats: { maxSpeed: 214, accel: 318, drag: 1.25, turnRate: 3.0, offroadPenalty: 0.67, mass: 1.0 },
    body: { segments: 16, spacing: 8.4, waveAmp: 3.2, waveFreq: 1.15, waveSpeed: 4.1, taper: 0.56 },
    venom: { range: 168, cooldownMs: 2450, slowMul: 0.86, durationMs: 1650, speed: 360 },
  },
  {
    id: "bully",
    name: "Bully",
    flavor: "Тяжелый корпус, сильнее толчки",
    color: "#ff8c7c",
    stats: { maxSpeed: 206, accel: 292, drag: 1.18, turnRate: 2.3, offroadPenalty: 0.71, mass: 1.35 },
    body: { segments: 22, spacing: 8.8, waveAmp: 2.6, waveFreq: 0.72, waveSpeed: 3.1, taper: 0.72 },
    venom: { range: 182, cooldownMs: 2520, slowMul: 0.83, durationMs: 1800, speed: 342 },
  },
  {
    id: "trickster",
    name: "Trickster",
    flavor: "Почти не теряет темп вне дороги",
    color: "#d6a7ff",
    stats: { maxSpeed: 222, accel: 305, drag: 1.22, turnRate: 2.72, offroadPenalty: 0.82, mass: 0.95 },
    body: { segments: 15, spacing: 7.1, waveAmp: 5.3, waveFreq: 1.32, waveSpeed: 6.0, taper: 0.52 },
    venom: { range: 212, cooldownMs: 2200, slowMul: 0.81, durationMs: 1900, speed: 372 },
  },
];

export function snakeHeadTextureKey(snakeId) {
  return `snake_head_${snakeId}`;
}

export function snakeSegmentTextureKey(snakeId) {
  return `snake_segment_${snakeId}`;
}

export function snakeHeadTexturePath(snakeId) {
  return `${SNAKE_SPRITES_BASE_PATH}/${snakeId}/head.png`;
}

export function snakeSegmentTexturePath(snakeId) {
  return `${SNAKE_SPRITES_BASE_PATH}/${snakeId}/segment.png`;
}

export const PICKUP_TYPES = {
  BOOST: { name: "BOOST", color: "#44f084", durationMs: 2600 },
  SHIELD: { name: "SHIELD", color: "#63cfff", durationMs: 6500, charges: 1 },
  OIL: { name: "OIL", color: "#ffc45f", durationMs: 2200 },
  BOMB: { name: "BOMB", color: "#ff6975", durationMs: 1450, radius: 86 },
};

export const PICKUP_ORDER = ["BOOST", "SHIELD", "OIL", "BOMB"];

export const NPC_PROFILES = [
  { id: "careful", name: "аккуратный", speedFactor: 0.88, lookAhead: 130, steerGain: 2.2, brakeAngle: 0.48 },
  { id: "normal", name: "ровный", speedFactor: 0.95, lookAhead: 145, steerGain: 2.45, brakeAngle: 0.56 },
  { id: "aggressive", name: "агро", speedFactor: 1.02, lookAhead: 160, steerGain: 2.65, brakeAngle: 0.66 },
  { id: "maniac", name: "маньяк", speedFactor: 1.08, lookAhead: 172, steerGain: 2.85, brakeAngle: 0.76 },
];

export const TRACK_DEFS = [
  {
    id: "canyon_loop",
    name: "Canyon Loop",
    subtitle: "Быстрая трасса с затяжными связками",
    roadWidth: 52,
    outsideWidth: 90,
    checkpointFractions: [0, 0.15, 0.33, 0.49, 0.68, 0.84],
    pickupFractions: [0.07, 0.21, 0.31, 0.42, 0.58, 0.73, 0.86, 0.93],
    createPoints: () => {
      const points = [];
      const steps = 180;
      for (let i = 0; i < steps; i += 1) {
        const t = (i / steps) * TAU;
        const x = 492 + Math.cos(t) * 315 + Math.cos(2 * t + 0.8) * 58;
        const y = 312 + Math.sin(t) * 198 + Math.sin(3 * t - 0.4) * 39;
        points.push({ x, y });
      }
      return points;
    },
  },
  {
    id: "switchback_run",
    name: "Switchback Run",
    subtitle: "Больше смен темпа и двойные апексы",
    roadWidth: 50,
    outsideWidth: 88,
    checkpointFractions: [0, 0.12, 0.25, 0.4, 0.56, 0.74, 0.88],
    pickupFractions: [0.05, 0.16, 0.29, 0.39, 0.51, 0.64, 0.79, 0.9],
    createPoints: () => {
      const points = [];
      const steps = 200;
      for (let i = 0; i < steps; i += 1) {
        const t = (i / steps) * TAU;
        const x = 488 + Math.cos(t) * 268 + Math.sin(2 * t) * 98 + Math.cos(3 * t) * 26;
        const y = 312 + Math.sin(t) * 162 + Math.sin(4 * t + 0.5) * 58;
        points.push({ x, y });
      }
      return points;
    },
  },
  {
    id: "twin_fang",
    name: "Twin Fang",
    subtitle: "Почти восьмерка с коварными перекладками",
    roadWidth: 48,
    outsideWidth: 86,
    checkpointFractions: [0, 0.11, 0.26, 0.43, 0.57, 0.72, 0.87],
    pickupFractions: [0.04, 0.17, 0.27, 0.36, 0.53, 0.68, 0.81, 0.92],
    createPoints: () => {
      const points = [];
      const steps = 220;
      for (let i = 0; i < steps; i += 1) {
        const t = (i / steps) * TAU;
        const x = 490 + Math.sin(t) * 300 + Math.sin(3 * t) * 20;
        const y = 310 + Math.sin(2 * t) * 162 + Math.cos(t) * 12;
        points.push({ x, y });
      }
      return points;
    },
  },
  {
    id: "dune_orbit",
    name: "Dune Orbit",
    subtitle: "Песчаный овал с волной по дугам",
    roadWidth: 50,
    outsideWidth: 90,
    checkpointFractions: [0, 0.13, 0.24, 0.37, 0.51, 0.64, 0.78, 0.9],
    pickupFractions: [0.03, 0.11, 0.19, 0.28, 0.4, 0.53, 0.66, 0.74, 0.83, 0.92],
    createPoints: () => {
      const points = [];
      const steps = 210;
      for (let i = 0; i < steps; i += 1) {
        const t = (i / steps) * TAU;
        const x = 490 + Math.cos(t) * 330 + Math.cos(3 * t + 0.5) * 34;
        const y = 312 + Math.sin(t) * 190 + Math.sin(2 * t - 0.8) * 46 + Math.sin(5 * t) * 12;
        points.push({ x, y });
      }
      return points;
    },
  },
  {
    id: "neon_delta",
    name: "Neon Delta",
    subtitle: "Три прямых зоны и резкие связки",
    roadWidth: 49,
    outsideWidth: 88,
    checkpointFractions: [0, 0.1, 0.22, 0.35, 0.49, 0.61, 0.74, 0.87],
    pickupFractions: [0.05, 0.14, 0.23, 0.31, 0.43, 0.56, 0.67, 0.75, 0.86, 0.94],
    createPoints: () => {
      const points = [];
      const steps = 240;
      for (let i = 0; i < steps; i += 1) {
        const t = (i / steps) * TAU;
        const triangleX = Math.asin(Math.sin(t)) * (2 / Math.PI);
        const triangleY = Math.asin(Math.sin(t + 1.2)) * (2 / Math.PI);
        const x = 490 + triangleX * 315 + Math.sin(4 * t) * 26 + Math.cos(2 * t - 0.2) * 20;
        const y = 312 + triangleY * 170 + Math.sin(3 * t + 0.3) * 34;
        points.push({ x, y });
      }
      return points;
    },
  },
  {
    id: "volcano_spiral",
    name: "Вулканическая спираль",
    subtitle: "Узкие дуги и пульсирующие связки в поворотах",
    roadWidth: 50,
    outsideWidth: 90,
    checkpointFractions: [0, 0.09, 0.2, 0.32, 0.46, 0.6, 0.73, 0.86],
    pickupFractions: [0.04, 0.12, 0.18, 0.27, 0.38, 0.49, 0.58, 0.69, 0.81, 0.93],
    createPoints: () => {
      const points = [];
      const steps = 240;
      for (let i = 0; i < steps; i += 1) {
        const t = (i / steps) * TAU;
        const x = 490 + Math.cos(t) * 308 + Math.cos(2 * t + 1.1) * 76 + Math.sin(5 * t + 0.2) * 14;
        const y = 310 + Math.sin(t) * 176 + Math.sin(3 * t - 0.35) * 62 + Math.cos(4 * t + 0.6) * 11;
        points.push({ x, y });
      }
      return points;
    },
  },
  {
    id: "glacier_chicane",
    name: "Ледяная шикана",
    subtitle: "Длинные прямые с быстрыми шиканами и перекладками",
    roadWidth: 51,
    outsideWidth: 92,
    checkpointFractions: [0, 0.11, 0.23, 0.35, 0.48, 0.61, 0.74, 0.88],
    pickupFractions: [0.03, 0.14, 0.22, 0.3, 0.41, 0.52, 0.63, 0.72, 0.84, 0.95],
    createPoints: () => {
      const points = [];
      const steps = 250;
      for (let i = 0; i < steps; i += 1) {
        const t = (i / steps) * TAU;
        const triX = Math.asin(Math.sin(t)) * (2 / Math.PI);
        const triY = Math.asin(Math.sin(t + 1.5)) * (2 / Math.PI);
        const x = 490 + triX * 324 + Math.sin(3 * t + 0.15) * 34 + Math.cos(5 * t) * 10;
        const y = 312 + triY * 182 + Math.sin(2 * t + 0.65) * 28 + Math.sin(6 * t - 0.4) * 13;
        points.push({ x, y });
      }
      return points;
    },
  },
];
