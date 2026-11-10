import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, monoLabel } from "./theme";
import { BAR, BEAT, DURATION, FPS, MONTAGE, SECTIONS } from "./timeline";
import { ease, prog } from "../../lib/motion";
import { MONTAGE_TONES } from "./scenes/Range";

/** Viewfinder overlay: crop marks, timecode, section index, beat meter, scrubber. */

type Tone = "ink" | "paper";

/** Which ink the HUD needs over the current background. Liquid wipe covers bottom first. */
const toneAt = (f: number, edge: "top" | "bottom"): Tone => {
  if (f < 150) return "ink";
  if (f < 180) return "paper";
  if (f < (edge === "bottom" ? 214 : 234)) return "ink";
  if (f < MONTAGE.start) return "paper";
  if (f < MONTAGE.end) return MONTAGE_TONES[Math.floor((f - MONTAGE.start) / MONTAGE.shot)];
  if (f < 662) return "ink";
  return "paper";
};

const pad = (n: number, l = 2) => String(Math.floor(n)).padStart(l, "0");

const Crop: React.FC<{ x: number; y: number; sx: number; sy: number; color: string }> = ({ x, y, sx, sy, color }) => (
  <path d={`M${x} ${y + 30 * sy} L${x} ${y} L${x + 30 * sx} ${y}`} fill="none" stroke={color} strokeWidth={2} />
);

export const Hud: React.FC = () => {
  const f = useCurrentFrame();
  const top = toneAt(f, "top") === "ink" ? C.ink : C.paper;
  const bot = toneAt(f, "bottom") === "ink" ? C.ink : C.paper;
  const intro = 1;

  // section label swap
  let idx = 0;
  for (let i = 0; i < SECTIONS.length; i++) if (f >= SECTIONS[i].from) idx = i;
  const cur = SECTIONS[idx];
  const prev = idx > 0 ? SECTIONS[idx - 1] : null;
  const swap = ease.outExpo(prog(f, cur.from, cur.from + 9));

  const secs = f / FPS;
  const tc = `00:00:${pad(secs)}:${pad(f % FPS)}`;
  const beat = Math.floor((f % BAR) / BEAT);
  const beatFlash = Math.exp(-(f % BEAT) / 7);

  const labelStyle: React.CSSProperties = { ...monoLabel, fontSize: 15, whiteSpace: "nowrap" };

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: intro }}>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <Crop x={36} y={36} sx={1} sy={1} color={top} />
        <Crop x={1884} y={36} sx={-1} sy={1} color={top} />
        <Crop x={36} y={1044} sx={1} sy={-1} color={bot} />
        <Crop x={1884} y={1044} sx={-1} sy={-1} color={bot} />
        {/* scrubber */}
        <line x1={420} x2={1500} y1={1018} y2={1018} stroke={bot} strokeOpacity={0.2} strokeWidth={2} />
        <line x1={420} x2={420 + 1080 * (f / (DURATION - 1))} y1={1018} y2={1018} stroke={bot} strokeOpacity={0.85} strokeWidth={2} />
        {SECTIONS.filter((s, i, a) => a.findIndex((t) => t.n === s.n) === i).map((s) => (
          <line key={s.n} x1={420 + (1080 * s.from) / (DURATION - 1)} x2={420 + (1080 * s.from) / (DURATION - 1)} y1={1011} y2={1025} stroke={bot} strokeOpacity={0.45} strokeWidth={1.5} />
        ))}
      </svg>

      <div style={{ position: "absolute", left: 64, top: 50, ...labelStyle, color: top }}>
        <span style={{ fontWeight: 800 }}>Klaq</span>
        <span style={{ opacity: 0.6 }}> &nbsp;/&nbsp; Motion Reel ’26</span>
      </div>
      <div style={{ position: "absolute", right: 64, top: 50, ...labelStyle, color: top, fontVariantNumeric: "tabular-nums" }}>
        <span style={{ opacity: 0.6 }}>TC&nbsp;&nbsp;</span>
        {tc}
      </div>

      <div style={{ position: "absolute", left: 64, bottom: 50, height: 20, overflow: "hidden", ...labelStyle, color: bot, width: 340 }}>
        {prev && swap < 1 ? (
          <div style={{ position: "absolute", transform: `translateY(${-swap * 100}%)` }}>
            <span style={{ fontWeight: 800 }}>{prev.n}</span>
            <span style={{ opacity: 0.7 }}> — {prev.label}</span>
          </div>
        ) : null}
        <div style={{ position: "absolute", transform: `translateY(${(1 - swap) * 100}%)` }}>
          <span style={{ fontWeight: 800 }}>{cur.n}</span>
          <span style={{ opacity: 0.7 }}> — {cur.label}</span>
        </div>
      </div>

      <div style={{ position: "absolute", right: 64, bottom: 50, display: "flex", alignItems: "center", gap: 16, ...labelStyle, color: bot }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2, 3].map((b) => (
            <div
              key={b}
              style={{
                width: 11,
                height: 11,
                border: `1.5px solid ${bot}`,
                background: b === beat ? bot : "transparent",
                opacity: b === beat ? 0.45 + 0.55 * beatFlash : 0.5,
              }}
            />
          ))}
        </div>
        <span>120 BPM</span>
      </div>
    </AbsoluteFill>
  );
};
