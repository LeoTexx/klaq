import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { DIM, FLUID, GRID } from "../timeline";
import { clamp, ease, hash, lerp, mix, noise1, prog, smoothClosedPath, sp } from "../../../lib/motion";

/**
 * 03 Fluid → 04 Generative → 05 3D, as ONE continuous system (global frames 240–540).
 * Lime metaballs swirl, merge into a jelly core and burst into 648 droplets that
 * spiral into a grid. The grid ripples, twists, then curls into a globe, morphs
 * into a torus and explodes into warp streaks.
 */

const F0 = FLUID.start - 14; // starts under the liquid wipe
const CX = 960;
const CY = 540;

/* ------------------------------ particles ------------------------------ */
const COLS = 36;
const ROWS = 18;
const S = 48;
const CIRC = COLS * S; // wraps to 2π
const RS = CIRC / (2 * Math.PI); // ≈ 275
const RT = 212;
const RT_TUBE = 90;

type Particle = {
  gx: number;
  gy: number;
  d: number;
  lon: number;
  lat: number;
  bx: number;
  by: number;
  delay: number;
  equator: boolean;
  s1: number;
  s2: number;
};

const DMAX = Math.hypot(17.5 * S, 8.5 * S);
const PARTICLES: Particle[] = [];
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const i = row * COLS + col;
    const gx = (col - 17.5) * S;
    const gy = (row - 8.5) * S;
    const d = Math.hypot(gx, gy);
    const rr = Math.sqrt(hash(i * 1.37)) * 150;
    const aa = hash(i * 2.11) * Math.PI * 2;
    PARTICLES.push({
      gx,
      gy,
      d,
      lon: (gx * 2 * Math.PI) / CIRC,
      lat: (gy * 2 * Math.PI) / CIRC,
      bx: Math.cos(aa) * rr,
      by: Math.sin(aa) * rr,
      delay: (d / DMAX) * 9 + hash(i * 3.3) * 3,
      equator: row === 8 || row === 9,
      s1: 0.55 + hash(i * 4.7) * 0.9,
      s2: 0.3 + hash(i * 5.9) * 1.1,
    });
  }
}

/** burst flight 0→1 with overshoot: leaves fast, settles soft */
const flightAt = (p: Particle, g: number) => ease.outBack(prog(g, FLUID.burst + p.delay, FLUID.burst + p.delay + 30), 1.3);

/** accumulated spin (rad) — integrates angular speed so speed changes stay smooth */
const spinAt = (g: number) => {
  let a = 0;
  for (let t = GRID.wrapIn; t < g; t += 1) {
    const w = 0.05 * ease.inQuad(prog(t, GRID.wrapIn, GRID.wrapOut)) - 0.012 * prog(t, DIM.torusIn, DIM.torusOut);
    a += w * Math.min(1, g - t);
  }
  return a;
};

type Proj = { x: number; y: number; z: number; scale: number };

const camera = (g: number) => {
  const k = ease.inOutCubic(prog(g, GRID.wrapIn + 8, DIM.sphere + 6));
  const back = ease.inOutCubic(prog(g, DIM.torusIn, DIM.torusOut + 10));
  return { camZ: lerp(1400, 1000, k) + 90 * back, focal: lerp(1400, 1450, k) };
};

