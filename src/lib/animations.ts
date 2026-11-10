import { spring, interpolate, type SpringConfig } from "remotion";

/** Smooth entrance — no overshoot */
export const SPRING_SMOOTH: SpringConfig = { damping: 200, stiffness: 100, mass: 1, overshootClamping: false };

/** Snappy entrance — slight overshoot */
export const SPRING_SNAPPY: SpringConfig = { damping: 100, stiffness: 200, mass: 0.5, overshootClamping: false };

/** Bouncy entrance — playful */
export const SPRING_BOUNCY: SpringConfig = { damping: 8, stiffness: 100, mass: 0.5, overshootClamping: false };

/** Heavy entrance — slow, weighty */
export const SPRING_HEAVY: SpringConfig = { damping: 200, stiffness: 50, mass: 3, overshootClamping: false };

/** Create a fade-in + slide-up animation */
export function fadeSlideIn(
  frame: number,
  fps: number,
  delay = 0,
  config: SpringConfig = SPRING_SMOOTH,
) {
  const progress = spring({ frame, fps, delay, config });
  const y = interpolate(progress, [0, 1], [40, 0]);
  return { opacity: progress, transform: `translateY(${y}px)` };
}

/** Create a scale entrance animation */
export function scaleIn(
  frame: number,
  fps: number,
  delay = 0,
  config: SpringConfig = SPRING_SMOOTH,
) {
  const progress = spring({ frame, fps, delay, config });
  const scale = interpolate(progress, [0, 1], [0.8, 1]);
  return { opacity: progress, transform: `scale(${scale})` };
}

/** Create an enter + exit animation pair */
export function enterExit(
  frame: number,
  fps: number,
  durationInFrames: number,
  exitDuration = 20,
  config: SpringConfig = SPRING_SMOOTH,
) {
  const enter = spring({ frame, fps, config });
  const exit = spring({ frame, fps, delay: durationInFrames - exitDuration, config });
  const scale = enter - exit;
  const opacity = enter - exit;
  return { scale, opacity };
}
