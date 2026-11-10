# Editing Recorded Video (talking head → vertical social video)

Turn a raw camera recording into a 1080×1920 edited video in the style of reference videos: best take per sentence, pauses and fluffs cut between words, camera alternating between a window under an animated graphic and full screen, word-by-word captions, a LUT for LOG footage, voice at −14 LUFS, discreet SFX, a preview before the final.

Code: `src/scripts/edit/` (pipeline CLI) and `src/compositions/talking-head/` (the `TalkingHead` edit engine and its built-in graphics). Each edit's plan lives in the user's project, `projects/<slug>/index.tsx`.

This file is the procedure. The rules behind it (script tests, hooks, CTAs, retention guidance, caption and SFX rules, the yap and screen + face formats, tooling not built yet) are in `editing-craft.md`.

```bash
#   00 intake: up to 4 questions (no command)
pnpm edit ref <slug> <ref1> <ref2>                      # 01 analyse references (files or URLs)
#   01b proof assets: browse, capture, log each in work/<slug>/sources.md (no command)
pnpm edit cut <slug> --raw <file> --script <script.txt> # 03a transcribe, choose takes, cut pauses
pnpm edit assemble <slug>                               # 03b cut footage, LUT if LOG, voice −14 LUFS
#   write projects/<slug>/index.tsx exporting editComposition(plan)
pnpm stills --id Edit-<slug> --frames … --props '{"qa":true}' --out out/<slug>/stills --sheet 6
pnpm edit preview <slug>                                # 03d half-res preview + one still per sentence
pnpm edit final <slug> --approved                       # 03e full render, mix mastered to −14 LUFS
#   04 deliver: versioned file, light copy, transcript check, post caption, version log (checklist)
```

`<slug>`: lower-case letters, digits, hyphens. Files (all gitignored):

| Folder | Contents |
|---|---|
| `work/<slug>/` | Scratch: raw link, audio, `transcript.json`, `takes.md`, `refs/`, `sources.md`, `versions.md` |
| `public/projects/<slug>/` | What the composition reads: `cuts.json`, `footage.mp4`, `head.json`, `proof/`, screen recordings |
| `projects/<slug>/` | The edit plan (`index.tsx`) and any custom graphics |
| `out/<slug>/` | Preview, stills, final, delivered versions |

---

## 00 — Intake

Ask before starting, in one `AskUserQuestion` call: at most 4 questions, the recommended option first and marked "(Recommended)" with a one-line reason. Skip any question the user already answered or the material answers. Propose; the user picks or writes their own.

| Question | Options (recommended first) |
|---|---|
| What do you have? | Full recording (go to 01) · An idea, not recorded yet (01, 01b, 02, then stop: the user records and comes back) · A reference to copy the style of (01 first) · Only the hook recorded (not covered end to end by this pipeline: the rest would be a voice-led film, `social-vertical.md`; say so) |
| Format | Recommend from the content: **talking head** (camera window under a graphic, alternating with full screen: ideas that need a diagram or a number) · **yap** (full-screen face, one element at a time pops up above or beside the head: opinion, story, a few pieces of evidence) · **screen + face** (screen recording on top, whole head below: tutorials, product walkthroughs). Layouts mix freely in one video (`editing-craft.md` §11) |
| CTA | Comment WORD · DM WORD · Send to someone · No CTA. Recommend by goal (lead, reach, reach beyond followers) as in `editing-craft.md` §4; if a WORD, ask what it delivers |
| Sound | Synthesized kit, whoosh and pop (Recommended: the default) · Fewer, quieter sounds (kit at lower `sfxVolume`; sounds on story beats are guidance only, not a plan field yet, `editing-craft.md` §7) · None |

Then say in one line what you will do ("one recording, 7 sentences, ~45 s: I'll cut by sentence, find the sources for the 3 numbers, and build window/full layouts"). Technical choices are yours: inform, don't ask.

## 01 — Start from the references

The user sends two videos whose editing they want reproduced (files, or URLs that `yt-dlp` can fetch). If they want help choosing, or have none, find 3 yourself and show link · views · what to take from each: the same format they will record, a similar length, and a video that did well above that creator's usual views (`editing-craft.md` §8).

