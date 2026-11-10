/**
 * Showreel score — synthesized from scratch, driven by the SAME timeline as the picture,
 * so every hit, cut and whoosh lands on its frame. No samples, no libraries.
 *
 *   pnpm tsx src/scripts/showreel-score.ts  →  public/audio/showreel/score.wav
 *
 * 120 BPM · A minor → A major lift on the end card.
 */
import path from "path";
import { BALL, BEAT, DIM, DURATION, FLUID, FPS, GRID, IDENT, MONTAGE, TYPE } from "../compositions/showreel/timeline";
import { Mix, bass, bell, bloop, boom, clap, crash, glitch, hat, hz, kick, noise, pad, ping, pluck, rand, reverseSwell, riser, sine, snare, stab, swirl, tick, whoosh } from "./lib/synth";

const OUT = path.resolve(__dirname, "../../public/audio/showreel/score.wav");
const s = (frame: number) => frame / FPS;

const mix = new Mix(DURATION / FPS);
const DRUMS = mix.bus();
const MUSIC = mix.bus(true); // ducked by the kick
const LEAD = mix.bus();
const FX = mix.bus();
const place = mix.place.bind(mix);

/* ------------------------------ harmony -------------------------------- */
const CH = {
  Am9: [57, 60, 64, 67, 71],
  Fmaj9: [53, 57, 60, 64, 67],
  Cmaj9: [48, 55, 59, 62, 64],
  G69: [55, 59, 62, 64, 69],
  E7sus: [52, 57, 59, 62, 64],
  Aadd9: [57, 61, 64, 71, 76],
};
const BARS = [
  { from: 120, to: 240, ch: CH.Am9, root: 45 },
  { from: 240, to: 360, ch: CH.Fmaj9, root: 41 },
  { from: 360, to: 480, ch: CH.Cmaj9, root: 36 },
  { from: 480, to: 600, ch: CH.G69, root: 43 },
  { from: 600, to: 660, ch: CH.E7sus, root: 40 },
];

/* ------------------------------- score --------------------------------- */
const kicks: number[] = [];

// Intro — the ball's contacts are musical: an A-minor arpeggio that rises as bounces shrink
place(MUSIC, pad([45, 52, 57], s(118), { attack: 1.2, release: 0.05, cutoff: 700 }), 0, 0.22, 0, 0.3);
BALL.contacts.forEach((c, i) => {
  place(LEAD, pluck(hz([69, 72, 76, 79][i]), { decay: 0.5 }), s(c), 0.5 - i * 0.06, -0.35 + i * 0.25, 0.45);
  place(DRUMS, bloop(160, 70, 0.07), s(c), 0.35 - i * 0.05, 0);
});
place(FX, riser(s(60)), s(60), 0.22, 0, 0.2);
place(FX, reverseSwell(s(26)), s(BALL.cut - 26), 0.3, 0, 0.1);
place(FX, whoosh(s(12), { f0: 600, f1: 9000, peak: 0.95, pan0: 0, pan1: 0 }), s(BALL.launch - 1), 0.35);

// DROP
const drop = (frame: number, chord: number[], big = 1) => {
  if (big >= 1) place(DRUMS, kick({ decay: 0.45, punch: 1.2 }), s(frame), 1.0 * big);
  place(DRUMS, boom({ dur: 1.6 * big }), s(frame), 0.75 * big);
  place(FX, crash(0.9 * big, 2.4 * big), s(frame), 0.32 * big, 0, 0.3);
  place(LEAD, stab(chord, { dur: 1.2, decay: 0.34 * big }), s(frame), 0.55 * big, 0, 0.4);
};
drop(TYPE.timing, CH.Am9);

