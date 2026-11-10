# Captions & Subtitles

> Audio transcription and animated caption rendering with `@remotion/captions`.

## Transcription Methods

### 1. Whisper.cpp (Local Server-Side)

Best for: self-hosted rendering, privacy, no API costs.

```tsx
import path from "path";
import fs from "fs";
import {
  installWhisperCpp,
  downloadWhisperModel,
  transcribe,
  toCaptions,
} from "@remotion/install-whisper-cpp";

// One-time setup
const whisperPath = path.join(process.cwd(), "whisper.cpp");

await installWhisperCpp({ to: whisperPath, version: "1.5.5" });
await downloadWhisperModel({ model: "medium.en", folder: whisperPath });

// Transcribe
const whisperOutput = await transcribe({
  model: "medium.en",
  whisperPath,
  whisperCppVersion: "1.5.5",
  inputPath: "/path/to/audio.wav",  // Must be WAV, ideally 16KHz
  tokenLevelTimestamps: true,
});

const { captions } = toCaptions({ whisperCppOutput: whisperOutput });
fs.writeFileSync("public/captions.json", JSON.stringify(captions, null, 2));
```

### 2. OpenAI Whisper API (Cloud)

Best for: high accuracy, multi-language, no local setup.

```tsx
import fs from "fs";
import { OpenAI } from "openai";
import { openAiWhisperApiToCaptions } from "@remotion/openai-whisper";

const openai = new OpenAI();

const transcription = await openai.audio.transcriptions.create({
  file: fs.createReadStream("audio.mp3"),
  model: "whisper-1",
  response_format: "verbose_json",
  timestamp_granularities: ["word"],
});

const { captions } = openAiWhisperApiToCaptions({ transcription });
fs.writeFileSync("public/captions.json", JSON.stringify(captions, null, 2));
```

### 3. Whisper Web (Browser)

Best for: in-browser apps, no server needed.

```tsx
import { transcribe, downloadWhisperModel, resampleTo16Khz, canUseWhisperWeb } from "@remotion/whisper-web";

const model = "tiny.en";
const { supported } = await canUseWhisperWeb(model);
if (!supported) throw new Error("Whisper Web not supported");

await downloadWhisperModel({
  model,
  onProgress: ({ progress }) => console.log(`${Math.round(progress * 100)}%`),
});

const channelWaveform = await resampleTo16Khz({ file: audioFile });

const { transcription } = await transcribe({
  channelWaveform,
  model,
  onProgress: (p) => console.log(`${Math.round(p * 100)}%`),
});
```

---

## Caption Data Structure

All methods produce `Caption[]`:

```typescript
interface Caption {
  text: string;         // The word or phrase
  startMs: number;      // Start time in milliseconds
  endMs: number;        // End time in milliseconds
  timestampMs: number;  // Midpoint timestamp
  confidence: number;   // 0-1 confidence score
}
```

---

## TikTok-Style Animated Captions

The signature word-by-word highlighted caption style.

### Generate Pages

```tsx
import { createTikTokStyleCaptions } from "@remotion/captions";
import type { TikTokPage } from "@remotion/captions";

const { pages } = createTikTokStyleCaptions({
  captions,
  combineTokensWithinMilliseconds: 1200, // How long each page shows
});
```

Each `TikTokPage` has:
- `startMs` — when this page appears
- `tokens[]` — each token has `text`, `fromMs`, `toMs`

### Render Captions Component

```tsx
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { createTikTokStyleCaptions } from "@remotion/captions";
import type { Caption, TikTokPage } from "@remotion/captions";

const HIGHLIGHT_COLOR = "#39E508";
const TEXT_COLOR = "#FFFFFF";
const SWITCH_MS = 1200;

const CaptionPage: React.FC<{ page: TikTokPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = page.startMs + (frame / fps) * 1000;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontSize: 80, fontWeight: "bold", textAlign: "center" }}>
        {page.tokens.map((token) => {
          const isActive = token.fromMs <= currentTimeMs && token.toMs > currentTimeMs;
          return (
            <span
              key={token.fromMs}
              style={{ color: isActive ? HIGHLIGHT_COLOR : TEXT_COLOR }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const CaptionedVideo: React.FC<{ captions: Caption[] }> = ({ captions }) => {
  const { fps } = useVideoConfig();

  const { pages } = createTikTokStyleCaptions({
    captions,
    combineTokensWithinMilliseconds: SWITCH_MS,
  });

  return (
    <AbsoluteFill>
      {pages.map((page, i) => {
        const next = pages[i + 1] ?? null;
        const startFrame = (page.startMs / 1000) * fps;
        const endFrame = next
          ? (next.startMs / 1000) * fps
          : startFrame + (SWITCH_MS / 1000) * fps;
        const duration = Math.max(1, Math.floor(endFrame - startFrame));

        return (
          <Sequence key={i} from={Math.floor(startFrame)} durationInFrames={duration}>
            <CaptionPage page={page} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
```