1. `pnpm edit ref <slug> <ref1> <ref2>` measures what can be measured and writes `work/<slug>/refs/report.md`:
   cuts per minute (jump cuts included), words per minute, silences over 0.3 s per minute and whether pauses were removed, integrated loudness, true peak, LRA, and whether a music bed runs under the voice.
2. **Look at the frames**; the numbers don't cover the visuals. Read `refs/<n>/sheet.jpg` (1 fps), `refs/<n>/shots/` (one still per shot) and `refs/<n>/motion/` (0.6 s strips at 10 fps around each cut).
3. Deliver the analysis in five parts, in the user's language:

| Part | Source |
|---|---|
| **Rhythm**: cuts/min, words/min, pauses removed? | `report.md` |
| **Layout**: where camera, graphics and captions sit; when the camera goes full screen | `sheet.jpg`, `shots/`: note which sentences go full screen (usually the hook, punchlines, the CTA) |
| **Visual**: typography (family class, weight, case), colours (hex picked from stills), graphic style | `shots/`; name the closest Google Font |
| **Motion**: how elements enter and leave, which transitions | `motion/` strips: spring pop, slide, scale, mask, cut vs animated move |
| **Audio**: voice LUFS, music, SFX | `report.md` (music bed is an estimate: say "confirm by ear"); SFX you can't hear, only infer from the motion |

4. Add the targets the edit will be held to: cuts in the first 3 s (count the shot change times under 3.0 s in `report.md`), on-screen text every X s (count text changes on `sheet.jpg`), average shot length. Without targets the rhythm drifts (`editing-craft.md` §8).
5. End with a clear split, as a table: **what I can reproduce** (this pipeline, built-in graphics, any custom graphic written in React, layout moves, captions, LUT, loudness) vs **what depends on you** (recording quality: light, framing, mic; brand font and palette if they differ from the references; the camera profile if the footage is LOG but untagged; music: none is added by default, a bed can be synthesised with `synth.ts` or you supply a licensed track; approving takes and the preview).

## 01b — Find the proof

Before the script, find the real thing behind every claim: a screenshot of the primary source with the sentence visible, the number where it was published, the logo of each tool named, a licensed photo. Browse with **Claude in Chrome**; read and capture only, never like, comment, follow or post.

1. Capture at 2x, cropped so the full sentence fits. Close pop-ups, chat widgets and banners first. Blur e-mails, phone numbers, private people's names and anything that could help an attacker.
2. Save what the video shows in `public/projects/<slug>/proof/` (a `custom` graphic reads it with `staticFile("projects/<slug>/proof/…")`).
3. Log every asset as one line in `work/<slug>/sources.md`: file · URL · date · what it proves · licence and author.
4. **A number with no line in `sources.md` comes out of the script.** So does a claim with no evidence.

Where to look per asset type, licence rules and the log format: `editing-craft.md` §1.

## 02 — Write the script

Vertical, 40-50 s, about 110-130 spoken words:

- Hook in the first 2 seconds, in one of two styles chosen **by context** (`editing-craft.md` §3): **A. curiosity** that withholds the answer (a story, a reveal, a payoff that is visual or comes with evidence later) · **B. a statement that already gives the fact** (the fact itself surprises: a number, a counter-intuitive claim; cold audiences in ads). Lean toward B by default. When a hook is a question, the next line answers it. When unsure, write one of each and let the user pick.
- The first repeatable fact (a number, a screenshot, a reveal) lands **by 14 s**. Before it: no definition, no announced outline ("there are four parts…"), no CTA.
- Context in one sentence; the line after the hook already teaches.
- 3 to 5 clear steps, one idea per sentence. Each block explains the concept first, then gives the example.
- No empty punchlines: delete any line that only announces, dramatises or moralises ("Here's the twist.", "It isn't magic. It's math."). More examples: `editing-craft.md` §2.
- The first screen after the face leaves (the first graphic) is evidence from `sources.md`, not a title.
- Closing call to action.

