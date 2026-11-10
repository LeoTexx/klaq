# Rendering Pipeline

> Programmatic video rendering with Remotion — local and cloud.

## Data Fetching & Dynamic Metadata

### calculateMetadata (Preferred for Async Data)

The canonical way to fetch data and set dynamic video properties. Runs **once** before rendering (not per frame). Always prefer this over `delayRender` for data loading.

```tsx
import { CalculateMetadataFunction } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";

export const calculateMetadata: CalculateMetadataFunction<Props> = async ({
  props,
  abortSignal,  // Cancel when Studio props change
}) => {
  const data = await fetch(`https://api.example.com/${props.id}`, {
    signal: abortSignal,
  });
  const json = await data.json();

  return {
    durationInFrames: Math.ceil(json.durationSeconds * 30),
    fps: 30,
    width: 1920,   // Optional override
    height: 1080,  // Optional override
    props: { ...props, data: json },  // Must be JSON-serializable
  };
};
```

Register it in the project's `projects/<name>/index.tsx` (never in `src/Root.tsx`):

```tsx
export const compositions: KlaqComposition[] = [
  {
    id: "DynamicVideo",
    component: DynamicVideo,
    durationInFrames: 300,   // placeholder; calculateMetadata overrides it
    fps: 30,
    width: 1920,
    height: 1080,
    calculateMetadata,
    defaultProps: { id: "demo", data: null },
  },
];
```

(Plain Remotion registers the same fields on a `<Composition>` in `Root.tsx`, plus an optional `schema`.)

### useDelayRender (For In-Component Async)

When data must be fetched inside a component (not in calculateMetadata), use the **hook form** (preferred over raw `delayRender()`):

```tsx
import { useDelayRender } from "remotion";

const MyComp: React.FC = () => {
  const [data, setData] = useState(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Loading data..."));

  useEffect(() => {
    fetch("https://api.example.com/data")
      .then((r) => r.json())
      .then((json) => {
        setData(json);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, []);

  if (!data) return null;
  return <VideoContent data={data} />;
};
```

### useBufferState (Player Buffering)

`delayRender` only affects server-side rendering. For the `<Player>` component, use `useBufferState` to pause playback while loading:

```tsx
import { useBufferState, useDelayRender } from "remotion";

const buffer = useBufferState();
const { delayRender, continueRender } = useDelayRender();
const [handle] = useState(() => delayRender());

useEffect(() => {
  const playbackHandle = buffer.delayPlayback(); // Pauses Player
  loadAsset().then(() => {
    playbackHandle.unblock();
    continueRender(handle);
  });
  return () => { playbackHandle.unblock(); };
}, []);
```

---

## Local Rendering (Node.js API)

### Full Render Script

```tsx
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

async function render() {
  const bundleLocation = await bundle({
    entryPoint: "./src/index.ts",
    onProgress: (progress) => {
      console.log(`Bundling: ${(progress * 100).toFixed(0)}%`);
    },
  });

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "MyVideo",
    inputProps: {
      title: "Dynamic Title",
      scenes: [/* scene data */],
    },
  });

  await renderMedia({
    serveUrl: bundleLocation,
    codec: "h264",
    composition,
    outputLocation: "./out/video.mp4",
    inputProps: {
      title: "Dynamic Title",
      scenes: [/* scene data */],
    },
    onProgress: ({ progress }) => {
      console.log(`Rendering: ${(progress * 100).toFixed(0)}%`);
    },
    crf: 18,               // Near-lossless quality
    imageFormat: "jpeg",
    jpegQuality: 90,
    // Pass env vars explicitly (NOT auto-read from .env)
    envVariables: {
      REMOTION_API_KEY: process.env.REMOTION_API_KEY,
    },
  });

  console.log("Render complete!");
}

render().catch(console.error);
```

### Batch Rendering (Multiple Videos)

```tsx
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const dataset = [
  { name: "Video 1", title: "First", color: "#FF6B6B" },
  { name: "Video 2", title: "Second", color: "#4ECDC4" },
  { name: "Video 3", title: "Third", color: "#45B7D1" },
];

const bundleLocation = await bundle({ entryPoint: "./src/index.ts" });

for (const entry of dataset) {
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "DataDrivenVideo",
    inputProps: entry,
  });

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: `out/${entry.name}.mp4`,
    inputProps: entry,
  });

  console.log(`Rendered: ${entry.name}`);
}
```

### Still Image Rendering

```tsx
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const bundleLocation = await bundle({ entryPoint: "./src/index.ts" });

