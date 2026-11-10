# Reusable Component Patterns

> Common visual building blocks for Remotion compositions.

## Layouts

### Full-Screen Centered

```tsx
import { AbsoluteFill } from "remotion";

export const CenteredLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
    {children}
  </AbsoluteFill>
);
```

### Split Screen (Left/Right)

```tsx
import { AbsoluteFill } from "remotion";

export const SplitScreen: React.FC<{
  left: React.ReactNode;
  right: React.ReactNode;
  ratio?: number; // 0-1, default 0.5
}> = ({ left, right, ratio = 0.5 }) => (
  <AbsoluteFill style={{ flexDirection: "row" }}>
    <div style={{ flex: ratio, display: "flex", justifyContent: "center", alignItems: "center" }}>
      {left}
    </div>
    <div style={{ flex: 1 - ratio, display: "flex", justifyContent: "center", alignItems: "center" }}>
      {right}
    </div>
  </AbsoluteFill>
);
```

### Padded Container

```tsx
import { AbsoluteFill } from "remotion";

export const PaddedContainer: React.FC<{
  children: React.ReactNode;
  padding?: number;
}> = ({ children, padding = 80 }) => (
  <AbsoluteFill style={{ padding }}>
    {children}
  </AbsoluteFill>
);
```

---

## Backgrounds

### Gradient Background

```tsx
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

export const GradientBg: React.FC<{
  colors: [string, string];
  angle?: number;
  animated?: boolean;
}> = ({ colors, angle = 135, animated = false }) => {
  const frame = useCurrentFrame();
  const animatedAngle = animated
    ? angle + interpolate(frame, [0, 300], [0, 360])
    : angle;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${animatedAngle}deg, ${colors[0]}, ${colors[1]})`,
      }}
    />
  );
};
```

### Particle/Dot Grid Background

```tsx
import { AbsoluteFill, useCurrentFrame, useVideoConfig, random } from "remotion";

