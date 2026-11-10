import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700", "900"],
  subsets: ["latin"],
});

export const demoSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  backgroundColor: z.string(),
  accentColor: z.string(),
});

type DemoProps = z.infer<typeof demoSchema>;

export const Demo: React.FC<DemoProps> = ({
  title,
  subtitle,
  backgroundColor,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Title entrance
  const titleEnter = spring({
    frame,
    fps,
    config: { damping: 200 },
  });

  const titleY = interpolate(titleEnter, [0, 1], [60, 0]);

  // Subtitle entrance (delayed)
  const subtitleEnter = spring({
    frame,
    fps,
    delay: 15,
    config: { damping: 200 },
  });

  const subtitleY = interpolate(subtitleEnter, [0, 1], [30, 0]);

  // Exit animation
  const exit = spring({
    frame,
    fps,
    delay: durationInFrames - 25,
    config: { damping: 200 },
  });

  const exitScale = interpolate(exit, [0, 1], [1, 0.8]);
  const exitOpacity = interpolate(exit, [0, 1], [1, 0]);

  // Accent line width animation
  const lineWidth = interpolate(
    spring({ frame, fps, delay: 10, config: { damping: 100 } }),
    [0, 1],
    [0, 200]
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
        transform: `scale(${exitScale})`,
        opacity: exitOpacity,
      }}
    >
      {/* Title */}
      <h1
        style={{
          fontSize: 96,
          fontWeight: 900,
          color: "white",
          margin: 0,
          opacity: titleEnter,
          transform: `translateY(${titleY}px)`,
          letterSpacing: -2,
        }}
      >
        {title}
      </h1>

      {/* Accent line */}
      <div
        style={{
          width: lineWidth,
          height: 4,
          backgroundColor: accentColor,
          borderRadius: 2,
          marginTop: 20,
          marginBottom: 20,
        }}
      />

      {/* Subtitle */}
      <p
        style={{
          fontSize: 36,
          fontWeight: 400,
          color: "rgba(255,255,255,0.7)",
          margin: 0,
          opacity: subtitleEnter,
          transform: `translateY(${subtitleY}px)`,
        }}
      >
        {subtitle}
      </p>
    </AbsoluteFill>
  );
};
