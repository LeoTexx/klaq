/**
 * LOG footage: detection and a generated .cube LUT to Rec.709.
 *
 * Detection is a hint, not a verdict: container tags (Apple Log, HLG, S-Log tags) first, then a
 * contrast/saturation check on sampled frames — LOG looks flat and washed out.
 *
 * Generated LUTs decode the published camera curve, convert the gamut to Rec.709 and tone-map with a
 * filmic curve. They are a good starting grade, not the manufacturer's look: when the camera maker
 * ships an official LUT, pass that file instead (`--lut path/to/file.cube`).
 */
import fs from "fs";
import { probe, run } from "./lib";

export type LogProfile = "apple-log" | "slog3" | "flat";

/** `tagged`: the file says it is LOG (safe to grade automatically). `likely`: it only looks flat — ask which camera profile. */
export function detectLog(file: string): { tagged: boolean; likely: boolean; profile?: LogProfile; reason: string } {
  const p = probe(file);
  const tags = `${p.colorTransfer ?? ""} ${p.colorPrimaries ?? ""}`.toLowerCase();
  if (/apple|log/.test(tags)) return { tagged: true, likely: true, profile: /s-?log/.test(tags) ? "slog3" : "apple-log", reason: `container tags "${tags.trim()}"` };
  // sample 8 frames: luma spread and average saturation
  const { stderr } = run("ffmpeg", [
    "-hide_banner", "-nostats", "-i", file, "-an",
    "-vf", `fps=${(8 / Math.max(1, p.duration)).toFixed(4)},scale=320:-2,signalstats,metadata=print`,
    "-f", "null", "-",
  ]);
  const get = (k: string) => [...stderr.matchAll(new RegExp(`lavfi\\.signalstats\\.${k}=([\\d.]+)`, "g"))].map((m) => +m[1]);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const range = avg(get("YHIGH")) - avg(get("YLOW"));
  const sat = avg(get("SATAVG"));
  const bits = p.pixFmt.includes("10") ? 4 : 1; // signalstats reports 10-bit values on 10-bit input
  // LOG: washed-out colour first of all, and a compressed tonal range
  const flat = sat / bits < 22 && range / bits < 160;
  return {
    tagged: false,
    likely: flat,
    profile: flat ? "flat" : undefined,
    reason: `luma 10–90% spread ${(range / bits).toFixed(0)}/255, saturation ${(sat / bits).toFixed(1)}, transfer "${p.colorTransfer ?? "untagged"}"`,
  };
}

/* ---------------------------- camera curves ---------------------------- */

/** Apple Log (Apple Log Profile white paper), code value 0..1 → scene linear, Rec.2020 primaries */
function appleLogToLinear(P: number) {
  const R0 = -0.05641088, Rt = 0.01, c = 47.28711236, b = 0.00964052, g = 0.08550479, B = 0.69336945;
  const Pt = c * (Rt - R0) ** 2;
  if (P >= Pt) return 2 ** ((P - B) / g) - b;
  if (P >= 0) return Math.sqrt(P / c) + R0;
  return R0;
}

/** Sony S-Log3 code value 0..1 → scene linear (S-Gamut3.Cine primaries) */
function slog3ToLinear(P: number) {
  const x = P * 1023;
  if (x >= 171.2102946929) return 10 ** ((x - 420) / 261.5) * (0.18 + 0.01) - 0.01;
  return ((x - 95) * 0.01125) / (171.2102946929 - 95);
}

type M3 = number[][];
const REC2020_TO_709: M3 = [
  [1.6605, -0.5876, -0.0728],
  [-0.1246, 1.1329, -0.0083],
  [-0.0182, -0.1006, 1.1187],
];
const SGAMUT3CINE_TO_709: M3 = [
  [1.6269474, -0.5401385, -0.0868089],
  [-0.1785155, 1.4179409, -0.2394254],
  [-0.0444361, -0.1959199, 1.240356],
];
const mul = (m: M3, v: number[]) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);

/** Filmic tone map (Narkowicz ACES fit) then Rec.709 display encoding (gamma 2.4). */
const tone = (x: number, exposure: number) => {
  const v = Math.max(0, x * exposure);
  const y = (v * (2.51 * v + 0.03)) / (v * (2.43 * v + 0.59) + 0.14);
  return Math.min(1, Math.max(0, y)) ** (1 / 2.4);
};

/** Generic lift for flat, untagged footage: S-curve around mid grey plus saturation. */
function flatGrade(rgb: number[]) {
  const s = (v: number) => {
    const c = Math.min(1, Math.max(0, (v - 0.06) / 0.86));
    return c < 0.5 ? 0.5 * (2 * c) ** 1.35 : 1 - 0.5 * (2 * (1 - c)) ** 1.35;
  };
  const o = rgb.map(s);
  const l = 0.2126 * o[0] + 0.7152 * o[1] + 0.0722 * o[2];
  return o.map((v) => Math.min(1, Math.max(0, l + (v - l) * 1.3)));
}

export function writeCube(profile: LogProfile, out: string, size = 33, exposure = 1.0) {
  const lines = [`TITLE "video-maker ${profile} to Rec.709"`, `LUT_3D_SIZE ${size}`, "DOMAIN_MIN 0 0 0", "DOMAIN_MAX 1 1 1"];
  for (let bi = 0; bi < size; bi++)
    for (let gi = 0; gi < size; gi++)
      for (let ri = 0; ri < size; ri++) {
        // .cube order: red changes fastest
        const code = [ri, gi, bi].map((i) => i / (size - 1));
        let rgb: number[];
        if (profile === "flat") rgb = flatGrade(code);
        else {
          const lin = code.map(profile === "apple-log" ? appleLogToLinear : slog3ToLinear);
          const m = mul(profile === "apple-log" ? REC2020_TO_709 : SGAMUT3CINE_TO_709, lin);
          rgb = m.map((v) => tone(v, exposure));
        }
        lines.push(rgb.map((v) => v.toFixed(6)).join(" "));
      }
  fs.writeFileSync(out, lines.join("\n") + "\n");
  return out;
}
