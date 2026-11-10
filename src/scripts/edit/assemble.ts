/**
 * Step 03b — cut the raw recording into one continuous clip the composition plays.
 *
 *   pnpm edit assemble <slug> [--lut auto|none|apple-log|slog3|flat|path.cube] [--exposure 1.0]
 *
 * - Applies every segment from cuts.json (frame-exact re-encode, 6 ms audio fades so cuts never click).
 * - LOG: `auto` checks tags and image statistics and applies a generated LUT if the footage looks LOG.
 * - Voice: rumble cut, gentle compression, then two-pass loudnorm to −14 LUFS / −1 dBTP.
 * - Writes public/projects/<slug>/footage.mp4 (source resolution, height capped at 2160).
 */
import { head } from "./head";
import fs from "fs";
import path from "path";
import type { Cuts } from "./cut";
import { detectLog, writeCube, type LogProfile } from "./lut";
import { dirs, loudnormFilter, measureLoudness, run, VOICE_CHAIN } from "./lib";

export async function assemble(slug: string, opts: { lut: string; exposure: number }) {
  const d = dirs(slug);
  const cuts: Cuts = JSON.parse(fs.readFileSync(path.join(d.pub, "cuts.json"), "utf8"));
  const raw = cuts.raw;

  let lutFile: string | undefined;
  if (opts.lut.endsWith(".cube")) lutFile = path.resolve(opts.lut);
  else if (opts.lut !== "none") {
    let profile: LogProfile | undefined = opts.lut === "auto" ? undefined : (opts.lut as LogProfile);
    if (!profile) {
      const det = detectLog(raw);
      console.log(`LOG check: ${det.tagged ? `tagged LOG (${det.profile})` : det.likely ? "looks flat, possibly LOG" : "looks like normal Rec.709"} — ${det.reason}`);
      if (det.tagged) profile = det.profile;
      else if (det.likely)
        throw new Error(
          "The footage looks flat but is not tagged as LOG, so no LUT was guessed. Which camera profile was it shot in?\n" +
            "  re-run with --lut apple-log | slog3 | flat | path/to/manufacturer.cube   (or --lut none if it is meant to look like this)",
        );
    }
    if (profile) {
      lutFile = writeCube(profile, path.join(d.work, `${profile}-to-709.cube`), 33, opts.exposure);
      console.log(`Generated LUT ${lutFile}`);
    }
  }

  // one filtergraph: trim each segment, fade its audio edges, concat
  const fps = cuts.fps;
  const parts: string[] = [];
  cuts.segments.forEach((s, i) => {
    const dur = s.out - s.in;
    parts.push(`[0:v]trim=start=${s.in.toFixed(4)}:end=${s.out.toFixed(4)},setpts=PTS-STARTPTS[v${i}]`);
    parts.push(
      `[0:a]atrim=start=${s.in.toFixed(4)}:end=${s.out.toFixed(4)},asetpts=PTS-STARTPTS,afade=t=in:d=0.006,afade=t=out:st=${Math.max(0, dur - 0.006).toFixed(4)}:d=0.006[a${i}]`,
    );
  });
  const n = cuts.segments.length;
  const scale = cuts.height > 2160 ? `,scale=-2:2160` : "";
  const lut = lutFile ? `,lut3d=file='${lutFile.replace(/'/g, "\\'")}':interp=tetrahedral` : "";
  parts.push(`${cuts.segments.map((_, i) => `[v${i}][a${i}]`).join("")}concat=n=${n}:v=1:a=1[vc][ac]`);
  parts.push(`[vc]fps=${fps}${lut}${scale},format=yuv420p[vo]`);
  // mono voice (a lav on one channel still works), then dual-mono stereo so the level is right when played in stereo
  parts.push(`[ac]aformat=channel_layouts=mono,${VOICE_CHAIN},pan=stereo|c0=c0|c1=c0,aresample=48000[ao]`);
  const graph = path.join(d.work, "assemble.filtergraph");
  fs.writeFileSync(graph, parts.join(";\n"));

  const tmp = path.join(d.work, "assembled.mov");
  console.log(`Assembling ${n} segments (${cuts.durationSec.toFixed(1)}s)…`);
  run("ffmpeg", [
    "-v", "error", "-y", "-i", raw, "-filter_complex_script", graph, "-map", "[vo]", "-map", "[ao]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-g", String(fps), "-movflags", "+faststart",
    "-c:a", "pcm_s16le", "-f", "mov", tmp,
  ]);

  // two-pass loudness normalisation of the voice
  const m = measureLoudness(tmp);
  const out = path.join(d.pub, "footage.mp4");
  run("ffmpeg", ["-v", "error", "-y", "-i", tmp, "-c:v", "copy", "-af", `${loudnormFilter(m)},aresample=48000`, "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", out]);
  const after = measureLoudness(out);
  console.log(`Voice: ${m.I} → ${after.I} LUFS, true peak ${after.TP} dBTP`);
  console.log(`Wrote ${out}`);
  // head track for yap / split framing and for placing graphics around the head (macOS Vision)
  try {
    head(slug);
  } catch (e) {
    console.log(`Head track skipped: ${(e as Error).message.split("\n")[0]}`);
  }
}
