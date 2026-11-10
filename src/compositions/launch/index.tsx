/**
 * Klaq launch film (example). 48 s · 1920×1080 · 60 fps · 120 BPM. Timing: ./timeline.ts.
 * Before the first render: `pnpm tsx src/compositions/launch/prepare.ts` (fetches the talking-head clip
 * from Pexels, renders the QA stills, synthesizes the score).
 *
 * One protagonist, the orange dot of the logo: the clapper's record light, the terminal cursor,
 * the act markers, every check, and finally the full stop of "Klaq.".
 * Colours have jobs: orange = Klaq / action / approval, cobalt = media and data, paper and ink for the rest.
 */
import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Audio, Video } from "@remotion/media";
import { clamp, ease, lerp, noise1, prog, sp, SPRING } from "../../lib/motion";
import { Showreel } from "../showreel";
import { C, FONT, flex, monoLabel } from "../showreel/theme";
import { ACT, BAR, DURATION, EDIT, END, FPS, INSTALL, MOTION, PROMPT, QA, SLATE, SOUND } from "./timeline";

export { DURATION as LAUNCH_DURATION, FPS as LAUNCH_FPS } from "./timeline";

const INK2 = "#141417";
const LINE = "rgba(241,236,228,0.14)";
const ASSET = (p: string) => staticFile(`examples/launch/${p}`);

/* ------------------------------- shared -------------------------------- */

const actAt = (f: number) => {
  const order = Object.entries(ACT).sort((a, b) => a[1] - b[1]);
  let cur = order[0];
  for (const o of order) if (f >= o[1]) cur = o;
  return { name: cur[0], from: cur[1], n: order.indexOf(cur) };
};

/** Corner brackets, act label and timecode, as on the showreel and the README banner. */
const Hud: React.FC<{ f: number }> = ({ f }) => {
  const a = actAt(f);
  const s = Math.floor(f / FPS);
  const tc = `00:00:${String(s).padStart(2, "0")}:${String(Math.floor(((f % FPS) / FPS) * 100)).padStart(2, "0")}`;
  const corner = (d: string, i: number) => <path key={i} d={d} fill="none" stroke={C.paper} strokeOpacity={0.5} strokeWidth={2.5} />;
  const label: React.CSSProperties = { ...monoLabel, position: "absolute", fontSize: 17, color: C.paper };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {["M36 86V36H86", "M1834 36H1884V86", "M1884 994V1044H1834", "M86 1044H36V994"].map(corner)}
      </svg>
      <div style={{ ...label, left: 64, top: 50 }}>
        <span style={{ fontWeight: 800 }}>Klaq</span>
        <span style={{ opacity: 0.55 }}>&nbsp; / &nbsp;launch film</span>
      </div>
      <div style={{ ...label, right: 64, top: 50, fontVariantNumeric: "tabular-nums" }}>
        <span style={{ opacity: 0.55 }}>TC&nbsp;&nbsp;</span>
        {tc}
      </div>
      <div style={{ ...label, left: 64, bottom: 50, opacity: 0.8 }}>
        {String(a.n + 1).padStart(2, "0")} — {a.name}
      </div>
      <div style={{ ...label, right: 64, bottom: 50, opacity: 0.8 }}>120 BPM</div>
    </AbsoluteFill>
  );
};

/** Mask-rise line of type. */
const Rise: React.FC<{ f: number; at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ f, at, children, style }) => {
  const p = sp(f, at, SPRING.snap);
  return (
    <div style={{ overflow: "hidden", paddingBottom: "0.12em", ...style }}>
      <div style={{ transform: `translateY(${(1 - p) * 105}%)`, opacity: clamp(p * 3) }}>{children}</div>
    </div>
  );
};

