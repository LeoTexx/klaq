import React from "react";
import { spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SPRING_SMOOTH } from "../lib/animations";

interface AnimatedTextProps {
  text: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  fontFamily?: string;
  delay?: number;
  staggerPerWord?: number;
  style?: React.CSSProperties;
}

/**
 * Renders text with word-by-word staggered entrance animation.
 * Each word fades in and slides up independently.
 */
export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  fontSize = 48,
  fontWeight = 700,
  color = "white",
  fontFamily,
  delay = 0,
  staggerPerWord = 3,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.3em",
        justifyContent: "center",
        ...style,
      }}
    >
      {words.map((word, i) => {
        const wordDelay = delay + i * staggerPerWord;
        const enter = spring({
          frame,
          fps,
          delay: wordDelay,
          config: SPRING_SMOOTH,
        });
        const y = interpolate(enter, [0, 1], [20, 0]);

        return (
          <span
            key={`${word}-${i}`}
            style={{
              fontSize,
              fontWeight,
              color,
              fontFamily,
              opacity: enter,
              transform: `translateY(${y}px)`,
              display: "inline-block",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
