# Production Pipeline: Brand Films, Reels, Promos

The pipeline behind the example reel (`src/compositions/showreel/`, 15 s). Use it for any film where motion quality matters. Every step ends with a check you can run.

All paths are relative to the workspace root (`$KLAQ_HOME`, default `~/klaq`). A film lives in `projects/<name>/`, its assets in `public/projects/<name>/`, its renders in `out/<name>/`.

---

## 0. Brief (before any code)

### 0a. Intake: one round of questions

Ask only what the request leaves open, in **a single `AskUserQuestion` call with at most 4 questions**. Put the best option first in each, labelled "(Recommended)" with a one-line reason. Skip questions that do not apply (there is no product URL to ask about for a story; no voice question for a film without narration).

Choose the four from this list, most open first:

| Question | Options (recommended default) |
|---|---|
| Formats | 9:16 · 4:5 · 1:1 · 16:9, multi-select (9:16 for Reels/TikTok; each extra format is a native layout, `social-vertical.md` §1b) |
| Length | ~15 s · 20-30 s · 30-60 s · 60-90 s (from the idea: one message 15 s, ad or reel 20-30 s, narrated explainer 30-60 s) |
| Audio | Score only · voice-over + score · both cuts (voice-over + score when the viewer needs context; score only for visual jokes and showreels) |
| Visuals | Brand UI / vector · real photos + 3D (`assets-3d.md`) · mix (brand UI for products; real material for story and topic films) |
| Language | From the brand and the audience; one or several |
| Pacing | Calm · dynamic (`motion-craft.md` §12; calm with 3D or narration) |

If the user skips a question, use the recommended option. Lock the length; if the beat sheet does not fit the hold rule, say so and propose a length rather than rushing beats.

### 0b. From a product website