First person, short sentences, spoken language. Deliver only the text to be said to camera, one sentence per line, no scene directions. Save it as the script file for `--script`: the cut step matches every script sentence to the recording, and the captions use the script's spelling ("5", "WhatsApp", the CTA keyword in capitals) with the voice's timing. So **write numbers as digits** ("5", "397", currency joined as "$397"), and check the match percentages in `takes.md` (`editing-craft.md` §2, digits note).

Before showing the script, run every rule above as a test on it; the tests are in the `editing-craft.md` §2 table.

CTA: three options; offer them and let the user choose, don't swap one silently. One sentence, about 3 s, after the payoff, in the last third (`editing-craft.md` §4).

| CTA | Works when |
|---|---|
| "Comment the word [WORD]" | Someone (or an automation like ManyChat) answers every comment with the promised item. Platforms tend to down-rank engagement bait (`social-vertical.md` §2) |
| "DM me WORD" | Organic reach without engagement bait; somebody has to answer the DMs |
| "Send this to someone who…" | The goal is reach beyond followers: shares count heavily with non-followers |

Recording brief to give the user: phone or camera **horizontal in 4K** (the vertical full-screen shot crops a 1215×2160 window from it, so 4K keeps it sharp), light on the face, mic close. **Got it wrong? Pause, then say the whole sentence again.** The last complete take wins. **1 s of silence before and after each take.** Where a graphic will appear, **point up and hold about 1 s** (in window mode the graphic sits above the camera). For **yap**: leave headroom (the head in the upper-middle third, not touching the top), stay roughly centred, keep the face visible (the head track needs it). For **screen + face**: record the screen separately (macOS `Cmd+Shift+5` or QuickTime, a clean browser window, desktop layout for a desktop product, zoom the page so text reads on a phone), and say the URL if it matters. More: `editing-craft.md` §10-11.

## 03 — Edit

### a. Cut: `pnpm edit cut <slug> --raw <file> --script <file>`

- Whisper turbo, word timestamps, cached in `work/<slug>/transcript.json` (on a laptop CPU, roughly 1 min per 30 s of audio).
- Every attempt at every script sentence is found; the **last** take scoring within 8 points of the best wins (an abandoned take scores low and is skipped).
- Word edges are moved onto the real speech onset and offset from the audio level, then pauses over `--gap` (0.25 s) and hesitation sounds (the `FILLER` pattern in `cut.ts`; extend it for your language) are cut. Cuts always fall between words.
- Without `--script`, an utterance repeated within the next three is treated as a botched take and dropped.
- Writes `public/projects/<slug>/cuts.json` and `work/<slug>/takes.md`. **Show the user `takes.md`** (every take, which one was chosen, the match score) before going on. They override with `--pick <sentence>:<take>` (saved in `picks.json`). A sentence with "No take found" needs a re-record or a script edit.

### b. Assemble: `pnpm edit assemble <slug> [--lut …]`

- Frame-exact trim and concat with 6 ms audio fades (no clicks), capped at 2160 px tall.
- **LOG:** `--lut auto` (default) grades automatically only when the file is *tagged* LOG (Apple Log, S-Log). Footage that merely looks flat stops with a question: ask which profile it was shot in, then re-run with `--lut apple-log | slog3 | flat | <manufacturer>.cube | none`. Generated LUTs (`lut.ts`) decode the published curve, convert the gamut to Rec.709 and tone-map: a solid starting grade, not the manufacturer's look. When a manufacturer LUT exists, use it. `--exposure 1.2` lifts a dark grade. Check one file with `pnpm edit lut <file>`.
- **Voice:** mono, high-pass at 80 Hz, a small cut at 250 Hz, 3:1 compression, two-pass loudnorm to −14 LUFS / −1 dBTP, then dual-mono stereo.

### c. Plan: `projects/<slug>/index.tsx`

The plan is a project like any other film. It exports compositions built with `editComposition(plan)`, which registers an `Edit-<slug>` composition:

```tsx
import { editComposition, sentence, type Cuts, type EditPlan, type HeadTrack } from "../../src/compositions/talking-head";
import { loadFont } from "@remotion/google-fonts/Inter";
import cutsJson from "../../public/projects/my-edit/cuts.json";
import headJson from "../../public/projects/my-edit/head.json";

const { fontFamily } = loadFont();
const cuts = cutsJson as Cuts;
const s = (k: number) => sentence({ cuts }, k);   // { from, to } of sentence k (0-based), in seconds

const plan: EditPlan = {
  slug: "my-edit",
  cuts,
  footage: "projects/my-edit/footage.mp4",
  head: headJson as HeadTrack,
  theme: { font: fontFamily, /* bg, ink, card, accent, accent2, caption, keyword */ },
  keywords: ["397", "free"],
  layout: [{ at: 0, mode: "full" }, { at: s(1).from, mode: "window" }],
  graphics: [ /* one per spoken idea */ ],
};

export const compositions = [editComposition(plan)];
```

Read `src/compositions/talking-head/types.ts` for the exact field types. Times are seconds on the edited timeline; use `s(k)` instead of typing numbers.

| Field | Rule |
|---|---|
| `theme` | `font`: a family loaded with `@remotion/google-fonts/<Font>` at the top of the file; `bg`, `ink`, `card`, `accent`, `accent2`, `caption`, `keyword` from the references or the user's palette. Several hues with meaning, not one flood colour. |
| `keywords` | The words the captions colour: the payload of each sentence (numbers, the problem, the result, the CTA word). |
| `layout` | Starts at 0. Modes: `window`, `full`, `yap`, `split`. **Full** on the hook, punchlines and the CTA; **window** whenever a graphic explains an idea; **yap** for talking with light evidence around the head; **split** while a screen recording carries the explanation, back to the face at least every 10-15 s. Change layout on a sentence start (`s(k).from`) or on the punch word inside it. Fewer than one change every 3 s. |
| `graphics` | **One per spoken idea**, shown in window, yap and split (with no screen) and hidden in full. In yap only the latest one shows, scaled into the free space above or beside the head, light text with a shadow and a dark card. Built-ins: `headline`, `step` (n of total), `stat` (counts up), `list` (items land in turn), `compare` (before/after). Anything else: `kind: "custom"` with a React component that receives `{ f, fps, dur, theme, w, h }` (proof screenshots from `public/projects/<slug>/proof/` go here). The first graphic is evidence, not a `headline`. |
| `head` | `import headJson from "../../public/projects/<slug>/head.json"` and pass `head: headJson as HeadTrack`. Written by `assemble` (or `pnpm edit head <slug>`) with Apple Vision. **Required for yap**; every layout uses it to frame each take on the head (framing is still within a take and moves on the cut). Check the coverage it prints: below 80% the face is often lost |
| `face` | Fallback when there is no head track: where the face sits in the source frame (0..1). |
| `screens` | Screen recordings for `split`: `{ from, to, src: "projects/<slug>/screen.mp4", start?, rate?, url?, fit?, zoom?, focus? }`. `start`/`rate` retime the clip to the words (one entry per stretch); `url` draws a browser address bar; `zoom` + `focus` crop into the part that matters (a full-width desktop screen is small on a phone). A split stretch with no screen shows the active graphic in the panel instead |
| `punchIn` | Default on: alternate 8% punch-in on every jump cut so the cuts read as intentional. |
| `sfx`, `sfxVolume` | Default on: soft whoosh on every layout change, soft pop on every graphic entrance (`public/sfx/`, peaks around −20 dBFS under the voice). If the user chose "fewer sounds": lower `sfxVolume` or set `sfx: false`; a sound on an arbitrary story beat has no plan field yet. Meme sounds in a paid ad: CC0 only (`editing-craft.md` §7). |

Fixed geometry (`TalkingHead.tsx`): window x 60, y 960, 960×860, radius 44; graphic box y 290-900; captions straddle the window's top edge in window mode, at y 1150 full screen. **Yap:** head 380 px tall with its top at y 700 (a blurred copy of the frame fills any band the reframing opens), graphics ≥ 70 px from the head across the whole graphic span, captions on the chest (y ≤ 1200). **Split:** screen panel x 36, y 200, 1008×780 (address bar 74 px when `url` is set), head region y 1010-1920 with the whole head 400 px tall, captions on the seam. All critical text stays above the paid-placement bottom zone (y > 1248). The `qa` prop draws the safe zones and, in yap, the head clearance box.