// Groove: 4-on-floor, claps on 2 & 4, off-beat hats + bass, ducked pads
for (let f = 150; f <= 630; f += BEAT) kicks.push(f);
kicks.forEach((f) => place(DRUMS, kick(), s(f), 0.92));
kicks.push(TYPE.timing);
for (let f = 150; f <= 630; f += 60) place(DRUMS, clap(), s(f), 0.42, 0.05, 0.28);
for (let f = 135; f <= 645; f += BEAT) place(DRUMS, hat(0.05), s(f), 0.22, 0.25, 0.05);
for (let f = 247.5; f < 540; f += 15) place(DRUMS, hat(0.022), s(f), 0.1, -0.3);
for (const b of BARS) {
  place(MUSIC, pad(b.ch, s(b.to - b.from), { attack: 0.08, release: 0.35 }), s(b.from), 0.3, 0, 0.35);
  for (let f = b.from + 15; f < b.to; f += BEAT) place(MUSIC, bass(hz(b.root)), s(f), 0.5);
  if (b.from > 120) place(LEAD, stab(b.ch, { decay: 0.2 }), s(b.from), 0.34, 0, 0.35);
}

// 02 Kinetic type
place(LEAD, pluck(hz(76), { decay: 0.35 }), s(TYPE.is), 0.35, -0.2, 0.4);
place(LEAD, pluck(hz(83), { decay: 0.35 }), s(TYPE.is), 0.25, 0.2, 0.4);
place(FX, bloop(420, 1300, 0.06), s(TYPE.is), 0.25);
place(FX, whoosh(s(16), { f0: 1500, f1: 5000, q: 3, peak: 0.5, pan0: 0.4, pan1: -0.4 }), s(TYPE.is + 1), 0.12);
place(LEAD, stab(CH.Am9, { decay: 0.16, hi: 4500 }), s(TYPE.every), 0.32, 0, 0.3);
place(FX, sine(300, 2600, 0.11), s(TYPE.snap - 3), 0.2, 0, 0.2);
place(LEAD, stab(CH.Am9.map((m) => m + 12), { decay: 0.12, hi: 7000 }), s(TYPE.snap), 0.2, 0, 0.35);
place(DRUMS, hat(0.28), s(TYPE.wipe - 3), 0.14, 0.3, 0.15);
place(FX, whoosh(s(TYPE.end - TYPE.wipe + 6), { f0: 180, f1: 2600, q: 0.9, peak: 0.85, pan0: -0.2, pan1: 0.2 }), s(TYPE.wipe), 0.3, 0, 0.15);

// 03 Fluid — bubbles, merge gloop, burst splash
[214, 221, 229, 236, 246, 253, 259, 266].forEach((f, i) =>
  place(FX, bloop(300 + ((i * 137) % 500), 900 + ((i * 211) % 900), 0.05), s(f), 0.16, ((i % 3) - 1) * 0.6, 0.25),
);
place(FX, bloop(340, 95, 0.2), s(FLUID.merge), 0.5, 0, 0.3);
place(DRUMS, boom({ dur: 0.7, f0: 90, f1: 45, decay: 0.25 }), s(FLUID.merge), 0.35);
place(FX, sine(180, 150, 0.4, 0.06), s(FLUID.merge + 6), 0.12, 0, 0.2);
place(FX, reverseSwell(s(10), 0.8), s(FLUID.burst - 10), 0.2);
place(DRUMS, boom({ dur: 0.9, f0: 95, f1: 40, decay: 0.3 }), s(FLUID.burst), 0.5);
place(FX, whoosh(0.35, { f0: 3000, f1: 800, q: 0.7, peak: 0.08 }), s(FLUID.burst), 0.4, 0, 0.2);
for (let k = 0; k < 14; k++) place(FX, bloop(900 + rand() * 1400, 2200 + rand() * 1800, 0.03), s(FLUID.burst + rand() * 14), 0.08, noise() * 0.8, 0.2);

