/**
 * Shared helpers for the talking-head editing pipeline (`pnpm edit <cmd> <slug>`).
 *
 * Layout on disk for an edit called <slug>:
 *   work/<slug>/                scratch: raw link, audio.wav, transcript.json, takes.md, refs/
 *   public/projects/<slug>/     what the composition reads: footage.mp4, cuts.json, head.json, proof/
 *   projects/<slug>/index.tsx   the edit plan (layout, graphics, theme), registered as Edit-<slug>
 *   out/<slug>/                 preview.mp4, final.mp4, stills
 * All four are gitignored: only the engine is tracked.
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

export const ROOT = path.resolve(__dirname, "../../..");

export const dirs = (slug: string) => {
  const d = {
    work: path.join(ROOT, "work", slug),
    pub: path.join(ROOT, "public", "projects", slug),
    out: path.join(ROOT, "out", slug),
    plan: path.join(ROOT, "projects", slug, "index.tsx"),
  };
  for (const k of ["work", "pub", "out"] as const) fs.mkdirSync(d[k], { recursive: true });
  return d;
};

export function run(cmd: string, args: string[], opts: { quiet?: boolean; maxBuffer?: number } = {}) {
  const r = spawnSync(cmd, args, { maxBuffer: opts.maxBuffer ?? 1 << 30, encoding: "buffer" });
  const stderr = r.stderr?.toString() ?? "";
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.slice(0, 6).join(" ")}… failed (${r.status}):\n${stderr.slice(-3000)}`);
  }
  return { stdout: r.stdout as Buffer, stderr };
}

/* -------------------------------- probe -------------------------------- */

export type Probe = {
  width: number;
  height: number;
  fps: number;
  duration: number;
  vcodec: string;
  pixFmt: string;
  colorTransfer?: string;
  colorPrimaries?: string;
  hasAudio: boolean;
  rotation: number;
};

export function probe(file: string): Probe {
  const { stdout } = run("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file]);
  const j = JSON.parse(stdout.toString());
  const v = j.streams.find((s: any) => s.codec_type === "video");
  if (!v) throw new Error(`${file} has no video stream`);
  const [n, d] = String(v.avg_frame_rate || v.r_frame_rate).split("/").map(Number);
  const rot = Number(v.side_data_list?.find((s: any) => s.rotation !== undefined)?.rotation ?? v.tags?.rotate ?? 0);
  const swap = Math.abs(rot) % 180 === 90;
  return {
    width: swap ? v.height : v.width,
    height: swap ? v.width : v.height,
    fps: d ? n / d : n,
    duration: Number(j.format.duration),
    vcodec: v.codec_name,
    pixFmt: v.pix_fmt,
    colorTransfer: v.color_transfer,
    colorPrimaries: v.color_primaries,
    hasAudio: j.streams.some((s: any) => s.codec_type === "audio"),
    rotation: rot,
  };
}

/** Round odd rates (29.97, 59.94) to the integer Remotion composition rate. */
export const compFps = (fps: number) => Math.round(fps);

/* ------------------------------ transcript ----------------------------- */

export type Word = { text: string; start: number; end: number; p?: number };

/**
 * Word-level transcript through the local openai-whisper CLI (turbo model, CPU).
 * Cached: re-running with the same audio returns the saved JSON.
 */
export function transcribe(audioWav: string, outJson: string, lang = "auto", model = "turbo"): Word[] {
  if (fs.existsSync(outJson) && fs.statSync(outJson).mtimeMs > fs.statSync(audioWav).mtimeMs) {
    return JSON.parse(fs.readFileSync(outJson, "utf8"));
  }
  const tmp = path.join(path.dirname(outJson), "whisper");
  fs.mkdirSync(tmp, { recursive: true });
  console.log(`Transcribing ${path.basename(audioWav)} with whisper ${model} (${lang})…`);
  run("whisper", [
    audioWav, "--model", model, ...(lang === "auto" ? [] : ["--language", lang]), "--word_timestamps", "True",
    "--output_format", "json", "--fp16", "False", "--condition_on_previous_text", "False",
    "--output_dir", tmp, "--verbose", "False",
  ]);
  const raw = JSON.parse(fs.readFileSync(path.join(tmp, path.basename(audioWav, path.extname(audioWav)) + ".json"), "utf8"));
  const words: Word[] = [];
  for (const seg of raw.segments) {
    for (const w of seg.words ?? []) {
      const text = String(w.word).trim();
      if (text) words.push({ text, start: +w.start.toFixed(3), end: +w.end.toFixed(3), p: +(w.probability ?? 1).toFixed(3) });
    }
  }
  fs.writeFileSync(outJson, JSON.stringify(words, null, 1));
  return words;
}

/** 16 kHz mono WAV for whisper / energy analysis. */
export function extractAudio(src: string, out: string, rate = 16000) {
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs > fs.statSync(src).mtimeMs) return out;
  run("ffmpeg", ["-v", "error", "-y", "-i", src, "-vn", "-ac", "1", "-ar", String(rate), "-c:a", "pcm_s16le", out]);
  return out;
}

