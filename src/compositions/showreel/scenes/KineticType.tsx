import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { getLength } from "@remotion/paths";
import { C, FONT, flex, monoLabel } from "../theme";
import { TYPE } from "../timeline";
import { clamp, ease, hash, lerp, prog, smoothOpenPath, sp, SPRING, tween } from "../../../lib/motion";

/**
 * 02 — Kinetic type. "TIMING / is / EVERYTHING", one word per beat.
 * Variable-font axes (wdth, wght) are animated live; EVERYTHING gets
 * squash & stretch on the type itself (wide+flat → tall+condensed at constant width).
 * Local frame 0 = global TYPE.timing.
 */

const T0 = TYPE.timing;
const IS = TYPE.is - T0; // 30
const EVERY = TYPE.every - T0; // 60
const SNAP = TYPE.snap - T0; // 75
const WIPE = TYPE.wipe - T0; // 88

/* Measured: Roboto Flex wght 1000, width of "EVERYTHING" at 100px for wdth 25..151 */
const EVERY_W: [number, number][] = [
  [25, 445.2],
  [50, 504.4],
  [75, 563.6],
  [100, 622.8],
  [125, 747.5],
  [151, 877.3],
];
const everyWidth = (wdth: number) => {
  for (let i = 0; i < EVERY_W.length - 1; i++) {
    const [a, wa] = EVERY_W[i];
    const [b, wb] = EVERY_W[i + 1];
    if (wdth <= b) return lerp(wa, wb, (wdth - a) / (b - a));
  }
  return EVERY_W[EVERY_W.length - 1][1];
};

const AxisReadout: React.FC<{ wdth: number; wght: number; color: string; opacity: number; y: number }> = ({ wdth, wght, color, opacity, y }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      top: y,
      display: "flex",
      justifyContent: "center",
      gap: 38,
      ...monoLabel,
      fontSize: 15,
      color,
      opacity,
    }}
  >
    <span>wdth {wdth.toFixed(1).padStart(5, "0")}</span>
    <span>wght {Math.round(wght)}</span>
    <span>opsz 144</span>
    <span>roboto flex · variable</span>
  </div>
);