const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: "og-image",  // A <Still> composition
  inputProps: { title: "My Title" },
});

await renderStill({
  serveUrl: bundleLocation,
  composition,
  output: "./out/og-image.png",
  imageFormat: "png",  // or "jpeg"
});
```

CLI: `npx remotion still og-image out.png`

---

## Artifact Emission (Sidecar Files)

Export `.srt`, `.json`, thumbnails, or other files alongside the video:

```tsx
import { Artifact, useCurrentFrame } from "remotion";

const frame = useCurrentFrame();

return (
  <>
    {/* Emit only at frame 0 (critical rule) */}
    {frame === 0 && (
      <Artifact filename="captions.srt" content={srtContent} />
    )}
    {frame === 0 && (
      <Artifact filename="thumbnail.jpeg" content={Artifact.Thumbnail} />
    )}
    <VideoContent />
  </>
);
// Output saved to: out/[composition-id]/[filename]
```

---

## AWS Lambda Rendering

### Trigger Render

```tsx
import { renderMediaOnLambda } from "@remotion/lambda/client";

const { bucketName, renderId } = await renderMediaOnLambda({
  region: "us-east-1",
  functionName: "remotion-render-bds9aab",
  composition: "MyVideo",
  serveUrl: "https://your-remotion-site.vercel.app",
  codec: "h264",
  inputProps: {
    title: "Hello World",
    scenes: [/* ... */],
  },
});

console.log(`Render started: ${renderId}`);
```

### Poll Progress

```tsx
import { getRenderProgress } from "@remotion/lambda";

const progress = await getRenderProgress({
  renderId,
  bucketName,
  functionName: "remotion-render-bds9aab",
  region: "us-east-1",
});

console.log(`Progress: ${(progress.overallProgress * 100).toFixed(0)}%`);

if (progress.done) {
  console.log(`Output: ${progress.outputFile}`);
}
```

---

## Render Options Reference

### Codecs

| Codec | Extension | Use Case | Notes |
|---|---|---|---|
| `h264` | .mp4 | Universal playback | Best compatibility |
| `h265` | .mp4 | Smaller files | Not universally supported |
| `vp8` | .webm | Web embedding | Good for web |
| `vp9` | .webm | High quality web | Better compression than vp8 |
| `prores` | .mov | Professional editing | Huge files, best quality |
| `gif` | .gif | Short loops | Limited colors |

### Quality Settings

| Setting | Range | Default | Notes |
|---|---|---|---|
| `crf` | 0-51 | 23 | Lower = better. 18 = visually lossless |
| `jpegQuality` | 0-100 | 80 | For `imageFormat: "jpeg"` |
| `scale` | 0.1-4 | 1 | Resolution multiplier |
| `audioBitrate` | string | "320k" | e.g., "128k", "256k", "320k" |
| `videoBitrate` | string | null | e.g., "5M" (overrides CRF) |

### Image Format

| Format | Pros | Cons |
|---|---|---|
| `jpeg` | Faster, smaller | No transparency |
| `png` | Transparency support | Slower, larger |

---

## Environment Variables

Only `REMOTION_`-prefixed variables are bundled into Webpack and available in components:

```tsx
// In component code:
const apiKey = process.env.REMOTION_API_KEY; // Only REMOTION_* works

// CLI:
// REMOTION_API_KEY=abc123 npx remotion render MyComp

// In renderMedia() — .env is NOT auto-read:
await renderMedia({
  envVariables: { REMOTION_API_KEY: process.env.REMOTION_API_KEY },
  // ...
});
```

---

## Render from API Endpoint (Express/Fastify)

```tsx
import express from "express";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";

const app = express();
app.use(express.json());

let bundleLocation: string;
bundle({ entryPoint: "./src/index.ts" }).then((loc) => {
  bundleLocation = loc;
  console.log("Bundle ready");
});

app.post("/api/render", async (req, res) => {
  const { compositionId, inputProps } = req.body;
  const outputPath = path.join("out", `${Date.now()}.mp4`);

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps,
  });

  await renderMedia({
    serveUrl: bundleLocation,
    codec: "h264",
    composition,
    outputLocation: outputPath,
    inputProps,
  });

  res.json({ success: true, path: outputPath });
});

app.listen(3001);
```