/** world-space position of particle p at global frame g (before projection) */
const worldPos = (p: Particle, g: number, spin: number): [number, number, number] => {
  // burst → grid (2D)
  const fl = flightAt(p, g);
  const flc = clamp(fl);
  let x = lerp(p.bx, p.gx, fl);
  let y = lerp(p.by, p.gy, fl);
  const sw = 0.45 * (1 - flc) * (1 - flc);
  const cs = Math.cos(sw);
  const sn = Math.sin(sw);
  [x, y] = [x * cs - y * sn, x * sn + y * cs];

  // ripple
  const rt = g - GRID.land;
  if (rt > 0) {
    const crest = Math.exp(-(((p.d - rt * 36) / 80) ** 2)) * (1 - prog(g, GRID.land + 18, GRID.land + 40));
    const push = 18 * crest;
    if (p.d > 0.1) {
      x += (p.gx / p.d) * push;
      y += (p.gy / p.d) * push;
    }
  }
  // twist in / out
  const tw = Math.sin(Math.PI * ease.inOutQuad(prog(g, GRID.twistIn, GRID.twistOut))) * 1.35 * Math.exp(-p.d / 560);
  if (tw !== 0) {
    const c = Math.cos(tw);
    const s = Math.sin(tw);
    [x, y] = [x * c - y * s, x * s + y * c];
  }

  // wrap plane → sphere (bend curvature)
  const m = ease.inOutCubic(prog(g, GRID.wrapIn, GRID.wrapOut));
  let X = x;
  let Y = y;
  let Z = 0;
  if (m > 0) {
    const k = (m * 2 * Math.PI) / CIRC;
    const lon = x * k;
    const lat = y * k;
    X = (Math.sin(lon) * Math.cos(lat)) / k;
    Y = Math.sin(lat) / k;
    Z = (Math.cos(lon) * Math.cos(lat) - 1) / k + RS * m;
  }

  // sphere → torus
  const mt = ease.inOutCubic(prog(g, DIM.torusIn, DIM.torusOut));
  if (mt > 0) {
    const v = p.lat * 2;
    const tx = (RT + RT_TUBE * Math.cos(v)) * Math.sin(p.lon);
    const ty = RT_TUBE * Math.sin(v);
    const tz = (RT + RT_TUBE * Math.cos(v)) * Math.cos(p.lon);
    X = lerp(X, tx, mt);
    Y = lerp(Y, ty, mt);
    Z = lerp(Z, tz, mt);
  }

  // rotate around the (moving) pivot
  const pivot = -RS * (1 - m);
  Z -= pivot;
  const ry = spin;
  const rx = -0.38 * ease.inOutCubic(prog(g, GRID.wrapIn + 10, GRID.wrapOut)) - 0.72 * ease.inOutCubic(prog(g, DIM.torusIn, DIM.torusOut + 6)) - 0.15 * prog(g, DIM.torusOut, DIM.cut);
  const rz = 0.25 * ease.inOutCubic(prog(g, DIM.torusIn + 6, DIM.explode));
  // Y axis
  let x1 = X * Math.cos(ry) + Z * Math.sin(ry);
  let z1 = -X * Math.sin(ry) + Z * Math.cos(ry);
  // X axis
  let y1 = Y * Math.cos(rx) - z1 * Math.sin(rx);
  let z2 = Y * Math.sin(rx) + z1 * Math.cos(rx);
  // Z axis
  const x2 = x1 * Math.cos(rz) - y1 * Math.sin(rz);
  const y2 = x1 * Math.sin(rz) + y1 * Math.cos(rz);
  x1 = x2;
  y1 = y2;
  z2 += pivot;

  // anticipation + explosion
  const pre = 1 - 0.14 * ease.inOutQuad(prog(g, DIM.explode - 10, DIM.explode));
  const e = ease.inCubic(prog(g, DIM.explode, DIM.cut + 2));
  const grow = pre * (1 + 3.4 * e * p.s1);
  return [x1 * grow, y1 * grow, z2 * grow + 1500 * e * p.s2];
};

const project = (X: number, Y: number, Z: number, g: number): Proj | null => {
  const { camZ, focal } = camera(g);
  const depth = camZ - Z;
  if (depth < 60) return null;
  const scale = focal / depth;
  return { x: CX + X * scale, y: CY + Y * scale, z: Z, scale };
};

