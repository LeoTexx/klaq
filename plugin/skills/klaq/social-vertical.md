# Vertical Social Films (Reels / TikTok / Shorts)

Voice-led 9:16 ads and organic reels, 20-30 s, built like the brand films (`production-pipeline.md`) with the extra rules below. A typical shape: a phone lock screen at a bad moment → the work piling up → calm once the product takes over → offer card, ending in a seamless loop. Build the shared pieces (theme with safe zones, voice timing helpers, captions, phone frame, logo, offer card) inside the project; `src/components/ReelsSafeZone.tsx` is the engine's QA overlay.

## 1. Format and safe zones

1080×1920, 60 fps. The platform UI covers part of the frame. Design one master that survives paid placements:

| Zone | Covered | Rule |
|---|---|---|
| Top | 0-270 | status bar, account name: nothing critical |
| Bottom (paid) | 1248-1920 | CTA button, caption, sound: critical text stays at y ≤ 1248 |
| Bottom (organic) | 1420-1920 | texture may continue below 1248, never words |
| Right column | x > 940, y 880-1700 | like/comment/share icons: keep text at x ≤ 920-940 |

- QA overlay: render stills with `ReelsSafeZone` (`src/components/`) behind a `qa` prop. Pass the paid margin: `{ top: 250, bottom: 672, right: 150, rightFrom: 880, rightTo: 1700 }`.
- Centre the composition on x = 540 anyway. Decorative edges (card corners, a pile's right side) may pass under the icon column; labels and numbers may not.
- A phone mockup at w ≈ 820 keeps its right edge at x ≤ 920. Chat text ≥ 38 px.

### 1b. The other feed formats: native, never padded

Campaigns usually need more than 9:16. Lay out each format for its own frame: don't sit a finished render of another aspect ratio inside bars or a blurred fill, and don't crop one format out of another. In Remotion: one composition entry per format, the same component and timeline, with the layout read from `useVideoConfig()` (elements in a row on wide frames, in a column on vertical ones, and fewer of them on tall frames).

| Platform | Aspect | Size | Keep text, logos, CTA inside (top · right · bottom · left, px) |
|---|---|---|---|
| Reels / TikTok / Shorts / Stories | 9:16 | 1080×1920 | Use §1 above (stricter at the bottom for paid). A looser organic box: 260 · 150 · 460 · 150 |
| Instagram feed | 4:5 | 1080×1350 | 110 · 90 · 120 · 90 |
| LinkedIn feed, square feeds | 1:1 | 1080×1080 | 90 · 90 · 90 · 90 |
| X, YouTube, site embeds | 16:9 | 1920×1080 | 80 · 110 · 90 · 110 |

The 4:5, 1:1 and 16:9 margins are starting values; check them against real posts on each platform. Only backgrounds and textures bleed to the edge. On tall formats, drop content rather than shrinking it, and split a crowded screen into two beats. Minimum type on 1080-wide frames: roughly 34 px body, 28 px labels, 96 px or more for headlines. Name files `<name>_<platform>_<W>x<H>.mp4`. Render drafts in the first format only, and build the other layouts after the first is approved (`production-pipeline.md` §0).

## 2. Structure

| Beat | When | Rule |
|---|---|---|
| Hook | frame 0 | No fade-in, no logo. Frame 0 is the thumbnail: it already shows the situation (pre-rolled elements, see §5). Voice starts by frame 4. |
| Re-hook | ~10 s | A pattern interrupt: freeze, dim, one new element (everything stops and a single coloured dot appears with a ripple). |
| Payoff | ~18-20 s | The same frame as the hook, transformed (the same late-night lock screen, now with one calm notification). |
| Offer | last 6-8 s | One card; each line lands on its spoken word. Captions hidden here. CTA on screen ≥ 2.5 s. |
| Loop | last 0.5-0.8 s | Transition back into frame 0's exact state so the replay is seamless. |

For organic reach, prefer "DM me WORD" over "comment WORD": platforms tend to down-rank engagement bait. Somebody has to answer those DMs.

Three CTA options; recommend the DM one and let the user choose by goal:

| Goal | CTA | Note |
|---|---|---|
| Leads (recommended) | "DM me WORD" | Someone must answer the DMs |
| Reach beyond followers | "Send this to someone who …" | Shares carry a lot of weight with people who don't follow the account. Write the script around "who would they send this to, and with what message?" |
| Growth | Follow / save | Weakest for reach; a long course or product pitch is the weakest CTA of all |

One sentence, about 3 s, after the payoff, in the last third. Never a CTA before the first payoff. More on CTAs: `editing-craft.md` §4.

## 3. Voice-over drives the timeline

1. Write each line as a separate clip in a `vo.ts` list in the project. Spell brand names phonetically for the TTS, keep the real spelling on screen. Writing rules, the one-take alternative and the take checks are in `narration.md`.
2. `pnpm tts` with timestamps on calls ElevenLabs `/with-timestamps` and writes `<clip>.json` (character alignment) next to each mp3 in `public/projects/<name>/audio/`.
3. `timeline.ts` imports the JSON and lays the clips end to end with per-clip breaths, e.g. a project helper `layClips([{ id, file, align, gapBefore }], FPS)` that returns each clip's start frame.
4. Beats come from words, not seconds: a `wordAt(clip, "cancelled.")` helper returns the frame that word is spoken. Labels, flips and offer lines land on it.
5. Measure clip lengths before planning beats. Total length = speech + breaths; trim breaths before cutting words.

Captions: burned in, 2-4 words, chunked at punctuation, the spoken word highlighted; a light pill on dark scenes, a dark pill on light ones (flip it with the scene's light level). Place them above the content, never over the element being read. Rules in `captions.md`. Turn off the platform's auto-captions when posting.

## 4. Building the scene

- **World as a pure function of t.** `World({ t })` renders backdrop, clock, cards and camera from `t` alone. The loop at the end renders a second `World` at negative `t` inside a pull-down shade.
- **Choreography as data.** Every event (a notification landing, a card flying, a flip, an absorb) lives in a pure `data.ts` (no React, no fonts) that the score imports too. The picture and the sound read the same frames.
- **List reflow with spring superposition.** For a stack where every arrival pushes older items down: `k̃(t) = -1 + S(t - at) + Σ S(t - at_newer)`, `y = slotY(k̃)`. Precompute `spring()` into a 150-entry table (`S(t)`), because there are dozens of springs per item per frame.
- **Shared-element morph.** A notification flies to its pile while its box shrinks (900×134 → 200×60) and its content cross-fades to a mini card. Use one box with an interpolated size and two content layers.
- **Colour by story time.** A time-lapse re-colours everything from the clock (`daylight(minutes)`). Surfaces cross-fade linearly. Text flips with a smoothstep around mid-light so it never sits grey on grey at dusk.
- **Protagonist hand-off to a shared component.** A small icon flies from the scene to the offer card's logo position while a circle reveal opens from it. The card takes over at the exact frame (`beats.handoff`: hidden before, fully formed after). Compute the target from the card's layout, not by eye.
- **Look native without copying a brand.** Lock screen, notifications and chat use your own glyphs and colours. No third-party app logo, signature colour or wallpaper. The voice can still name the channel.
- **Disclaimers.** Simulated UI with invented names and counts carries a "Simulation. Fictional data." line on the end card.

## 5. Seamless loop

- Give the hook pre-roll: elements that "arrived" at t = -30, -18, -8 so frame 0 is full.
- At `T.loop`, slide a night shade down over the offer, containing `World` at `t = f - T.end`. The pre-roll replays as the shade lands, so the last frame equals frame -1.
- In the score, play the pre-roll's sounds at `T.end + at` and end with the same drone level the file starts with, with a 2 ms fade-out only.

## 6. Audio for voice-led films

- Load the voice into the mix: `loadAudio(mp3)` → a VO bus at `clip.at / FPS`. Duck every other bus from it: `mix.duckFrom(VOICE, 0.62)` (≈ -8 dB under speech).
- Keep a separate `VOICE` buffer as the sidechain source. A muted QA render then still ducks the bed the way the real mix does.
- Trim the whole bed with one factor (`BED = 0.5` in a `place` wrapper) rather than chasing single gains.
- **Measure the voice against the bed.** Render the full mix and note `master gain` (printed by `writeWav`). Render again with `MUTE_VO=1 MASTER_GAIN=<g>` (`render({ gain })` fixes the master gain so both files share one scale). Then compare LUFS per speech window. The voice must sit ≥ 6 dB above the ducked bed in every window: `voice = 10·log10(10^(mix/10) − 10^(bed/10))`.
  A typical first pass has the bed 0-3 dB louder than the voice in a few windows; after trimming, it should sit 6-12 dB under.
- Dense sections (groove + plucks + pads under a long line) are where it fails. Trim those sections, not the whole film.
- A mix-only change doesn't need a re-render. Remux: `ffmpeg -i film.mp4 -i mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -ar 48000 -movflags +faststart out.mp4`.
- UI instruments in `synth.ts`: `pop` (bubble), `typing`, `buzz` (phone on a table), `coin`, `rewind` (time-lapse), `powerDown` (nobody answered).
- A campaign shares one notification sound (`chime()` is a ready-made two-blip signature). A brand's signature sounds belong in a shared module in the project that every score imports, never as a local copy in one score.
- Alternative to `MUTE_VO`: give the score a `--stems <dir>` flag that writes the voice and bed stems on the mix's scale.

## 7. QA additions

- [ ] Stills with the paid overlay at hook, each label, re-hook, each verb, payoff, offer, loop
- [ ] Frame 0 is legible and full, and the last frame matches frame -1 (compare frame 0 to `DURATION - 1`)
- [ ] No caption or label below y = 1248 or right of x = 940 (inside y 880-1700)
- [ ] Counters never show a 0 when a label lands (count from launch, not from landing)
- [ ] Voice ≥ 6 dB over the ducked bed in every speech window; integrated -14 to -15 LUFS
- [ ] Contact sheets tile 360×640 for vertical comps (`pnpm stills` follows the composition's aspect)