When the brief is a product URL, pull the brand out of the site before designing:
- Open the site with Claude in Chrome. Take exact tokens and fonts from the stylesheet's CSS variables, any Tailwind config and the `@font-face` declarations; save the logo SVG; screenshot the real product screens and charts at full resolution into `public/projects/<name>/assets/`.
- Take headlines, CTAs and stats **word for word**, noting the page each came from. Never make up rankings, scores or statistics.
- Write `projects/<name>/brand.md`: colours and their roles, fonts and weights, logo files, a catalogue of UI components, chart styles (copy the site's chart style exactly, no added decoration), copy, and claims to avoid (outdated prices, "free" promises).
- Parodies of another medium (terminal, trailer, chat) are restyled in the brand's own system.

### 0c. Several versions (not the default)

When the user asks for alternatives, spawn one independent agent per **creative angle** (a different story or format, never just another palette), in parallel so the ideas do not anchor on each other. Each agent gets the brief, `brand.md`, the approved facts and its angle, and **stops at style frames** (a still of every beat) for review before animating. Each version costs a full build, so time and tokens grow roughly linearly; confirm before going past 3. The default stays one film built by one hand.

### 0d. Campaign matrix and claims (method; tooling planned)

For ads that need several hooks, formats and CTAs:
- **Data drives content, code drives motion.** A `campaign.ts` beside the timeline holds the copy, hooks, CTAs, formats, asset paths and claims; scenes never hardcode them. Changing copy is a data edit plus a re-render.
- **Claims.** Any number on screen must belong to a claim with a source and `approved: true`; incidental numbers (a year, a version) go on an explicit allow-list. No source, no number.
- **Get one reference video right first**, in the first format. Then add formats, then the alternative hooks and CTAs. Multiplying a mediocre film only produces more mediocre films.
- **Matrix**: for example 3 hooks × 3 formats × 2 CTAs = 18 exports. Mark the joins in the timeline (`T.body` where the hook ends, `T.cta` where the CTA begins); nothing between them depends on the hook or CTA, so the middle is shared. Keep every hook the same length.
- **Delivery**: name files `<name>_hook-A_cta-B_<platform>_<W>x<H>.mp4`, export a poster frame per format, and write a manifest of inputs and outputs with hashes.

Planned, not built: a validator (schema, files exist, fonts load, copy within character limits, every on-screen number backed by an approved claim; exit 1 on any error) and a matrix renderer. Until then, run the checks by hand and register each combination as its own composition entry.

### 0e. Brand sources and the concept gate

1. **Read the brand's source of truth**: positioning or strategy docs, voice guide, approved-facts list, the live site copy, design explorations, the logo SVG. When documents disagree, trust the newest decision.
2. **Screenshot HTML design explorations** instead of reading large markup files:
   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
     --virtual-time-budget=4000 --window-size=1440,3600 --screenshot=/abs/out.png "file:///abs/path/page.html"
   ```
   (On Linux the binary is `google-chrome` or `chromium`.)
3. **Extract tokens**: palette (exact hex), gradient stops, fonts and weights, signature devices (an angle, a line, a status chip), voice rules (banned words, punctuation rules, claim discipline).
4. **Copy that sells** (offers, CTAs): if a copywriting skill is installed, use it for voice and claim discipline; otherwise apply the brief in `orchestration.md` §2 yourself. One offer, one CTA, the risk removed for the viewer. Save the approved copy as `work/<name>/script.md`.
5. **Concept gate**: for brand work, present (a) what you understood about the company, (b) the concept in one line, (c) a storyboard table `time · beat · what happens · on screen`, (d) 3-4 decisions with your recommended defaults (length, language, format, live numbers). Build only after a go. When the user asks you to just go, build first and show.

**Check:** every on-screen number traces to an approved fact or is computed from a source (see `calculateMetadata` below).

---

## 1. `timeline.ts`: one source of truth for picture and sound

`pnpm new <name>` creates `projects/<name>/timeline.ts`. Fill it first. The composition AND the score import it, so every hit lands on its frame.

```ts
export const FPS = 60;              // 60 for motion-heavy films
export const BPM = 120;             // 120 BPM at 60 fps → beat = 30 frames, bar = 120 frames
export const BEAT = 30, BAR = 120;
export const DURATION = 900;        // 15 s
export const T = {                  // named event frames, grouped by section
  pull: 240,                        // big moments on bar downbeats (multiples of 120)
  launch: 720,
  logo: 840,
};
export const IMPACTS = [{ f: 120, s: 1 }, { f: 720, s: 1 }];   // camera rig input (0..1 strength)
export const SECTIONS = [{ from: 0, n: "01", label: "Principles" } /* … */];
```

Rules:
- Big moments (drop, final hit, logo resolve) sit on bar downbeats; cuts sit on beats or eighth notes (15 frames).
- A calm brand film can keep 120 BPM and play it half-time (a pulse every 60 frames).
- Derived schedules (heartbeats, unit spawns, status chip states) are exported from the timeline or geometry module, never re-typed in the score.

**Check:** `grep` the score script; it should import the timeline, not hardcode frame numbers.

---

## 2. Project layout

```
projects/<name>/
├── index.tsx        # exports compositions: KlaqComposition[] (one entry per language/format)
├── timeline.ts      # frames, beats, impacts, sections
├── theme.ts         # tokens + loadFont() for local woff2 files
├── copy.ts          # per-language strings (Record<Lang, Copy>)
├── geometry.ts      # world-space paths, camera keys, schedules (when there is a world)
├── logo.ts          # real logo SVG paths, split into parts
├── scenes/          # one file per scene (or parts/: Background, World, Overlay)
├── <Film>.tsx       # the film component + calculateMetadata
└── score.ts         # synthesized score
```

- Register one entry per language in `compositions` (`<Name>` and `<Name>-ES`, say) with `defaultProps: { lang }`. `pnpm registry` picks them up; never edit `src/Root.tsx`.
- Shared helpers live in `src/lib/motion.ts` (import, never edit): `clamp`, `lerp`, `prog`, `ease.*` (incl. `inOutSine`, `outExpo`, `outBack`), `tween`, `SPRING` presets (`snap`, `pop`, `soft`, `jelly`), `sp(f, start, config, fps = 60)`, `hash`, `noise1`, `mix` (fast hex mix for hundreds of particles), `smoothClosedPath`, `smoothOpenPath`.
- Live numbers (days since a start date, uptime clocks) come from `calculateMetadata`, so every frame of one render gets the same value:
  ```ts
  export const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => {
    const ms = Date.now() - new Date(START).getTime();
    return { props: { ...props, days: props.days ?? Math.floor(ms / 86_400_000) } };
  };
  ```
  The number freezes on the export date; say so in the delivery note and give the re-render command.

---

## 3. Fonts and measurement

- Download woff2 files to `public/projects/<name>/fonts/` and load them with `@remotion/fonts` `loadFont()` (blocks the render until loaded). Variable axes need the full variable file: request the Google Fonts CSS2 API with a modern User-Agent and the axis ranges, then fetch the `/* latin */` block URL.
  ```bash
  curl -sA "Mozilla/5.0 (Macintosh) Chrome/126.0" "https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wdth,wght@8..144,25..151,100..1000"
  ```
  `loadFont({ family: "Roboto Flex", url: staticFile("projects/<name>/fonts/RobotoFlex-latin.woff2"), weight: "100 1000", stretch: "25% 151%" })`
- The latin subset covers Western European diacritics (ã, ç, é, ñ, ö). Many languages run 15-30% longer than English: size headlines per language (for example 106 px in English, 94 px in the longer language).
- **Measure before you design type that must fit**: a temporary 1-frame `Measure` composition renders the text at several axis values, measures with `getBoundingClientRect()` / canvas `measureText()` inside `useLayoutEffect` after `document.fonts.ready`, holds the frame with `useDelayRender()`, and prints the numbers into the frame. Render it with `pnpm stills`, read the PNG, hardcode the table (for example the width of "EVERYTHING" at wdth 25→151), then remove the debug entry.

---

## 4. Stills QA loop (your eyes)

`pnpm stills` (`src/scripts/stills.ts`) bundles once and renders many frames in parallel:

```bash
pnpm stills --id <CompositionId> --frames 0,60,240,600 --out out/<name>/stills --sheet 4
pnpm stills --id <CompositionId> --range 660:1100:20 --out out/<name>/stills --sheet 6
```

- `--sheet N` tiles a contact sheet (N columns, 640 px cells) with ffmpeg `xstack`. Frame order = sorted file order (cells carry no labels, since many ffmpeg builds lack `drawtext`).
- Read the sheet first, then open full-resolution frames for typography and detail.
- Before the score exists, drop a silent placeholder so `<Audio>` resolves:
  `ffmpeg -loglevel error -y -f lavfi -i anullsrc=r=48000:cl=stereo -t 20 -c:a pcm_s16le public/projects/<name>/score.wav`

Work in batches: render a section, list every problem you see, fix them all, render again. Beyond regular intervals, render every named event at −0.12/+0.06/+0.30 s, every camera move at 10 frames, and a 390 px phone sheet (`qa-checklist.md` §1b). Run `qa-checklist.md` before the final render.

---

## 5. Score

Write `projects/<name>/score.ts` using `src/scripts/lib/synth.ts` (see `audio-scoring.md`). It imports the timeline (and geometry, when sound follows motion) and writes `public/projects/<name>/score.wav` (48 kHz, 16-bit, dithered).

```bash
pnpm tsx projects/<name>/score.ts
```

Regenerate whenever the timeline changes. Proof that a refactor changed nothing: the WAV's md5 (`md5 -q` on macOS, `md5sum` on Linux) is identical before and after.

---

## 6. Measure the audio (you cannot listen)

```bash
ffmpeg -hide_banner -nostats -i public/projects/<name>/score.wav -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|LRA|Peak):"
ffmpeg -loglevel error -y -i public/projects/<name>/score.wav \
  -lavfi "showspectrumpic=s=1800x560:mode=combined:scale=log:fscale=log:legend=1:color=intensity" work/<name>/spectrum.png
