import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { getLength } from "@remotion/paths";
import { C, flex, monoLabel } from "../theme";
import { MONTAGE } from "../timeline";
import { clamp, ease, hash, lerp, mix, prog, smoothOpenPath, sp, SPRING } from "../../../lib/motion";

/**
 * 06 — Range. Eight 15-frame shots cut on eighth notes, each a different discipline:
 * UI · Data · Line · Type · 3D · Shape · FX · Pattern.
 */

type Shot = React.FC<{ f: number }>;

/* UI — a toggle labelled MOTION flips ON; knob stretches with speed, squashes on the wall */
const ShotUI: Shot = ({ f }) => {
  const cfg = { damping: 15, stiffness: 320, mass: 0.55 };
  const p = sp(f, 0.5, cfg);
  const vel = Math.abs(p - sp(f - 1, 0.5, cfg));
  const press = 1 - 0.07 * Math.sin(Math.PI * prog(f, 0, 2.5));
  const over = Math.max(0, p - 1);
  const stretch = 1 + Math.min(0.42, vel * 1.5);
  const sx = (stretch - over * 1.5) * press;
  const sy = (1 / Math.sqrt(stretch) + over * 1.1) * press;
  const K = 112;
  const x = lerp(800, 1120, Math.min(1, p)) + K * (1 - sx) * (p > 0.5 ? 1 : -1) * (over > 0 ? 1 : 0);
  const fillW = Math.max(280, x + K - 660 + 28);
  const ring = prog(f, 7, 15);
  const grow = 48 * ease.outCubic(ring);
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {ring > 0 ? (
          <rect x={660 - grow} y={400 - grow} width={600 + 2 * grow} height={280 + 2 * grow} rx={140 + grow} fill="none" stroke={C.orange} strokeOpacity={1 - ring} strokeWidth={5} />
        ) : null}
        <rect x={660} y={400} width={600} height={280} rx={140} fill={C.ink} />
        <rect x={660} y={400} width={Math.min(600, fillW)} height={280} rx={140} fill={C.orange} opacity={clamp(p * 6)} />
        <ellipse cx={x} cy={540} rx={K * sx} ry={K * sy} fill={C.paper} />
      </svg>
      <div style={{ position: "absolute", left: 660, top: 330, ...monoLabel, fontSize: 22, color: C.ink, opacity: 0.75 }}>Motion</div>
      <div style={{ position: "absolute", right: 660, top: 330, ...monoLabel, fontSize: 22, color: p > 0.5 ? C.orange : C.ink, fontWeight: 800 }}>
        {p > 0.5 ? "On" : "Off"}
      </div>
    </AbsoluteFill>
  );
};

/* DATA — bars spring up with stagger, number counts, trend line draws */
const BARS = [230, 340, 290, 440, 395, 570, 505];
const BAR_W = 104;
const BAR_GAP = 34;
const BAR_X0 = 960 - (BARS.length * BAR_W + (BARS.length - 1) * BAR_GAP) / 2;
const BASE = 830;
const TREND = smoothOpenPath(BARS.map((h, i) => [BAR_X0 + i * (BAR_W + BAR_GAP) + BAR_W / 2, BASE - h - 34] as [number, number]));
const TREND_LEN = getLength(TREND);
const ShotData: Shot = ({ f }) => {
  const n = Math.round(248 * ease.outExpo(prog(f, 0, 12)));
  const draw = ease.outCubic(prog(f, 4, 14));
  return (
    <AbsoluteFill style={{ background: C.orange }}>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {BARS.map((h, i) => {
          const s = sp(f, i * 0.8, { damping: 12, stiffness: 320, mass: 0.5 });
          const hh = h * s;
          return <rect key={i} x={BAR_X0 + i * (BAR_W + BAR_GAP)} y={BASE - hh} width={BAR_W} height={Math.max(0, hh)} fill={C.ink} />;
        })}
        <line x1={BAR_X0 - 30} x2={1920 - BAR_X0 + 30} y1={BASE} y2={BASE} stroke={C.ink} strokeWidth={4} />
        <path d={TREND} fill="none" stroke={C.paper} strokeWidth={7} strokeLinecap="round" strokeDasharray={TREND_LEN} strokeDashoffset={TREND_LEN * (1 - draw)} />
      </svg>
      <div style={{ position: "absolute", left: BAR_X0 - 10, top: 150, ...flex(1000, 112), fontSize: 150, lineHeight: 0.8, color: C.ink }}>+{n}%</div>
    </AbsoluteFill>
  );
};

