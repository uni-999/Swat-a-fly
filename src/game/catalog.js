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
    createPoints: () => [
      { x: 881.52, y: 298.41 },
      { x: 881.11, y: 312.28 },
      { x: 880.71, y: 326.15 },
      { x: 880.31, y: 340.02 },
      { x: 879.90, y: 353.89 },
      { x: 877.41, y: 366.69 },
      { x: 872.81, y: 378.43 },
      { x: 867.62, y: 389.89 },
      { x: 861.61, y: 400.97 },
      { x: 853.42, y: 411.03 },
      { x: 844.47, y: 420.24 },
      { x: 835.30, y: 428.83 },
      { x: 825.50, y: 435.72 },
      { x: 815.06, y: 440.89 },
      { x: 803.99, y: 444.33 },
      { x: 792.60, y: 446.92 },
      { x: 780.91, y: 448.67 },
      { x: 769.19, y: 450.36 },
      { x: 757.17, y: 451.22 },
      { x: 745.15, y: 450.36 },
      { x: 732.81, y: 450.36 },
      { x: 720.79, y: 449.50 },
      { x: 709.08, y: 447.78 },
      { x: 697.70, y: 445.19 },
      { x: 685.99, y: 443.47 },
      { x: 674.29, y: 441.75 },
      { x: 662.58, y: 440.03 },
      { x: 650.56, y: 439.17 },
      { x: 638.99, y: 437.09 },
      { x: 627.47, y: 434.86 },
      { x: 615.76, y: 433.14 },
      { x: 603.84, y: 432.01 },
      { x: 592.04, y: 430.56 },
      { x: 580.02, y: 429.69 },
      { x: 568.47, y: 427.54 },
      { x: 556.61, y: 426.25 },
      { x: 544.52, y: 425.57 },
      { x: 532.56, y: 424.53 },
      { x: 520.54, y: 423.67 },
      { x: 508.52, y: 422.81 },
      { x: 496.50, y: 421.94 },
      { x: 484.75, y: 420.34 },
      { x: 472.88, y: 421.39 },
      { x: 461.07, y: 422.81 },
      { x: 449.36, y: 424.53 },
      { x: 437.66, y: 426.25 },
      { x: 426.55, y: 429.59 },
      { x: 415.52, y: 433.14 },
      { x: 404.45, y: 436.58 },
      { x: 393.42, y: 440.15 },
      { x: 382.94, y: 445.19 },
      { x: 372.50, y: 450.36 },
      { x: 362.09, y: 455.59 },
      { x: 351.79, y: 461.14 },
      { x: 341.51, y: 466.72 },
      { x: 331.43, y: 472.85 },
      { x: 321.36, y: 479.01 },
      { x: 311.29, y: 485.17 },
      { x: 302.66, y: 494.02 },
      { x: 293.48, y: 502.61 },
      { x: 283.86, y: 509.99 },
      { x: 273.66, y: 515.81 },
      { x: 262.82, y: 519.87 },
      { x: 251.52, y: 522.69 },
      { x: 239.99, y: 524.89 },
      { x: 228.43, y: 527.00 },
      { x: 216.41, y: 527.86 },
      { x: 204.39, y: 527.00 },
      { x: 192.68, y: 525.28 },
      { x: 180.98, y: 523.56 },
      { x: 169.91, y: 520.11 },
      { x: 159.41, y: 515.12 },
      { x: 149.03, y: 509.78 },
      { x: 138.91, y: 503.75 },
      { x: 129.42, y: 496.03 },
      { x: 121.01, y: 486.57 },
      { x: 112.29, y: 476.76 },
      { x: 104.10, y: 466.70 },
      { x: 97.23, y: 456.02 },
      { x: 92.07, y: 444.55 },
      { x: 89.58, y: 431.83 },
      { x: 87.61, y: 418.87 },
      { x: 85.75, y: 405.86 },
      { x: 83.45, y: 393.05 },
      { x: 84.98, y: 379.88 },
      { x: 87.28, y: 367.08 },
      { x: 91.11, y: 354.98 },
      { x: 97.00, y: 343.85 },
      { x: 105.41, y: 334.39 },
      { x: 114.80, y: 326.41 },
      { x: 124.88, y: 320.25 },
      { x: 135.17, y: 314.69 },
      { x: 145.46, y: 309.14 },
      { x: 155.98, y: 304.20 },
      { x: 166.97, y: 300.53 },
      { x: 177.92, y: 296.75 },
      { x: 188.21, y: 291.20 },
      { x: 198.28, y: 285.03 },
      { x: 206.69, y: 275.59 },
      { x: 213.79, y: 265.02 },
      { x: 218.19, y: 253.19 },
      { x: 220.96, y: 240.60 },
      { x: 223.56, y: 227.93 },
      { x: 226.50, y: 215.42 },
      { x: 228.92, y: 202.68 },
      { x: 231.22, y: 189.87 },
      { x: 233.52, y: 177.06 },
      { x: 237.34, y: 164.97 },
      { x: 242.51, y: 153.49 },
      { x: 249.61, y: 142.93 },
      { x: 258.78, y: 134.33 },
      { x: 268.18, y: 126.34 },
      { x: 277.58, y: 118.36 },
      { x: 287.24, y: 111.08 },
      { x: 297.99, y: 106.78 },
      { x: 309.06, y: 103.33 },
      { x: 320.10, y: 99.81 },
      { x: 331.52, y: 97.31 },
      { x: 343.23, y: 95.58 },
      { x: 354.93, y: 93.86 },
      { x: 366.95, y: 93.00 },
      { x: 378.98, y: 93.86 },
      { x: 390.68, y: 95.58 },
      { x: 402.38, y: 97.31 },
      { x: 414.09, y: 99.03 },
      { x: 425.76, y: 100.83 },
      { x: 436.73, y: 104.56 },
      { x: 447.62, y: 108.50 },
      { x: 457.74, y: 114.53 },
      { x: 466.94, y: 123.04 },
      { x: 476.34, y: 131.02 },
      { x: 485.29, y: 140.23 },
      { x: 491.31, y: 151.30 },
      { x: 495.70, y: 163.13 },
      { x: 500.64, y: 174.71 },
      { x: 505.03, y: 186.54 },
      { x: 508.88, y: 198.63 },
      { x: 512.97, y: 210.60 },
      { x: 519.84, y: 221.28 },
      { x: 528.24, y: 230.74 },
      { x: 538.98, y: 235.08 },
      { x: 550.37, y: 237.67 },
      { x: 561.59, y: 240.69 },
      { x: 572.83, y: 243.69 },
      { x: 584.21, y: 241.11 },
      { x: 595.39, y: 237.96 },
      { x: 606.36, y: 234.24 },
      { x: 616.43, y: 228.08 },
      { x: 625.83, y: 220.09 },
      { x: 634.01, y: 210.03 },
      { x: 642.42, y: 200.57 },
      { x: 651.82, y: 192.58 },
      { x: 661.22, y: 184.60 },
      { x: 670.61, y: 176.61 },
      { x: 680.68, y: 170.45 },
      { x: 690.76, y: 164.29 },
      { x: 701.05, y: 158.74 },
      { x: 712.01, y: 155.00 },
      { x: 723.08, y: 151.56 },
      { x: 734.47, y: 148.97 },
      { x: 746.17, y: 147.25 },
      { x: 757.88, y: 145.53 },
      { x: 769.90, y: 144.67 },
      { x: 781.92, y: 145.53 },
      { x: 793.94, y: 146.39 },
      { x: 805.65, y: 148.11 },
      { x: 817.35, y: 149.83 },
      { x: 828.42, y: 153.28 },
      { x: 839.18, y: 157.58 },
      { x: 849.23, y: 163.78 },
      { x: 858.78, y: 171.36 },
      { x: 865.41, y: 181.98 },
      { x: 870.89, y: 193.31 },
      { x: 875.11, y: 205.22 },
      { x: 879.70, y: 216.96 },
      { x: 883.53, y: 229.06 },
      { x: 883.13, y: 242.93 },
      { x: 882.73, y: 256.80 },
      { x: 882.32, y: 270.67 },
      { x: 881.92, y: 284.54 },
    ],
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
