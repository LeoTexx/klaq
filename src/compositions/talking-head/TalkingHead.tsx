/**
 * TalkingHead — edits a cut talking-head recording into a 1080×1920 social video.
 *
 * Four layouts (types.ts `Mode`), animated between on a spring:
 *   window: camera in a rounded window in the lower half, an animated graphic above it
 *   full:   camera fills the frame (use on the highest-impact sentences)
 *   yap:    camera fills the frame with the head framed lower; one graphic at a time pops up in the
 *           free space above or beside the head, never over it (the "yap" format)
 *   split:  screen + face: a screen recording (or a graphic) on top, the whole head below
 * Word-by-word captions with keywords in colour, alternating punch-in on every jump cut,
 * discreet SFX on layout changes and graphic entrances. Everything comes from an EditPlan.
 *
 * Every layout is a "pose" (camera rect, where the video sits inside it, graphic and screen weights,
 * caption height); a layout change blends the previous pose into the next one.
 */
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio, Video } from "@remotion/media";
import { clamp, ease, lerp, prog, sp } from "../../lib/motion";
import { renderGraphic } from "./graphics";
import type { EditPlan, Graphic, HeadBox, Mode, Screen, Theme, Word } from "./types";

export const W = 1080;
export const H = 1920;
const WINDOW = { x: 60, y: 960, w: 960, h: 860, r: 44 };
const FULLR = { x: 0, y: 0, w: W, h: H, r: 0 };
const GRAPHIC_BOX = { x: 70, y: 290, w: 940, h: 610 };
const CAPTION_Y = { window: 960, full: 1150 };
const LAYOUT_SPRING = { damping: 20, stiffness: 150, mass: 0.9 };

/** yap: head height and head top on the output frame; graphics keep CLEAR px away from the head */
const YAP = { headH: 380, headTop: 700, clear: 70 };
/** split: screen panel on top, head region below; captions sit on the seam */
const SPLIT_Y = 1010;
const SCREEN = { x: 36, y: 200, w: 1008, h: 780, r: 30 };
const SPLITCAM = { x: 0, y: SPLIT_Y, w: W, h: H - SPLIT_Y, r: 0 };
const SPLIT_HEAD = { h: 400, top: 60 };
/** critical content stays inside the paid-placement safe area */
const SAFE = { top: 250, bottom: 1248, left: 60, right: 930 };
/** built-in graphics are designed 940 px wide and scaled to fit the space they get */
const DESIGN = { w: GRAPHIC_BOX.w, h: GRAPHIC_BOX.h };
/** content height of a built-in graphic at design size (estimate, with margin), so yap can scale it as large as the space allows */
function designH(g: Graphic): number {
  const lines = (s: string, perLine: number) => Math.max(1, Math.ceil(s.length / perLine));
  const h = (() => {
    switch (g.kind) {
      case "headline": return 44 + lines(g.text, 15) * 108 + (g.sub ? 28 + lines(g.sub, 34) * 56 : 0);
      case "step": return 130 + lines(g.text, 18) * 90;
      case "stat": return 300;
      case "list": return 90 + (g.title ? 90 : 0) + g.items.length * 84;
      case "compare": return 330;
      default: return DESIGN.h;
    }
  })();
  return Math.min(DESIGN.h, Math.round(h * 1.15));
}

const KIT = (name: string) => staticFile(`sfx/${name}.wav`);
const clean = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

/* ------------------------------- layout -------------------------------- */

/** previous and current layout, and k (0→1) the spring between them */
function layoutAt(plan: EditPlan, f: number, fps: number) {
  const L = plan.layout;
  let i = 0;
  for (let k = 0; k < L.length; k++) if (L[k].at * fps <= f) i = k;
  const cur: Mode = L[i]?.mode ?? "window";
  const prev: Mode = i > 0 ? L[i - 1].mode : cur;
  const k = i > 0 ? clamp(sp(f, Math.round(L[i].at * fps), LAYOUT_SPRING, fps), 0, 1.03) : 1;
  return { prev, cur, k, since: (L[i]?.at ?? 0) * fps };
}