---

## SRT Parsing & Export

### Parse existing SRT

```tsx
import { parseSrt } from "@remotion/captions";

const srtContent = fs.readFileSync("subtitles.srt", "utf-8");
const { captions } = parseSrt({ input: srtContent });
```

### Export SRT alongside video

```tsx
import { Artifact } from "remotion";
import { serializeSrt } from "@remotion/captions";

// Inside your composition component:
const srtContent = serializeSrt({
  lines: captions.map((caption) => [caption]),
});

return (
  <>
    {frame === 0 && <Artifact filename="subtitles.srt" content={srtContent} />}
    {/* Rest of the video */}
  </>
);
```

---

## Caption Styling Tips

- **Font**: Bold, large (60-80px), high contrast against video
- **Shadow/outline**: Add `textShadow` or `-webkit-text-stroke` for readability
- **Position**: Bottom third (70% from top) for standard subtitles, center for TikTok style
- **Background**: Semi-transparent box behind text for readability over varied backgrounds
- **Highlight color**: Bright, contrasting color (#39E508 green, #FFD700 gold, #FF6B6B coral)
- **Animation**: Smooth color transition on active word, optional scale bump (1.0→1.1)

```tsx
const captionStyle: React.CSSProperties = {
  fontSize: 72,
  fontWeight: 800,
  textAlign: "center",
  textShadow: "0 4px 8px rgba(0,0,0,0.8)",
  lineHeight: 1.3,
  padding: "0 40px",
};
```

---

## Caption Timing and Layout Rules

Rules for burned-in, word-synced captions; each one prevents a defect viewers notice. The talking-head engine (`src/compositions/talking-head/TalkingHead.tsx`) implements most of them; for a voice-led film, write a `Captions` component in the project that follows the same rules. Placement rules for 9:16 are in `social-vertical.md` §3.

| Rule | Threshold | How to meet it |
|---|---|---|
| A chunk's layout is fixed from the moment it appears: every word is laid out on the first frame (unspoken ones dimmed or at opacity 0), and nothing is added, removed or re-centred while it is visible | No movement (more than ~1.5 px counts as a fail) | Render the whole chunk at once; grow the active word with `transform: scale(1.06)`, which does not push its neighbours |
| No word shifts sideways or ghosts between frames of one chunk | none | Same as above. Never highlight with `font-weight` or `letter-spacing`; both reflow the line |
| The last word of a chunk stays readable | ≥ 0.3 s; the next chunk may wait up to 0.18 s for it | Not automatic if a chunk ends at `min(next.from, to + tail)`: a short final word followed at once by the next chunk can flash by. Check it in event stills |
| Each spoken word becomes visible on time | no later than 0.08 s after it is spoken, no earlier than 0.15 s before | Showing the chunk 2 frames early (0.03 s at 60 fps) is fine |
| A chunk never crosses a sentence end and never splits a spoken number | | Flush on `. ? ! , :`; keep numbers as one token in the script, since the chunker does not protect them |
| 2-4 words on one line | Some styles go up to 6 words / 30 characters with an outline instead of a plate | A good default: `maxWords = 3`, `maxChars = 18` |
| Each chunk disappears as the next spoken word begins; it does not linger into the following shot | | `to = next.from`, or a short tail |
| Use a soft rounded plate that hugs the words, not a bar across the full width | | A pill sized to the text |
| While a headline shows the same words, hide the caption; decide the hidden ranges once, not per frame | | A `hide(f)` prop fed by a fixed list of ranges |
| Preload every font weight the captions use | | `loadFont()` in the theme; a weight first used mid-film reflows the text |

A per-frame caption check (word positions stable, no short holds, on time against the alignment) is planned, not built. Until then, render event stills at each chunk change.
