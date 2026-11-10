/**
 * Head track for the cut footage: where the head is, sampled 4×/s, smoothed inside each take.
 *
 *   pnpm edit head <slug>        (assemble runs it too)
 *
 * Faces come from Apple Vision (`head.swift`, macOS). A face box (brows to chin) is grown into a head
 * box (crown to chin, ears included) so layouts can keep the whole head clear. Writes
 * public/projects/<slug>/head.json, read by the TalkingHead composition for framing (`yap`, `split`)
 * and for placing graphics around the head, never over it.
 */
import fs from "fs";
import path from "path";
import { dirs, ROOT, run } from "./lib";

export type Box = [number, number, number, number]; // x, y, w, h — normalised to the source frame, origin top-left
export type HeadTrack = {
  rate: number;
  boxes: (Box | null)[];
  /** one framing box per take (median of the take): framing stays still inside a take and moves on the cut */
  segments: { from: number; to: number; box: Box }[];
  /** share of samples where a face was found */
  coverage: number;
};

const RATE = 4;

function binary() {
  const src = path.join(ROOT, "src", "scripts", "edit", "head.swift");
  const bin = path.join(ROOT, "work", "bin", "head");
  if (!fs.existsSync(bin) || fs.statSync(bin).mtimeMs < fs.statSync(src).mtimeMs) {
    fs.mkdirSync(path.dirname(bin), { recursive: true });
    run("swiftc", ["-O", src, "-o", bin]);
  }
  return bin;
}

/** face (brows → chin) → head (crown → chin, ears) */
const toHead = ([x, y, w, h]: Box): Box => [x - w * 0.2, y - h * 0.55, w * 1.4, h * 1.7];

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export function head(slug: string): HeadTrack {
  const d = dirs(slug);
  const footage = path.join(d.pub, "footage.mp4");
  if (!fs.existsSync(footage)) throw new Error(`No ${footage}: run \`pnpm edit assemble ${slug}\` first`);
  const cuts = JSON.parse(fs.readFileSync(path.join(d.pub, "cuts.json"), "utf8"));

  const frames = path.join(d.work, "headframes");
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });
  run("ffmpeg", ["-v", "error", "-y", "-i", footage, "-vf", `fps=${RATE},scale=640:-2`, path.join(frames, "%05d.jpg")]);
  const raw: (([...Box, number]) | null)[] = JSON.parse(run(binary(), [frames]).stdout.toString());
  const faces: (Box | null)[] = raw.map((r) => (r && r[4] > 0.5 ? toHead([r[0], r[1], r[2], r[3]]) : null));

  // takes on the output timeline; never smooth across a cut (the head jumps there on purpose)
  const bounds = [0, ...(cuts.cuts as number[]), cuts.durationSec as number];
  const boxes: (Box | null)[] = new Array(faces.length).fill(null);
  const segments: HeadTrack["segments"] = [];
  for (let s = 0; s < bounds.length - 1; s++) {
    const a = Math.floor(bounds[s] * RATE);
    const b = Math.min(faces.length, Math.ceil(bounds[s + 1] * RATE));
    const found = faces.slice(a, b).filter((x): x is Box => !!x);
    if (!found.length) continue;
    const med: Box = [0, 1, 2, 3].map((k) => median(found.map((f) => f[k]))) as Box;
    segments.push({ from: bounds[s], to: bounds[s + 1], box: med });
    for (let i = a; i < b; i++) {
      // ±0.5 s moving average of the samples that found a face, inside this take only
      const near = faces.slice(Math.max(a, i - 2), Math.min(b, i + 3)).filter((x): x is Box => !!x);
      boxes[i] = near.length ? ([0, 1, 2, 3].map((k) => near.reduce((acc, f) => acc + f[k], 0) / near.length) as Box) : med;
    }
  }
  const coverage = faces.filter(Boolean).length / Math.max(1, faces.length);
  const round = (b: Box) => b.map((v) => +v.toFixed(4)) as Box;
  const track: HeadTrack = { rate: RATE, boxes: boxes.map((b) => (b ? round(b) : null)), segments: segments.map((s) => ({ ...s, box: round(s.box) })), coverage: +coverage.toFixed(3) };
  fs.writeFileSync(path.join(d.pub, "head.json"), JSON.stringify(track));
  console.log(`Head track: face found in ${(coverage * 100).toFixed(0)}% of ${faces.length} samples, ${segments.length}/${bounds.length - 1} takes framed → ${path.join(d.pub, "head.json")}`);
  if (coverage < 0.8) console.log("Warning: the face is often not found (turned away, dark, too small). Yap and split framing fall back to plan.face there.");
  return track;
}