const modeAt = (plan: EditPlan, t: number): Mode => {
  let m: Mode = plan.layout[0]?.mode ?? "window";
  for (const l of plan.layout) if (l.at <= t + 1e-6) m = l.mode;
  return m;
};

/* -------------------------------- head --------------------------------- */

/** the take's framing box (still inside a take, moves on the cut); falls back to plan.face */
function takeBox(plan: EditPlan, t: number): HeadBox {
  const seg = plan.head?.segments.find((s) => t >= s.from - 1e-3 && t < s.to + 1e-3);
  if (seg) return seg.box;
  const f = plan.face ?? { x: 0.5, y: 0.38 };
  return [f.x - 0.08, f.y - 0.17, 0.16, 0.3];
}

/** the head where it actually is at t (smoothed samples), for clearance */
function liveBox(plan: EditPlan, t: number): HeadBox {
  const h = plan.head;
  if (!h) return takeBox(plan, t);
  return h.boxes[Math.min(h.boxes.length - 1, Math.max(0, Math.round(t * h.rate)))] ?? takeBox(plan, t);
}

/* -------------------------------- poses -------------------------------- */

type Pose = {
  /** camera rect on the output frame */
  x: number; y: number; w: number; h: number; r: number;
  /** video inside the camera rect */
  vx: number; vy: number; vw: number; vh: number;
  /** weights 0..1 */
  win: number; yap: number; split: number;
  captionY: number;
};

function pose(mode: Mode, plan: EditPlan, t: number, push: number): Pose {
  const { width: SW, height: SH } = plan.cuts;
  const seg = plan.cuts.cuts.filter((c) => c <= t + 1e-3).length;
  const punch = plan.punchIn === false ? 0 : seg % 2 ? 0.08 : 0;
  const hb = takeBox(plan, t);
  const hcx = hb[0] + hb[2] / 2;
  const base = { win: 0, yap: 0, split: 0 };

  if (mode === "yap") {
    // head a set size and lower in the frame, so the space above it is free; any gap is filled by a blurred copy
    const r = FULLR;
    const scale = (YAP.headH / (hb[3] * SH)) * (1 + punch);
    const vw = SW * scale, vh = SH * scale;
    const vx = clamp(r.w / 2 - hcx * vw, r.w - vw, 0);
    const vy = YAP.headTop - hb[1] * vh;
    const chin = vy + (hb[1] + hb[3]) * vh;
    return { ...r, vx, vy, vw, vh, ...base, yap: 1, captionY: clamp(chin + 95, 1000, 1200) };
  }
  if (mode === "split") {
    // the whole head in the lower region, never cut at the crown or chin
    const r = SPLITCAM;
    const scale = Math.max(r.w / SW, r.h / SH, SPLIT_HEAD.h / (hb[3] * SH)) * (1 + punch * 0.5);
    const vw = SW * scale, vh = SH * scale;
    const vx = clamp(r.w / 2 - hcx * vw, r.w - vw, 0);
    const vy = clamp(SPLIT_HEAD.top - hb[1] * vh, r.h - vh, 0);
    return { ...r, vx, vy, vw, vh, ...base, split: 1, captionY: SPLIT_Y };
  }
  const r = mode === "full" ? FULLR : WINDOW;
  const fy = hb[1] + hb[3] * 0.55; // eyes, roughly
  const scale = Math.max(r.w / SW, r.h / SH) * (1 + punch + (mode === "full" ? push : 0));
  const vw = SW * scale, vh = SH * scale;
  const vx = clamp(r.w / 2 - hcx * vw, r.w - vw, 0);
  const vy = clamp(r.h * 0.42 - fy * vh, r.h - vh, 0);
  return { ...r, vx, vy, vw, vh, ...base, win: mode === "window" ? 1 : 0, captionY: mode === "full" ? CAPTION_Y.full : CAPTION_Y.window };
}

