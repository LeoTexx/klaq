# QA Checklist and Pitfalls

Run this before every final render and again on the encoded file. Every item below catches a defect that has shown up in real films.

---

## 1. Visual checklist (stills)

**Frame 0 is the thumbnail**
- [ ] HUD and framing visible at frame 0 (no fade-in from nothing)
- [ ] Content already in motion (pre-rolled), not an empty background
- [ ] Status chips/labels show text at frame 0 (first state has no entrance animation)

**Every cut and section boundary**
- [ ] The cut frame already shows the incoming element (entrances pre-rolled 2-5 frames)
- [ ] No dead stretch: after a wipe or transition, the next scene's subject is already arriving
- [ ] Exits finish together (no lingering punctuation or single glyph)

**Text**
- [ ] No unintended wrapping (absolutely positioned containers need explicit width; sublines `nowrap`)
- [ ] Every language fits (render the longest language at every text-bearing beat)
- [ ] Headline block, proof slot and HUD never overlap (check bottom corners and rulers)
- [ ] Copy is the approved copy, claims trace to approved facts, no banned words or punctuation

**Composition**
- [ ] Subject large enough to read (open closer on small details, e.g. zoom 1.25-1.35)
- [ ] Nothing important spills off-frame unintentionally (3D objects at full perspective, lines at the bottom)
- [ ] Things that "continue" leave the frame edge; things that "end" stop on screen
- [ ] Moving units never overtake the drawing head
- [ ] Layering: the pen or particles do not draw over labels they should pass behind
- [ ] Colours: no muddy crossfades (fill behind the moving element instead); flashes are bright and short

**Motion details**
- [ ] Bursts start fast (out-back), not from rest
- [ ] Streak widths sensible (thin, short for bursts; long only for warp)
- [ ] Overshoot stays inside containers (squash against walls instead)
- [ ] Odometer/counter final digits are correct

## 1b. Event stills, phone size, self-review

Contact sheets at regular intervals miss whatever breaks *between* their frames. Add these passes.

**What to render** (all with `pnpm stills`, frame numbers computed by hand from `timeline.ts`):