/* -------------------------------- blobs -------------------------------- */
const BLOBS = [
  { r: 96, a0: 0.5 * Math.PI - 1.0, sw: 1.5, rad0: 760 },
  { r: 72, a0: 0.5 * Math.PI - 0.45, sw: 1.9, rad0: 690 },
  { r: 112, a0: 0.5 * Math.PI + 0.05, sw: 1.3, rad0: 800 },
  { r: 60, a0: 0.5 * Math.PI + 0.5, sw: 2.1, rad0: 700 },
  { r: 84, a0: 0.5 * Math.PI + 0.95, sw: 1.6, rad0: 760 },
  { r: 104, a0: 0.5 * Math.PI - 1.45, sw: 1.2, rad0: 900 },
  { r: 66, a0: 0.5 * Math.PI + 1.4, sw: 1.8, rad0: 880 },
];
const RC = 215;

const Blobs: React.FC<{ g: number }> = ({ g }) => {
  if (g >= FLUID.burst + 8) return null;
  const m = ease.inOutCubic(prog(g, F0 + 2, FLUID.merge));
  const blobs = BLOBS.map((b, i) => {
    const wob = 1 - m;
    const rad = b.rad0 * (1 - m) + 40 * wob * Math.sin(g * 0.11 + i);
    const ang = b.a0 + b.sw * m + 0.2 * noise1(g * 0.03, i);
    return <circle key={i} cx={CX + rad * Math.cos(ang)} cy={CY + rad * Math.sin(ang)} r={b.r * (1 - 0.25 * m)} />;
  });

  // jelly core
  const grow = ease.outBack(prog(g, FLUID.merge - 12, FLUID.merge + 4), 2.2);
  const antic = 1 - 0.14 * ease.inCubic(prog(g, FLUID.burst - 8, FLUID.burst));
  const burst = 1 - ease.inCubic(prog(g, FLUID.burst, FLUID.burst + 4));
  const rc = RC * grow * antic * burst;
  const jt = Math.max(0, g - FLUID.merge);
  const decay = Math.exp(-jt / 16);
  const modes = [
    { k: 2, a: 0.13, w: 0.36, ph: 0 },
    { k: 3, a: 0.08, w: 0.5, ph: 1.2 },
    { k: 4, a: 0.05, w: 0.63, ph: 2.1 },
  ];
  const pts: [number, number][] = [];
  for (let j = 0; j < 72; j++) {
    const th = (j / 72) * Math.PI * 2;
    let r = 1;
    for (const md of modes) r += md.a * decay * Math.sin(md.w * jt + md.ph) * Math.cos(md.k * th + md.ph + g * 0.02);
    pts.push([CX + Math.cos(th) * rc * r, CY + Math.sin(th) * rc * r]);
  }
  const sats = [0, 1, 2, 3, 4].map((j) => {
    const on = prog(g, FLUID.merge - 4, FLUID.merge + 6) * burst;
    const a = j * 1.26 + g * (0.035 + j * 0.012) * (j % 2 ? -1 : 1);
    const dist = rc * (1.02 + 0.28 * (0.5 + 0.5 * Math.sin(g * 0.09 + j * 2.1)));
    return <circle key={`s${j}`} cx={CX + Math.cos(a) * dist} cy={CY + Math.sin(a) * dist} r={(24 + 10 * hash(j)) * on} />;
  });

  return (
    <g filter="url(#goo)" fill={C.lime}>
      {blobs}
      {rc > 1 ? <path d={smoothClosedPath(pts)} /> : null}
      {sats}
    </g>
  );
};

