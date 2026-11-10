/**
 * Klaq launch film: timeline (frames at 60 fps, 120 BPM: beat 30, bar 120). Picture and score import this.
 *
 *   act       frames      what it shows
 *   slate     0–240       a clapperboard claps "KLAQ · TAKE 1"; the orange dot (the protagonist) lights up
 *   prompt    240–600     one prompt in a terminal; the plan comes back as checked lines
 *   motion    600–1080    the showreel, live: springs, kinetic type, particles
 *   edit      1080–1680   a raw take: pauses collapse, captions land, the 9:16 cut gets its card and stamp
 *   sound     1680–2040   the score on the beat grid; the meter settles at −14 LUFS
 *   qa        2040–2280   a contact sheet flips in, every frame gets its check
 *   install   2280–2520   one install line
 *   end       2520–2880   "Klaq." with the dot as the full stop
 */
export const FPS = 60;
export const BEAT = 30;
export const BAR = 120;
export const DURATION = 2880;

export const ACT = {
  slate: 0,
  prompt: 240,
  motion: 600,
  edit: 1080,
  sound: 1680,
  qa: 2040,
  install: 2280,
  end: 2520,
} as const;

export const SLATE = { clap: 90, drop: 120, dot: 162 };

export const PROMPT = {
  command: "/klaq make our launch video. 48 s, show everything.",
  typeStart: 270,
  cps: 0.62, // characters per frame
  replies: [
    { at: 462, text: "timeline.ts   2,880 frames · 120 BPM · 8 acts" },
    { at: 492, text: "picture       one protagonist: the dot" },
    { at: 522, text: "score         synthesized on the same timeline" },
    { at: 552, text: "stills        64 frames looked at" },
  ],
};

/** showreel slices played live inside the motion act: [launch frame, showreel frame, length] */
export const MOTION = {
  slices: [
    { at: 600, from: 0, len: 160, label: "springs · physics" },
    { at: 760, from: 150, len: 160, label: "kinetic type" },
    { at: 920, from: 420, len: 160, label: "3D particles" },
  ],
};

export const EDIT = {
  collapse: 1230, // the silences close up
  words: [
    { text: "This", at: 1290 },
    { text: "is", at: 1302 },
    { text: "my", at: 1314 },
    { text: "raw", at: 1326 },
    { text: "take.", at: 1344 },
    { text: "Pauses", at: 1380 },
    { text: "cut,", at: 1398 },
    { text: "captions", at: 1428 },
    { text: "on", at: 1446 },
    { text: "time.", at: 1458 },
  ],
  card: 1500,
  stamp: 1560,
};

export const SOUND = {
  hits: [1710, 1740, 1770, 1800, 1830, 1860, 1890, 1920, 1950, 1980],
  meter: [1740, 1950], // counts from −23 to −14.0 LUFS
};

export const QA = { first: 2070, step: 15, count: 9, sweep: 2220 };

export const INSTALL = {
  command: "claude plugin install klaq --marketplace LeoTexx/klaq",
  typeStart: 2310,
  cps: 0.75,
  done: 2400,
  second: 2430,
};

export const END = { dot: 2560, hit: 2600, land: 2622, details: 2660 };
