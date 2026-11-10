import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, FONT, monoLabel } from "../theme";
import { BALL } from "../timeline";
import { clamp, ease, lerp, prog, sp, SPRING, tween } from "../../../lib/motion";

/**
 * 01 — Principles.
 * A physically-timed bouncing ball (squash & stretch, arcs, slow-in/slow-out,
 * anticipation) with onion skins, a spacing chart and a live graph editor
 * plotting its Y curve. Ends by leaping into the lens — its orange becomes
 * the next shot's background.
 */

const GROUND = 664;
const R = 44;
const G = 1.75; // px / frame²
const X0 = 170;
const VX = [11.5, 9.5, 7.5, 5.5];
const [C0, C1, C2, C3] = BALL.contacts;
const HOLD = BALL.hold;
const H0 = (G * C0 * C0) / 2;

// Arcs between contacts (launch after hold → next contact)
const ARCS = [
  { from: C0 + HOLD, to: C1 },
  { from: C1 + HOLD, to: C2 },
  { from: C2 + HOLD, to: C3 },
];
const ARRIVAL = [G * C0, ...ARCS.map((a) => (G * (a.to - a.from)) / 2)];

/** Height of ball bottom above ground + vertical velocity (up +) */
const heightAt = (t: number): { h: number; vy: number } => {
  if (t < C0) return { h: H0 - (G * t * t) / 2, vy: -G * t };
  for (const a of ARCS) {
    if (t >= a.from && t < a.to) {
      const T = a.to - a.from;
      const u = t - a.from;
      const v0 = (G * T) / 2;
      return { h: v0 * u - (G * u * u) / 2, vy: v0 - G * u };
    }
  }
  return { h: 0, vy: 0 };
};

const xAt = (t: number) => {
  const bounds = [0, C0, C1, C2, C3];
  let x = X0;
  for (let i = 0; i < 4; i++) {
    const a = bounds[i];
    const b = bounds[i + 1];
    if (t <= a) break;
    x += (Math.min(t, b) - a) * VX[i];
  }
  if (t > C3) x += Math.min(t - C3, 5) * 1.6 * (1 - Math.min(t - C3, 5) / 10);
  return x;
};

/** Squash amount during contact holds (0 = round) */
const squashAt = (t: number) => {
  const cs = [C0, C1, C2];
  for (let i = 0; i < cs.length; i++) {
    const d = t - cs[i];
    if (d >= 0 && d <= HOLD) return 0.52 * (ARRIVAL[i] / ARRIVAL[0]) * Math.sin((Math.PI * d) / HOLD);
  }
  if (t >= C3) {
    // landing + deep anticipation crouch, released on launch
    const land = 0.5 * ease.outCubic(prog(t, C3, C3 + 4));
    const release = ease.inCubic(prog(t, BALL.launch - 1, BALL.launch + 1.5));
    return land * (1 - release) - 0.38 * release * (1 - prog(t, BALL.launch + 1.5, BALL.launch + 5));
  }
  return 0;
};

type M = [number, number, number, number]; // a b c d
const mul = (p: M, q: M): M => [p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1], p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3]];

type Ball = { x: number; y: number; m: M; h: number };

const ballAt = (t: number): Ball => {
  const { h, vy } = heightAt(t);
  const q = squashAt(t);
  const x = xAt(t);
  if (Math.abs(q) > 0.001) {
    const sx = 1 + 0.9 * q;
    const sy = 1 - q;
    return { x, y: GROUND - R * sy, m: [sx, 0, 0, sy], h: 0 };
  }
  // stretch along velocity
  const vx = t < C0 ? VX[0] : t < C1 ? VX[1] : t < C2 ? VX[2] : VX[3];
  const vys = -vy;
  const s = 1 + Math.min(0.3, Math.abs(vy) * 0.0068);
  const phi = Math.atan2(vys, vx);
  const c = Math.cos(phi);
  const sn = Math.sin(phi);
  const rot: M = [c, sn, -sn, c];
  const irot: M = [c, -sn, sn, c];
  const m = mul(mul(rot, [s, 0, 0, 1 / s]), irot);
  return { x, y: GROUND - h - R, m, h };
};