/** Left column title for acts 3–6: an act marker with the dot, a serif title, a mono line. */
const Title: React.FC<{ f: number; at: number; n: string; kicker: string; lines: string[]; sub: string; top?: number }> = ({ f, at, n, kicker, lines, sub, top = 300 }) => {
  const dot = sp(f, at, SPRING.pop);
  return (
    <div style={{ position: "absolute", left: 120, top, width: 660 }}>
      <div style={{ ...monoLabel, fontSize: 19, color: C.paper, display: "flex", alignItems: "center", gap: 14, opacity: clamp(dot * 2) }}>
        <span style={{ width: 16, height: 16, borderRadius: 8, background: C.orange, transform: `scale(${dot})` }} />
        <span style={{ color: C.orange }}>{n}</span>
        <span style={{ opacity: 0.8 }}>{kicker}</span>
      </div>
      <div style={{ marginTop: 26 }}>
        {lines.map((l, i) => (
          <Rise key={i} f={f} at={at + 6 + i * 7} style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: 104, lineHeight: 1.0, color: C.paper }}>
            {l}
          </Rise>
        ))}
      </div>
      <div style={{ ...monoLabel, fontSize: 19, lineHeight: 1.7, color: C.paper, opacity: 0.6 * clamp(prog(f, at + 24, at + 40)), marginTop: 30 }}>{sub}</div>
    </div>
  );
};

/** Terminal window: typed command lines and checked replies. */
type TLine = { kind: "cmd"; prompt: string; text: string; start: number; cps: number } | { kind: "ok"; text: string; at: number } | { kind: "dim"; text: string; at: number };
const Terminal: React.FC<{ f: number; at: number; title: string; lines: TLine[]; x: number; y: number; w: number; h: number; progress?: [number, number] }> = ({ f, at, title, lines, x, y, w, h, progress }) => {
  const k = sp(f, at - 4, SPRING.soft);
  const blink = Math.floor(f / 18) % 2 === 0;
  // the cursor sits after the last command that has started typing
  let cursorLine = -1;
  lines.forEach((l, i) => {
    if (l.kind === "cmd" && f >= l.start - 20) cursorLine = i;
  });
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, background: INK2, borderRadius: 22, border: `1.5px solid ${LINE}`, boxShadow: "0 40px 120px rgba(0,0,0,0.55)", transform: `translateY(${(1 - k) * 60}px) scale(${0.97 + 0.03 * k})`, opacity: clamp(k * 1.6), overflow: "hidden" }}>
      <div style={{ height: 58, display: "flex", alignItems: "center", gap: 12, padding: "0 24px", borderBottom: `1.5px solid ${LINE}` }}>
        {[C.orange, "rgba(241,236,228,0.25)", "rgba(241,236,228,0.25)"].map((c, i) => (
          <div key={i} style={{ width: 15, height: 15, borderRadius: 8, background: c }} />
        ))}
        <div style={{ ...monoLabel, fontSize: 16, color: C.paper, opacity: 0.55, marginLeft: 14, textTransform: "none", letterSpacing: "0.04em" }}>{title}</div>
      </div>
      <div style={{ padding: "34px 40px", fontFamily: FONT.mono, fontSize: 31, lineHeight: 1.65, color: C.paper }}>
        {lines.map((l, i) => {
          if (l.kind === "cmd") {
            if (f < l.start - 20) return null;
            const n = Math.max(0, Math.floor((f - l.start) * l.cps));
            const done = n >= l.text.length;
            return (
              <div key={i} style={{ whiteSpace: "pre" }}>
                <span style={{ color: C.orange }}>{l.prompt} </span>
                {l.text.slice(0, n)}
                {i === cursorLine && (!done || blink) ? <span style={{ display: "inline-block", width: "0.6em", height: "1.05em", verticalAlign: "-0.18em", background: C.orange, marginLeft: 2 }} /> : null}
              </div>
            );
          }
          if (f < l.at) return null;
          const p = sp(f, l.at, SPRING.snap);
          return (
            <div key={i} style={{ whiteSpace: "pre", opacity: clamp(p * 2) * (l.kind === "dim" ? 0.55 : 0.9), transform: `translateX(${(1 - p) * -16}px)` }}>
              {l.kind === "ok" ? <span style={{ color: C.orange }}>✓ </span> : <span>  </span>}
              {l.text}
            </div>
          );
        })}
        {progress && f >= progress[0] ? (
          <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 22, opacity: 0.9 }}>
            <span style={{ opacity: 0.55 }}>render</span>
            <div style={{ flex: 1, height: 12, borderRadius: 6, background: "rgba(241,236,228,0.12)", overflow: "hidden" }}>
              <div style={{ width: `${ease.inOutSine(prog(f, progress[0], progress[1])) * 100}%`, height: "100%", background: C.orange }} />
            </div>
            <span style={{ fontVariantNumeric: "tabular-nums", width: 90, textAlign: "right" }}>{Math.round(ease.inOutSine(prog(f, progress[0], progress[1])) * 100)}%</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

