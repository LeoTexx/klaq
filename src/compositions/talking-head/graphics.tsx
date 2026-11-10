/**
 * Built-in animated graphics for the area above the camera window.
 * Each one enters on a spring, settles, and leaves in the last 8 frames. All motion is frame-driven.
 */
import React from "react";
import { interpolate } from "remotion";
import { clamp, ease, prog, sp, SPRING } from "../../lib/motion";
import type { Graphic, GraphicProps, Theme } from "./types";

const exitOf = (f: number, dur: number) => 1 - ease.inCubic(prog(f, dur - 8, dur));

const Card: React.FC<{ theme: Theme; children: React.ReactNode; style?: React.CSSProperties }> = ({ theme, children, style }) => (
  <div
    style={{
      background: theme.card,
      borderRadius: 36,
      padding: "44px 52px",
      boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
      ...style,
    }}
  >
    {children}
  </div>
);

/** words rise in one after another */
const Rise: React.FC<{ text: string; f: number; fps: number; delay?: number; stagger?: number; style: React.CSSProperties; hi?: string; hiColor?: string }> = ({
  text,
  f,
  fps,
  delay = 0,
  stagger = 3,
  style,
  hi,
  hiColor,
}) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: "0 0.26em", ...style }}>
    {text.split(" ").map((w, i) => {
      const s = clamp(sp(f, delay + i * stagger, SPRING.snap, fps), 0, 1.2);
      const isHi = hi && w.toLowerCase().replace(/[^\p{L}\d]/gu, "") === hi.toLowerCase();
      return (
        <span key={i} style={{ display: "inline-block", opacity: clamp(s * 1.4), transform: `translateY(${(1 - s) * 40}px)`, color: isHi ? hiColor : undefined }}>
          {w}
        </span>
      );
    })}
  </div>
);

export const Headline: React.FC<GraphicProps & { text: string; sub?: string }> = ({ f, fps, dur, theme, w, text, sub }) => {
  const out = exitOf(f, dur);
  const bar = sp(f, 2, SPRING.soft, fps);
  // the last word carries the accent unless it is very short
  const words = text.split(" ");
  const hi = words.length > 1 ? words[words.length - 1] : undefined;
  return (
    <div style={{ width: w, opacity: out, transform: `translateY(${(1 - out) * -30}px)` }}>
      <div style={{ width: 120 * bar, height: 12, borderRadius: 6, background: theme.accent, marginBottom: 32 }} />
      <Rise text={text} f={f} fps={fps} hi={hi?.replace(/[^\p{L}\d]/gu, "")} hiColor={theme.accent} style={{ fontFamily: theme.font, fontWeight: theme.weight ?? 800, fontSize: 104, lineHeight: 1.02, letterSpacing: "-0.03em", color: theme.ink }} />
      {sub && <Rise text={sub} f={f} fps={fps} delay={10} stagger={2} style={{ marginTop: 28, fontFamily: theme.font, fontWeight: 500, fontSize: 46, color: theme.ink, opacity: 0.72 }} />}
    </div>
  );
};