const blend = (a: Pose, b: Pose, k: number): Pose => {
  const o = {} as Pose;
  for (const key of Object.keys(a) as (keyof Pose)[]) o[key] = lerp(a[key], b[key], key === "r" ? clamp(k) : k);
  return o;
};

/* ---------------------------- yap placement ---------------------------- */

type Zone = { x: number; y: number; w: number; h: number; s: number };

/** the head's extent over [from, to] on the output frame, in yap framing (measured along the take, the head moves) */
function headExtent(plan: EditPlan, from: number, to: number) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let t = from; t <= to; t += 0.25) {
    const p = pose("yap", plan, t, 0);
    const b = liveBox(plan, t);
    x0 = Math.min(x0, p.x + p.vx + b[0] * p.vw);
    y0 = Math.min(y0, p.y + p.vy + b[1] * p.vh);
    x1 = Math.max(x1, p.x + p.vx + (b[0] + b[2]) * p.vw);
    y1 = Math.max(y1, p.y + p.vy + (b[1] + b[3]) * p.vh);
  }
  return { x0, y0, x1, y1 };
}

/** the free space above or beside the head with the most room for a DESIGN-shaped graphic */
function placeYap(plan: EditPlan, g: Graphic): Zone {
  const e = headExtent(plan, g.from, g.to);
  const c = YAP.clear;
  const zones = [
    { x: SAFE.left, y: SAFE.top, w: SAFE.right + 90 - SAFE.left, h: e.y0 - c - SAFE.top }, // above (full width, the right column only matters low down)
    { x: SAFE.left, y: SAFE.top, w: e.x0 - c - SAFE.left, h: SAFE.bottom - SAFE.top }, // left of the head
    { x: e.x1 + c, y: SAFE.top + 200, w: SAFE.right - (e.x1 + c), h: SAFE.bottom - SAFE.top - 200 }, // right, below the top UI
  ].map((z) => ({ ...z, s: Math.min(1, z.w / DESIGN.w, z.h / designH(g)) }));
  return zones.reduce((a, b) => (b.s > a.s ? b : a));
}

/* ------------------------------- captions ------------------------------ */

type Chunk = { words: Word[]; from: number; to: number };
function chunk(words: Word[], max = 3): Chunk[] {
  const out: Chunk[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) out.push({ words: cur, from: cur[0].start, to: cur[cur.length - 1].end });
    cur = [];
  };
  words.forEach((w, i) => {
    if (cur.length && (cur.length >= max || w.sentence !== cur[0].sentence || w.start - cur[cur.length - 1].end > 0.35)) flush();
    cur.push(w);
    if (/[.!?,:;…]$/.test(w.text) || i === words.length - 1) flush();
  });
  return out.map((c, i) => ({ ...c, to: i < out.length - 1 ? Math.min(out[i + 1].from, c.to + 0.4) : c.to + 0.5 }));
}

const Captions: React.FC<{ f: number; fps: number; words: Word[]; keywords: Set<string>; theme: Theme; y: number }> = ({ f, fps, words, keywords, theme, y }) => {
  const chunks = React.useMemo(() => chunk(words), [words]);
  const t = f / fps;
  const c = chunks.find((k) => t >= k.from - 0.03 && t < k.to);
  if (!c) return null;
  const out = 1 - ease.inCubic(prog(t, c.to - 0.08, c.to));
  return (
    <div style={{ position: "absolute", left: 70, right: 70, top: y, transform: "translateY(-50%)", display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "0 22px", opacity: out }}>
      {c.words.map((w, i) => {
        const at = Math.round(w.start * fps) - 1;
        if (f < at) return <span key={i} style={{ visibility: "hidden", fontSize: 84 }}>{w.text}</span>;
        const s = clamp(sp(f, at, { damping: 13, stiffness: 340, mass: 0.5 }, fps), 0, 1.15);
        const kw = keywords.has(clean(w.text));
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              fontFamily: theme.font,
              fontWeight: 900,
              fontSize: 84,
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
              color: kw ? theme.keyword : theme.caption,
              WebkitTextStroke: "14px rgba(0,0,0,0.88)",
              paintOrder: "stroke fill",
              textShadow: "0 8px 24px rgba(0,0,0,0.35)",
              transform: `scale(${(kw ? 1.08 : 1) * (0.7 + 0.3 * s)}) translateY(${(1 - clamp(s)) * 18}px)`,
            }}
          >
            {w.text.replace(/[,;:]$/, "")}
          </span>
        );
      })}
    </div>
  );
};

