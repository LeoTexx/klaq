/**
 * SFX kit, preview and final render for edits.
 *
 *   pnpm edit kit                 synthesise the discreet SFX kit into public/sfx/ (once)
 *   pnpm edit preview <slug>      half-res draft + contact sheet of every sentence, for approval
 *   pnpm edit final <slug>        full render, then master the mix to −14 LUFS / −1 dBTP
 */
import fs from "fs";
import path from "path";
import { Mix, whoosh, bloop, type Stereo } from "../lib/synth";
import { dirs, fmtT, loudnormFilter, measureLoudness, ROOT, run } from "./lib";

export function kit() {
  const out = path.join(ROOT, "public", "sfx");
  fs.mkdirSync(out, { recursive: true });
  const write = (name: string, sec: number, place: (mix: Mix, bus: Stereo) => void) => {
    const mix = new Mix(sec);
    const bus = mix.bus();
    place(mix, bus);
    // fixed gain: the kit sits well under a −14 LUFS voice (peaks around −20 dBFS)
    mix.render({ gain: 1, revGain: 0.6, fadeOut: 0.03 });
    mix.writeWav(path.join(out, `${name}.wav`));
  };
  write("whoosh-in", 0.5, (m, b) => m.place(b, whoosh(0.42, { f0: 400, f1: 4200, peak: 0.75, pan0: -0.3, pan1: 0.3 }), 0, 0.09, 0, 0.15));
  write("whoosh-out", 0.5, (m, b) => m.place(b, whoosh(0.4, { f0: 3600, f1: 500, peak: 0.35, pan0: 0.3, pan1: -0.3 }), 0, 0.08, 0, 0.15));
  write("pop", 0.25, (m, b) => m.place(b, bloop(520, 980, 0.07), 0, 0.12, 0, 0.1));
  console.log(`Wrote SFX kit to ${out}`);
}

function ensureKit() {
  if (!fs.existsSync(path.join(ROOT, "public", "sfx", "pop.wav"))) kit();
}

const compId = (slug: string) => `Edit-${slug}`;

export function preview(slug: string) {
  ensureKit();
  const d = dirs(slug);
  const cuts = JSON.parse(fs.readFileSync(path.join(d.pub, "cuts.json"), "utf8"));
  const out = path.join(d.out, "preview.mp4");
  console.log(`Rendering half-resolution preview of ${compId(slug)} (${fmtT(cuts.durationSec)})…`);
  run("pnpm", ["exec", "remotion", "render", compId(slug), out, "--scale=0.5", "--crf=26", "--log=error"]);
  // one still per sentence (midpoint) as a contact sheet
  const frames = cuts.sentences.map((s: { start: number; end: number }) => Math.round(((s.start + s.end) / 2) * cuts.fps));
  run("pnpm", ["exec", "tsx", "src/scripts/stills.ts", "--id", compId(slug), "--frames", frames.join(","), "--out", path.join(d.out, "stills"), "--sheet", "4", "--scale", "0.5"]);
  console.log(`\nPreview: ${out}\nStills: ${path.join(d.out, "stills")}\nSend these for approval before \`pnpm edit final ${slug}\`.`);
}

export function final(slug: string) {
  ensureKit();
  const d = dirs(slug);
  const rendered = path.join(d.work, "render.mov"); // uncompressed audio needs a mov container
  console.log(`Rendering ${compId(slug)} at full quality…`);
  run("pnpm", ["exec", "remotion", "render", compId(slug), rendered, "--codec=h264", "--crf=16", "--audio-codec=pcm-16", "--log=error"]);
  const m = measureLoudness(rendered);
  const out = path.join(d.out, "final.mp4");
  run("ffmpeg", ["-v", "error", "-y", "-i", rendered, "-c:v", "copy", "-af", `${loudnormFilter(m)},aresample=48000`, "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", out]);
  const after = measureLoudness(out);
  console.log(`Mix: ${m.I} → ${after.I} LUFS integrated, true peak ${after.TP} dBTP, LRA ${after.LRA} LU`);
  console.log(`Final: ${out}`);
}