/* ---------------------------- Graph editor ---------------------------- */
const PX = 170;
const PW = 1580;
const PY = 752;
const PH = 176;
const tx = (t: number) => PX + (t / 120) * PW;
const hy = (h: number) => PY + PH - 16 - (h / H0) * (PH - 58);

const APEXES = [
  { t: 0, h: H0 },
  ...ARCS.map((a) => ({ t: (a.from + a.to) / 2, h: (G * (a.to - a.from) ** 2) / 8 })),
];
const CONTACT_KEYS = [C0, C0 + HOLD, C1, C1 + HOLD, C2, C2 + HOLD, C3];

const curvePath = (tEnd: number) => {
  let d = "";
  for (let t = 0; t <= tEnd; t += 0.5) {
    d += `${d ? "L" : "M"}${tx(t).toFixed(1)} ${hy(heightAt(t).h).toFixed(1)}`;
  }
  return d;
};
const FULL_CURVE = curvePath(C3);

const GraphEditor: React.FC<{ f: number }> = ({ f }) => {
  const reveal = 1;
  const head = Math.min(f, 119);
  const ticks: React.ReactNode[] = [];
  for (let t = 0; t <= 120; t += 2) {
    const major = t % 10 === 0;
    ticks.push(
      <line key={t} x1={tx(t)} x2={tx(t)} y1={PY + PH + 8} y2={PY + PH + (major ? 20 : 14)} stroke={C.ink} strokeOpacity={major ? 0.5 : 0.22} strokeWidth={major ? 1.5 : 1} />,
    );
    if (major)
      ticks.push(
        <text key={`l${t}`} x={tx(t)} y={PY + PH + 38} textAnchor="middle" fontFamily={FONT.mono} fontSize={14} fill={C.ink} fillOpacity={0.5}>
          {t}
        </text>,
      );
  }
  return (
    <g opacity={reveal} transform={`translate(0 ${(1 - reveal) * 30})`}>
      <rect x={PX} y={PY} width={PW} height={PH} rx={14} fill={C.ink} fillOpacity={0.035} stroke={C.ink} strokeOpacity={0.12} />
      {Array.from({ length: 13 }, (_, i) => (
        <line key={i} x1={tx(i * 10)} x2={tx(i * 10)} y1={PY + 38} y2={PY + PH - 8} stroke={C.ink} strokeOpacity={0.06} />
      ))}
      <line x1={PX + 16} x2={PX + PW - 16} y1={hy(0)} y2={hy(0)} stroke={C.ink} strokeOpacity={0.2} />
      <text x={PX + 18} y={PY + 26} fontFamily={FONT.mono} fontSize={13} letterSpacing={2} fill={C.ink} fillOpacity={0.62}>
        GRAPH EDITOR
      </text>
      <text x={PX + PW - 18} y={PY + 26} textAnchor="end" fontFamily={FONT.mono} fontSize={13} letterSpacing={2} fill={C.ink} fillOpacity={0.4}>
        BALL · POSITION Y · 60 FPS
      </text>
      {ticks}
      {/* planned curve (ghost) + live curve */}
      <path d={FULL_CURVE} fill="none" stroke={C.ink} strokeOpacity={0.14} strokeWidth={2} strokeDasharray="3 6" />
      <path d={curvePath(Math.min(head, C3))} fill="none" stroke={C.orange} strokeWidth={3.2} strokeLinejoin="round" />
      {/* keyframes: contacts = broken tangents (diamonds), apexes = flat eased tangents */}
      {CONTACT_KEYS.map((t, i) => {
        const s = sp(f, t, SPRING.pop);
        return <rect key={`c${i}`} x={-5} y={-5} width={10} height={10} fill={C.ink} transform={`translate(${tx(t)} ${hy(0)}) rotate(45) scale(${s})`} />;
      })}
      {APEXES.map((a, i) => {
        const s = sp(f, a.t, SPRING.pop);
        const hl = 34 * clamp(s);
        return (
          <g key={`a${i}`} transform={`translate(${tx(a.t)} ${hy(a.h)})`}>
            <line x1={-hl} x2={hl} y1={0} y2={0} stroke={C.ink} strokeOpacity={0.55} strokeWidth={1.2} />
            <circle cx={-hl} r={3.2 * s} fill={C.paper} stroke={C.ink} strokeWidth={1.2} />
            <circle cx={hl} r={3.2 * s} fill={C.paper} stroke={C.ink} strokeWidth={1.2} />
            <circle r={6 * s} fill={C.orange} stroke={C.ink} strokeWidth={1.4} />
          </g>
        );
      })}
      {/* playhead */}
      <g transform={`translate(${tx(head)} 0)`}>
        <line y1={PY - 6} y2={PY + PH + 10} stroke={C.orange} strokeWidth={2} />
        <rect x={-26} y={PY - 30} width={52} height={24} rx={6} fill={C.orange} />
        <text y={PY - 13} textAnchor="middle" fontFamily={FONT.mono} fontWeight={700} fontSize={14} fill={C.ink}>
          {String(Math.floor(head)).padStart(3, "0")}
        </text>
      </g>
    </g>
  );
};