/* -------------------------------- camera ------------------------------- */

const Camera: React.FC<{ plan: EditPlan; p: Pose }> = ({ plan, p }) => {
  const src = staticFile(plan.footage);
  // yap may leave a band above or below the video: a blurred copy fills it and the sharp video feathers into it
  const gap = p.vy > 1 || p.vy + p.vh < p.h - 1;
  const feather = 140 * clamp(p.yap);
  const mask = gap && feather > 1 ? `linear-gradient(to bottom, transparent 0px, black ${feather}px, black calc(100% - ${feather}px), transparent 100%)` : undefined;
  return (
    <div
      style={{
        position: "absolute",
        left: p.x,
        top: p.y,
        width: p.w,
        height: p.h,
        borderRadius: p.r,
        overflow: "hidden",
        boxShadow: p.win > 0.02 ? `0 30px 80px rgba(0,0,0,${0.35 * p.win})` : undefined,
        background: "#000",
      }}
    >
      {gap && (
        <Video
          src={src}
          muted
          objectFit="cover"
          style={{ position: "absolute", left: -60, top: -60, width: p.w + 120, height: p.h + 120, filter: "blur(46px) brightness(0.62) saturate(1.2)" }}
        />
      )}
      <Video
        src={src}
        objectFit="fill"
        style={{ position: "absolute", left: p.vx, top: p.vy, width: p.vw, height: p.vh, WebkitMaskImage: mask, maskImage: mask }}
      />
    </div>
  );
};

/* -------------------------------- screen ------------------------------- */

const URL_BAR = 74;

