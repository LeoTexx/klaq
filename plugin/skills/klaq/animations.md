# Animation Patterns

> Remotion animation reference. All animations are frame-driven — no CSS transitions.

## Core Hooks

```tsx
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";

const frame = useCurrentFrame();                    // Current frame number (0-based)
const { fps, durationInFrames, width, height } = useVideoConfig();  // Composition config
```

---

## interpolate()

Maps a value from one range to another. The workhorse of Remotion animation.

```tsx
// Basic: fade in over first 30 frames
const opacity = interpolate(frame, [0, 30], [0, 1], {
  extrapolateRight: "clamp",   // Don't go above 1
  extrapolateLeft: "clamp",    // Don't go below 0
});

// With easing
const progress = interpolate(frame, [0, 60], [0, 1], {
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  extrapolateRight: "clamp",
});

// Multi-keyframe (chain input ranges)
const x = interpolate(frame, [0, 30, 60, 90], [0, 200, 200, 0], {
  extrapolateRight: "clamp",
});
```

### Easing Functions

```tsx
import { Easing } from "remotion";

Easing.linear              // No easing
Easing.ease                // Default CSS ease
Easing.in(Easing.quad)     // Accelerate (quadratic)
Easing.out(Easing.quad)    // Decelerate
Easing.inOut(Easing.quad)  // Both
Easing.bezier(x1, y1, x2, y2)  // Custom cubic bezier
Easing.bounce              // Bounce at end
Easing.elastic(1)          // Elastic overshoot
```

---

## interpolateColors()

Animates between colors. Accepts hex, named, rgb/rgba, hsl/hsla, oklch, oklab, lab, lch, hwb.

```tsx
import { interpolateColors, useCurrentFrame } from "remotion";

const frame = useCurrentFrame();
const color = interpolateColors(frame, [0, 30], ["#ff0000", "#0000ff"]);
// Returns rgba() string — use directly in style props

// Multi-step color animation
const bg = interpolateColors(frame, [0, 30, 60], ["#1a1a2e", "#e94560", "#0f3460"]);

// Works with all CSS color formats
const c = interpolateColors(frame, [0, 30], ["oklch(0.5 0.2 240)", "hsl(120, 80%, 50%)"]);
```

---

## spring()

Physics-based animation. Returns 0→1 with natural motion.

```tsx
// Smooth entrance (no bounce)
const enter = spring({
  frame,
  fps,
  config: { damping: 200 },  // High damping = no overshoot
});

// Bouncy entrance
const bounce = spring({
  frame,
  fps,
  config: { damping: 8, stiffness: 100, mass: 0.5 },
});

// Delayed entrance (preferred over manual frame - N)
const delayed = spring({
  frame,
  fps,
  delay: 15,  // Start after 15 frames
  config: { damping: 200 },
});

// Fixed duration (predictable timing — no infinite tail)
const fixed = spring({
  frame,
  fps,
  durationInFrames: 30,
  config: { damping: 200 },
});

// Exit animation (reverse: from 1 → 0)
const exit = spring({
  frame,
  fps,
  from: 1,
  to: 0,
  reverse: true,
  config: { damping: 200 },
});
```

### Spring Config Presets

| Preset | damping | stiffness | mass | Effect |
|---|---|---|---|---|
| Smooth | 200 | 100 | 1 | No overshoot, clean |
| Snappy | 100 | 200 | 0.5 | Fast, slight overshoot |
| Bouncy | 8 | 100 | 0.5 | Playful bounce |
| Heavy | 200 | 50 | 3 | Slow, weighty feel |
| Elastic | 5 | 200 | 1 | Multiple oscillations |

### spring() Order of Operations

1. Stretch by `durationInFrames` (if set)
2. Reverse (if `reverse: true`)
3. Apply `delay`

---

## Deterministic Randomness

**NEVER use `Math.random()`.** It causes flickering in concurrent renders. Always use seeded `random()`:

```tsx
import { random } from "remotion";

const x = random("particle-x-3");       // 0 to 1, deterministic
const y = random("particle-y-3");       // Same seed always = same value
const trueRandom = random(null);        // Opt-in to true randomness

// Particle arrays
const particles = new Array(50).fill(null).map((_, i) => ({
  x: random(`x-${i}`) * width,
  y: random(`y-${i}`) * height,
  delay: random(`delay-${i}`) * 30,
}));
```

---

## Noise (Organic Motion)

Use `@remotion/noise` for natural-looking motion: camera shake, particle drift, organic backgrounds.

```tsx
import { noise2D, noise3D } from "@remotion/noise";

// 2D noise: spatial variation (textures, static fields)
const val = noise2D("seed", x / 100, y / 100); // returns -1 to 1

// 3D noise: time-varying — use frame as z-axis
const wobbleX = noise3D("shake-x", 0, 0, frame / 20) * 10; // ±10px camera shake
const wobbleY = noise3D("shake-y", 0, 0, frame / 20) * 10;

// Smooth particle movement
const px = noise3D(`particle-x-${i}`, 0, 0, frame / 30) * width;
const py = noise3D(`particle-y-${i}`, 0, 0, frame / 30) * height;
```

---

## Common Patterns

### Fade In + Scale

```tsx
const enter = spring({ frame, fps, config: { damping: 200 } });

return (
  <div style={{
    opacity: enter,
    transform: `scale(${interpolate(enter, [0, 1], [0.8, 1])})`,
  }}>
    Content
  </div>
);
```

### Enter + Exit

```tsx
const enter = spring({ frame, fps, config: { damping: 200 } });
const exit = spring({
  frame,
  fps,
  delay: durationInFrames - 20,
  config: { damping: 200 },
});
const scale = enter - exit;  // 0→1→0
```

### Staggered Children

```tsx
const items = ["A", "B", "C", "D"];
const STAGGER_DELAY = 5; // frames between each item

return items.map((item, i) => {
  const enter = spring({
    frame,
    fps,
    delay: i * STAGGER_DELAY,
    config: { damping: 200 },
  });
  const y = interpolate(enter, [0, 1], [30, 0]);

  return (
    <div key={item} style={{ opacity: enter, transform: `translateY(${y}px)` }}>
      {item}
    </div>
  );
});
```

### Slide In from Direction

```tsx
type Direction = "left" | "right" | "top" | "bottom";

function slideIn(frame: number, fps: number, direction: Direction, delay = 0) {
  const progress = spring({ frame, fps, delay, config: { damping: 200 } });
  const offset = interpolate(progress, [0, 1], [100, 0]);

  const transforms: Record<Direction, string> = {
    left: `translateX(${-offset}%)`,
    right: `translateX(${offset}%)`,
    top: `translateY(${-offset}%)`,
    bottom: `translateY(${offset}%)`,
  };

  return { opacity: progress, transform: transforms[direction] };
}
```

### Typewriter Effect

```tsx
const text = "Hello World";
const charsShown = interpolate(frame, [0, text.length * 3], [0, text.length], {
  extrapolateRight: "clamp",
});

return <span>{text.slice(0, Math.floor(charsShown))}</span>;
```

### Counting Number

```tsx
const targetNumber = 1234;
const count = interpolate(frame, [0, 60], [0, targetNumber], {
  extrapolateRight: "clamp",
  easing: Easing.out(Easing.quad),
});

return <span>{Math.floor(count).toLocaleString()}</span>;
```

### Pulse / Breathe

```tsx
const pulse = interpolate(
  Math.sin(frame * 0.1),
  [-1, 1],
  [0.95, 1.05],
);

return <div style={{ transform: `scale(${pulse})` }}>Breathing</div>;
```

### Progress Bar

```tsx
const progress = interpolate(frame, [0, durationInFrames], [0, 100], {
  extrapolateRight: "clamp",
});

return (
  <div style={{ width: "100%", height: 4, backgroundColor: "#333" }}>
    <div style={{ width: `${progress}%`, height: "100%", backgroundColor: "#0af" }} />
  </div>
);
```

---

## SVG Path Animations

### Draw-On Effect (evolvePath)

