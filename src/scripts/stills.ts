/**
 * Render a set of stills from one bundle (fast visual QA) + an optional contact sheet.
 *
 * Usage:
 *   pnpm tsx src/scripts/stills.ts --id Showreel --frames 0,60,120 --out out/showreel/stills
 *   pnpm tsx src/scripts/stills.ts --id Showreel --range 100:140:4 --sheet 5
 */
import path from "path";
import fs from "fs";
import { execFileSync } from "child_process";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { withAtAlias } from "./lib/bundle-alias";

const PROJECT_ROOT = path.resolve(__dirname, "../..");

function parseArgs() {
  const args = process.argv.slice(2);
  let id = "Showreel";
  let frames: number[] = [];
  let out = path.join(PROJECT_ROOT, "out", "qa", "stills");
  let sheet = 0;
  let scale = 1;
  let props: Record<string, unknown> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--id") id = args[++i];
    else if (a === "--frames") frames = args[++i].split(",").map(Number);
    else if (a === "--range") {
      const [s, e, st] = args[++i].split(":").map(Number);
      for (let f = s; f <= e; f += st || 1) frames.push(f);
    } else if (a === "--out") out = path.resolve(args[++i]);
    else if (a === "--sheet") sheet = Number(args[++i]);
    else if (a === "--scale") scale = Number(args[++i]);
    else if (a === "--props") props = JSON.parse(args[++i]);
  }
  return { id, frames, out, sheet, scale, props };
}

async function main() {
  const { id, frames, out, sheet, scale, props } = parseArgs();
  fs.mkdirSync(out, { recursive: true });
  const serveUrl = await bundle({ entryPoint: path.join(PROJECT_ROOT, "src/index.ts"), webpackOverride: withAtAlias });
  const composition = await selectComposition({ serveUrl, id, inputProps: props });
  const files: string[] = [];
  await Promise.all(
    frames.map(async (frame) => {
      const tag = Object.keys(props).length ? "-" + Object.values(props).join("-") : "";
      const output = path.join(out, `${id}${tag}-${String(frame).padStart(4, "0")}.png`);
      await renderStill({ serveUrl, composition, frame, output, scale, inputProps: props });
      files.push(output);
    }),
  );
  files.sort();
  console.log(files.join("\n"));
  if (sheet > 0 && files.length > 1) {
    const sheetPath = path.join(out, `${id}-sheet.png`);
    const inputs = files.flatMap((f) => ["-i", f]);
    // tiles follow the composition's aspect: 640 wide for landscape, 360 wide for vertical
    const tw = composition.width >= composition.height ? 640 : 360;
    const th = Math.round((tw * composition.height) / composition.width);
    const scaleChain = files.map((_, i) => `[${i}:v]scale=${tw}:${th}[v${i}]`).join(";");
    const layout = Array.from({ length: files.length }, (_, i) => `${(i % sheet) * tw}_${Math.floor(i / sheet) * th}`).join("|");
    execFileSync("ffmpeg", [
      "-loglevel", "error", "-y", ...inputs,
      "-filter_complex", `${scaleChain};${files.map((_, i) => `[v${i}]`).join("")}xstack=inputs=${files.length}:layout=${layout}:fill=gray`,
      sheetPath,
    ]);
    console.log(`sheet: ${sheetPath}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