/* ------------------------------- TIMING -------------------------------- */
const Timing: React.FC<{ f: number }> = ({ f }) => {
  const letters = "TIMING".split("");
  const order = [2, 3, 1, 4, 0, 5]; // centre-out
  const wdth = lerp(38, 112, ease.outQuart(prog(f, 0, 26)));
  const size = 340;
  return (
    <AbsoluteFill style={{ background: C.orange, justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", ...flex(1000, wdth), fontSize: size, lineHeight: 0.8, color: C.ink, marginTop: -30 }}>
        {letters.map((ch, i) => {
          const rank = order.indexOf(i);
          const p = sp(f, rank * 1.4 - 2, SPRING.snap);
          return (
            <span key={i} style={{ display: "inline-block", clipPath: "inset(-40% -20% 0 -20%)" }}>
              <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 105}%)` }}>{ch}</span>
            </span>
          );
        })}
      </div>
      <AxisReadout wdth={wdth} wght={1000} color={C.ink} opacity={0.62 * tween(f, 6, 10)} y={740} />
    </AbsoluteFill>
  );
};

/* --------------------------------- is ---------------------------------- */
const LOOP_PTS: [number, number][] = (() => {
  const pts: [number, number][] = [];
  const n = 90;
  const a0 = -0.35 * Math.PI;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const th = a0 - u * 2.18 * Math.PI;
    const grow = 1 + 0.07 * u;
    const rx = 300 * grow * (1 + 0.035 * Math.sin(3 * th));
    const ry = 238 * grow * (1 + 0.04 * Math.cos(2 * th + 0.4));
    const x = rx * Math.cos(th);
    const y = ry * Math.sin(th);
    const rot = -0.2;
    pts.push([960 + x * Math.cos(rot) - y * Math.sin(rot), 548 + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return pts;
})();
const LOOP_D = smoothOpenPath(LOOP_PTS);
const LOOP_LEN = getLength(LOOP_D);

const Is: React.FC<{ f: number }> = ({ f }) => {
  const s = sp(f, -2.5, SPRING.pop);
  const draw = ease.inOutCubic(prog(f, 1, 17));
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <path d={LOOP_D} fill="none" stroke={C.orange} strokeWidth={13} strokeLinecap="round" strokeDasharray={LOOP_LEN} strokeDashoffset={LOOP_LEN * (1 - draw)} />
      </svg>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <span
          style={{
            fontFamily: FONT.serif,
            fontStyle: "italic",
            fontSize: 600,
            lineHeight: 1,
            color: C.paper,
            transform: `translate(-8px, -40px) scale(${lerp(0.55, 1, s)}) rotate(${lerp(-14, 0, s)}deg)`,
            opacity: clamp(s * 3),
          }}
        >
          is
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ------------------------------ EVERYTHING ----------------------------- */
const TARGET_W = 1690;

const Everything: React.FC<{ f: number }> = ({ f }) => {
  const lf = f - EVERY;
  const snap = sp(f, SNAP, { damping: 12, stiffness: 210, mass: 0.7 });
  const pc = clamp(snap);
  const wdth = lerp(151, 25, pc);
  const scaleY = lerp(1, 2.45, snap); // overshoots with the spring
  const size = (TARGET_W * 100) / everyWidth(wdth);
  const letters = "EVERYTHING".split("");
  const drift = 1 + 0.025 * ease.outQuad(prog(f, SNAP + 10, 120));
  return (
    <AbsoluteFill style={{ background: C.paper, justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          ...flex(1000, wdth),
          fontSize: size,
          lineHeight: 0.74,
          color: C.ink,
          transform: `scale(${drift}) scaleY(${scaleY})`,
          transformOrigin: "50% 50%",
          whiteSpace: "nowrap",
        }}
      >
        {letters.map((ch, i) => {
          const p = sp(lf, i * 0.8 - 4, SPRING.snap);
          const dir = i % 2 === 0 ? 1 : -1;
          return (
            <span key={i} style={{ display: "inline-block", clipPath: "inset(0 -10% 0 -10%)" }}>
              <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 110 * dir}%)` }}>{ch}</span>
            </span>
          );
        })}
      </div>
      <AxisReadout wdth={wdth} wght={1000} color={C.ink} opacity={0.62 * tween(lf, 4, 10) * (1 - clamp(pc * 1.6))} y={640} />
    </AbsoluteFill>
  );
};

/* ------------------------------ Liquid wipe ---------------------------- */
const LiquidWipe: React.FC<{ f: number }> = ({ f }) => {
  if (f < WIPE) return null;
  const u = prog(f, WIPE, 120);
  const level = lerp(1250, -260, ease.inOutCubic(u));
  const bumps = Array.from({ length: 19 }, (_, j) => {
    const x = j * 108 - 12;
    const r = 70 + 34 * hash(j * 3.1);
    const y = level + 36 * Math.sin(f * 0.21 + j * 1.9) + 20 * Math.sin(f * 0.13 + j * 0.7);
    return <circle key={j} cx={x} cy={y} r={r} />;
  });
  const drops = Array.from({ length: 14 }, (_, j) => {
    const born = WIPE + 2 + hash(j * 7.7) * 16;
    const t = f - born;
    if (t < 0) return null;
    const v0 = 15 + 11 * hash(j * 1.3);
    const x = 60 + hash(j * 5.3) * 1800 + Math.sin(j) * t * 0.6;
    const bornLevel = lerp(1250, -260, ease.inOutCubic(prog(born, WIPE, 120)));
    const y = bornLevel - v0 * t + 0.5 * 1.25 * t * t;
    const r = 16 + 20 * hash(j * 9.1);
    return <circle key={`d${j}`} cx={x} cy={y} r={r} />;
  });
  return (
    <svg width={1920} height={1080} style={{ position: "absolute" }}>
      <defs>
        <filter id="goo-wipe" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="22" result="b" />
          <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 36 -15" />
        </filter>
      </defs>
      <g filter="url(#goo-wipe)" fill={C.ink}>
        <rect x={-100} y={level} width={2120} height={1600} />
        {bumps}
        {drops}
      </g>
    </svg>
  );
};

export const KineticType: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      {f < IS ? <Timing f={f} /> : f < EVERY ? <Is f={f - IS} /> : <Everything f={f} />}
      <LiquidWipe f={f} />
    </AbsoluteFill>
  );
};