export const DotGrid: React.FC<{
  dotCount?: number;
  color?: string;
}> = ({ dotCount = 50, color = "rgba(255,255,255,0.1)" }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const dots = new Array(dotCount).fill(0).map((_, i) => ({
    x: random(`x-${i}`) * width,
    y: random(`y-${i}`) * height,
    size: random(`size-${i}`) * 4 + 2,
    speed: random(`speed-${i}`) * 0.5 + 0.1,
  }));

  return (
    <AbsoluteFill>
      {dots.map((dot, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: dot.x,
            top: (dot.y + frame * dot.speed) % height,
            width: dot.size,
            height: dot.size,
            borderRadius: "50%",
            backgroundColor: color,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
```

### Video Background (with overlay)

```tsx
import { AbsoluteFill } from "remotion";
import { Video } from "@remotion/media";

export const VideoBg: React.FC<{
  src: string;
  overlayColor?: string;
  overlayOpacity?: number;
}> = ({ src, overlayColor = "#000", overlayOpacity = 0.5 }) => (
  <AbsoluteFill>
    <Video src={src} objectFit="cover" style={{ width: "100%", height: "100%" }} />
    <AbsoluteFill style={{ backgroundColor: overlayColor, opacity: overlayOpacity }} />
  </AbsoluteFill>
);
```

---

## Text Components

### Animated Title

```tsx
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export const AnimatedTitle: React.FC<{
  text: string;
  fontFamily: string;
  fontSize?: number;
  color?: string;
  delay?: number;
}> = ({ text, fontFamily, fontSize = 80, color = "#fff", delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, delay, config: { damping: 200 } });
  const y = interpolate(enter, [0, 1], [40, 0]);

  return (
    <h1 style={{
      fontFamily,
      fontSize,
      fontWeight: 700,
      color,
      opacity: enter,
      transform: `translateY(${y}px)`,
      margin: 0,
    }}>
      {text}
    </h1>
  );
};
```

### Subtitle with Background

```tsx
export const Subtitle: React.FC<{
  text: string;
  fontFamily: string;
  delay?: number;
}> = ({ text, fontFamily, delay = 10 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, delay, config: { damping: 200 } });

  return (
    <p style={{
      fontFamily,
      fontSize: 32,
      color: "rgba(255,255,255,0.9)",
      backgroundColor: "rgba(0,0,0,0.3)",
      padding: "8px 20px",
      borderRadius: 8,
      opacity: enter,
      margin: 0,
    }}>
      {text}
    </p>
  );
};
```

---

## Shapes (@remotion/shapes)

SVG shape components and path generators for geometric motion graphics.

### Shape Components

```tsx
import { Circle, Rect, Triangle, Star, Polygon, Ellipse } from "@remotion/shapes";

// Renders SVG with correct transform-origin
<Circle radius={100} fill="green" stroke="white" strokeWidth={2} />
<Rect width={200} height={100} fill="blue" cornerRadius={10} />
<Triangle length={150} fill="red" direction="up" />
<Star points={5} innerRadius={30} outerRadius={70} fill="gold" />
<Polygon points={6} radius={80} fill="purple" />
<Ellipse rx={100} ry={60} fill="cyan" />
```

### Shape Path Generators (for SVG path animation)

```tsx
import { makeCircle, makeRect, makeStar } from "@remotion/shapes";

const { path, width, height, transformOrigin } = makeCircle({ radius: 50 });
// Use with evolvePath() for draw-on animation:
import { evolvePath } from "@remotion/paths";
const { strokeDasharray, strokeDashoffset } = evolvePath(progress, path);
```

---

## Media Components

### Safe Image with Fallback

```tsx
import { Img, staticFile } from "remotion";

export const SafeImage: React.FC<{
  src: string;
  width?: number;
  height?: number;
  borderRadius?: number;
}> = ({ src, width, height, borderRadius = 0 }) => (
  <Img
    src={src.startsWith("http") ? src : staticFile(src)}
    style={{
      width,
      height,
      borderRadius,
      objectFit: "cover",
    }}
  />
);
```

### Video (`@remotion/media`, preferred)

`<Video>` from `@remotion/media` is Remotion's recommended video component. It extracts the exact frame with Mediabunny, supports `effects`, `crop*`, `loop` and `objectFit`, and falls back to `<OffthreadVideo>` by itself when a file can't be decoded (`disallowFallbackToOffthreadVideo` turns that off).

```tsx
import { interpolate, staticFile } from "remotion";
import { Video } from "@remotion/media";
import { glow } from "@remotion/effects/glow";

<Video
  src={staticFile("clip.mp4")}
  trimBefore={30}       // Start playback at frame 30 (replaces deprecated startFrom)
  trimAfter={90}        // End playback at frame 90 (replaces deprecated endAt)
  volume={(f) => interpolate(f, [0, 30], [0, 1], { extrapolateRight: "clamp" })}
  toneFrequency={1.2}   // Pitch shift 0.01–2 (render-only)
  loop                  // native looping
  effects={[glow()]}    // pixel effects, see docs/remotion/effects/
  objectFit="cover"
  style={{ width: "100%", height: "100%" }}
/>
```

Use `<OffthreadVideo>` from `remotion` only when you need its `toneMapped` HDR handling or a codec Mediabunny can't read; check the effect's options in `docs/remotion/effects/<name>.md` before passing them.

### Audio Layer

```tsx
import { staticFile } from "remotion";
import { Audio } from "@remotion/media";

export const AudioLayer: React.FC<{
  src: string;
  fadeInFrames?: number;
}> = ({ src, fadeInFrames = 15 }) => (
  <Audio
    src={src.startsWith("http") ? src : staticFile(src)}
    volume={(f) => {
      if (f < fadeInFrames) return f / fadeInFrames;
      return 1;
    }}
  />
);
```

### Audio Visualization

```tsx
import { useAudioData, visualizeAudio, createSmoothSvgPath } from "@remotion/media-utils";
import { staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const AudioVisualizer: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const audioData = useAudioData(staticFile(src)); // auto-handles delayRender

  if (!audioData) return null;

  // Bar chart (music visualization)
  const bars = visualizeAudio({ fps, frame, audioData, numberOfSamples: 32 });
  // bars: number[] amplitudes 0–1

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 200 }}>
      {bars.map((amp, i) => (
        <div key={i} style={{
          width: 12,
          height: `${amp * 100}%`,
          backgroundColor: "#0af",
          borderRadius: 4,
        }} />
      ))}
    </div>
  );
};
```

### Animated Emoji

```tsx
import { AnimatedEmoji } from "@remotion/animated-emoji";

