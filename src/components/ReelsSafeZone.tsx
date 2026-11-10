import React from "react";
import { AbsoluteFill } from "remotion";

/**
 * QA overlay for vertical (1080×1920) social video: shades the areas the
 * Reels / TikTok / Shorts interface covers, so stills show whether text
 * sits under the platform UI. Render it only behind a debug prop.
 */
export type SafeZone = { top: number; bottom: number; right: number; rightFrom: number; rightTo: number };

/** conservative defaults covering Reels, TikTok and Shorts at 1080×1920 */
export const REELS_SAFE: SafeZone = { top: 250, bottom: 440, right: 150, rightFrom: 880, rightTo: 1700 };

export const ReelsSafeZone: React.FC<{ zone?: SafeZone }> = ({ zone = REELS_SAFE }) => {
  const shade = "rgba(255,0,90,0.22)";
  const edge = "2px dashed rgba(255,0,90,0.85)";
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: zone.top, background: shade, borderBottom: edge }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: zone.bottom, background: shade, borderTop: edge }} />
      <div
        style={{
          position: "absolute",
          right: 0,
          top: zone.rightFrom,
          width: zone.right,
          height: zone.rightTo - zone.rightFrom,
          background: shade,
          borderLeft: edge,
        }}
      />
    </AbsoluteFill>
  );
};