Captions: up to 3 words per chunk, keywords coloured. A chunk never spans a cut between takes (built in: each sentence comes from one take and chunks break at sentence changes). A number must never split across two chunks: not enforced, so check the stills (`editing-craft.md` §6). General caption timing rules: `captions.md` (end).

### d. Look, then preview

1. Stills at each layout change and each graphic: `pnpm stills --id Edit-<slug> --frames … --props '{"qa":true}' --out out/<slug>/stills --sheet 6` (`qa` draws the safe zones). Fix, re-render.
2. `pnpm edit preview <slug>`: half-resolution MP4 plus one still per sentence.
3. Check the preview against the reference side by side over the first 25 s (the `ffmpeg hstack` command in `editing-craft.md` §8) and against the targets from 01: cuts in the first 3 s, on-screen text every X s. Then the retention checks: first fact by 14 s, something new on screen at least every 3 s between 8 and 25 s (look at 1 fps frames; there is no automated static-screen check yet, `editing-craft.md` §11d), first screen after the face leaves is evidence.
4. **Send the preview and stills to the user for approval before the final.** Name what you couldn't check (you can't hear the result).

### e. Final: `pnpm edit final <slug> --approved`

Full render with uncompressed audio, then a two-pass loudnorm of the whole mix to −14 LUFS / −1 dBTP. Report the measured loudness and true peak, duration, resolution and fps from ffprobe.

## 04 — Deliver

`pnpm edit final` writes only `out/<slug>/final.mp4`; the rest is by hand. Commands and the post-caption format: `editing-craft.md` §9. Record the approval in the review report (`qa-checklist.md` §3b).

- [ ] Versioned copy `out/<slug>/<slug>-vN_reels_1080x1920.mp4` (N+1 per version; keep the previous one)
- [ ] Light copy under 30 MB for the phone (`-crf 22`, raise if over)
- [ ] Re-transcribe the final and read it against the script: no missing or doubled word at a cut
- [ ] Post caption ready to paste, with credits for every CC BY asset in `sources.md`
- [ ] One line in `work/<slug>/versions.md`: file, state, duration, what changed and why
- [ ] Reveal the file; short message with what changed and what you couldn't check. Never post or publish.

## Verified behaviour

On a synthetic test recording (42.5 s raw → 23.2 s): an abandoned take was skipped, a repeated take resolved to the last one, a mid-sentence pause and a hesitation sound were removed. Captions measured against a re-transcription of the render: median offset −0.01 s, within ±0.04 s. Final: −14.0 LUFS, −2.2 dBTP. Reference analysis found all 7 jump cuts in the edit and none in the raw take.

## Troubleshooting

| Symptom | Fix |
|---|---|
| A sentence shows "No take found" | The recording differs from the script too much; edit the script line to what was said, or re-record that line |
| A word's start or end is clipped | `--gap 0.35` keeps more air; the cut point comes from the audio level, so check for loud room noise (raise the mic gain, record closer) |
| Wrong take chosen | `--pick <sentence>:<take>` using the numbers in `takes.md` |
| Caption spelling wrong | Captions take spelling from the script; without `--script` they use whisper's text, so edit `cuts.json` words or pass a script |
| A number splits across two caption chunks | Write it as one token in the script ("397", "$397") and re-run `cut` |
| Match score dropped on a sentence with a number | Whisper spelled the number differently from the script ("five" vs "5"); the caption timing still follows the voice. `--pick` if the wrong take won |
| `Edit-<slug>` missing from Studio | Check `projects/<slug>/index.tsx` exports `compositions`; run `pnpm registry` |
| Graphic never visible | It was scheduled during full-screen layout; move it or switch that span to window |
| Face cut off in the window | Adjust `face: { x, y }` in the plan, or check the head track coverage |
| "looks flat but is not tagged as LOG" | Ask for the camera profile; `--lut none` if the flat look is intended |
| Preview loudness differs from −14 | Expected: SFX add a little. The final is mastered to −14 |
| `pcm-16 … must end in mkv, mov` / `prores … --crf` | Already handled in `src/scripts/edit/render.ts` (`render.mov` + `--codec=h264`) |