// Assets must be copied from node_modules/@remotion/animated-emoji/public/ to public/
<AnimatedEmoji emoji="fire" scale={1} />        // 1024x1024
<AnimatedEmoji emoji="thumbs-up" scale={0.5} /> // 512x512
// Available: 'fire', 'sparkles', 'heart-grow', 'thumbs-up', 'party-popper', etc.
```

---

## Composition Registration Pattern

In Klaq, a film registers through `export const compositions: KlaqComposition[]` in `projects/<name>/index.tsx` (fields: `id`, `component`, `durationInFrames`, `fps`, `width`, `height`, optional `defaultProps` and `calculateMetadata`; see SKILL.md "Registering a film"). Never edit `src/Root.tsx` for a project. The plain-Remotion pattern below is what the engine's `Root.tsx` does with those entries, and what you would write in a standalone Remotion app; `<Folder>`, `<Still>` and `schema` are only available there.

### With Zod Schema + calculateMetadata

```tsx
import React from "react";
import { Composition, Still, Folder, staticFile } from "remotion";
import { z } from "zod";

const videoSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  scenes: z.array(z.object({
    text: z.string(),
    durationSeconds: z.number(),
    backgroundColor: z.string(),
  })),
  audioSrc: z.string().optional(),
  captionsEnabled: z.boolean().default(true),
});

export type VideoProps = z.infer<typeof videoSchema>;

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="Videos">
      <Composition
        id="ExplainerVideo"
        component={ExplainerVideo}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={300}
        schema={videoSchema}
        defaultProps={{
          title: "My Explainer",
          scenes: [
            { text: "Scene 1", durationSeconds: 5, backgroundColor: "#1a1a2e" },
            { text: "Scene 2", durationSeconds: 5, backgroundColor: "#16213e" },
          ],
          captionsEnabled: true,
        }}
      />
    </Folder>

    <Folder name="Images">
      <Still
        id="og-image"
        component={OgImageComp}
        width={1200}
        height={630}
        defaultProps={{ title: "Hello World" }}
      />
    </Folder>
  </>
);
```

### Dynamic Duration with calculateMetadata

```tsx
import { CalculateMetadataFunction } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";

export const calculateMetadata: CalculateMetadataFunction<Props> = async ({
  props,
  abortSignal,
}) => {
  const duration = await getAudioDurationInSeconds(props.audioSrc);
  return {
    durationInFrames: Math.ceil(duration * 30),
    fps: 30,
    props,  // Must be JSON-serializable
  };
};
```

---

## Player Integration (Embed in React App)

```tsx
import { Player } from "@remotion/player";
import { ExplainerVideo, videoSchema } from "./compositions/ExplainerVideo";

export const VideoPreview: React.FC = () => (
  <Player
    component={ExplainerVideo}
    inputProps={{
      title: "Preview",
      scenes: [{ text: "Hello", durationSeconds: 3, backgroundColor: "#1a1a2e" }],
      captionsEnabled: false,
    }}
    durationInFrames={90}
    compositionWidth={1920}
    compositionHeight={1080}
    fps={30}
    style={{ width: 960, height: 540 }}
    controls
    autoPlay
    loop
  />
);
```
