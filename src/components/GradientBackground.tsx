import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

interface GradientBackgroundProps {
  colors: [string, string];
  angle?: number;
  animated?: boolean;
  children?: React.ReactNode;
}

/**
 * Full-screen gradient background.
 * Optionally animates the gradient angle for a subtle motion effect.
 */
export const GradientBackground: React.FC<GradientBackgroundProps> = ({
  colors,
  angle = 135,
  animated = false,
  children,
}) => {
  const frame = useCurrentFrame();
  const currentAngle = animated
    ? angle + interpolate(frame, [0, 600], [0, 360])
    : angle;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${currentAngle}deg, ${colors[0]}, ${colors[1]})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
