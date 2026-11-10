/**
 * Showreel timeline — single source of truth for picture AND sound.
 * The score generator (src/scripts/showreel-score.ts) imports this file,
 * so every hit, cut and whoosh lands on the exact frame the visuals do.
 *
 * 60 fps · 120 BPM → 1 beat = 30 frames, 1 bar = 120 frames, 15 s = 900 frames.
 */
export const FPS = 60;
export const BPM = 120;
export const BEAT = (60 / BPM) * FPS; // 30
export const BAR = BEAT * 4; // 120
export const DURATION = 900;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/* 01 — Principles: bouncing ball + live graph editor */
export const BALL = {
  contacts: [24, 60, 87, 107.25],
  hold: 4,
  launch: 111,
  cut: 120,
};

/* 02 — Kinetic type */
export const TYPE = {
  timing: 120,
  is: 150,
  every: 180,
  snap: 195,
  wipe: 208,
  end: 240,
};

/* 03 — Fluid */
export const FLUID = {
  start: 240,
  merge: 270,
  burst: 300,
};

/* 04 — Generative grid */
export const GRID = {
  land: 330,
  twistIn: 345,
  twistOut: 377,
  wrapIn: 368,
  wrapOut: 420,
};

/* 05 — 3D particles */
export const DIM = {
  sphere: 420,
  torusIn: 450,
  torusOut: 476,
  pulse: 480,
  explode: 508,
  cut: 540,
};

/* 06 — Range montage: 8 shots on eighth notes */
export const MONTAGE = {
  start: 540,
  shot: 15,
  shots: ["UI", "Data", "Line", "Type", "3D", "Shape", "FX", "Pattern"] as const,
  end: 660,
};

/* 07 — Identity */
export const IDENT = {
  collapse: 660,
  dot: 680,
  squash: 707,
  hit: 720,
  land: 742,
  details: 752,
  end: 900,
};

export const SECTIONS = [
  { from: 0, n: "01", label: "Principles" },
  { from: 120, n: "02", label: "Kinetic Type" },
  { from: 240, n: "03", label: "Fluid" },
  { from: 330, n: "04", label: "Generative" },
  { from: 420, n: "05", label: "3D / Particles" },
  ...MONTAGE.shots.map((s, i) => ({ from: MONTAGE.start + i * MONTAGE.shot, n: "06", label: `Range · ${s}` })),
  { from: 660, n: "07", label: "Identity" },
];

/** Camera impacts: shake + punch-in + chromatic split. strength 0..1 */
export const IMPACTS: { f: number; s: number }[] = [
  { f: 120, s: 1 },
  { f: 150, s: 0.55 },
  { f: 180, s: 0.6 },
  { f: 195, s: 0.45 },
  { f: 270, s: 0.4 },
  { f: 300, s: 0.75 },
  { f: 330, s: 0.3 },
  { f: 420, s: 0.35 },
  { f: 480, s: 0.25 },
  { f: 540, s: 0.8 },
  ...[555, 570, 585, 600, 615, 630, 645].map((f) => ({ f, s: 0.38 })),
  { f: 720, s: 1 },
  { f: 742, s: 0.3 },
];