```tsx
import { evolvePath } from "@remotion/paths";

const progress = spring({ frame, fps, config: { damping: 200 } });
const { strokeDasharray, strokeDashoffset } = evolvePath(progress, svgPathString);

<path
  d={svgPathString}
  stroke="white"
  strokeWidth={3}
  strokeDasharray={strokeDasharray}
  strokeDashoffset={strokeDashoffset}
  fill="none"
/>
```

### Path Morphing (interpolatePath)

```tsx
import { interpolatePath } from "@remotion/paths";

const progress = spring({ frame, fps, config: { damping: 200 } });
const morphed = interpolatePath(progress, pathA, pathB);

<path d={morphed} fill="red" />
```

---

## Motion Blur / Trail Effect

```tsx
import { Trail } from "@remotion/motion-blur";

<Trail layers={30} lagInFrames={0.5} trailOpacity={0.8}>
  <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
    <MovingElement />  {/* Must be absolutely positioned */}
  </AbsoluteFill>
</Trail>
// layers: number of duplicate frames stacked below
// lagInFrames: time offset per layer (can be fractional)
// trailOpacity: maximum opacity of trail layers
```

---

## Combining spring() with interpolate()

Use spring output as input to interpolate for custom ranges:

```tsx
const springProgress = spring({ frame, fps, config: { damping: 15 } });

const rotation = interpolate(springProgress, [0, 1], [0, 360]);
const translateY = interpolate(springProgress, [0, 1], [50, 0]);
const scale = interpolate(springProgress, [0, 1], [0, 1.2]);

return (
  <div style={{
    transform: `translateY(${translateY}px) rotate(${rotation}deg) scale(${scale})`,
  }}>
    Animated
  </div>
);
```

---

## Sequence Timing

Use `<Sequence>` to offset elements in time:

```tsx
import { Sequence, AbsoluteFill } from "remotion";

return (
  <AbsoluteFill>
    <Sequence from={0} durationInFrames={60}>
      <Title text="Hello" />
    </Sequence>
    <Sequence from={30} durationInFrames={90}>
      <Subtitle text="World" />
    </Sequence>
    <Sequence from={60}>
      <Content />  {/* Plays until end if no durationInFrames */}
    </Sequence>
  </AbsoluteFill>
);
```

Inside a `<Sequence>`, `useCurrentFrame()` resets to 0 at the sequence start.

### Sequence Advanced Features

```tsx
// Negative from = trim first 15 frames of child animation
<Sequence from={-15} durationInFrames={45}>
  <AnimatedComponent />
</Sequence>

// Width/height override for components designed for different dimensions
<Sequence width={1080} height={1080}>
  <SquareComponent />
</Sequence>

// Premount before appearance (prevents flicker on seek)
<Sequence from={60} premountFor={30}>
  <HeavyComponent />
</Sequence>
```

---

## Series (Sequential Playback)

```tsx
import { Series } from "remotion";

return (
  <Series>
    <Series.Sequence durationInFrames={60}>
      <SceneA />
    </Series.Sequence>
    <Series.Sequence durationInFrames={90} offset={-10}>
      {/* offset={-10} = 10-frame overlap with previous */}
      <SceneB />
    </Series.Sequence>
    <Series.Sequence durationInFrames={60}>
      <SceneC />
    </Series.Sequence>
  </Series>
);
// Total: 60 + 90 + 60 - 10 = 200 frames
```

`offset`: positive = gap, negative = overlap with previous sequence.

---

## Loop

```tsx
import { Loop } from "remotion";

// Finite loop: 3 iterations of a 50-frame animation
<Loop durationInFrames={50} times={3} layout="none">
  <AnimatedBadge />
</Loop>

// Inside child — get loop context
const loop = Loop.useLoop(); // null if not inside Loop
if (loop) {
  console.log(loop.iteration);       // 0, 1, 2, ...
  console.log(loop.durationInFrames); // 50
}
```

---

## Freeze

Pause animation at a specific frame — useful for holding a state or pausing video.

```tsx
import { Freeze } from "remotion";

<Freeze frame={30}>
  <AnimatedContent />
</Freeze>

// Conditional freeze
<Freeze frame={30} active={(currentFrame) => currentFrame < 30}>
  <AnimatedContent />
</Freeze>
```
