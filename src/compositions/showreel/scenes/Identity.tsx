import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, FONT, monoLabel } from "../theme";
import { IDENT, SECTIONS } from "../timeline";
import { clamp, ease, lerp, prog, sp, SPRING, tween } from "../../../lib/motion";
import { PatternShot } from "./Range";

/**
 * 07 — Identity. The pattern irises down into the orange dot from shot one.
 * A breath of silence, an anticipation squash, then the hit: the name rises,
 * the dot arcs over it and lands as the full stop.
 */

const G0 = IDENT.collapse;
const R0 = 44;
const R1 = 38;

/* Name layout — Instrument Serif Italic, measured with fontTools: "Klaq" advance 1.638em, ink right 1.633em */
const NAME_SIZE = 440;
const NAME = "Klaq";
const INK_RIGHT = 1.633;
const GAP = 26;
const NAME_W = INK_RIGHT * NAME_SIZE + GAP + 2 * R1;
const NAME_X = 960 - NAME_W / 2;
const BASELINE = 640;
const DOT_X = NAME_X + INK_RIGHT * NAME_SIZE + GAP + R1;
const DOT_Y = BASELINE - R1;

const SKILLS = SECTIONS.filter((s, i, a) => a.findIndex((t) => t.n === s.n) === i && s.n !== "07").map((s) => s.label.split(" · ")[0]);

const Typewriter: React.FC<{ text: string; g: number; start: number; cps?: number; style: React.CSSProperties }> = ({ text, g, start, cps = 1.6, style }) => {
  const n = clamp(Math.floor((g - start) * cps), 0, text.length);
  const typing = g >= start && n < text.length;
  const blink = typing || Math.floor((g - start) / 16) % 2 === 0;
  return (
    <div style={style}>
      <span>{text.slice(0, n)}</span>
      {g >= start && g < start + text.length / cps + 40 ? (
        <span style={{ display: "inline-block", width: "0.62em", height: "1em", marginLeft: 4, verticalAlign: "-0.14em", background: C.orange, opacity: blink ? 1 : 0 }} />
      ) : null}
    </div>
  );
};

