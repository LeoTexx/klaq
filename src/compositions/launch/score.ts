/**
 * Launch film score, synthesized on the film's own timeline (120 BPM).
 *   pnpm tsx src/compositions/launch/score.ts → public/examples/launch/score.wav
 * The clap is the first sound; typing ticks follow the characters; the motion act gets the beat;
 * pauses collapsing make a soft zip; captions pluck; the stamp thumps; each QA check pings;
 * the dot's landing is the last hit.
 */
import path from "path";
import { ACT, BAR, BEAT, DURATION, EDIT, END, FPS, INSTALL, PROMPT, QA, SLATE, SOUND } from "./timeline";
import { Mix, boom, clap, hat, hz, kick, pad, ping, pluck, riser, sub, thump, tick, whoosh } from "../../scripts/lib/synth";

const s = (frame: number) => frame / FPS;
const mix = new Mix(DURATION / FPS + 0.5);
const DRUMS = mix.bus();
const MUSIC = mix.bus(true);
const FX = mix.bus();
const place = mix.place.bind(mix);
const pulse: number[] = [];

// chords per act (MIDI): unease → open → bright → resolve
const Am9 = [45, 52, 55, 59, 60], Fmaj9 = [41, 48, 52, 55, 60], Cmaj9 = [48, 55, 59, 62, 64], G6 = [43, 50, 55, 59, 64], Dm9 = [50, 57, 60, 64, 65];
const plan: [number, number[]][] = [
  [ACT.prompt, Am9], [ACT.motion, Fmaj9], [ACT.motion + 2 * BAR, Cmaj9], [ACT.edit, Am9], [ACT.edit + 2 * BAR, Fmaj9],
  [ACT.sound, Cmaj9], [ACT.qa, G6], [ACT.install, Dm9], [ACT.end, Cmaj9],
];
plan.forEach(([at, ch], i) => {
  const end = i < plan.length - 1 ? plan[i + 1][0] : DURATION;
  place(MUSIC, pad(ch, s(end - at) + 0.8, { attack: 0.6, release: 0.8, cutoff: at >= ACT.end ? 2400 : 1600 }), s(at), 0.2, 0, 0.4);
  place(MUSIC, sub(hz(ch[0] - 12), s(end - at), 0.15, 0.5), s(at), 0.16);
});

/* 01 slate: room tone, the clap, the record light */
place(FX, riser(s(SLATE.clap - 20), { f0: 200, f1: 1800 }), s(20), 0.05);
place(DRUMS, clap(), s(SLATE.clap), 0.9);
place(DRUMS, thump(140, 60, 0.12), s(SLATE.clap), 0.6);
place(FX, ping(hz(84), 0.9), s(SLATE.dot), 0.12, 0, 0.5);

/* 02 prompt: a key tick per character, a pluck per reply */
for (let i = 0; i < PROMPT.command.length; i++) place(FX, tick(2600 + (i % 4) * 250, 0.005), s(PROMPT.typeStart + i / PROMPT.cps), 0.05, Math.sin(i) * 0.3);
PROMPT.replies.forEach((r, i) => place(FX, pluck(hz(72 + [0, 3, 7, 10][i]), { decay: 0.4, bright: 0.45 }), s(r.at), 0.1, -0.2 + i * 0.13, 0.4));

/* 03 motion: the beat comes in */
for (let fr = ACT.motion; fr < ACT.edit; fr += BEAT) {
  const n = (fr - ACT.motion) / BEAT;
  place(DRUMS, kick({ decay: 0.25 }), s(fr), n % 4 === 0 ? 0.7 : 0.5);
  pulse.push(s(fr));
  place(DRUMS, hat(0.03), s(fr + BEAT / 2), 0.12, 0.25);
}
place(FX, whoosh(0.35, { f0: 600, f1: 5000, peak: 0.6 }), s(760 - 12), 0.07);
place(FX, whoosh(0.35, { f0: 600, f1: 5000, peak: 0.6 }), s(920 - 12), 0.07);

/* 04 edit: half-time, pauses zip shut, captions pluck, stamp thumps */
for (let fr = ACT.edit; fr < ACT.sound; fr += 2 * BEAT) {
  place(DRUMS, kick({ decay: 0.3 }), s(fr), 0.45);
  pulse.push(s(fr));
}
place(FX, whoosh(0.5, { f0: 4000, f1: 400, peak: 0.5 }), s(EDIT.collapse), 0.09);
EDIT.words.forEach((w, i) => place(FX, pluck(hz(76 + (i % 3) * 2), { decay: 0.22, bright: 0.35 }), s(w.at), 0.05, 0.1));
place(DRUMS, thump(110, 46, 0.3), s(EDIT.stamp), 0.7);

/* 05 sound: the hits the picture draws */
SOUND.hits.forEach((h, i) => {
  place(DRUMS, kick({ decay: 0.3 }), s(h), 0.7);
  if (i % 2 === 1) place(DRUMS, clap(), s(h), 0.35);
  pulse.push(s(h));
});

/* 06 qa: a ping per check */
for (let i = 0; i < QA.count; i++) place(FX, ping(hz(84 + (i % 3) * 3), 0.4), s(QA.first + i * QA.step + 10), 0.06, -0.4 + (i % 3) * 0.4, 0.4);
place(FX, pluck(hz(88), { decay: 0.6, bright: 0.5 }), s(QA.sweep + 40), 0.1, 0, 0.5);

/* 07 install: typing again, a resolved pluck when it's done */
for (let i = 0; i < INSTALL.command.length; i++) place(FX, tick(2600 + (i % 4) * 250, 0.005), s(INSTALL.typeStart + i / INSTALL.cps), 0.05, Math.sin(i) * 0.3);
place(FX, pluck(hz(79), { decay: 0.5, bright: 0.5 }), s(INSTALL.done), 0.12, 0, 0.4);

/* 08 end: silence, then the landing */
place(FX, riser(s(END.hit - END.dot), { f0: 300, f1: 2600 }), s(END.dot), 0.06);
place(DRUMS, boom({ dur: 2.8, f0: 72, f1: 36, decay: 1 }), s(END.land), 0.5);
place(DRUMS, clap(), s(END.land), 0.5);
pulse.push(s(END.land));

mix.duckAt(pulse, 0.32, 0.14);
mix.render({ revGain: 2.4, room: 0.85, damp: 0.3, headroom: 1.25, fadeOut: 1.2 });
mix.writeWav(path.resolve(__dirname, "../../../public/examples/launch/score.wav"));
