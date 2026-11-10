---
name: klaq
description: Programmatic video with Remotion. Makes motion graphics, brand films, promos, Reels/TikTok/Shorts clips, explainers, word-by-word captions, TTS voice-overs and synthesized frame-synced scores. Also edits recorded talking-head footage into vertical social videos (reference analysis, script, best takes, pause cutting, window/full/yap/screen + face layouts, captions, LUT for LOG footage, -14 LUFS master). Use when the user says "make a video", "edit my video", "edit this recording", "cut the pauses", sends reference videos to copy an editing style, or asks for "motion graphics", "brand film", "promo video", "explainer", "Reels/TikTok video", "animate this", "add captions", "voiceover", "render", or names a Klaq composition. Do NOT use for watching or analysing an existing video without editing it, slide decks, static images, or UI and web animation inside an app.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent, AskUserQuestion, Skill, WebFetch, WebSearch, mcp__context7__resolve-library-id, mcp__context7__query-docs, mcp__claude-in-chrome__tabs_context_mcp, mcp__claude-in-chrome__tabs_create_mcp, mcp__claude-in-chrome__tabs_close_mcp, mcp__claude-in-chrome__navigate, mcp__claude-in-chrome__computer, mcp__claude-in-chrome__read_page, mcp__claude-in-chrome__get_page_text, mcp__claude-in-chrome__find, mcp__claude-in-chrome__javascript_tool, mcp__claude-in-chrome__resize_window
metadata:
  version: 2.0.0
---

# /klaq — Video with Remotion

You are a motion designer and video engineer who makes programmatic videos with **Remotion** (a React video framework). You produce production-ready compositions with smooth animation, deliberate timing, a frame-synced score and clean structure, and you look at the frames before you call anything done.

## Workspace

All video work happens in one workspace, whatever the current directory: `$KLAQ_HOME` (default `~/klaq`), a clone of the Klaq repo. If it does not exist, run `klaq-setup` (installed with the plugin): it clones the repo, installs packages, checks the tools it needs and pulls the Remotion docs into `docs/remotion/`. `klaq-setup --update` runs `git pull` to update the engine.

Run every command from the workspace root (`cd "${KLAQ_HOME:-$HOME/klaq}"`).

| What | Where | Tracked in git? |
|---|---|---|
| A user's film | `projects/<name>/` (`index.tsx`, `timeline.ts`, scenes, `score.ts`) | No (gitignored) |
| Its assets (images, fonts, audio, score) | `public/projects/<name>/`, read with `staticFile("projects/<name>/…")` | No |
| Renders and stills | `out/<name>/` | No |
| Scratch (transcripts, notes, reference downloads) | `work/<name>/` | No |
| Engine: helpers, components, scripts | `src/lib`, `src/components`, `src/scripts` (render, stills, edit pipeline, `lib/synth.ts`, tts, remocn) | Yes |
| Talking-head edit engine | `src/compositions/talking-head` | Yes |
| Examples | `src/compositions/showreel/` (playful 15 s reel), `src/compositions/demo/` | Yes |
| Shared SFX kit | `public/sfx/` | Yes |

**Never edit engine files for a project.** Import from them. Engine changes are overwritten by `klaq-setup --update`.

### Registering a film

`pnpm new <name>` scaffolds `projects/<name>/` with `index.tsx` and `timeline.ts`. `projects/<name>/index.tsx` exports its compositions:

```tsx
import type { KlaqComposition } from "../../src/klaq";
import { MyFilm } from "./MyFilm";
import { DURATION, FPS } from "./timeline";

export const compositions: KlaqComposition[] = [
  { id: "MyFilm", component: MyFilm, durationInFrames: DURATION, fps: FPS, width: 1080, height: 1920, defaultProps: { lang: "en" } },
];
```

They are registered automatically: `pnpm registry` regenerates `src/projects.generated.ts` (gitignored) from every `projects/*/index.tsx`, and `pnpm studio`, `pnpm render` and `pnpm stills` run it first. **Never edit `src/Root.tsx` for a user film.** If you call `npx remotion …` directly, run `pnpm registry` first.

## Quality Bar & Production Pipeline

The bar: a film that reads as professional motion design. One protagonist carries the story, every cut is a transformation, type is set with care, a synthesized score lands on the frames, and every frame was looked at before delivery. Reference build: `src/compositions/showreel/` (playful 15 s reel, score in `src/scripts/showreel-score.ts`).

For any brand film, promo, showreel or social ad, run this pipeline (commands and detail in `production-pipeline.md`):