/* -------------------------------- acts --------------------------------- */

/** 01 Slate: the clapper claps, then drops away and leaves its record light. */
const Slate: React.FC<{ f: number }> = ({ f }) => {
  const enter = sp(f, 4, SPRING.soft);
  const close = ease.inQuad(prog(f, 40, SLATE.clap));
  const bounce = f >= SLATE.clap ? Math.sin((f - SLATE.clap) * 0.9) * Math.exp(-(f - SLATE.clap) / 6) * 4 : 0;
  const angle = lerp(-27, 0, close) - bounce;
  const shake = f >= SLATE.clap ? Math.exp(-(f - SLATE.clap) / 5) : 0;
  const sx = noise1(f * 0.9, 3) * 14 * shake;
  const sy = noise1(f * 0.9, 7) * 10 * shake;
  const drop = ease.inCubic(prog(f, SLATE.drop, SLATE.drop + 40));
  const W = 760, H = 470, stick = 92, x0 = 960 - W / 2, y0 = 360;
  const dotK = sp(f, SLATE.dot, SPRING.pop);
  const flash = f >= SLATE.clap ? Math.exp(-(f - SLATE.clap) / 4) : 0;
  const stripes = (w: number, h: number, id: string) => (
    <>
      <defs>
        <clipPath id={id}>
          <rect width={w} height={h} rx={6} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect width={w} height={h} fill={C.paper} />
        {Array.from({ length: 12 }, (_, i) => (
          <polygon key={i} points={`${i * 80 - 40},${h} ${i * 80},0 ${i * 80 + 40},0 ${i * 80},${h}`} fill={C.ink} />
        ))}
      </g>
    </>
  );
  const row: React.CSSProperties = { ...monoLabel, fontSize: 20, color: C.ink, opacity: 0.7 };
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x0, top: y0, width: W, transform: `translate(${sx}px, ${sy + (1 - enter) * 300 + drop * 900}px) rotate(${drop * 6}deg)`, opacity: clamp(enter * 2) }}>
        {/* bottom stick (fixed) */}
        <svg width={W} height={stick} style={{ position: "absolute", top: 0 }}>{stripes(W, stick, "s1")}</svg>
        {/* top stick, hinged on the left */}
        <svg width={W} height={stick} style={{ position: "absolute", top: -stick - 6, transformOrigin: `10px ${stick + 3}px`, transform: `rotate(${angle}deg)` }}>{stripes(W, stick, "s2")}</svg>
        {/* board */}
        <div style={{ position: "absolute", top: stick + 8, width: W, height: H - stick, background: C.paper, borderRadius: 10, padding: "30px 40px", boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `3px solid ${C.ink}`, paddingBottom: 12 }}>
            <span style={row}>Prod.</span>
            <span style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: 92, lineHeight: 1, color: C.ink }}>Klaq</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginTop: 18, rowGap: 6 }}>
            {[["Scene", "01"], ["Take", "01"], ["Roll", "A"]].map(([k, v]) => (
              <div key={k}>
                <div style={row}>{k}</div>
                <div style={{ ...flex(800, 70), fontSize: 64, lineHeight: 1.05, color: C.ink }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
            <span style={row}>Director · Claude</span>
            <span style={row}>Camera · Code</span>
          </div>
        </div>
      </div>
      <AbsoluteFill style={{ background: C.paper, opacity: flash * 0.18 }} />
      {f >= SLATE.dot ? (
        <div style={{ position: "absolute", left: 960 - 26, top: 540 - 26, width: 52, height: 52, borderRadius: 26, background: C.orange, transform: `scale(${dotK * (1 + 0.08 * Math.sin((f - SLATE.dot) / 9))})`, boxShadow: `0 0 ${60 * dotK}px rgba(255,79,26,0.45)` }} />
      ) : null}
    </AbsoluteFill>
  );
};

/** 02 Prompt: one line in, the plan back. */
const Prompt: React.FC<{ f: number }> = ({ f }) => (
  <AbsoluteFill>
    <Terminal
      f={f}
      at={ACT.prompt}
      title="~/klaq — claude"
      x={260}
      y={280}
      w={1400}
      h={520}
      lines={[
        { kind: "cmd", prompt: "›", text: PROMPT.command, start: PROMPT.typeStart, cps: PROMPT.cps },
        { kind: "dim", text: "", at: PROMPT.replies[0].at },
        ...PROMPT.replies.map((r) => ({ kind: "ok" as const, text: r.text, at: r.at })),
      ]}
      progress={[566, 598]}
    />
  </AbsoluteFill>
);

/** 03 Motion: the showreel, live in a viewport. */
const Motion: React.FC<{ f: number }> = ({ f }) => {
  const k = sp(f, ACT.motion + 4, SPRING.soft);
  const cur = [...MOTION.slices].reverse().find((s) => f >= s.at) ?? MOTION.slices[0];
  const vx = 860, vy = 250, vw = 960, vh = 540;
  return (
    <AbsoluteFill>
      <Title f={f} at={ACT.motion} n="01" kicker="motion design" lines={["Motion design,", "in code."]} sub={"springs · kinetic type\nfluid · particles · 3D"} />
      <div style={{ position: "absolute", left: vx, top: vy, width: vw, height: vh, borderRadius: 18, overflow: "hidden", border: `1.5px solid ${LINE}`, boxShadow: "0 40px 120px rgba(0,0,0,0.5)", transform: `translateY(${(1 - k) * 50}px)`, opacity: clamp(k * 1.5) }}>
        <div style={{ width: 1920, height: 1080, transform: "scale(0.5)", transformOrigin: "0 0" }}>
          {MOTION.slices.map((s) => (
            <Sequence key={s.at} from={s.at} durationInFrames={s.len} layout="none">
              <AbsoluteFill>
                <Sequence from={-s.from} layout="none">
                  <Showreel muted />
                </Sequence>
              </AbsoluteFill>
            </Sequence>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", left: vx, top: vy + vh + 22, width: vw, display: "flex", justifyContent: "space-between", ...monoLabel, fontSize: 17, color: C.paper, opacity: 0.7 * clamp(k) }}>
        <span>src/compositions/showreel</span>
        <span style={{ color: C.orange }}>{cur.label}</span>
      </div>
    </AbsoluteFill>
  );
};

/** 04 Edit: the raw take loses its pauses; the vertical cut gets captions, a card and its stamp. */
const BARS = 132;
const GAPS: [number, number][] = [
  [26, 38],
  [60, 69],
  [96, 108],
];
const inGap = (i: number) => GAPS.some(([a, b]) => i >= a && i < b);
const amp = (i: number) => (inGap(i) ? 0.05 + 0.03 * Math.abs(noise1(i * 1.7, 2)) : 0.25 + 0.75 * Math.abs(noise1(i * 0.45, 5)) * (0.6 + 0.4 * Math.abs(Math.sin(i * 0.9))));

const Edit: React.FC<{ f: number }> = ({ f }) => {
  const k = sp(f, ACT.edit + 4, SPRING.soft);
  const c = ease.inOutCubic(prog(f, EDIT.collapse, EDIT.collapse + 30));
  // waveform panel
  const px = 120, py = 700, pw = 960, ph = 170;
  const step = pw / BARS;
  const kept = Array.from({ length: BARS }, (_, i) => !inGap(i));
  const keptBefore = (i: number) => kept.slice(0, i).filter(Boolean).length;
  const keptTotal = kept.filter(Boolean).length;
  // phone
  const fx = 1300, fy = 150, fw = 420, fh = 746;
  const words = EDIT.words.filter((w) => f >= w.at - 2);
  const chunkStart = words.length ? Math.floor((words.length - 1) / 3) * 3 : 0;
  const shown = words.slice(chunkStart, chunkStart + 3);
  const card = sp(f, EDIT.card, SPRING.snap);
  const stamp = clamp(sp(f, EDIT.stamp, { damping: 11, stiffness: 260, mass: 0.6 }), 0, 1.2);
  const dur = lerp(54.9, 49.2, c);
  return (
    <AbsoluteFill>
      <Title f={f} at={ACT.edit} n="02" kicker="your footage" lines={["Edits your", "raw takes."]} sub={"best take · pauses cut\ncaptions · B-roll · −14 LUFS"} top={230} />
      {/* raw take */}
      <div style={{ position: "absolute", left: px, top: py - 44, width: pw, display: "flex", justifyContent: "space-between", ...monoLabel, fontSize: 17, color: C.paper, opacity: 0.75 * clamp(k) }}>
        <span>raw take</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          0:{dur.toFixed(1)} {c > 0.02 ? <span style={{ color: C.orange }}>· {Math.round((1 - 49.2 / 54.9) * 100 * c)}% cut</span> : null}
        </span>
      </div>
      <svg width={pw} height={ph} style={{ position: "absolute", left: px, top: py, opacity: clamp(k * 1.5) }}>
        <line x1={0} x2={pw} y1={ph / 2} y2={ph / 2} stroke={LINE} />
        {Array.from({ length: BARS }, (_, i) => {
          const gap = inGap(i);
          const xBefore = i * step;
          const xAfter = (keptBefore(i) * pw) / keptTotal;
          const x = lerp(xBefore, xAfter, c);
          const w = gap ? step * (1 - c) * 0.62 : lerp(step * 0.62, (pw / keptTotal) * 0.62, c);
          const h = amp(i) * ph * 0.9 * (0.85 + 0.15 * Math.sin(f / 7 + i));
          if (w < 0.3) return null;
          return <rect key={i} x={x} y={(ph - h) / 2} width={w} height={h} rx={w / 2} fill={gap ? C.orange : C.cobalt} opacity={gap ? 0.55 * (1 - c) + 0.2 : 0.95} />;
        })}
        {GAPS.map(([a, b], j) =>
          c < 0.6 ? (
            <text key={j} x={((a + b) / 2) * step} y={ph - 6} textAnchor="middle" fill={C.orange} opacity={(1 - c / 0.6) * clamp(prog(f, ACT.edit + 40, ACT.edit + 60))} style={{ fontFamily: FONT.mono, fontSize: 15, letterSpacing: "0.12em" }}>
              PAUSE
            </text>
          ) : null,
        )}
      </svg>
      {/* the vertical cut */}
      <div style={{ position: "absolute", left: fx, top: fy, width: fw, height: fh, borderRadius: 54, background: "#000", border: `10px solid #1E1E22`, boxShadow: "0 40px 120px rgba(0,0,0,0.6)", overflow: "hidden", transform: `translateY(${(1 - k) * 80}px)`, opacity: clamp(k * 1.5) }}>
        <Sequence from={ACT.edit} durationInFrames={ACT.sound - ACT.edit} layout="none">
          <Video src={ASSET("talk.mp4")} muted loop objectFit="cover" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", filter: "contrast(1.05) saturate(0.95)" }} />
        </Sequence>
        <AbsoluteFill style={{ background: "radial-gradient(ellipse 90% 70% at 50% 40%, transparent 60%, rgba(0,0,0,0.45) 100%)" }} />
        {/* card + stamp */}
        {f >= EDIT.card - 2 ? (
          <div style={{ position: "absolute", left: 26, right: 26, top: 70, padding: "22px 24px", background: C.paper, borderRadius: 6, boxShadow: "0 14px 40px rgba(0,0,0,0.35)", transform: `translateY(${(1 - card) * -40}px) rotate(-1.2deg)`, opacity: clamp(card * 1.6) }}>
            <div style={{ ...monoLabel, fontSize: 13, color: C.ink, opacity: 0.6 }}>edit · checklist</div>
            {["best take chosen", "pauses removed", "captions synced"].map((t, i) => (
              <div key={t} style={{ fontFamily: FONT.mono, fontSize: 19, color: C.ink, marginTop: 8, opacity: clamp(prog(f, EDIT.card + 8 + i * 8, EDIT.card + 16 + i * 8)) }}>
                <span style={{ color: C.orange }}>✓</span> {t}
              </div>
            ))}
            {f >= EDIT.stamp - 2 ? (
              <div style={{ position: "absolute", right: 14, bottom: -26, transform: `rotate(-8deg) scale(${lerp(1.8, 1, clamp(stamp))})`, opacity: clamp(stamp * 2) }}>
                <div style={{ ...flex(900, 60), fontSize: 38, color: C.orange, border: `5px solid ${C.orange}`, padding: "2px 12px 0", letterSpacing: "0.04em" }}>FINAL CUT</div>
              </div>
            ) : null}
          </div>
        ) : null}
        {/* captions */}
        <div style={{ position: "absolute", left: 20, right: 20, top: 470, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "0 12px" }}>
          {shown.map((w) => {
            const p = clamp(sp(f, w.at - 1, { damping: 16, stiffness: 320, mass: 0.5 }), 0, 1.08);
            const kw = /cut|time|raw/.test(w.text);
            return (
              <span key={w.at} style={{ ...flex(850, 90), fontSize: 44, color: kw ? "#F2C14E" : "#fff", WebkitTextStroke: "8px rgba(10,10,12,0.9)", paintOrder: "stroke fill", transform: `translateY(${(1 - clamp(p)) * 10}px)`, opacity: clamp(p * 1.4) }}>
                {w.text}
              </span>
            );
          })}
        </div>
      </div>
      <div style={{ position: "absolute", left: fx, top: fy + fh + 18, width: fw, textAlign: "center", ...monoLabel, fontSize: 16, color: C.paper, opacity: 0.6 * clamp(k) }}>
        1080 × 1920 · reels
      </div>
    </AbsoluteFill>
  );
};

/** 05 Sound: the score drawn on the beat grid; the meter settles at −14 LUFS. */
const Sound: React.FC<{ f: number }> = ({ f }) => {
  const k = sp(f, ACT.sound + 4, SPRING.soft);
  const px = 860, py = 280, pw = 940, ph = 330;
  const N = 150;
  const t0 = ACT.sound, t1 = ACT.qa;
  const head = prog(f, t0 + 10, t1 - 30);
  const env = (fr: number) => {
    let e = 0.16 + 0.06 * Math.abs(noise1(fr * 0.2, 9));
    for (const h of SOUND.hits) if (fr >= h) e += 0.85 * Math.exp(-(fr - h) / 9);
    return Math.min(1, e);
  };
  const lufs = lerp(-23, -14, ease.outCubic(prog(f, SOUND.meter[0], SOUND.meter[1])));
  return (
    <AbsoluteFill>
      <Title f={f} at={ACT.sound} n="03" kicker="sound" lines={["Scores,", "synthesized", "to the frame."]} sub={"one timeline for picture and sound\nmeasured: loudness · true peak"} top={260} />
      <svg width={pw} height={ph + 60} style={{ position: "absolute", left: px, top: py, opacity: clamp(k * 1.5) }}>
        {/* beat grid */}
        {Array.from({ length: 13 }, (_, i) => {
          const x = (i / 12) * pw;
          return <line key={i} x1={x} x2={x} y1={0} y2={ph} stroke={LINE} strokeWidth={i % 4 === 0 ? 2 : 1} />;
        })}
        {Array.from({ length: N }, (_, i) => {
          const fr = lerp(t0, t1, i / N);
          const x = (i / N) * pw;
          if (i / N > head) return null;
          const h = env(fr) * ph * 0.92 * (0.75 + 0.25 * Math.abs(noise1(i * 1.3, 4)));
          return <rect key={i} x={x} y={(ph - h) / 2} width={(pw / N) * 0.6} height={h} rx={2} fill={C.cobalt} />;
        })}
        {SOUND.hits.map((h, i) => {
          const x = ((h - t0) / (t1 - t0)) * pw;
          const on = f >= h;
          return <circle key={i} cx={x} cy={ph + 30} r={on ? 7 + 5 * Math.exp(-(f - h) / 6) : 4} fill={on ? C.orange : "rgba(241,236,228,0.25)"} />;
        })}
        <line x1={head * pw} x2={head * pw} y1={-10} y2={ph + 10} stroke={C.paper} strokeWidth={2} />
      </svg>
      <div style={{ position: "absolute", left: px, top: py + ph + 110, width: pw, display: "flex", alignItems: "flex-end", justifyContent: "space-between", opacity: clamp(prog(f, SOUND.meter[0] - 20, SOUND.meter[0])) }}>
        <div>
          <div style={{ ...monoLabel, fontSize: 17, color: C.paper, opacity: 0.6 }}>integrated loudness</div>
          <div style={{ ...flex(800, 60), fontSize: 120, lineHeight: 1, color: C.paper, fontVariantNumeric: "tabular-nums" }}>
            {lufs.toFixed(1).replace("-", "−")}
            <span style={{ ...monoLabel, fontSize: 26, marginLeft: 16, color: f >= SOUND.meter[1] ? C.orange : C.paper }}>LUFS {f >= SOUND.meter[1] ? "✓" : ""}</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ ...monoLabel, fontSize: 17, color: C.paper, opacity: 0.6 }}>true peak</div>
          <div style={{ ...flex(700, 60), fontSize: 56, color: C.paper }}>−1.0 dBTP</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 06 QA: a contact sheet flips in; every frame gets its check. */
const QA_FRAMES = [30, 180, 330, 480, 560, 640, 720, 800, 890];
const QaAct: React.FC<{ f: number }> = ({ f }) => {
  const gx = 860, gy = 250, cw = 300, ch = 169, gap = 18;
  const sweep = prog(f, QA.sweep, QA.sweep + 40);
  const all = f >= QA.sweep + 40;
  return (
    <AbsoluteFill>
      <Title f={f} at={ACT.qa} n="04" kicker="quality" lines={["Every frame,", "looked at."]} sub={"stills at every cut · contact sheets\nsafe zones · loudness · ffprobe"} />
      {QA_FRAMES.map((fr, i) => {
        const at = QA.first + i * QA.step;
        const p = sp(f, at, SPRING.snap);
        const chk = sp(f, at + 10, SPRING.pop);
        const x = gx + (i % 3) * (cw + gap), y = gy + Math.floor(i / 3) * (ch + gap);
        if (f < at - 2) return null;
        return (
          <div key={fr} style={{ position: "absolute", left: x, top: y, width: cw, height: ch, borderRadius: 8, overflow: "hidden", transform: `perspective(900px) rotateX(${(1 - clamp(p)) * 70}deg)`, opacity: clamp(p * 2), border: `2px solid ${sweep * 9 > i ? C.orange : LINE}` }}>
            <Img src={ASSET(`qa/Showreel-${String(fr).padStart(4, "0")}.png`)} style={{ width: "100%", height: "100%" }} />
            <div style={{ position: "absolute", right: 10, top: 10, width: 34, height: 34, borderRadius: 17, background: C.orange, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT.mono, fontSize: 20, fontWeight: 800, transform: `scale(${chk})` }}>✓</div>
            <div style={{ position: "absolute", left: 10, bottom: 8, ...monoLabel, fontSize: 12, color: C.paper, textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>f {fr}</div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: gx, top: gy + 3 * (ch + gap) + 10, ...monoLabel, fontSize: 18, color: all ? C.orange : C.paper, opacity: clamp(prog(f, QA.first + 120, QA.first + 140)) }}>
        {all ? "9 / 9 frames approved" : "checking frames…"}
      </div>
    </AbsoluteFill>
  );
};

/** 07 Install. */
const Install: React.FC<{ f: number }> = ({ f }) => (
  <AbsoluteFill>
    <Rise f={f} at={ACT.install + 2} style={{ position: "absolute", left: 0, right: 0, top: 190, textAlign: "center", fontFamily: FONT.serif, fontStyle: "italic", fontSize: 92, color: C.paper }}>
      Install in one line.
    </Rise>
    <Terminal
      f={f}
      at={ACT.install + 6}
      title="~ — zsh"
      x={210}
      y={380}
      w={1500}
      h={380}
      lines={[
        { kind: "cmd", prompt: "$", text: INSTALL.command, start: INSTALL.typeStart, cps: INSTALL.cps },
        { kind: "ok", text: "klaq installed. Open Claude Code and type /klaq", at: INSTALL.done },
        { kind: "cmd", prompt: "›", text: "/klaq edit my recording", start: INSTALL.second, cps: 0.7 },
      ]}
    />
  </AbsoluteFill>
);

/** 08 End: the dot comes back and lands as the full stop. */
const NAME = "Klaq";
const NAME_SIZE = 330;
const INK_RIGHT = 1.633; // "Klaq" in Instrument Serif Italic, measured with fontTools
const End: React.FC<{ f: number }> = ({ f }) => {
  const R = 30, GAP = 22;
  const W = INK_RIGHT * NAME_SIZE + GAP + 2 * R;
  const X = 960 - W / 2, BASE = 560;
  const dotX = X + INK_RIGHT * NAME_SIZE + GAP + R, dotY = BASE - R;
  const appear = sp(f, END.dot, SPRING.pop);
  const fly = ease.inOutCubic(prog(f, END.hit - 6, END.land));
  const cx = lerp(960, dotX, fly);
  const cy = lerp(540, dotY, fly) - Math.sin(fly * Math.PI) * 160;
  const squash = f >= END.land ? 1 + 0.25 * Math.exp(-(f - END.land) / 5) * Math.cos((f - END.land) * 0.7) : 1;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: X, top: BASE - NAME_SIZE * 0.99, display: "flex", fontFamily: FONT.serif, fontStyle: "italic", fontSize: NAME_SIZE, lineHeight: 1.3, color: C.paper }}>
        {f >= END.hit
          ? NAME.split("").map((chr, i) => {
              const p = sp(f, END.hit + 1 + i * 2.4, SPRING.snap);
              return (
                <span key={i} style={{ display: "inline-block", clipPath: `inset(-40% -40% ${lerp(23.5, -40, clamp((p - 0.85) / 0.15))}% -40%)` }}>
                  <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 80}%) rotate(${(1 - clamp(p)) * 8}deg)` }}>{chr}</span>
                </span>
              );
            })
          : null}
      </div>
      <div style={{ position: "absolute", left: cx - R, top: cy - R, width: 2 * R, height: 2 * R, borderRadius: R, background: C.orange, transform: `scale(${appear * squash}, ${appear / squash})` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 690, textAlign: "center", fontFamily: FONT.serif, fontStyle: "italic", fontSize: 58, color: C.paper, opacity: clamp(prog(f, END.details, END.details + 20)), transform: `translateY(${(1 - ease.outCubic(prog(f, END.details, END.details + 24))) * 20}px)` }}>
        Videos from code, made by Claude.
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 800, textAlign: "center", ...monoLabel, fontSize: 22, color: C.paper, opacity: 0.75 * clamp(prog(f, END.details + 30, END.details + 50)) }}>
        open source · mit · <span style={{ color: C.orange }}>github.com/LeoTexx/klaq</span>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------ composition ---------------------------- */

export const Launch: React.FC = () => {
  const f = useCurrentFrame();
  const a = actAt(f).name;
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {a === "slate" && <Slate f={f} />}
      {a === "prompt" && <Prompt f={f} />}
      {a === "motion" && <Motion f={f} />}
      {a === "edit" && <Edit f={f} />}
      {a === "sound" && <Sound f={f} />}
      {a === "qa" && <QaAct f={f} />}
      {a === "install" && <Install f={f} />}
      {a === "end" && <End f={f} />}
      <Hud f={f} />
      <Audio src={ASSET("score.wav")} />
    </AbsoluteFill>
  );
};

export const LAUNCH_BARS = DURATION / BAR;