// 04 Generative — droplets land as a rain of ticks, sonar ping, twist swirl, wrap whoosh
for (let k = 0; k < 44; k++) place(FX, tick(2600 + rand() * 2600, 0.003), s(FLUID.burst + 14 + Math.pow(rand(), 0.8) * 30), 0.07, noise(), 0.1);
place(LEAD, ping(hz(88)), s(GRID.land), 0.2, 0, 0.55);
place(LEAD, ping(hz(81)), s(GRID.land + 2), 0.12, 0.3, 0.55);
place(FX, swirl(s(GRID.twistOut - GRID.twistIn)), s(GRID.twistIn), 0.2, 0, 0.2);
place(FX, whoosh(s(GRID.wrapOut - GRID.wrapIn), { f0: 150, f1: 3500, q: 0.8, peak: 0.9, pan0: -0.6, pan1: 0.6 }), s(GRID.wrapIn), 0.3, 0, 0.2);
place(FX, sine(55, 110, s(GRID.wrapOut - GRID.wrapIn)), s(GRID.wrapIn), 0.3);

// 05 3D — globe lands, arpeggio climbs, torus wobble, explosion
place(DRUMS, boom({ dur: 0.8, f0: 70, f1: 40, decay: 0.3 }), s(DIM.sphere), 0.35);
place(LEAD, ping(hz(81), 0.8), s(DIM.sphere), 0.12, -0.3, 0.6);
const arp = [72, 76, 79, 83, 86, 88, 91, 93, 95, 98, 100];
for (let k = 0, f = DIM.sphere + 7.5; f < DIM.explode && k < arp.length; f += 7.5, k++) {
  place(LEAD, pluck(hz(arp[k]), { decay: 0.2, bright: 0.7 }), s(f), 0.1 + k * 0.006, k % 2 ? 0.45 : -0.45, 0.35);
}
place(FX, sine(220, 440, s(DIM.torusOut - DIM.torusIn), 0.04), s(DIM.torusIn), 0.14, 0, 0.3);
place(FX, whoosh(s(DIM.torusOut - DIM.torusIn), { f0: 400, f1: 1800, q: 2, peak: 0.5 }), s(DIM.torusIn), 0.14);
place(DRUMS, tick(1800, 0.01), s(DIM.pulse), 0.2, 0, 0.3);
place(FX, riser(s(DIM.cut - DIM.explode + 10), { f0: 600, f1: 12000, tone: 0.4 }), s(DIM.explode - 10), 0.3, 0, 0.15);
place(DRUMS, boom({ dur: 0.5, f0: 120, f1: 50, decay: 0.12 }), s(DIM.explode), 0.4);
place(FX, reverseSwell(s(20)), s(DIM.cut - 20), 0.3);

// 06 Range — every cut gets its own sound
drop(MONTAGE.start, CH.G69, 0.75);
const m = (k: number) => MONTAGE.start + k * MONTAGE.shot;
place(FX, tick(2400, 0.004), s(m(0)), 0.35);
place(FX, sine(700, 320, 0.05), s(m(0) + 1), 0.3);
[0, 2, 4, 6].forEach((d, i) => place(LEAD, ping(hz([79, 83, 86, 91][i]), 0.08), s(m(1) + d), 0.16, -0.3 + i * 0.2, 0.2));
place(FX, whoosh(0.22, { f0: 900, f1: 7000, q: 1.5, peak: 0.3, pan0: -0.8, pan1: 0.8 }), s(m(2)), 0.3);
for (let k = 0; k < 8; k++) place(FX, tick(3800, 0.002), s(m(3) + 12 * (1 - Math.pow(1 - k / 8, 2))), 0.2, 0.2);
place(DRUMS, boom({ dur: 0.35, f0: 140, f1: 60, decay: 0.08 }), s(m(4)), 0.4);
place(FX, sine(380, 900, 0.16, 0.05), s(m(5)), 0.2, 0, 0.3);
place(FX, glitch(0.24), s(m(6)), 0.3);
for (let k = 0; k < 6; k++) place(FX, tick(2000 + k * 300, 0.004), s(m(7) + k * 2.4), 0.16, k % 2 ? 0.3 : -0.3);
for (let f = 540; f < 660; f += 7.5) place(DRUMS, hat(0.02), s(f + 3.75), 0.08, 0.35);
for (let k = 0, f = 600; f < 660; k++) {
  place(DRUMS, snare(), s(f), 0.12 + 0.3 * ((f - 600) / 60), 0, 0.2);
  f += f < 645 ? 7.5 : 3.75;
}
place(FX, riser(s(90), { f0: 300, f1: 9000 }), s(570), 0.3, 0, 0.1);