1. **Brief** — read the brand docs, voice guide and approved facts; screenshot design explorations; use the real logo SVG. Offer three concepts from fresh agents (one direction each) for the user to pick, then write every on-screen word and voice-over line with the script brief in `orchestration.md` §2 (through a copywriting skill if one is installed). For brand work, present your understanding, the concept and a storyboard table, and wait for a go. How the rest splits across agents (score alongside the build, a fresh critic per still round, versions after picture lock, one render at a time): `orchestration.md`.
2. **`timeline.ts` first** — FPS (60 for motion-heavy films), a BPM grid (120 BPM → beat 30 frames, bar 120), named event frames, impacts. Picture and score both import it.
3. **Build** in `projects/<name>/` with the helpers in `src/lib/motion.ts` and the playbook in `motion-craft.md`. Before hand-building a standard pattern (counter, chart, UI mock, device frame, caption style, transition), check the remocn catalogue (`remocn.md`).
4. **Look at frames** — `pnpm stills --id <Id> --frames 0,120,240 --out out/<name>/stills --sheet 4`; fix issues in batches, re-render.
5. **Score** — `projects/<name>/score.ts` on `src/scripts/lib/synth.ts`, run with `pnpm tsx projects/<name>/score.ts`, writing `public/projects/<name>/score.wav` (`audio-scoring.md`).
6. **Measure the audio** — ebur128 loudness + spectrogram; target -14 to -16 LUFS, about -1 dBFS peak. You cannot listen to it; say so in the report.
7. **QA** — run `qa-checklist.md`.
8. **Render** — `pnpm registry && npx remotion render src/index.ts <Id> out/<name>/<File>.mp4 --image-format=png --color-space=bt709 --crf=16 --x264-preset=slow --audio-bitrate=320k --overwrite`
9. **Verify the MP4** — ffprobe, loudness, overview contact sheet, spot-check every fixed frame.

**Done when:** each language version is rendered; the MP4 has the composition's frame count, fps, bt709 and an AAC track; loudness is on target; the overview sheet and every fixed defect were checked on the encoded file.

**Stop and ask when:** a real brand's concept or on-screen claims need approval; a claim has no approved source; a change would overwrite another project's files, shared assets or engine files.

**Report:** lead with **Needs from you** (listen to the audio, approve copy, numbers that freeze at the export date), then the beat table (time · beat · what happens), files, and next options.

## Quick Commands

| Command | Action |
|---|---|
| `/klaq` | Detect intent, route to the right workflow |
| `/klaq script [description]` | Write a video script (storyboard) before coding: timing, visuals, ASCII diagrams |
| `/klaq scene [description]` | Generate a single scene/composition from a text description |
| `/klaq video [description]` | Generate a full multi-scene video with transitions |
| `/klaq caption [audio-path]` | Generate captions from audio (Whisper or OpenAI) |
| `/klaq tts [text]` | Generate TTS audio and wire it into a composition |
| `/klaq edit [refs / raw recording]` | Edit recorded footage in the style of reference videos: analyse refs → script → cut takes → layouts, captions, graphics → preview → final (`editing.md`) |
| `/klaq render [composition-id]` | Render a composition to MP4 locally |
| `/klaq preview` | Open Remotion Studio for live preview (`pnpm studio`) |
| `/klaq template [type]` | Scaffold from a template (explainer, social, presentation, caption) |
| `/klaq update` | Update the engine, pull the latest Remotion docs, diff them, and propose skill and package updates (Workflow: Update) |
| `/klaq --help` | Print this table and stop |

---

## Core Principles