/* ------------------------------ Callouts ------------------------------ */
const Callout: React.FC<{ f: number; x: number; y: number; text: string; from: number; to: number; dx?: number; dy?: number }> = ({
  f,
  x,
  y,
  text,
  from,
  to,
  dx = 60,
  dy = -70,
}) => {
  if (f < from || f > to + 8) return null;
  const dot = sp(f, from, SPRING.pop);
  const line = tween(f, from + 2, 7, ease.outCubic);
  const txt = tween(f, from + 6, 8, ease.outExpo);
  const out = 1 - tween(f, to, 8, ease.inCubic);
  const ex = x + dx;
  const ey = y + dy;
  const hx = ex + (dx >= 0 ? 34 : -34);
  const len = Math.hypot(dx, dy) + 34;
  return (
    <g opacity={out}>
      <circle cx={x} cy={y} r={5.5 * dot} fill={C.ink} />
      <circle cx={x} cy={y} r={14 * dot} fill="none" stroke={C.ink} strokeOpacity={0.35} />
      <path d={`M${x} ${y} L${ex} ${ey} L${hx} ${ey}`} fill="none" stroke={C.ink} strokeWidth={1.4} strokeDasharray={len} strokeDashoffset={len * (1 - line)} />
      <g>
        <text
          x={hx + (dx >= 0 ? 12 : -12)}
          y={ey + 5}
          textAnchor={dx >= 0 ? "start" : "end"}
          fontFamily={FONT.mono}
          fontWeight={600}
          fontSize={16}
          letterSpacing={2.4}
          fill={C.ink}
          opacity={txt}
          transform={`translate(${(1 - txt) * (dx >= 0 ? -14 : 14)} 0)`}
        >
          {text}
        </text>
      </g>
    </g>
  );
};