| Pass | Frames | Looks for |
|---|---|---|
| Storyboard | 12 frames spread across the film | A single coherent story; the one-sentence plot reads in order |
| Events | Each named event in `T` (and each voice beat) at **−0.12 s, +0.06 s and +0.30 s** (at 60 fps: −7, +4, +18 frames) | Text colliding, jumps, things vanishing mid-move, something entering before the previous exit has cleared |
| Camera moves | Each move sampled at **10 evenly spaced frames** (`--range start:end:step`) | Even spacing; no jump, snap or stall; the subject is whole when the move ends |
| Props | Each hero prop and icon as a **2× crop** (`--scale 2`, then crop) | It reads as the real thing at phone size |
| Phone size | The storyboard frames scaled down to **390 px wide** (a phone's width), never up | Every word is still legible; if not, it is too small or there is too much |

```bash
# three offsets around an event at frame 720 (60 fps)
pnpm stills --id <Id> --frames 713,724,738 --out out/<name>/events --sheet 3
# phone-size sheet from the storyboard stills (ffmpeg, no labels)
ffmpeg -loglevel error -y -pattern_type glob -i 'out/<name>/story/*.png' -vf "scale=390:-1,tile=6x2:padding=12:color=gray" -frames:v 1 out/<name>/phone.png
```

Planned, not built: `stills --marks` (read `T` from the timeline and expand each event into the three offsets) and `--phone 390` (write the phone-size sheet). Until then, compute the frames and run ffmpeg as above.

**Self-review** (before showing anything to anyone):
- [ ] **Density**: at most one new element arrives per spoken phrase. Don't pile cards on top of a busy scene; darken the scene strongly and show one card
- [ ] **Show, don't label**: nothing just spells out what the voice says; show what the thing actually looks like (`explainers.md` §3)
- [ ] **Props**: each 2× crop reads as the real object, not a flat box
- [ ] **Portfolio test**: would a motion designer put each key moment in their reel? If it is merely "correct", redesign it
- [ ] **Accuracy**: the structure matches how an expert in the field explains it
- [ ] **Camera**: the 10-frame samples of every move are evenly spaced
- [ ] **Opening**: a stranger understands within 1 s what happened and what is at stake
- [ ] **Depth order**: whatever is being talked about sits in front
- [ ] **Spacing**: at least 40 px between unrelated groups, 24 px inside containers; exits finish before entrances in the same area
- [ ] **Hold**: every text stays on screen at least words/3 + 1 s (`motion-craft.md` §12)
- [ ] **Script**: the take's transcript has no repeated hook, no three-item list, no misread word (`narration.md` §4)
- [ ] **Ends of the film**: frame 0 and the last frame, no black frames at joins, frame count matches

**Automated layout check (planned).** A debug mode could mark every essential text block with `data-qa-text`, read the boxes in the rendered page on sampled frames, and fail on text overlapping text, text outside its container or the safe zone (`social-vertical.md` §1), text clipped by an `overflow` or SVG ancestor, rendered type below a minimum size, or focal objects cut off. Not built; today the safe-zone overlay (`ReelsSafeZone`) and your eyes do this job.

## 2. Audio checklist

- [ ] Score regenerated after the last timeline edit
- [ ] Integrated loudness -14 to -16 LUFS, peak about -1 dBFS
- [ ] Spectrogram shows hits at the intended seconds, the breath gap, no sub-bass wall
- [ ] Section RMS: intro quieter than the body, breath clearly below
- [ ] Voice-led: voice ≥ 6 dB over the ducked bed in every speech window (`social-vertical.md` §6)
- [ ] Report says the audio was verified by measurement only, and asks the user to listen

## 3. Encoded file checklist

- [ ] `nb_frames` equals `DURATION`, `r_frame_rate` correct, `color_space=bt709`
- [ ] AAC stream present, loudness re-measured from the MP4
- [ ] Overview contact sheet (every 30-40 frames) reviewed end to end
- [ ] Every previously fixed defect spot-checked at its exact second (`-ss <frame/fps>`)

## 3b. Review report and human approval

A review produces a report, not a verdict. Do not write "looks great" or "review done" unless you opened the rendered frames, and state plainly what you did not check. Model-based visual review is useful but fallible.

Include this in the delivery report, filled in:

```
Inspected: storyboard (12) · events (n × 3) · camera moves (n × 10) · props 2× · phone 390 px · MP4 overview
Issues found: <timestamp · what>
Fixes applied: <timestamp · what>
Remaining concerns: <what, and why it was left>
Not checked: audio by ear · <anything else>

[ ] Approved by the user (listened, watched on a phone) — nothing is delivered or posted before this is ticked
```

---

## 4. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Remotion prints a zod version mismatch warning | the workspace pins zod 3; Remotion 4.0.4xx expects 4.x | harmless for compositions without zod schemas; ignore it |
| A composition is missing from Studio or render | not exported in `compositions`, or the registry is stale | check `projects/<name>/index.tsx`; run `pnpm registry` |
| `rm -f $DIR/*.png` is refused | the safety check blocks removals through shell variables | use a literal absolute path, `"${DIR:?}"/…`, or write into a fresh directory |
| `ffmpeg … drawtext` fails | the ffmpeg build lacks libfreetype | label contact sheets by order, not by burnt-in text |
| `npx remotion still` is slow per frame | it rebundles every call | use `pnpm stills` (one bundle, parallel `renderStill`) |
| Stills fail on `<Audio>` | score file does not exist yet | create a silent placeholder WAV with `anullsrc` |
| Variable-font text measures wrong | measured before the font loaded, or canvas cannot set axes | measure in a debug composition after `document.fonts.ready` with DOM `getBoundingClientRect()`; hardcode the table |
| Particles disappear in a goo filter | blur spreads small alpha below the threshold | keep goo for large blobs; draw small particles crisp |
| Frames render slowly with glows | SVG filter region covers the whole world | size `filterUnits="userSpaceOnUse"` regions to the visible rect + margin |
| Whole film looks colour-shifted | `<CameraMotionBlur>` stacks translucent copies | remove it; fake blur with stretch/streaks |
| Grey flash frames | long low-opacity flash overlay | use high opacity and a 1-2 frame decay |
| Stage bobs with a bouncing subject | camera transform origin follows the subject | fixed origin for drift, separate zoom group for dives |
| A number is wrong a day later | live value computed at render time | re-render; say in the delivery note that it freezes on export |
| Text block wraps word by word | absolute child of a shrink-wrapped container | give the container an explicit width |
| Score sounds right but hits drift | score hardcodes frames | import the timeline/geometry in the score script |