```

Read the spectrogram against the timeline: hits as vertical bands at the right seconds, arpeggios as staircases, silence where the picture breathes. Targets in `audio-scoring.md`.

---

## 7. Final render

```bash
pnpm registry && npx remotion render src/index.ts <CompositionId> out/<name>/<File>.mp4 \
  --image-format=png --color-space=bt709 --crf=16 --x264-preset=slow --audio-bitrate=320k --overwrite
```

- PNG intermediates + BT.709 tagging give accurate colour on flat brand fills and crisp type edges.
- On a recent laptop, 900-1200 frames at 1080p60 take one to a few minutes; add `--concurrency=<n>` to use more cores.
- Several languages: loop over composition ids, write a log per render, check exit codes.

---

## 8. Verify the encoded file

```bash
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,color_space -show_entries format=duration,size -of compact out/<name>/<File>.mp4
ffmpeg -hide_banner -nostats -i out/<name>/<File>.mp4 -vn -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):"
ffmpeg -loglevel error -y -i out/<name>/<File>.mp4 -vf "select='not(mod(n\,30))',scale=400:-1,tile=6x5:padding=4:color=gray" -frames:v 1 work/<name>/overview.png
ffmpeg -loglevel error -y -ss 15.5 -i out/<name>/<File>.mp4 -frames:v 1 work/<name>/spot.png
```

Expect: `nb_frames` = DURATION, `color_space=bt709`, AAC present, integrated loudness on target (AAC adds about +0.1 dB true peak). Spot-check every frame you fixed.

---

## 9. Deliver

- Open the file (`open out/<name>/<File>.mp4` on macOS).
- Report with **Needs from you** first: listen to the audio (it was verified by measurement only), approve copy, note any number that freezes at export and the command to refresh it.
- Then a beat table (time · beat · what happens), the files, the filled review report with its approval box (`qa-checklist.md` §3b), and the next options (format cuts such as 4:5 or 9:16, A/B lines).
- When real assets were used, offer the post caption with the credits for every CC BY / BY-SA file (`assets-3d.md` §2).
- Projects are gitignored; nothing needs committing.