/* ------------------------------- Scene -------------------------------- */
export const Principles: React.FC = () => {
  const f = useCurrentFrame();
  const b = ballAt(f);

  // slow push-in around frame centre, then a dive into the ball on launch
  const s1 = 1 + 0.035 * ease.inOutQuad(prog(f, 0, BALL.launch));
  const toScreen = (x: number, y: number): [number, number] => [960 + s1 * (x - 960), 540 + s1 * (y - 540)];
  const L = prog(f, BALL.launch, BALL.cut - 1);
  const launchPos = toScreen(xAt(BALL.launch), GROUND - R);
  const s2 = 1 + 0.35 * ease.inCubic(L);
  const grow = 1 + 31 * ease.inQuart(L);
  const [px, py] = toScreen(b.x, b.y);
  const bx = lerp(px, 960, ease.inCubic(L));
  const by = lerp(py, 540, ease.inCubic(L));
  const stageFade = 1 - 0.6 * ease.inCubic(L);

  // onion skins + spacing chart
  const skins: React.ReactNode[] = [];
  for (let k = 1; k <= 5; k++) {
    const t = f - k * 3;
    if (t < 0 || f >= BALL.launch) continue;
    const s = ballAt(t);
    skins.push(
      <ellipse
        key={k}
        cx={0}
        cy={0}
        rx={R}
        ry={R}
        fill="none"
        stroke={C.ink}
        strokeWidth={1.6}
        strokeOpacity={0.42 * (1 - k / 6)}
        transform={`matrix(${s.m[0]} ${s.m[1]} ${s.m[2]} ${s.m[3]} ${s.x} ${s.y})`}
      />,
    );
  }
  const spacing: React.ReactNode[] = [];
  for (let t = 0; t <= Math.min(f, C3); t += 2) {
    const s = ballAt(t);
    spacing.push(<circle key={t} cx={s.x} cy={s.y} r={2.6} fill={C.ink} fillOpacity={0.28} />);
  }

  const groundDraw = 1;
  const shadowK = clamp(1 - b.h / 520);
  const apex1 = APEXES[1];

  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <AbsoluteFill style={{ transform: `scale(${s2})`, transformOrigin: `${launchPos[0]}px ${launchPos[1]}px` }}>
        <AbsoluteFill style={{ transform: `scale(${s1})`, transformOrigin: "960px 540px" }}>
          <svg width={1920} height={1080} style={{ position: "absolute", opacity: stageFade }}>
            {/* ground */}
            <line x1={960 - 850 * groundDraw} x2={960 + 850 * groundDraw} y1={GROUND} y2={GROUND} stroke={C.ink} strokeWidth={2} />
            {[C0, C1, C2, C3].map((c, i) => {
              const d = f - c;
              if (d < 0 || d > 22) return null;
              const p = ease.outCubic(d / 22);
              return (
                <ellipse key={i} cx={xAt(c)} cy={GROUND} rx={30 + 150 * p * (1 - i * 0.2)} ry={4 + 16 * p} fill="none" stroke={C.ink} strokeOpacity={0.5 * (1 - p)} strokeWidth={1.5} />
              );
            })}
            {/* contact shadow */}
            <ellipse cx={b.x} cy={GROUND + 3} rx={R * (0.55 + 0.6 * shadowK)} ry={5 + 3 * shadowK} fill={C.ink} fillOpacity={(0.06 + 0.16 * shadowK) * (1 - L)} />
            {spacing}
            {skins}
            <GraphEditor f={f} />
            <Callout f={f} x={xAt(C0) + 70} y={GROUND - 26} text="SQUASH & STRETCH" from={C0 + 1} to={C0 + 26} dx={60} dy={-100} />
            <Callout f={f} x={xAt(apex1.t)} y={GROUND - apex1.h - 2 * R - 18} text="SLOW IN · SLOW OUT" from={40} to={66} dx={-60} dy={-60} />
            <Callout f={f} x={ballAt(ARCS[0].from + 7).x} y={ballAt(ARCS[0].from + 7).y} text="ARCS · SPACING" from={66} to={92} dx={-70} dy={-96} />
            <Callout f={f} x={xAt(C3) + 92} y={GROUND - 22} text="ANTICIPATION" from={C3 + 1} to={BALL.launch + 2} dx={70} dy={-96} />
          </svg>
        </AbsoluteFill>
      </AbsoluteFill>
      {/* the ball lives outside the camera groups so it can fill the frame */}
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <circle
          cx={0}
          cy={0}
          r={R}
          fill={C.orange}
          transform={`translate(${bx} ${by}) scale(${s1 * grow}) matrix(${b.m[0]} ${b.m[1]} ${b.m[2]} ${b.m[3]} 0 0)`}
        />
      </svg>
      <Caption f={f} />
    </AbsoluteFill>
  );
};

/** Tiny spec line, like an animator's exposure sheet note */
const Caption: React.FC<{ f: number }> = ({ f }) => {
  const a = tween(f, 6, 14, ease.outExpo) * (1 - tween(f, BALL.launch - 6, 6));
  return (
    <div
      style={{
        position: "absolute",
        right: 64,
        top: 92,
        ...monoLabel,
        fontSize: 15,
        color: C.ink,
        opacity: 0.55 * a,
        transform: `translateY(${(1 - a) * 12}px)`,
      }}
    >
      bounce_v07.anim · g 1.75 px/f² · e 0.75
    </div>
  );
};