const ScreenPanel: React.FC<{ plan: EditPlan; screen?: Screen; f: number; fps: number; w: number; children?: React.ReactNode }> = ({ plan, screen, f, fps, w, children }) => {
  if (w < 0.01) return null;
  const s = screen;
  const hasBar = !!s?.url;
  const zoom = s?.zoom ?? 1;
  const focus = s?.focus ?? { x: 0.5, y: 0.5 };
  return (
    <div
      style={{
        position: "absolute",
        left: SCREEN.x,
        top: SCREEN.y,
        width: SCREEN.w,
        height: SCREEN.h,
        borderRadius: SCREEN.r,
        overflow: "hidden",
        background: s ? "#0B0D12" : "transparent",
        boxShadow: s ? "0 30px 80px rgba(0,0,0,0.35)" : undefined,
        opacity: clamp(w * 1.4 - 0.2),
        transform: `translateY(${(1 - w) * -60}px) scale(${0.94 + 0.06 * w})`,
        display: s ? undefined : "flex",
        alignItems: "center",
      }}
    >
      {s && hasBar && (
        <div style={{ height: URL_BAR, display: "flex", alignItems: "center", gap: 16, padding: "0 22px", background: "#1A1D24" }}>
          <div style={{ display: "flex", gap: 9 }}>
            {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
              <div key={c} style={{ width: 16, height: 16, borderRadius: 8, background: c }} />
            ))}
          </div>
          <div style={{ flex: 1, height: 46, borderRadius: 23, background: "#2A2E37", display: "flex", alignItems: "center", padding: "0 22px", gap: 12, overflow: "hidden" }}>
            <svg width={20} height={22} viewBox="0 0 20 22">
              <rect x={2} y={9} width={16} height={12} rx={3} fill="#9AA3B2" />
              <path d="M6 9V6a4 4 0 0 1 8 0v3" fill="none" stroke="#9AA3B2" strokeWidth={2.4} />
            </svg>
            <span style={{ fontFamily: plan.theme.font, fontSize: 28, fontWeight: 600, color: "#E8EAEE", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.url}</span>
          </div>
        </div>
      )}
      {s && (
        <div style={{ position: "absolute", left: 0, right: 0, top: hasBar ? URL_BAR : 0, bottom: 0, overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})`, transformOrigin: `${focus.x * 100}% ${focus.y * 100}%` }}>
            <Sequence from={Math.round(s.from * fps)} durationInFrames={Math.max(1, Math.round((s.to - s.from) * fps))} layout="none">
              <Video
                src={staticFile(s.src)}
                muted
                trimBefore={Math.round((s.start ?? 0) * fps)}
                playbackRate={s.rate ?? 1}
                objectFit={s.fit ?? "contain"}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              />
            </Sequence>
          </div>
        </div>
      )}
      {!s && children}
    </div>
  );
};

/* ------------------------------ background ----------------------------- */

const Backdrop: React.FC<{ theme: Theme; f: number; fps: number }> = ({ theme, f, fps }) => {
  const t = f / fps;
  return (
    <AbsoluteFill style={{ background: theme.bg, overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 900, height: 900, borderRadius: "50%", left: -260 + Math.sin(t * 0.35) * 60, top: 80 + Math.cos(t * 0.3) * 50, background: theme.accent, opacity: 0.16, filter: "blur(140px)" }} />
      <div style={{ position: "absolute", width: 800, height: 800, borderRadius: "50%", right: -300 + Math.cos(t * 0.4) * 60, top: 520 + Math.sin(t * 0.33) * 60, background: theme.accent2 ?? theme.keyword, opacity: 0.14, filter: "blur(140px)" }} />
    </AbsoluteFill>
  );
};

const SafeZones: React.FC<{ head?: { x0: number; y0: number; x1: number; y1: number } }> = ({ head }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 250, background: "rgba(255,0,0,0.18)" }} />
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 672, background: "rgba(255,0,0,0.18)" }} />
    <div style={{ position: "absolute", right: 0, width: 150, top: 880, height: 820, background: "rgba(255,0,0,0.18)" }} />
    {head && (
      <div style={{ position: "absolute", left: head.x0 - YAP.clear, top: head.y0 - YAP.clear, width: head.x1 - head.x0 + 2 * YAP.clear, height: head.y1 - head.y0 + 2 * YAP.clear, border: "4px dashed rgba(255,220,0,0.9)" }} />
    )}
  </AbsoluteFill>
);

/* ------------------------------ composition ---------------------------- */

const span = (g: Graphic, f: number, fps: number) => {
  const from = Math.round(g.from * fps);
  return { from, dur: Math.round(g.to * fps) - from, f: f - from };
};

export const TalkingHead: React.FC<{ plan: EditPlan }> = ({ plan }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const { prev, cur, k, since } = layoutAt(plan, f, fps);
  const push = 0.04 * ease.inOutSine(prog(f, since, since + fps * 4));
  const p = blend(pose(prev, plan, t, 0), pose(cur, plan, t, push), k);
  const keywords = React.useMemo(() => new Set(plan.keywords.map(clean)), [plan.keywords]);
  const active = plan.graphics.filter((g) => t >= g.from && t < g.to);
  // yap shows one element at a time: the latest to enter
  const yapG = active.length ? active.reduce((a, b) => (b.from > a.from ? b : a)) : undefined;
  const zones = React.useMemo(() => new Map(plan.graphics.filter((g) => modeAt(plan, g.from) === "yap").map((g) => [g, placeYap(plan, g)])), [plan]);
  const screen = plan.screens?.find((s) => t >= s.from && t < s.to);
  const yapTheme = React.useMemo<Theme>(() => ({ ...plan.theme, ink: plan.theme.caption, card: "rgba(12,14,22,0.78)" }), [plan.theme]);
  const sfx = plan.sfx !== false;
  const vol = plan.sfxVolume ?? 1;
  const zone = yapG ? zones.get(yapG) : undefined;

  return (
    <AbsoluteFill>
      <Backdrop theme={plan.theme} f={f} fps={fps} />
      {/* window: graphics above the camera window, fading as the camera takes over */}
      <div style={{ position: "absolute", left: GRAPHIC_BOX.x, top: GRAPHIC_BOX.y, width: GRAPHIC_BOX.w, height: GRAPHIC_BOX.h, display: "flex", alignItems: "center", opacity: clamp((p.win - 0.375) / 0.625) }}>
        {p.win > 0.01 && active.map((g, i) => <React.Fragment key={i}>{renderGraphic(g, { ...span(g, f, fps), fps, theme: plan.theme, w: GRAPHIC_BOX.w, h: GRAPHIC_BOX.h })}</React.Fragment>)}
      </div>
      <Camera plan={plan} p={p} />
      {/* split: the screen recording on top; with no recording in this span, the graphic takes the panel */}
      <ScreenPanel plan={plan} screen={screen} f={f} fps={fps} w={p.split}>
        {active.map((g, i) => (
          <div key={i} style={{ width: SCREEN.w, display: "flex", justifyContent: "center" }}>
            {renderGraphic(g, { ...span(g, f, fps), fps, theme: plan.theme, w: SCREEN.w - 68, h: SCREEN.h })}
          </div>
        ))}
      </ScreenPanel>
      {/* yap: one graphic at a time in the free space around the head, light ink and a shadow over the video */}
      {yapG && zone && p.yap > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: zone.x + (zone.w - DESIGN.w * zone.s) / 2,
            top: zone.y + (zone.h - designH(yapG) * zone.s) / 2,
            width: DESIGN.w,
            height: designH(yapG),
            transform: `scale(${zone.s})`,
            transformOrigin: "0 0",
            display: "flex",
            alignItems: "center",
            opacity: clamp((p.yap - 0.375) / 0.625),
            filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.55))",
          }}
        >
          {renderGraphic(yapG, { ...span(yapG, f, fps), fps, theme: yapTheme, w: DESIGN.w, h: designH(yapG) })}
        </div>
      )}
      <Captions f={f} fps={fps} words={plan.cuts.words} keywords={keywords} theme={plan.theme} y={p.captionY} />
      {sfx &&
        plan.layout.slice(1).map((l, i) => (
          <Sequence key={`l${i}`} from={Math.max(0, Math.round(l.at * fps) - 6)} durationInFrames={fps} layout="none">
            <Audio src={KIT(l.mode === "full" || l.mode === "yap" ? "whoosh-in" : "whoosh-out")} volume={vol} />
          </Sequence>
        ))}
      {sfx &&
        plan.graphics.map((g, i) => (
          <Sequence key={`g${i}`} from={Math.round(g.from * fps)} durationInFrames={fps} layout="none">
            <Audio src={KIT("pop")} volume={vol * 0.8} />
          </Sequence>
        ))}
      {plan.qa && <SafeZones head={p.yap > 0.5 ? headExtent(plan, t, t) : undefined} />}
    </AbsoluteFill>
  );
};

/** Seconds where sentence k (0-based) is spoken on the output timeline. */
export const sentence = (plan: Pick<EditPlan, "cuts">, k: number) => {
  const s = plan.cuts.sentences[k];
  if (!s) throw new Error(`No sentence ${k} in cuts.json (${plan.cuts.sentences.length} sentences)`);
  return { from: s.start, to: s.end };
};