/* LINE — a spiral draws itself while rotating, pen dot leads */
const SPIRAL_PTS: [number, number][] = Array.from({ length: 160 }, (_, i) => {
  const th = (i / 159) * 6 * Math.PI;
  const r = 16 + (364 * th) / (6 * Math.PI);
  return [960 + Math.cos(th) * r, 540 + Math.sin(th) * r];
});
const SPIRAL = smoothOpenPath(SPIRAL_PTS);
const SPIRAL_LEN = getLength(SPIRAL);
const ShotLine: Shot = ({ f }) => {
  const d = ease.outCubic(prog(f, -3, 12));
  const idx = Math.min(SPIRAL_PTS.length - 1, Math.round(d * (SPIRAL_PTS.length - 1)));
  const rot = lerp(-150, 0, ease.outCubic(prog(f, -3, 14)));
  return (
    <AbsoluteFill style={{ background: C.cobalt }}>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <g transform={`rotate(${rot} 960 540)`}>
          <path d={SPIRAL} fill="none" stroke={C.paper} strokeWidth={17} strokeLinecap="round" strokeDasharray={SPIRAL_LEN} strokeDashoffset={SPIRAL_LEN * (1 - d)} />
          <circle cx={SPIRAL_PTS[idx][0]} cy={SPIRAL_PTS[idx][1]} r={22} fill={C.orange} />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

/* TYPE — odometer rolls into 2026 */
const DIGIT_H = 440;
const ShotType: Shot = ({ f }) => {
  const target = [2, 0, 2, 6];
  return (
    <AbsoluteFill style={{ background: C.lime, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", ...flex(1000, 100), fontSize: DIGIT_H, lineHeight: 1, color: C.ink }}>
        {target.map((t, i) => {
          const roll = 10 * (1 + (i % 2)) + t;
          const p = ease.outExpo(prog(f, i - 1.5, i + 9));
          const off = roll * p;
          const digits = Array.from({ length: roll + 2 }, (_, k) => k % 10);
          return (
            <div key={i} style={{ height: DIGIT_H * 0.76, overflow: "hidden", position: "relative" }}>
              <div style={{ transform: `translateY(${-off * DIGIT_H - DIGIT_H * 0.12}px)` }}>
                {digits.map((dg, k) => (
                  <div key={k} style={{ height: DIGIT_H, lineHeight: `${DIGIT_H}px` }}>
                    {dg}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* 3D — a CSS cube snaps a quarter turn with overshoot */
const CUBE = 380;
const Shot3D: Shot = ({ f }) => {
  const s = sp(f, 0, { damping: 11, stiffness: 240, mass: 0.6 });
  const ry = lerp(-135, -45, s);
  const rx = lerp(-38, -24, s);
  const face = (bg: string, t: string): React.CSSProperties => ({
    position: "absolute",
    width: CUBE,
    height: CUBE,
    left: -CUBE / 2,
    top: -CUBE / 2,
    background: bg,
    transform: t,
    backfaceVisibility: "hidden",
    boxShadow: "inset 0 0 0 3px rgba(11,11,13,0.9)",
  });
  const h = CUBE / 2;
  return (
    <AbsoluteFill style={{ background: C.ink, perspective: 1500, perspectiveOrigin: "50% 40%" }}>
      <div style={{ position: "absolute", left: 960, top: 560, transformStyle: "preserve-3d", transform: `rotateX(${rx}deg) rotateY(${ry}deg)` }}>
        <div style={face(C.orange, `translateZ(${h}px)`)} />
        <div style={face(C.cobalt, `rotateY(90deg) translateZ(${h}px)`)} />
        <div style={face(C.paper, `rotateY(180deg) translateZ(${h}px)`)} />
        <div style={face(C.lime, `rotateY(-90deg) translateZ(${h}px)`)} />
        <div style={face("#FF8C66", `rotateX(90deg) translateZ(${h}px)`)} />
        <div style={face("#1a1a1f", `rotateX(-90deg) translateZ(${h}px)`)} />
      </div>
    </AbsoluteFill>
  );
};

/* SHAPE — square ↔ circle morph, counter-rotating, with a shock ring */
const ShotShape: Shot = ({ f }) => {
  const s = sp(f, 0, SPRING.pop);
  const outer = 400;
  const ring = prog(f, 3, 15);
  return (
    <AbsoluteFill style={{ background: C.orange, justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          width: 520 + 700 * ease.outCubic(ring),
          height: 520 + 700 * ease.outCubic(ring),
          borderRadius: "50%",
          border: `${8 * (1 - ring)}px solid ${C.ink}`,
        }}
      />
      <div
        style={{
          width: outer,
          height: outer,
          background: C.paper,
          borderRadius: `${lerp(6, 50, clamp(s))}%`,
          transform: `rotate(${lerp(-90, 0, s)}deg) scale(${lerp(0.6, 1, s)})`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div style={{ width: 170, height: 170, background: C.ink, borderRadius: `${lerp(50, 6, clamp(s))}%`, transform: `rotate(${lerp(90, -45, s)}deg)` }} />
      </div>
    </AbsoluteFill>
  );
};

/* FX — RGB-split glitch with sliced displacement */
const ShotFX: Shot = ({ f }) => {
  const k = Math.floor(f);
  const slices = 9;
  const amp = 1 - 0.6 * prog(f, 8, 15);
  const layer = (color: string, dx: number, blend: boolean) => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        transform: `translateX(${dx}px)`,
        mixBlendMode: blend ? "screen" : undefined,
      }}
    >
      <span style={{ ...flex(1000, 125), fontSize: 250, lineHeight: 1, color }}>GLITCH</span>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {Array.from({ length: slices }, (_, i) => {
        const top = (i / slices) * 100;
        const off = (hash(k * 13.1 + i * 7.7) - 0.5) * 140 * amp * (hash(k + i * 3.3) > 0.45 ? 1 : 0.1);
        const split = 10 + 18 * hash(k * 2.7 + i) * amp;
        return (
          <AbsoluteFill key={i} style={{ clipPath: `inset(${top}% 0 ${100 - top - 100 / slices}% 0)`, transform: `translateX(${off}px)` }}>
            {layer("#ff2a2a", -split, true)}
            {layer("#28e0ff", split, true)}
            {layer(C.paper, 0, true)}
          </AbsoluteFill>
        );
      })}
      {Array.from({ length: 6 }, (_, i) => {
        const on = hash(k * 5.1 + i * 9.3) > 0.5;
        if (!on) return null;
        return (
          <div
            key={`b${i}`}
            style={{
              position: "absolute",
              left: hash(k * 3.3 + i) * 1700,
              top: hash(k * 4.4 + i * 2) * 1000,
              width: 40 + hash(k + i * 5) * 260,
              height: 6 + hash(k * 2 + i) * 30,
              background: i % 2 ? C.lime : C.orange,
            }}
          />
        );
      })}
      <AbsoluteFill style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0 2px, transparent 2px 5px)" }} />
    </AbsoluteFill>
  );
};

/* PATTERN — nested squares twist into an op-art vortex */
export const PatternShot: Shot = ({ f }) => {
  const twist = lerp(0, 11, ease.inOutQuad(prog(f, 0, 15))) + Math.max(0, f - 15) * 1.6;
  const spin = f * 2.2 + Math.max(0, f - 15) ** 2 * 0.35;
  const layers = 18;
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {Array.from({ length: layers }, (_, i) => {
          const size = 1500 * Math.pow(0.83, i);
          return (
            <rect
              key={i}
              x={960 - size / 2}
              y={540 - size / 2}
              width={size}
              height={size}
              fill={i % 2 ? C.paper : C.ink}
              transform={`rotate(${spin + i * twist} 960 540)`}
            />
          );
        })}
        <circle cx={960} cy={540} r={20} fill={C.orange} />
      </svg>
    </AbsoluteFill>
  );
};

const SHOTS: Shot[] = [ShotUI, ShotData, ShotLine, ShotType, Shot3D, ShotShape, ShotFX, PatternShot];

export const Range: React.FC = () => {
  const f = useCurrentFrame();
  const i = Math.min(SHOTS.length - 1, Math.floor(f / MONTAGE.shot));
  const Comp = SHOTS[i];
  return <Comp f={f - i * MONTAGE.shot} />;
};

export const MONTAGE_TONES = ["ink", "ink", "paper", "ink", "paper", "ink", "paper", "ink"] as const;