export const Step: React.FC<GraphicProps & { n: number; text: string; total?: number }> = ({ f, fps, dur, theme, w, n, text, total }) => {
  const out = exitOf(f, dur);
  const pop = sp(f, 0, SPRING.pop, fps);
  const colors = [theme.accent, theme.accent2 ?? theme.accent];
  return (
    <div style={{ width: w, opacity: out, display: "flex", flexDirection: "column", gap: 36 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <div
          style={{
            width: 150,
            height: 150,
            borderRadius: 44,
            background: colors[(n - 1) % 2],
            color: theme.bg,
            fontFamily: theme.font,
            fontWeight: 900,
            fontSize: 96,
            display: "grid",
            placeItems: "center",
            transform: `scale(${pop}) rotate(${(1 - clamp(pop)) * -14}deg)`,
          }}
        >
          {n}
        </div>
        {total && (
          <div style={{ display: "flex", gap: 12 }}>
            {Array.from({ length: total }, (_, i) => (
              <div key={i} style={{ width: i + 1 === n ? 56 : 18, height: 18, borderRadius: 9, background: i < n ? theme.accent : theme.ink, opacity: i < n ? 1 : 0.18 }} />
            ))}
          </div>
        )}
      </div>
      <Rise text={text} f={f} fps={fps} delay={6} style={{ fontFamily: theme.font, fontWeight: theme.weight ?? 800, fontSize: 84, lineHeight: 1.05, letterSpacing: "-0.02em", color: theme.ink }} />
    </div>
  );
};

export const Stat: React.FC<GraphicProps & { value: number; prefix?: string; suffix?: string; label: string; decimals?: number }> = ({
  f,
  fps,
  dur,
  theme,
  w,
  value,
  prefix = "",
  suffix = "",
  label,
  decimals = 0,
}) => {
  const out = exitOf(f, dur);
  const count = ease.outExpo(prog(f, 2, 2 + Math.round(fps * 0.9)));
  const v = (value * count).toFixed(decimals);
  const ring = interpolate(count, [0, 1], [0, 1]);
  return (
    <Card theme={theme} style={{ width: w, opacity: out, display: "flex", alignItems: "center", gap: 44 }}>
      <svg width={170} height={170} viewBox="0 0 100 100" style={{ flex: "none" }}>
        <circle cx={50} cy={50} r={42} fill="none" stroke={theme.ink} strokeOpacity={0.12} strokeWidth={12} />
        <circle cx={50} cy={50} r={42} fill="none" stroke={theme.accent} strokeWidth={12} strokeLinecap="round" strokeDasharray={`${ring * 264} 264`} transform="rotate(-90 50 50)" />
      </svg>
      <div>
        <div style={{ fontFamily: theme.font, fontWeight: 900, fontSize: 132, lineHeight: 1, letterSpacing: "-0.04em", color: theme.ink, fontVariantNumeric: "tabular-nums" }}>
          {prefix}
          {v}
          <span style={{ color: theme.accent }}>{suffix}</span>
        </div>
        <Rise text={label} f={f} fps={fps} delay={8} stagger={2} style={{ marginTop: 10, fontFamily: theme.font, fontWeight: 600, fontSize: 42, color: theme.ink, opacity: 0.75 }} />
      </div>
    </Card>
  );
};

export const List: React.FC<GraphicProps & { title?: string; items: string[] }> = ({ f, fps, dur, theme, w, title, items }) => {
  const out = exitOf(f, dur);
  // spread item entrances across the first 60% of the graphic so they land roughly as they are said
  const gap = Math.max(4, Math.floor((dur * 0.6) / Math.max(1, items.length)));
  return (
    <Card theme={theme} style={{ width: w, opacity: out }}>
      {title && <Rise text={title} f={f} fps={fps} style={{ fontFamily: theme.font, fontWeight: 800, fontSize: 60, color: theme.ink, marginBottom: 26 }} />}
      {items.map((it, i) => {
        const s = clamp(sp(f, 4 + i * gap, SPRING.snap, fps), 0, 1.15);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 24, margin: "14px 0", opacity: clamp(s * 1.5), transform: `translateX(${(1 - s) * -50}px)` }}>
            <svg width={52} height={52} viewBox="0 0 24 24">
              <circle cx={12} cy={12} r={11} fill={i % 2 && theme.accent2 ? theme.accent2 : theme.accent} />
              <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke={theme.card} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={20} strokeDashoffset={20 * (1 - clamp(s))} />
            </svg>
            <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: 52, color: theme.ink }}>{it}</div>
          </div>
        );
      })}
    </Card>
  );
};

export const Compare: React.FC<GraphicProps & { left: { label: string; value: string }; right: { label: string; value: string } }> = ({ f, fps, dur, theme, w, left, right }) => {
  const out = exitOf(f, dur);
  const side = (d: { label: string; value: string }, i: number) => {
    const s = clamp(sp(f, i * 8, SPRING.pop, fps), 0, 1.2);
    const good = i === 1;
    return (
      <Card theme={theme} style={{ flex: 1, padding: "40px 36px", transform: `translateY(${(1 - s) * 60}px) scale(${0.9 + 0.1 * clamp(s)})`, opacity: clamp(s * 1.5), outline: good ? `6px solid ${theme.accent}` : undefined }}>
        <div style={{ fontFamily: theme.font, fontWeight: 600, fontSize: 40, color: theme.ink, opacity: 0.7 }}>{d.label}</div>
        <div style={{ fontFamily: theme.font, fontWeight: 900, fontSize: 96, letterSpacing: "-0.03em", color: good ? theme.accent : theme.ink, marginTop: 8 }}>{d.value}</div>
      </Card>
    );
  };
  return <div style={{ width: w, opacity: out, display: "flex", gap: 28 }}>{[side(left, 0), side(right, 1)]}</div>;
};

export const renderGraphic = (g: Graphic, p: GraphicProps) => {
  switch (g.kind) {
    case "headline":
      return <Headline {...p} text={g.text} sub={g.sub} />;
    case "step":
      return <Step {...p} n={g.n} text={g.text} total={g.total} />;
    case "stat":
      return <Stat {...p} value={g.value} prefix={g.prefix} suffix={g.suffix} label={g.label} decimals={g.decimals} />;
    case "list":
      return <List {...p} title={g.title} items={g.items} />;
    case "compare":
      return <Compare {...p} left={g.left} right={g.right} />;
    case "custom":
      return <g.render {...p} />;
  }
};
