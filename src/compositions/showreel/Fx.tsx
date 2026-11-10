import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { IMPACTS } from "./timeline";
import { hash, noise1 } from "../../lib/motion";

/** Camera rig: impact shake, punch-in and a chromatic split, driven by timeline IMPACTS. */
export const CameraRig: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  let sx = 0;
  let sy = 0;
  let punch = 0;
  let split = 0;
  for (const { f: t, s } of IMPACTS) {
    const d = f - t;
    if (d < 0 || d > 45) continue;
    const env = Math.exp(-d / 7) * s;
    sx += noise1(f * 0.5, t) * 18 * env;
    sy += noise1(f * 0.5, t + 91) * 14 * env;
    punch += 0.04 * s * Math.exp(-d / 5);
    split += 11 * s * Math.exp(-d / 3.2);
  }
  const useSplit = split > 0.75;
  return (
    <AbsoluteFill>
      {useSplit ? (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <filter id="rgbsplit" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
            <feOffset in="r" dx={split} dy={0} result="r2" />
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
            <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
            <feOffset in="b" dx={-split} dy={0} result="b2" />
            <feBlend in="r2" in2="g" mode="screen" result="rg" />
            <feBlend in="rg" in2="b2" mode="screen" />
          </filter>
        </svg>
      ) : null}
      <AbsoluteFill
        style={{
          transform: `translate(${sx}px, ${sy}px) scale(${1.012 + punch})`,
          filter: useSplit ? "url(#rgbsplit)" : undefined,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const GRAIN_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n' x='0' y='0'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='256' height='256' filter='url(#n)'/></svg>`;
const GRAIN_URL = `url("data:image/svg+xml;utf8,${encodeURIComponent(GRAIN_SVG)}")`;

/** Animated film grain — a noise tile jittered every frame. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.1 }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundImage: GRAIN_URL,
        backgroundSize: "256px 256px",
        backgroundPosition: `${Math.floor(hash(f * 1.7) * 256)}px ${Math.floor(hash(f * 3.1) * 256)}px`,
        opacity,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};