/* -------------------------------- scene -------------------------------- */
export const Matter: React.FC = () => {
  const g = useCurrentFrame() + F0;
  const spin = spinAt(g);
  const inBurst = g >= FLUID.burst - 1;

  // particles
  const items: { x: number; y: number; r: number; fill: string; o: number; z: number; px?: number; py?: number }[] = [];
  if (inBurst) {
    const m3d = prog(g, GRID.wrapIn + 10, DIM.sphere);
    const streak = g >= DIM.explode;
    const pulse = 1 + 0.55 * Math.exp(-Math.max(0, g - DIM.pulse) / 6) * (g >= DIM.pulse ? 1 : 0);
    const spinPrev = streak ? spinAt(g - 1.6) : spin;
    const wrapM = ease.inOutCubic(prog(g, GRID.wrapIn, GRID.wrapOut));
    const burstStreak = g < FLUID.burst + 24;
    for (let i = 0; i < PARTICLES.length; i++) {
      const p = PARTICLES[i];
      const [X, Y, Z] = worldPos(p, g, spin);
      const pr = project(X, Y, Z, g);
      if (!pr) continue;
      const fl = clamp(flightAt(p, g));
      const base = p.equator ? C.orange : C.paper;
      const rt = g - GRID.land;
      const crest = rt > 0 ? Math.exp(-(((p.d - rt * 36) / 80) ** 2)) * (1 - prog(g, GRID.land + 18, GRID.land + 40)) : 0;
      let fill = mix(C.lime, base, fl);
      if (crest > 0.02) fill = mix(base, C.lime, crest);
      const pole = lerp(1, 0.12 + 0.88 * Math.pow(Math.cos(p.lat), 1.1), wrapM);
      const rBase = lerp(10, 5, fl) * (1 + 1.3 * crest) * pulse * pole;
      const depthAlpha = 0.25 + 0.75 * clamp((pr.z + 330) / 660);
      const o = lerp(1, depthAlpha, m3d);
      const item: (typeof items)[number] = { x: pr.x, y: pr.y, r: rBase * pr.scale, fill, o, z: pr.z };
      if (streak || burstStreak) {
        const lag = streak ? 1.6 : 0.6;
        const [pX, pY, pZ] = worldPos(p, g - lag, streak ? spinPrev : spin);
        const pp = project(pX, pY, pZ, g - lag);
        if (pp && Math.hypot(pp.x - pr.x, pp.y - pr.y) > 2) {
          item.px = pp.x;
          item.py = pp.y;
        }
      }
      items.push(item);
    }
    if (m3d > 0) items.sort((a, b) => a.z - b.z);
  }

  // background: ink → cobalt shockwave at the burst → back to ink as the globe forms
  const wave = ease.outCubic(prog(g, FLUID.burst, FLUID.burst + 24)) * 1250;
  const toInk = ease.inOutQuad(prog(g, GRID.wrapIn + 20, DIM.sphere));
  const flash = g >= DIM.cut - 4 ? prog(g, DIM.cut - 4, DIM.cut) : 0;

  const dots = (keyPrefix: string) =>
    items.map((it, i) =>
      it.px !== undefined ? (
        <line key={keyPrefix + i} x1={it.px} y1={it.py} x2={it.x} y2={it.y} stroke={it.fill} strokeOpacity={it.o} strokeWidth={Math.max(1.5, it.r * (it.z === 0 ? 0.9 : 2))} strokeLinecap="round" />
      ) : (
        <circle key={keyPrefix + i} cx={it.x} cy={it.y} r={it.r} fill={it.fill} fillOpacity={it.o} />
      ),
    );

  return (
    <AbsoluteFill style={{ background: g >= FLUID.start - 4 ? C.ink : "transparent" }}>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        <defs>
          <filter id="goo" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={22} result="b" />
            <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 36 -15" />
          </filter>
          <radialGradient id="vig" cx="50%" cy="50%" r="75%">
            <stop offset="55%" stopColor="#000" stopOpacity={0} />
            <stop offset="100%" stopColor="#000" stopOpacity={0.45} />
          </radialGradient>
        </defs>
        {g >= FLUID.burst && toInk < 1 ? <circle cx={CX} cy={CY} r={wave} fill={mix(C.cobalt, C.ink, toInk)} /> : null}
        <Blobs g={g} />
        {inBurst ? <g>{dots("c")}</g> : null}
        {g >= DIM.sphere - 30 ? <rect width={1920} height={1080} fill="url(#vig)" opacity={prog(g, DIM.sphere - 30, DIM.sphere)} /> : null}
        {flash > 0 ? <rect width={1920} height={1080} fill={C.paper} opacity={ease.inQuad(flash)} /> : null}
      </svg>
    </AbsoluteFill>
  );
};