// 07 Identity — the suck, the silence, the hit
place(FX, reverseSwell(s(IDENT.dot - IDENT.collapse + 8), 0.6), s(IDENT.collapse - 8), 0.5, 0, 0.2);
place(FX, whoosh(s(IDENT.dot - IDENT.collapse), { f0: 5000, f1: 300, q: 1, peak: 0.85, pan0: 0.6, pan1: 0 }), s(IDENT.collapse), 0.25);
place(FX, bloop(700, 980, 0.05), s(IDENT.dot), 0.25, 0, 0.4);
place(FX, sine(hz(81), hz(81.4), s(IDENT.hit - IDENT.dot)), s(IDENT.dot), 0.035);
place(FX, sine(200, 460, s(IDENT.hit - IDENT.squash)), s(IDENT.squash), 0.12);
place(FX, reverseSwell(s(IDENT.hit - IDENT.squash + 8)), s(IDENT.squash - 8), 0.32);

drop(IDENT.hit, CH.Aadd9, 1.25);
place(MUSIC, pad([...CH.Aadd9, 45], s(IDENT.end - IDENT.hit - 10), { attack: 0.02, release: 0.15, cutoff: 1900 }), s(IDENT.hit), 0.32, 0, 0.5);
place(MUSIC, bass(hz(33), 2.2), s(IDENT.hit), 0.45);
[88, 93, 95, 100].forEach((n, i) => place(LEAD, bell(hz(n), 1.4), s(IDENT.hit + 2 + i * 3), 0.07, -0.4 + i * 0.27, 0.6));
place(FX, whoosh(s(IDENT.land - IDENT.hit), { f0: 500, f1: 2500, q: 1.6, peak: 0.5, pan0: -0.1, pan1: 0.5 }), s(IDENT.hit), 0.16);
place(LEAD, bell(hz(81), 1.2), s(IDENT.land), 0.3, 0.35, 0.5);
place(LEAD, pluck(hz(76), { decay: 0.5 }), s(IDENT.land), 0.26, 0.35, 0.4);
place(DRUMS, bloop(150, 60, 0.08), s(IDENT.land), 0.35, 0.3);
for (let k = 0; k < 16; k++) place(FX, tick(4200, 0.0015), s(IDENT.details + k * 1.25), 0.06, -0.4);
[0, 6, 12].forEach((d, i) => place(LEAD, pluck(hz([76, 81, 85][i]), { decay: 0.35, bright: 0.5 }), s(IDENT.details + 32 + d), 0.14, -0.2 + i * 0.2, 0.45));
place(LEAD, pluck(hz(88), { decay: 0.3, bright: 0.4 }), s(875), 0.1, 0.35, 0.5);
place(DRUMS, tick(2600, 0.004), s(884), 0.08, 0.35);

/* ------------------------------- mixdown ------------------------------- */
mix.duckAt(kicks.map(s));
mix.render();
mix.writeWav(OUT);
console.log(`  RMS by section: intro ${mix.sectionRms(0, 2)} | type ${mix.sectionRms(2, 4)} | matter ${mix.sectionRms(4, 9)} | range ${mix.sectionRms(9, 11)} | breath ${mix.sectionRms(11.35, 11.8)} | end ${mix.sectionRms(12, 15)} dBFS`);