export const Identity: React.FC = () => {
  const g = useCurrentFrame() + G0;

  /* --- iris collapse --- */
  const iris = lerp(1180, R0, ease.inOutCubic(prog(g, IDENT.collapse, IDENT.dot)));
  const toOrange = prog(g, IDENT.dot - 7, IDENT.dot);
  const collapsing = g < IDENT.dot;

  /* --- dot: breath, squash, arc, land --- */
  const breath = 1 + 0.03 * Math.sin((g - IDENT.dot) * 0.32) * (g < IDENT.squash ? 1 : 0);
  const sq = ease.inQuad(prog(g, IDENT.squash, IDENT.hit)) * (g < IDENT.hit ? 1 : 0);
  let dx = 960;
  let dy = 540;
  let r = R0;
  let sx = breath * (1 + 0.36 * sq);
  let sy = breath * (1 - 0.4 * sq);
  if (g >= IDENT.hit) {
    const u = prog(g, IDENT.hit, IDENT.land);
    dx = lerp(960, DOT_X, u);
    const peak = 330;
    dy = lerp(540, DOT_Y, u) - 4 * peak * u * (1 - u);
    r = lerp(R0, R1, u);
    // stretch along vertical velocity while flying
    const vy = lerp(0, DOT_Y - 540, 1) - 4 * peak * (1 - 2 * u);
    const st = g < IDENT.land ? 1 + Math.min(0.28, Math.abs(vy) * 0.00045) : 1;
    sx = 1 / st;
    sy = st;
    // landing squash — a damped jelly
    if (g >= IDENT.land) {
      const j = sp(g, IDENT.land, SPRING.jelly);
      const q = (1 - j) * 0.55 * Math.exp(-(g - IDENT.land) / 22);
      sx = 1 + q;
      sy = 1 - q;
    }
    // a little wink at the end
    const wink = prog(g, 866, 884);
    if (wink > 0 && wink < 1) dy -= Math.sin(Math.PI * wink) * 26;
  }
  const squashAnchorY = g < IDENT.hit ? dy + r * (1 - sy) : g >= IDENT.land ? dy + r * (1 - sy) : dy;

  /* --- hit FX --- */
  const shock = prog(g, IDENT.hit, IDENT.hit + 44);
  const flash = g >= IDENT.hit ? Math.exp(-(g - IDENT.hit) / 1.6) : 0;
  const landRing = prog(g, IDENT.land, IDENT.land + 26);

  /* --- end card drift --- */
  const drift = 1 + 0.028 * ease.outQuad(prog(g, IDENT.hit, IDENT.end));

  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {collapsing ? (
        <AbsoluteFill style={{ clipPath: `circle(${iris}px at 960px 540px)` }}>
          <PatternShot f={15 + (g - IDENT.collapse)} />
          <AbsoluteFill style={{ background: C.orange, opacity: toOrange }} />
        </AbsoluteFill>
      ) : null}

      <AbsoluteFill style={{ transform: `scale(${drift})`, transformOrigin: "960px 560px" }}>
        {g >= IDENT.hit ? (
          <>
            {/* name */}
            <div style={{ position: "absolute", left: NAME_X, top: BASELINE - NAME_SIZE * 0.99, display: "flex", fontFamily: FONT.serif, fontStyle: "italic", fontSize: NAME_SIZE, lineHeight: 1.3, color: C.paper }}>
              {NAME.split("").map((ch, i) => {
                const p = sp(g, IDENT.hit + 1 + i * 2.2, SPRING.snap);
                return (
                  <span key={i} style={{ display: "inline-block", clipPath: `inset(-40% -40% ${lerp(23.5, -40, clamp((p - 0.85) / 0.15))}% -40%)` }}>
                    <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 80}%) rotate(${(1 - clamp(p)) * 8}deg)` }}>{ch}</span>
                  </span>
                );
              })}
            </div>

            {/* top line */}
            <Typewriter
              text="Motion Designer — Showreel 2026"
              g={g}
              start={IDENT.details}
              style={{ position: "absolute", left: NAME_X + 8, top: 272, ...monoLabel, fontSize: 21, letterSpacing: "0.28em", color: C.paper, opacity: 0.8 }}
            />

            {/* rule */}
            <div
              style={{
                position: "absolute",
                left: NAME_X + 8,
                top: 776,
                height: 2,
                width: (NAME_W - 8) * ease.inOutCubic(prog(g, IDENT.details + 4, IDENT.details + 30)),
                background: C.paper,
                opacity: 0.35,
              }}
            />

            {/* skills */}
            <div style={{ position: "absolute", left: NAME_X + 8, top: 808, width: NAME_W - 8, display: "flex", justifyContent: "space-between", ...monoLabel, fontSize: 17, color: C.paper }}>
              {SKILLS.map((s, i) => {
                const a = tween(g, IDENT.details + 10 + i * 3.5, 12, ease.outExpo);
                return (
                  <span key={s} style={{ opacity: 0.72 * a, transform: `translateY(${(1 - a) * 16}px)` }}>
                    <span style={{ color: C.orange }}>{String(i + 1).padStart(2, "0")}</span> {s}
                  </span>
                );
              })}
            </div>

            {/* tagline */}
            <div style={{ position: "absolute", left: 0, right: 0, top: 900, display: "flex", justifyContent: "center", gap: 14, fontFamily: FONT.serif, fontStyle: "italic", fontSize: 52, color: C.paper }}>
              {["900 frames.", "One prompt.", "All code."].map((w, i) => {
                const a = sp(g, IDENT.details + 32 + i * 6, SPRING.snap);
                return (
                  <span key={w} style={{ display: "inline-block", clipPath: "inset(-20% -10% 0 -10%)" }}>
                    <span style={{ display: "inline-block", transform: `translateY(${(1 - a) * 110}%)`, color: i === 2 ? C.orange : C.paper }}>{w}</span>
                  </span>
                );
              })}
            </div>
          </>
        ) : null}

        <svg width={1920} height={1080} style={{ position: "absolute" }}>
          {shock > 0 && shock < 1 ? (
            <circle cx={960} cy={540} r={R0 + 1300 * ease.outCubic(shock)} fill="none" stroke={C.paper} strokeOpacity={0.5 * (1 - shock)} strokeWidth={3} />
          ) : null}
          {landRing > 0 && landRing < 1 ? (
            <circle cx={DOT_X} cy={DOT_Y} r={R1 + 90 * ease.outCubic(landRing)} fill="none" stroke={C.orange} strokeOpacity={1 - landRing} strokeWidth={4 * (1 - landRing) + 0.5} />
          ) : null}
          {!collapsing ? <ellipse cx={dx} cy={squashAnchorY} rx={r * sx} ry={r * sy} fill={C.orange} /> : null}
        </svg>
      </AbsoluteFill>

      {flash > 0.02 ? <AbsoluteFill style={{ background: C.paper, opacity: 0.88 * flash }} /> : null}
    </AbsoluteFill>
  );
};
