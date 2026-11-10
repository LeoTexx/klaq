/**
 * Step 01 — analyse reference videos.
 *
 *   pnpm edit ref <slug> <file-or-url> [<file-or-url> …] [--lang pt]
 *
 * Measures what can be measured (cuts/min, words/min, pause removal, loudness, music bed)
 * and extracts frames so Claude can judge what can't (layout, type, colour, motion).
 * Writes work/<slug>/refs/<n>/{metrics.json, sheet.jpg, shots/, motion/} and refs/report.md.
 */
import fs from "fs";
import path from "path";
import { decode, dirs, envelope, extractAudio, fmtT, measureLoudness, probe, run, transcribe, type Word } from "./lib";

type Metrics = {
  source: string;
  duration: number;
  resolution: string;
  fps: number;
  shots: number[];
  cutsPerMin: number;
  avgShotSec: number;
  words: number;
  wpm: number;
  pausesPerMin: number;
  longestPause: number;
  pausesRemoved: boolean;
  loudness: { I: number; LRA: number; TP: number };
  floorDb: number;
  musicBedLikely: boolean;
};

function fetchRef(src: string, dest: string) {
  if (!/^https?:\/\//.test(src)) return path.resolve(src);
  const existing = fs.readdirSync(dest).find((f) => f.startsWith("source."));
  if (existing) return path.join(dest, existing);
  console.log(`Downloading ${src}…`);
  run("yt-dlp", ["-q", "-f", "bv*[height<=1920]+ba/b", "--merge-output-format", "mp4", "-o", path.join(dest, "source.%(ext)s"), src]);
  return path.join(dest, fs.readdirSync(dest).find((f) => f.startsWith("source."))!);
}

/**
 * Visual cuts. Talking-head jump cuts (same person, same light, a punch-in) score only 0.08–0.2 on
 * ffmpeg's scene metric, so the threshold is low; an animated layout change spans a few frames and is
 * merged into one event.
 */
function shotChanges(file: string, threshold = 0.07, merge = 0.25): number[] {
  const { stderr } = run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-an", "-vf", `select='gt(scene,${threshold})',showinfo`, "-f", "null", "-"]);
  const t: number[] = [];
  for (const m of stderr.matchAll(/pts_time:([\d.]+)/g)) {
    const x = +(+m[1]).toFixed(3);
    if (!t.length || x - t[t.length - 1] > merge) t.push(x);
  }
  return t;
}

/** Pauses and music bed from the audio level inside the speech region (word timings are too loose for this). */
function audioShape(audio: string, words: Word[]) {
  const rate = 16000;
  const env = envelope(decode(audio, rate), rate);
  const a = Math.floor((words[0]?.start ?? 0) * 100);
  const b = Math.min(env.length, Math.ceil((words[words.length - 1]?.end ?? env.length / 100) * 100));
  const region = Array.from(env.slice(a, b));
  const sorted = [...region].sort((x, y) => x - y);
  const floor = quantile(sorted, 0.1);
  const speech = quantile(sorted, 0.9);
  const thr = Math.max(floor + 10, speech - 38);
  const runs: number[] = [];
  let n = 0;
  for (const v of region) {
    if (v < thr) n++;
    else {
      if (n) runs.push(n / 100);
      n = 0;
    }
  }
  const minutes = Math.max(1e-6, (b - a) / 100 / 60);
  const long = runs.filter((r) => r > 0.3);
  return {
    pausesPerMin: +(long.length / minutes).toFixed(1),
    longestPause: +Math.max(0, ...runs).toFixed(2),
    // quietest 2%: the short gaps a tight edit leaves still reach silence unless music runs underneath
    floorDb: +quantile(sorted, 0.02).toFixed(1),
  };
}

function quantile(xs: number[], q: number) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

function frames(file: string, out: string, shots: number[], duration: number) {
  fs.mkdirSync(path.join(out, "shots"), { recursive: true });
  fs.mkdirSync(path.join(out, "motion"), { recursive: true });
  // contact sheet: one frame per second, 6 columns, small
  const cols = 6;
  const rows = Math.ceil(Math.min(duration, 72) / cols);
  run("ffmpeg", ["-v", "error", "-y", "-i", file, "-vf", `fps=1,scale=240:-2,tile=${cols}x${rows}:padding=4:margin=4`, "-frames:v", "1", path.join(out, "sheet.jpg")]);
  // one still in the middle of each shot (max 24)
  const bounds = [0, ...shots, duration];
  const mids = bounds.slice(0, -1).map((a, i) => (a + bounds[i + 1]) / 2).slice(0, 24);
  mids.forEach((t, i) =>
    run("ffmpeg", ["-v", "error", "-y", "-ss", t.toFixed(3), "-i", file, "-frames:v", "1", "-vf", "scale=540:-2", path.join(out, "shots", `${String(i).padStart(2, "0")}_${t.toFixed(1)}s.jpg`)]),
  );
  // motion strips: 0.6 s around the first 6 cuts at 10 fps, so entrances/exits/transitions are visible
  shots.slice(0, 6).forEach((t, i) =>
    run("ffmpeg", ["-v", "error", "-y", "-ss", Math.max(0, t - 0.3).toFixed(3), "-t", "0.6", "-i", file, "-vf", "fps=10,scale=200:-2,tile=6x1:padding=3", "-frames:v", "1", path.join(out, "motion", `cut${i}_${t.toFixed(1)}s.jpg`)]),
  );
}

export async function ref(slug: string, sources: string[], lang: string) {
  const d = dirs(slug);
  const all: Metrics[] = [];
  sources.forEach((src, n) => {
    const out = path.join(d.work, "refs", String(n + 1));
    fs.mkdirSync(out, { recursive: true });
    const file = fetchRef(src, out);
    const p = probe(file);
    console.log(`\nReference ${n + 1}: ${path.basename(file)} — ${p.width}x${p.height} ${p.fps.toFixed(2)}fps ${p.duration.toFixed(1)}s`);
    const shots = shotChanges(file);
    const audio = extractAudio(file, path.join(out, "audio.wav"));
    const words = p.hasAudio ? transcribe(audio, path.join(out, "transcript.json"), lang) : [];
    const speech = words.length ? words[words.length - 1].end - words[0].start : 0;
    const loud = p.hasAudio ? measureLoudness(file) : { I: NaN, LRA: NaN, TP: NaN, threshold: NaN };
    const shape = p.hasAudio && words.length ? audioShape(audio, words) : { pausesPerMin: 0, longestPause: 0, floorDb: -120 };
    const m: Metrics = {
      source: src,
      duration: +p.duration.toFixed(2),
      resolution: `${p.width}x${p.height}`,
      fps: +p.fps.toFixed(2),
      shots,
      cutsPerMin: +((shots.length / p.duration) * 60).toFixed(1),
      avgShotSec: +(p.duration / (shots.length + 1)).toFixed(2),
      words: words.length,
      wpm: speech ? Math.round((words.length / speech) * 60) : 0,
      pausesPerMin: shape.pausesPerMin,
      longestPause: shape.longestPause,
      // a natural delivery has 10+ breaths over 0.3 s per minute; a tight edit has almost none
      pausesRemoved: shape.pausesPerMin < 3,
      loudness: { I: loud.I, LRA: loud.LRA, TP: loud.TP },
      floorDb: shape.floorDb,
      // the quietest moments of the speech region stay loud when a music bed runs under the voice
      musicBedLikely: shape.floorDb > -50,
    };
    fs.writeFileSync(path.join(out, "metrics.json"), JSON.stringify(m, null, 2));
    fs.writeFileSync(path.join(out, "transcript.txt"), words.map((w) => w.text).join(" "));
    frames(file, out, shots, p.duration);
    all.push(m);
  });

  const rows = (label: string, f: (m: Metrics) => string | number) => `| ${label} | ${all.map(f).join(" | ")} |`;
  const md = [
    `# Reference analysis — ${slug}`,
    "",
    `| Metric | ${all.map((_, i) => `Ref ${i + 1}`).join(" | ")} |`,
    `|---|${all.map(() => "---").join("|")}|`,
    rows("Duration / resolution", (m) => `${m.duration}s, ${m.resolution} @ ${m.fps}`),
    rows("Visual cuts per minute", (m) => m.cutsPerMin),
    rows("Average shot length", (m) => `${m.avgShotSec}s`),
    rows("Words per minute", (m) => m.wpm),
    rows("Silences > 0.3 s per minute / longest", (m) => `${m.pausesPerMin} / ${m.longestPause}s`),
    rows("Pauses removed?", (m) => (m.pausesRemoved ? "yes" : "no")),
    rows("Integrated loudness", (m) => `${m.loudness.I} LUFS`),
    rows("True peak / LRA", (m) => `${m.loudness.TP} dBTP / ${m.loudness.LRA} LU`),
    rows("Quietest moments under the voice", (m) => `${m.floorDb} dBFS${m.musicBedLikely ? " (music bed likely, confirm by ear)" : " (dry voice, no music)"}`),
    "",
    "Shot change times: " + all.map((m, i) => `Ref ${i + 1}: ${m.shots.map(fmtT).join(", ") || "none"}`).join("; "),
    "",
    "Frames to inspect for layout, type, colour and motion: `refs/<n>/sheet.jpg` (1 fps), `refs/<n>/shots/` (one per shot), `refs/<n>/motion/` (0.6 s strips around cuts).",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(d.work, "refs", "report.md"), md);
  console.log("\n" + md);
  console.log(`Wrote ${path.join(d.work, "refs")}`);
}