/** Mono float samples of an audio/video file. */
export function decode(file: string, rate = 16000): Float32Array {
  const { stdout } = run("ffmpeg", ["-v", "error", "-i", file, "-vn", "-f", "f32le", "-ac", "1", "-ar", String(rate), "-"]);
  return new Float32Array(stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + stdout.byteLength));
}

/** RMS envelope in dBFS, one value per `hop` seconds. */
export function envelope(x: Float32Array, rate: number, hop = 0.01): Float32Array {
  const n = Math.round(rate * hop);
  const out = new Float32Array(Math.ceil(x.length / n));
  for (let i = 0; i < out.length; i++) {
    let q = 0;
    const a = i * n;
    const b = Math.min(x.length, a + n);
    for (let j = a; j < b; j++) q += x[j] * x[j];
    out[i] = 10 * Math.log10(q / Math.max(1, b - a) + 1e-12);
  }
  return out;
}

/* ------------------------------- loudness ------------------------------ */

export type Loudness = { I: number; LRA: number; TP: number; threshold: number };

/** EBU R128 measurement via the loudnorm filter's first pass. */
export function measureLoudness(file: string, filterPrefix = ""): Loudness {
  const af = `${filterPrefix ? filterPrefix + "," : ""}loudnorm=I=-14:TP=-1:LRA=11:print_format=json`;
  const { stderr } = run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", af, "-f", "null", "-"]);
  const j = JSON.parse(stderr.slice(stderr.lastIndexOf("{"), stderr.lastIndexOf("}") + 1));
  return { I: +j.input_i, LRA: +j.input_lra, TP: +j.input_tp, threshold: +j.input_thresh };
}

/** Second-pass loudnorm filter string (linear mode when possible) for a target. */
export function loudnormFilter(m: Loudness, target = -14, tp = -1) {
  return `loudnorm=I=${target}:TP=${tp}:LRA=11:measured_I=${m.I}:measured_LRA=${m.LRA}:measured_TP=${m.TP}:measured_thresh=${m.threshold}:linear=true`;
}

/** Light voice chain: rumble cut, de-boom, gentle compression. Applied before loudnorm. */
export const VOICE_CHAIN = "highpass=f=80,equalizer=f=250:t=q:w=1.2:g=-2,acompressor=threshold=-20dB:ratio=3:attack=6:release=90:makeup=2";

/* ------------------------------- text ---------------------------------- */

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Longest-common-subsequence length of two token arrays. */
export function lcs(a: string[], b: string[]) {
  const dp = new Uint16Array((a.length + 1) * (b.length + 1));
  const W = b.length + 1;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i * W + j] = a[i - 1] === b[j - 1] ? dp[(i - 1) * W + j - 1] + 1 : Math.max(dp[(i - 1) * W + j], dp[i * W + j - 1]);
  return dp[a.length * W + b.length];
}

/** Dice-style similarity on token LCS, 0..1. */
export const similarity = (a: string[], b: string[]) => (a.length + b.length ? (2 * lcs(a, b)) / (a.length + b.length) : 0);

export const fmtT = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, "0")}`;
};

export function arg(name: string, def?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
}
export const flag = (name: string) => process.argv.includes(`--${name}`);