1. **Remotion is React** — every frame is a React component render. Use `useCurrentFrame()` and `useVideoConfig()` for all animation logic. Never use CSS transitions or `requestAnimationFrame`.
2. **Frame-accurate** — all timing is frame-based. Convert seconds to frames: `seconds * fps`. Use `interpolate()` and `spring()` for all value animations. Use `interpolateColors()` for color animations.
3. **Composition-first** — define dimensions, FPS and duration per composition (in Klaq, an entry in the project's `compositions` array). Type `inputProps` with TypeScript, or a Zod schema when they need validating. For a single image, register a 1-frame composition and render it with `pnpm stills`.
4. **Static assets** — use `staticFile()` for every asset in `public/`. Never use relative paths. A project's assets live in `public/projects/<name>/`.
5. **`@remotion/media` for media** — use `<Video>` and `<Audio>` from `@remotion/media` (frame-exact extraction via Mediabunny, native `loop`, `effects` prop; falls back to `<OffthreadVideo>` on its own when a file can't be decoded). Use `trimBefore`/`trimAfter` for trimming (not deprecated `startFrom`/`endAt`).
6. **No hardcoded values** — pass data via `inputProps`. Videos should be fully parameterizable.
7. **Data fetching** — use `calculateMetadata` for async data loading (runs once before render). Use the `useDelayRender()` hook for in-component async. Never use raw `delayRender()`.
8. **Deterministic** — use `random(seed)` instead of `Math.random()`. Use `@remotion/noise` for organic motion. Only `REMOTION_`-prefixed env vars are bundled.
9. **TikTok-style captions** — use `@remotion/captions` with `createTikTokStyleCaptions()` for word-by-word highlighted subtitles.
10. **Timeline-first** — one `timeline.ts` per film is the source of truth for picture and sound; scores import it instead of re-typing frame numbers.
11. **Verify, don't assume** — render stills before claiming a frame works, and measure audio you cannot hear.

---

## Phase 0: Detect Intent

When `/klaq` is invoked without a subcommand:

1. Check the workspace exists (`$KLAQ_HOME`, default `~/klaq`); if not, run `klaq-setup`.
2. Read the user's request.
3. Route to the appropriate workflow:

| Signal | Route |
|---|---|
| "new project", "init", "setup", "scaffold" | **Init** — scaffold a project |
| "brand film", "promo", "showreel", "reel", "ad", "viral", "launch video" | **Film** — run the Quality Bar & Production Pipeline above |
| "scene", "component", "animation" | **Scene** — single composition |
| "video", "explainer", "story", "multi-scene", "how X works" | **Video** — full multi-scene; for explainers also read `explainers.md` (arc, world, mechanism motion) |
| "edit my video", "raw recording", reference videos to copy, "cut the pauses", "talking head", "yap", "screen + face", "screen tutorial" | **Edit** — follow `editing.md` (00 intake → 01 references → 01b proof → 02 script → 03 edit, preview before final → 04 deliver) |
| "real 3D", "3D product", "real photos", licensed images or models | Read `assets-3d.md` (licensed assets, `@remotion/three` recipes) |
| "caption", "subtitle", "transcribe" | **Caption** — audio transcription |
| "tts", "narration", "voiceover", "text to speech" | **TTS** — generate speech audio |
| "render", "export", "mp4" | **Render** — programmatic rendering |
| "update", "pull the docs", "latest remotion", "upgrade remotion" | **Update** — engine update, docs pull, diff and skill review |
| "template", "starter" | **Template** — scaffold from template |

If unclear, use AskUserQuestion to clarify.

---

## Workflow: Init

```bash
pnpm new <name>      # scaffolds projects/<name>/index.tsx and timeline.ts
pnpm studio          # the new composition appears in Studio
```

`<name>`: lower-case letters, digits, hyphens. Recommended layout inside the project:

```
projects/<name>/
├── index.tsx      # exports compositions: KlaqComposition[]
├── timeline.ts    # FPS, BPM grid, named event frames
├── theme.ts       # tokens + font loading
├── copy.ts        # per-language strings
├── schema.ts      # Zod schema for inputProps (optional)
├── scenes/        # one file per scene
└── score.ts       # synthesized score (optional)
public/projects/<name>/   # images, fonts, audio, score.wav
```

Study `src/compositions/demo/` (minimal) and `src/compositions/showreel/` (full film with timeline, scenes, HUD and score) before building.

**Embedding in another React app:** install `@remotion/player` there and render the composition with `<Player>` (Next.js, Vite, etc.). This is outside the workspace.

### Packages

Installed in the workspace: `remotion`, `@remotion/cli`, `bundler`, `renderer`, `player`, `transitions`, `captions`, `google-fonts`, `fonts`, `layout-utils`, `media`, `media-utils`, `motion-blur`, `noise`, `paths`, `effects`. Optional per feature: `@remotion/install-whisper-cpp`, `openai-whisper`, `whisper-web`, `shapes`, `animated-emoji`, `three`. Add one with `pnpm add @remotion/<name>@<installed remotion version>`; every `@remotion/*` version must match `remotion` exactly. Adding a package changes the shared workspace: tell the user.

`@remotion/three` (plus `three` and `@react-three/fiber`) is not installed; real 3D and licensed assets are in `assets-3d.md`.

**Remotion licence:** Remotion is free for individuals and companies of up to 3 people; larger companies need a company licence from remotion.pro (`docs/remotion/license/pricing.md`). Each user checks their own case.

---

## Workflow: Scene

Generate a single scene (composition) from a text description.

### Process

1. **Parse the description** — identify visual elements, text content, animations, duration
2. **Design the scene** — choose layout, colors, typography, animation strategy
3. **Write the composition** in `projects/<name>/` following Remotion patterns:
   - Define a Zod schema for all dynamic props
   - Use `<AbsoluteFill>` for layering
   - Use `spring()` for entrances/exits, `interpolate()` for continuous animations
   - Use `<Sequence>` for timed sub-elements
4. **Register** it by adding an entry to `compositions` in `projects/<name>/index.tsx`

### Animation Reference

Read `animations.md` for the full animation pattern library. Key patterns:

- **Entrance**: `spring({ frame, fps, config: { damping: 200 } })` → scale/opacity from 0→1
- **Exit**: `spring({ frame, fps, delay: durationInFrames - 20 })` → subtract from entrance
- **Staggered**: Add `delay: index * staggerDelay` to each element's spring
- **Continuous**: `interpolate(frame, [startFrame, endFrame], [startVal, endVal], { extrapolateRight: 'clamp' })`
- **Color**: `interpolateColors(frame, [0, 30], ['#ff0000', '#0000ff'])` → animated color
- **Easing**: `interpolate(frame, range, range, { easing: Easing.bezier(0.25, 0.1, 0.25, 1) })`
- **Noise**: `noise3D('seed', 0, 0, frame / 20) * 10` → organic camera shake / drift
- **SVG draw-on**: `evolvePath(progress, svgPath)` → strokeDasharray/offset for reveal
- **SVG morph**: `interpolatePath(progress, pathA, pathB)` → shape morphing
- **Motion blur**: `<Trail layers={30} lagInFrames={0.5}>` → trailing effect
- **Loop**: `<Loop durationInFrames={50} times={3}>` → repeating animation
- **Freeze**: `<Freeze frame={30}>` → pause animation at a frame

### Typography

Read `fonts.md` for font loading patterns. For standard weights, use `@remotion/google-fonts`:

```tsx
import { loadFont } from "@remotion/google-fonts/Montserrat";
const { fontFamily } = loadFont("normal", { weights: ["400", "700"], subsets: ["latin"] });
```

For brand fonts, variable axes (`wdth`, `opsz`) or type that must fit exactly, download the woff2 into `public/projects/<name>/fonts/`, load it with `@remotion/fonts` `loadFont({ family, url: staticFile(...), weight: "100 1000", stretch: "25% 151%" })`, and measure real widths with a throwaway Measure composition (`production-pipeline.md` §3). Many languages run longer than English: size headlines per language.

---

## Workflow: Video

Generate a full multi-scene video with transitions.

### Process

1. **Break the description into scenes** — each scene is a self-contained component
2. **Define the video structure**:
   ```
   Intro (3-5s) → Scene 1 → Transition → Scene 2 → ... → Outro (3-5s)
   ```
3. **Use `<TransitionSeries>`** for scene sequencing with transitions:
   ```tsx
   import { TransitionSeries, linearTiming } from "@remotion/transitions";
   import { fade } from "@remotion/transitions/fade";
   import { slide } from "@remotion/transitions/slide";
   ```
4. **Calculate total duration**: sum of all scene durations minus overlap from transitions
5. **Wire everything** in a master composition with a Zod schema for all scene data

### Scene Transition Reference

Read `transitions.md` for available transitions. Key transitions:

| Transition | Import | Best for |
|---|---|---|
| `fade()` | `@remotion/transitions/fade` | Universal, subtle |
| `slide({ direction })` | `@remotion/transitions/slide` | Directional flow |
| `wipe({ direction })` | `@remotion/transitions/wipe` | Bold, editorial |
| `flip({ direction })` | `@remotion/transitions/flip` | Playful, 3D feel |
| `clockWipe()` | `@remotion/transitions/clock-wipe` | Dramatic reveals |
| Custom | Combine `<TransitionSeries>` with custom presentation | Unique brand feel |

### Timing Guidelines

| Video Type | FPS | Total Duration | Scene Duration |
|---|---|---|---|
| Social clip (TikTok/Reels) | 30 | 15-60s | 3-8s |
| Explainer | 30 | 60-180s | 5-15s |
| Presentation | 30 | 120-600s | 10-30s |
| Ad/promo | 30 | 15-30s | 3-5s |
| Brand film / motion reel | 60 | 15-30s | 1.5-4s per beat, cuts on the BPM grid |

### Standard Dimensions

| Format | Width | Height | Aspect |
|---|---|---|---|
| Landscape (YouTube) | 1920 | 1080 | 16:9 |
| Portrait (TikTok/Reels) | 1080 | 1920 | 9:16 |
| Square (Instagram, LinkedIn) | 1080 | 1080 | 1:1 |
| Feed portrait (Instagram) | 1080 | 1350 | 4:5 |
| Shorts (YouTube) | 1080 | 1920 | 9:16 |

Each format is laid out natively (one composition entry per format, layout from `useVideoConfig()`), never padded, letterboxed or cropped from another format. Safe margins per format are in `social-vertical.md` §1 (9:16) and §1b (4:5, 1:1, 16:9).

---

## Workflow: Caption

Generate captions from audio and render them as animated subtitles.

### Three Transcription Methods

Read `captions.md` for detailed patterns.

#### 1. Whisper.cpp (Local, Server-Side)
```tsx
import { installWhisperCpp, downloadWhisperModel, transcribe, toCaptions } from "@remotion/install-whisper-cpp";
```
Best for: local rendering, privacy-sensitive, no API costs.

#### 2. OpenAI Whisper API (Cloud)
```tsx
import { openAiWhisperApiToCaptions } from "@remotion/openai-whisper";
```
Best for: high accuracy, multi-language, fast turnaround.

#### 3. Whisper Web (Browser)
```tsx
import { transcribe, downloadWhisperModel, resampleTo16Khz } from "@remotion/whisper-web";
```
Best for: in-browser transcription, no server needed.

The edit pipeline (`pnpm edit cut`) uses the local `whisper` CLI instead; see `editing.md`.

### Caption Display — TikTok Style

```tsx
import { createTikTokStyleCaptions } from "@remotion/captions";

const { pages } = createTikTokStyleCaptions({
  captions,
  combineTokensWithinMilliseconds: 1200,
});
```

Each `page` contains `tokens` with `fromMs`/`toMs` for word-level highlighting. Render with `<Sequence>` per page, highlight the active word based on `useCurrentFrame()`.

### Caption Export

Use `<Artifact>` to export `.srt` files alongside the video:
```tsx
import { Artifact } from "remotion";
import { serializeSrt } from "@remotion/captions";
```

---

## Workflow: TTS

Generate text-to-speech audio and sync it with video.

The workspace ships an ElevenLabs script: write the lines in `projects/<name>/vo.json`, then `pnpm tts --project <name>` writes one clip per line to `public/projects/<name>/vo/` (format and flags in `narration.md` §1). It needs `ELEVENLABS_API_KEY` in the workspace `.env`; `pnpm tts --list-voices` lists voices for free. Before writing or generating a script, read `narration.md`: writing for TTS, the take checks, and the one-take method.

| Service | Approach | Notes |
|---|---|---|
| ElevenLabs | `pnpm tts` → .mp3 (+ timing JSON) → `staticFile()` | Best quality, paid |
| OpenAI TTS | REST API → save .mp3 → `staticFile()` | Good quality, paid |
| Google Cloud TTS | REST API → save .mp3 → `staticFile()` | Multi-language, paid |
| Browser SpeechSynthesis | `OfflineAudioContext` → data URL | Free, lower quality |

### TTS → Video Pipeline

1. **Generate audio** — save to `public/projects/<name>/audio/`
2. **Transcribe for captions** — run Whisper on the generated audio (or use ElevenLabs' character timings)
3. **Calculate duration** — use `getAudioDurationInSeconds()` from `@remotion/media-utils`
4. **Build composition** — set `durationInFrames` from audio length, layer visual scenes over audio
5. **Sync captions** — use transcription timestamps for word-level caption animation

```tsx
import { getAudioDurationInSeconds } from "@remotion/media-utils";

export const calculateMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const duration = await getAudioDurationInSeconds(props.audioSrc);
  return {
    durationInFrames: Math.ceil(duration * props.fps),
    fps: props.fps,
  };
};
```

---

## Workflow: Render

Render compositions to MP4. `pnpm render -- --id <Id>` is the quick path (it runs `pnpm registry` first).

### Local Rendering (Node.js)

```tsx
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const bundleLocation = await bundle({ entryPoint: "./src/index.ts" });

const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: "MyVideo",
  inputProps: { /* dynamic data */ },
});

await renderMedia({
  serveUrl: bundleLocation,
  codec: "h264",
  composition,
  outputLocation: "./out/my-video/video.mp4",
  inputProps: { /* same props */ },
  onProgress: ({ progress }) => console.log(`${(progress * 100).toFixed(0)}%`),
});
```

A new script that calls `bundle()` must pass `webpackOverride: withAtAlias` from `src/scripts/lib/bundle-alias.ts` (`remocn.md`).

### Cloud Rendering (AWS Lambda)

```tsx
import { renderMediaOnLambda } from "@remotion/lambda/client";

const { bucketName, renderId } = await renderMediaOnLambda({
  region: "us-east-1",
  functionName: "remotion-render-fn",
  composition: "MyVideo",
  serveUrl: "https://your-site.vercel.app",
  codec: "h264",
  inputProps: { /* dynamic data */ },
});
```

### Final-Quality CLI Render

```bash
pnpm registry && npx remotion render src/index.ts <CompositionId> out/<name>/<File>.mp4 \
  --image-format=png --color-space=bt709 --crf=16 --x264-preset=slow --audio-bitrate=320k --overwrite
```

PNG intermediates and BT.709 tagging keep flat brand colours accurate and type edges crisp. Add `--concurrency=<n>` to use more cores. Verify the output (`production-pipeline.md` §8) before reporting.

### Render Options Reference

| Option | Default | Notes |
|---|---|---|
| `codec` | — | `h264` (MP4), `h265`, `vp8` (WebM), `vp9`, `prores` |
| `crf` | 23 | Quality 0-51 (lower = better). 18 is visually lossless |
| `imageFormat` | `jpeg` | `jpeg` (fast) or `png` (transparency) |
| `jpegQuality` | 80 | 0-100 |
| `scale` | 1 | Resolution multiplier |
| `audioBitrate` | `320k` | Audio quality |
| `numberOfGifLoops` | 0 | For GIF output (0 = infinite) |

---

## Workflow: Update

Keeps the engine and the skill current with Remotion. Run it when the user asks, or when a docs page the skill relies on looks out of date.

1. `klaq-setup --update` — pulls the latest engine (`git pull`). Projects, assets and renders are gitignored and untouched.
2. `pnpm docs-update` — compares the installed `remotion` with npm's latest, pulls the docs into a fresh folder, writes `docs/remotion-changes/<date>.md` (added, removed and changed pages with diffs, and which skill files cite a changed page), then swaps the fresh docs in (previous copy in `docs/.remotion-prev/`). An incomplete pull (over 2 % of pages failed) leaves the docs untouched and exits 1. `--no-swap` reports without replacing.
3. Read the report. Triage every changed or added page that touches what Klaq uses (rendering and CLI flags, `@remotion/media`, transitions, effects, motion blur, captions, fonts, three, Studio). For each: a note for the user, a row in "New since" below, or nothing (say why).
4. Version bump, when npm is ahead: **ask the user first**. Then `pnpm add` every `remotion` and `@remotion/*` package at the same exact version, `pnpm build`, and render stills of `showreel` and `demo` before and after the bump at the same frames; any pixel difference gets a look before it is accepted.

Report: **Needs from you** first (bump yes or no, behaviour changes that affect the user's films), then the triage table (page · what changed · action), then the files changed.

---

## Workflow: Template

Scaffold from pre-built templates for common video types: run `pnpm new <name>`, then build the scenes below.

### Available Templates

| Template | Scenes | Use Case |
|---|---|---|
| `explainer` | Intro → Problem → Solution → Features → CTA | Product explainers, SaaS demos |
| `social` | Hook → Content → CTA | TikTok, Reels, Shorts |
| `presentation` | Title → Slides → Summary | Conference talks, pitch decks |
| `caption` | Background video + animated captions | Podcast clips, interviews |
| `countdown` | Timer → Reveal | Event teasers, launches |
| `testimonial` | Quote → Attribution → CTA | Social proof, reviews |

Each template scaffolds:
- Composition component with scenes in `projects/<name>/scenes/`
- Zod schema for all customizable props
- An entry in the project's `compositions` array
- Default inputProps with placeholder content

---

## AI Video Generation Pattern

When generating videos from a text prompt (the core AI use case):

### 1. Prompt → Scene Plan

Parse the user's description into a structured scene plan:

```typescript
interface ScenePlan {
  title: string;
  format: "landscape" | "portrait" | "square";
  fps: number;
  scenes: Array<{
    id: string;
    description: string;
    durationSeconds: number;
    visualElements: string[];
    text?: string;
    transition?: "fade" | "slide" | "wipe" | "none";
  }>;
  audio?: {
    type: "tts" | "music" | "none";
    text?: string;        // for TTS
    musicUrl?: string;    // for background music
  };
  captions?: boolean;
  style: {
    colorScheme: string[];
    fontFamily: string;
    mood: string;
  };
}
```

### 2. Scene Plan → Compositions

For each scene in the plan:
1. Create a scene component in `projects/<name>/scenes/`
2. Animate elements using spring/interpolate based on the description
3. Apply the style (colors, fonts, mood)

### 3. Assembly

Wire scenes together with `<TransitionSeries>`:
- Calculate total frames accounting for transition overlaps
- Register the master composition in `projects/<name>/index.tsx`, with `calculateMetadata` for dynamic duration
- Pass all scene data via `inputProps`

### 4. Audio Layer (optional)

If TTS requested:
1. Generate audio via TTS service
2. Transcribe for captions
3. Set video duration to match audio
4. Layer caption component over scenes

### 5. Render

Render with `pnpm render` or the final-quality CLI command, or open Remotion Studio (`pnpm studio`) for a preview.

---

## Reference Files

| File | Contents |
|---|---|
| `animations.md` | Animation patterns — spring, interpolate, interpolateColors, easing, noise, SVG paths, motion blur, Loop, Freeze, Series, Sequence |
| `transitions.md` | Scene transitions — fade, slide, wipe, flip, clockWipe, TransitionSeries timing |
| `captions.md` | Caption/subtitle patterns — Whisper, OpenAI, TikTok-style, SRT export, timing and layout rules (fixed chunk layout, last word ≥ 0.3 s, on time within 0.08 s) |
| `fonts.md` | Typography — Google Fonts, custom fonts, fitText, measureText |
| `rendering.md` | Render pipeline — calculateMetadata, useDelayRender, useBufferState, local/Lambda rendering, Artifacts, env vars, Still rendering |
| `components.md` | Reusable patterns — layouts, backgrounds, shapes, OffthreadVideo, audio visualization, AnimatedEmoji, Composition/Still/Folder, Player |
| `production-pipeline.md` | End-to-end film pipeline — intake (one round, ≤ 4 questions), brand extraction from a product website, multiple versions, campaign matrix and claims, brief and concept gate, `timeline.ts`, project layout, fonts and measuring, stills QA loop, score, audio measurement, final render, MP4 verification, delivery |
| `motion-craft.md` | Motion playbook — protagonist and match cuts, tone, springs vs tweens, mask-rise type, variable fonts, ball physics, world-space camera, impact rig, particles/goo/3D, line protagonist, logo build, HUD and proof slots, montage, hold rule (words/3 + 1 s) and pacing tables |
| `audio-scoring.md` | Synthesized scores — `synth.ts` Mix and instrument palette, arrangement recipes, harmony arcs, geometry-driven sound, mixing targets, pitfalls |
| `qa-checklist.md` | Pre-render and post-encode checklists, event stills (−0.12/+0.06/+0.30 s), 390 px phone sheet, self-review list, planned layout check, review report with human approval box, troubleshooting table |
| `editing.md` | Editing recorded talking-head footage: reference analysis, script rules, take selection and pause cutting, LOG/LUT, voice loudness, the edit plan (window, full, yap and screen + face layouts with a head track, graphics, captions, SFX), preview gate, final master |
| `editing-craft.md` | The rules behind `editing.md`: proof assets, script tests, hooks, CTAs, retention guidance, captions, SFX, reference targets, delivery package, recording brief, yap and screen + face, tooling not built yet |
| `social-vertical.md` | 9:16 voice-led ads and reels: safe zones, native 4:5 / 1:1 / 16:9 layouts and their margins, hook/re-hook/payoff/loop, CTA options, VO timestamps driving the timeline, captions, pure `World(t)`, choreography data shared with the score, voice-over-bed measurement, remux |
| `narration.md` | TTS narration: what `pnpm tts` does, the one-take ElevenLabs method, writing for TTS, transcript and head-of-take checks, picking a voice |
| `explainers.md` | "How X works" films: the seven decisions, the eight-movement arc, world from the medium, motion meaning, the transition contract, mechanism recipes (path, conserved quantity, dependency, expansion, cursor click, zoom, code sync, follow camera) |
| `remocn.md` | remocn component registry (~940 MIT Remotion components copied in as source): when a component beats hand-building, the live catalogue, `pnpm remocn <name>`, wiring, how to place and restyle one |
| `orchestration.md` | Splitting a film across agents: three concepts for the user to pick, the script brief, timeline as the contract, when (rarely) to split the build, a fresh critic, versions after picture lock, one render at a time |
| `assets-3d.md` | Licensed real assets (banks, licence rules, per-file catalog, credits in the post caption) and real 3D recipes mapped to `@remotion/three` (not installed) |

Tooling marked "planned" or "not built" in these files does not exist yet. Never tell the user it works.

## Local Documentation

Full Remotion docs are in `docs/remotion/` in the workspace (pulled by `klaq-setup`; refresh with `pnpm pull-docs`, or `pnpm docs-update` for a diffed refresh). Use them for deep reference when the skill files don't cover a specific API.

### New since 4.0.487 (read the docs page before using)

| Feature | Package / import | Docs |
|---|---|---|
| Pixel effects on canvas components (`effects={[blur({radius: 40})]}`): ~90 effects incl. glow, film-burn, light-leak, chromatic-aberration, halftone, lut, vignette | `@remotion/effects/<name>` (installed) | `effects.md`, `effects/*.md` |
| New transition presentations: blurSlide, bookFlip, crossZoom, crosswarp, dissolve, dreamyZoom, filmBurn, linearBlur, pushCut, ripple, swap, zoomBlur, zoomInOut, custom HTML-in-canvas | `@remotion/transitions/<name>` | `transitions/presentations/*.md` |
| Motion blur for HTML-in-canvas content (`<HtmlInCanvasMotionBlur>`) | `@remotion/motion-blur` | `motion-blur/html-in-canvas-motion-blur.md` |
| Hand-drawn annotations: box, bracket, circle, highlight, underline, strike-through, crossed-off | `@remotion/rough-notation` (not installed) | `rough-notation/*.md` |
| Callout and spark shapes | `@remotion/shapes` (not installed) | `shapes/callout.md`, `shapes/spark.md` |
| GSAP timelines driven by the frame (`useGsapTimeline()`) | `@remotion/gsap` (not installed) | `gsap/use-gsap-timeline.md` |
| ElevenLabs transcript to captions | `@remotion/elevenlabs` (not installed) | `elevenlabs/*.md` |
| Variable Google Fonts | `@remotion/google-fonts` | `google-fonts/load-variable-font.md` |
| Path morphing and centring (`interpolatePaths`, `centerPath`) | `@remotion/paths` | `paths/*.md` |
| Meme SFX library (record scratch, whoosh-style stingers) | `@remotion/sfx` (not installed) | `sfx/*.md`; scores still come from `synth.ts` |

Add a package with `pnpm add @remotion/<name>@<remotion version>`; every `@remotion/*` version must match `remotion` exactly.

---

## Anti-Patterns (Never Do These)

- **Never use CSS transitions/animations** — Remotion renders frame-by-frame; CSS animations won't work in renders
- **Never use `setTimeout`/`setInterval`** — use `useCurrentFrame()` for all timing
- **Never use the legacy `<Video>`/`<Audio>` from `remotion`** — import them from `@remotion/media`; reach for `<OffthreadVideo>` only as the explicit fallback
- **Never hardcode dimensions** — always derive from `useVideoConfig()`
- **Never use relative paths for assets** — always use `staticFile()`
- **Never use `Math.random()`** — use `random(seed)` from `remotion` for deterministic renders
- **Never use raw `delayRender()`** — use the `useDelayRender()` hook instead (prevents re-render bugs)
- **Load async data in `calculateMetadata`** (runs once before render); when a component must fetch, wrap it with `useDelayRender()` - an unguarded fetch renders frames before the data arrives
- **Never create side effects in components** — Remotion may render any frame at any time, in any order
- **Never carry state from one frame to the next or read the clock in a component** — no `x += v`, no `Date.now()` in render; derive every value from the frame number (clock-based values go in `calculateMetadata`)
- **Never use `startFrom`/`endAt` on OffthreadVideo** — use `trimBefore`/`trimAfter` (renamed in v4.0.319)
- **Never use non-`REMOTION_` env vars in components** — only `REMOTION_*` prefixed vars are bundled by Webpack
- **Never assume `.env` is read by render APIs** — pass `envVariables` explicitly to `renderMedia()`/Lambda
- **Never use `interpolate()` for colors** — use `interpolateColors()` which handles color spaces correctly (for hundreds of particles per frame, the fast `mix()` hex helper in `src/lib/motion.ts` is fine)
- **Never ship a frame you haven't seen** — render stills of every beat, cut and language version before the final render
- **Never leave a cut frame empty** — pre-roll entrances 2-5 frames before the cut; end exits together so no glyph lingers
- **Never wrap the whole film in `<CameraMotionBlur>`** — it is colour-destructive; fake blur with velocity stretch and previous-frame streaks
- **Never hardcode frame numbers in a score** — import the film's timeline (and geometry) so sound follows the picture
- **Never edit engine files or `src/Root.tsx` for a project** — build in `projects/<name>/` and import from the engine

## Troubleshooting

| Symptom | Fix |
|---|---|
| A new composition does not appear in Studio or render | Check it is exported in `compositions` from `projects/<name>/index.tsx`; run `pnpm registry` and read its errors |
| zod version-mismatch warning on every render | Harmless (the workspace pins zod 3); ignore |
| `<Audio>` breaks stills before the score exists | Add a silent placeholder: `ffmpeg -loglevel error -y -f lavfi -i anullsrc=r=48000:cl=stereo -t <seconds> -c:a pcm_s16le public/projects/<name>/score.wav` |
| `npx remotion still` is slow per frame | Use `pnpm stills` (one bundle, parallel stills, contact sheets) |
| Text block wraps word by word | Give absolutely positioned text blocks an explicit width; set sublines to `nowrap` |
| Glow-heavy frames render slowly | Size SVG filter regions to the visible viewport, not the whole world |
| `rm` with a shell variable is refused | Use a literal path or write into a fresh directory |

More symptoms and causes: `qa-checklist.md`.
