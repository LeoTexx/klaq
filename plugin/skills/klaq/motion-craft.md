# Motion Craft Playbook

Techniques that make a film read as professional motion design. The working reference is `src/compositions/showreel/` (bouncing ball + graph editor, animated variable-font type, metaballs, particle grid → globe → torus, montage, impact rig in `Fx.tsx`, HUD in `Hud.tsx`). Sections 8-10 describe a calmer brand-film style (one unbroken line, world-space camera, system diagram, proof slots, a logo built from its own SVG) that you build in your own project.

---

## 1. Concept: one protagonist, match cuts

- **One element carries the film.** In the showreel, an orange dot becomes ball → screen fill → liquid → hundreds of droplets → grid → globe → iris → the full stop of the name. In a calm brand film, a single line can go knot → taut line → system route → past launch → drawing the logo. Viewers follow one thing; every transition transforms it rather than cutting to something new.
- **Match cuts**: the ball scales into the lens until its colour IS the next background; letters drown in a rising goo wave; a cluster of particles bursts into a grid; a pattern irises down to the dot.
- **Brand signature as grammar**: reuse the brand's own device everywhere (if the logo has a diagonal at a given angle, every diagonal in the film rises at that angle and the camera climbs on it to the logo).
- **End on the identity**: the protagonist resolves into the logo or the name. Build the logo from its real SVG paths (section 9).

## 2. Tone calibration

| | Playful reel | Calm brand film |
|---|---|---|
| Energy | Cuts on beats, impacts, chromatic split, montage | Composure: eased camera, no shake, mask reveals |
| Score | 4-on-the-floor 120 BPM, drop, snare roll | Half-time pulse, plucked string, heartbeat |
| Type | Animated variable fonts, slams | Editorial: one headline block, one proof slot |
| Rule of thumb | "Show range" | "Confidence doesn't shout" |

Read the brand voice guide and pick a column before designing.

## 3. Timing and easing

- **60 fps, 120 BPM**: beat = 30 frames, eighth = 15. Montage shots of 15 frames read fine at 60 fps if each shot completes its own mini-animation inside the window.
- **Springs** (`sp(f, start, SPRING.x)` from `src/lib/motion.ts`) for things that land: letters, chips, knobs, dots. `snap` (no visible overshoot), `pop` (overshoot), `jelly` (wobble after landing).
- **Eased tweens** for things that travel: camera moves (`inOutCubic`), drifts (`inOutSine`), text masks (`outExpo` in, `inQuart` out), bars and counters (`outCubic`/`outExpo`).
- **Bursts start fast**: a spring from rest accelerates slowly and reads as mush. Explosions and releases use `ease.outBack(t, 1.3)`: high initial velocity, soft overshoot.
- **Pre-roll entrances**: start an entrance 2-5 frames before the cut (`sp(f, -3, …)`) so the cut frame already shows motion. A cut frame must never be empty.
- **Exit together**: stagger entrances, but end exits within 2 frames of each other. A lagging "." reads as a stray dot.
- **Breath before the final hit**: 0.5-1 s of near silence and a single small element (the dot) before the biggest moment.

## 4. Type

**Mask-rise word reveal**: each word in an `overflow: hidden` inline-block, inner span translated 108% → 0.

```tsx
const enter = ease.outExpo(prog(f, inAt, inAt + 26));
const exit = outAt !== undefined ? ease.inQuart(prog(f, outAt, outAt + 16)) : 0;
const y = (1 - enter) * 108 - exit * 108;
<span style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", paddingBottom: "0.08em", marginBottom: "-0.08em" }}>
  <span style={{ display: "inline-block", transform: `translateY(${y}%)` }}>{word}</span>
</span>
```

- **Accent phrases** (gradient text via `background-clip: text`) animate as ONE unit so the gradient is continuous across the phrase.
- **Absolutely positioned text blocks need an explicit width** and `whiteSpace: "nowrap"` on sublines, or they shrink-wrap to the narrowest sibling and wrap word by word.
- **Variable fonts** (`fontVariationSettings: "'wght' 1000, 'wdth' 112, 'opsz' 144"`): animate `wdth` for squash and stretch on type itself. For constant-width morphs, interpolate a measured width table and solve font-size per frame (`size = targetW * 100 / widthAt(wdth)`), then let `scaleY` overshoot with the spring. A live axis readout ("wdth 112.0 · wght 1000") under the word is a good craft flex.
- **Clip only where letters enter** (`clipPath: inset(-40% -20% 0 -20%)`) so overshoot above the box is not cut.
- **Odometers**: one column per digit, a strip of `10*k + target` digits translated by `-off * H`; stagger columns 1-2.5 frames and finish inside the shot. The final visible digit must be `roll % 10 === target`.

## 5. Character animation (the bouncing ball)

- One gravity constant for every arc; arc height = `g * T² / 8` for flight time `T`; flight times decay by the restitution (0.75). Different g per arc reads as wrong.
- Contact holds of 3-4 frames carry the squash: `q = Q * sin(π d / HOLD)`, `scaleX = 1 + 0.9q`, `scaleY = 1 - q`, bottom anchored to the ground.
- In flight, stretch along velocity with an area-preserving matrix `R(φ) · diag(s, 1/s) · R(-φ)`, `s = 1 + min(0.3, |vy| * 0.0068)`.
- Onion skins (last 5 positions every 3 frames, outlines fading) and a spacing chart (dots every 2 frames) make timing visible. A live graph-editor panel (curve drawn up to the playhead, broken-tangent keys at contacts, flat eased handles at apexes) signals expertise.
- Camera origins must not follow a bouncing subject (the stage bobs). Use a fixed origin for drift and a separate zoom group anchored at the launch point.

## 6. Camera

- **World space**: put the scene in one SVG group: `translate(960 540) scale(z) translate(-camX -camY)`. Keyframes `{ f, c: { x, y, z }, e }` with per-segment easing; interpolate zoom in log space: `z = exp(lerp(log(a.z), log(b.z), t))` so pull-backs feel even.
- **Start close, release wide**: open zoomed in on the problem (z ≈ 1.25-1.35) and widen on the release beat.
- **Sell motion with a world grid**: faint lines every ~96 world px drawn only inside the visible rect; they make pans legible.
- **Lead the subject**: the drawing head must stay ahead of anything travelling on it (units must not overtake the line), and a "continuing" element must leave the frame edge. If it stops on screen it reads as ending.
- **Impact rig** (`showreel/Fx.tsx`): per impact, `env = exp(-d/7) * s`; shake = `noise1(f * 0.5, seed) * 18 * env`; punch = `1.012 + 0.04 * s * exp(-d/5)` (the 1.012 overscale hides shake edges); chromatic split = `11 * s * exp(-d/3.2)` px via an SVG filter (split R and B with `feColorMatrix`, `feOffset` ±split, recombine with `feBlend mode="screen"`), only while > 0.75 px.
- **Flashes**: bright and short (`0.88 * exp(-(f - hit)/1.6)` of paper colour). A long 40% flash reads as a grey frame.

## 7. Particles, fluids, 3D

- **SVG particles** (600-700 `<circle>`s per frame are fine): compute world positions, project `scale = focal / (camZ - Z)`, sort back to front when 3D, alpha by depth (`0.25 + 0.75 * depthNorm`).
- **Plane → sphere bend** (curl a grid into a globe): with curvature `k = m * 2π / circumference`, `lon = x*k`, `lat = y*k`, `X = sin(lon)cos(lat)/k`, `Y = sin(lat)/k`, `Z = (cos(lon)cos(lat) - 1)/k + R*m`. Use a 2:1 grid (36×18) so the width wraps 360° and the height 180°.
- **Lat/long globes**: scale dots by `cos(lat)^1.1` so poles thin out instead of forming bright target rings; tilt so the north pole faces the camera (negative rotX here).
- **Sphere → torus**: reuse the same (u, v): torus `((R + r cos v) sin u, r sin v, (R + r cos v) cos u)` with `v = 2·lat`; lerp positions.
- **Motion blur without CameraMotionBlur**: draw each fast particle as a line from its position at `f - lag` to `f` (`strokeLinecap="round"`, width ≈ radius × 1-2); lag 0.6 frames for bursts, 1.6 for warp. `<CameraMotionBlur>` is colour-destructive; avoid it.
- **Goo / metaballs**: `feGaussianBlur stdDeviation=22` then `feColorMatrix` alpha row `0 0 0 36 -15`. Great for 5-10 big blobs and liquid wipes (rising rect + bobbing circles + droplets). Small particles vanish under a large blur (peak alpha drops below threshold); draw bursts crisp.

## 8. The line as protagonist

- **Polyline with arc length**: write a small `Poly` helper with `at(len)`, `slice(l0, l1)`, `lengthAt(vertex)`; draw "up to the head" by slicing, not with dash offsets, so the geometry can morph.
- **Head timing** is a piecewise function of frame (`routeHead(f)`), eased per stroke for hand-drawn strokes (each logo stroke `inOutCubic`).
- **Knot → taut**: a self-crossing scribble (rotating offset around a drifting centre), cinched before the beat, then each point lerps to its arc-length position on a straight line, right end first, followed by a plucked-string vibration (`24 e^(-v/15) sin(2πv/8.5)` times a mode shape).
- **Colour charge**: on the release, a gradient copy of the path is revealed from the tail (`slice(0, sweep)`) over the grey one.
- **Gradient strokes in screen space**: `linearGradient gradientUnits="userSpaceOnUse"` with x1/x2 recomputed per frame from the visible world rect, so the brand gradient always spans the screen left → right.
- **Glow**: a blurred, thicker copy behind the crisp stroke. Size SVG filter regions to the visible viewport (`filterUnits="userSpaceOnUse"`, region = visible rect + margin); a world-sized filter region rasterizes far too much.
- **Layering**: when the line runs behind blocks, the pen head must also render under the blocks; render it on top only for strokes that should be visible (the logo).

## 9. Logo build

- Split the real logo SVG into parts (`logo.ts`: each stroke or bar of the mark, wordmark glyphs with `evenodd` where glyphs have counters).
- Draw centerline strokes with the protagonist, then grow fills from the axis (`translate(0 axis) scale(1 g) translate(0 -axis)`; polygons lerp vertices from the axis outward), then wipe the wordmark in with a `clipPath` rect, then pull the camera back to the lockup framing.
- Fade every non-logo world element before the pull-back, or the zoom-out reveals clutter.

## 10. Information design

- **HUD** (`showreel/Hud.tsx`): crop marks, timecode `HH:MM:SS:FF`, section label that swaps by sliding (old up, new up from below), status chip, beat meter, scrubber. HUD tone flips with the background (per edge if a wipe covers one edge first).
- **One proof slot per section** (same screen position, one hero number each, such as "8 weeks to first release" or "−71% cycle time"). Big gradient number + small caps label + source. Every number needs an approved source.
- **Ghost / contrast device**: show the alternative (a grey line that stops at LAUNCH with a "Delivered" chip) next to the hero path that continues ("Running"). Contrast sells the differentiator without a comparison table.
- **Status chips as narrative**: No owner (amber) → Building → Automated → Running (teal, pulsing with the heartbeat).
- **Real-time detail**: a clock ticking one second per 60 frames inside a counter reads as "live".

## 11. Montage (range section)

Eight 15-frame shots on eighth notes, each a different discipline (UI toggle, bars + trend line, spiral draw-on, odometer, CSS 3D cube, shape morph, RGB glitch, op-art vortex). Each shot: one bold idea, full colour change, its own sound. End the montage by collapsing into the protagonist (iris down to the dot).

Details that mattered: a toggle knob stretches with velocity and squashes against the end wall instead of overshooting out of the track; the track fills behind the knob instead of crossfading colours (crossfades go muddy).

## 12. Hold and pacing

The numbers below are starting points for narrated product reels at 60 fps, not laws.

**Hold rule.** Once a piece of text has finished entering, keep it on screen for at least **words / 3 + 1 s** (a 6-word line stays 3 s). A 0.4 s entrance alone leaves no time to read. If the beat sheet cannot fit the holds, drop beats or ask for a longer film; do not rush them. Give each screen one main reading path, and add one new element per phrase.

**Pacing presets.** Cut rhythm follows the voice or the BPM grid (§3); the preset governs motion *within* a shot. Choose one using the tone column in §2.

| | Calm and cinematic | Dynamic |
|---|---|---|
| Fits | Explainers, 3D, narration, calm brand films | Memes, showreels, music-driven cuts |
| Entrances and exits | about 0.5-0.8 s | about 0.3-0.4 s |
| Camera | One move across the whole shot, eased in and out; push from 1.00 to 1.08; rotate no faster than about 20°/s | Whip moves on the beat |
| Transitions | 0.6-1.0 s | Cut on the beat |
| Exploded views | Open over 1.5-2.5 s, then hold 1 s or longer | |
| Counters | Roll for 1.2 s or more and stop on the number being spoken | Quicker |
| Flashes | Only between acts | On impacts (§6) |
| Rule | Only one big move at a time | |

Quick test for either preset: a move that makes your eye hurry after it is too fast. Fast 3D in particular tires viewers.

**Starting timings for product-UI scenes** (calm, 60 fps):

| Element | Timing |
|---|---|
| A card, panel or phone coming in | ~0.55 s, rising 36-60 px while scaling from 0.94 to 1, with a small overshoot (`ease.outBack(t, 1.2)`) |
| Leaving | ~0.30 s, moving 18 px, no overshoot; gone before the next thing enters the same area |
| Headline | Each word fades in while rising 18 px over 0.5 s, 0.05 s apart; the previous headline is gone at least 0.55 s before the next arrives |
| Change of section | 0.45 s crossfade with a 60 px slide |
| Darkening and blurring behind a screenshot | 0.35-0.40 s, in sync with the screenshot (about 14 px blur, 40% tint); never show the dim without the card on top |
| Real screenshot | Comes in at roughly 860-940 px wide on a 1080 frame; a highlighter grows across the spoken phrase (`scaleX` 0 → 1 in 0.4 s) on its word |
| One counter step | 0.5-0.8 s `outCubic`, tabular figures, a small 1.08 pulse when it lands |
| Bar or progress fill | ~0.85 s `outCubic`; when it has to finish on a word, ease in and out to that word's frame |
| Toggle, segmented control, strike-through | 0.3-0.5 s, eased in and out |
| Cursor | Travels on a spring; the press lasts ~0.14 s at scale 0.90, with a 0.7 s ring |
| Caption word | 0.18 s pop; the last word of a chunk stays ≥ 0.3 s (`captions.md`) |

Slower study pacing, useful for mechanism scenes (`explainers.md`): a highlight that pulls attention 0.20-0.35 s, a short label 0.35-0.55 s, movement the eye must follow 0.8-1.6 s, opening up a structure 1.5-2.5 s, settling after a change 0.4-0.8 s. Once a reveal lands, the beat is over: nothing keeps blinking, spinning or looping.

**Timing, not effects, is what makes motion look expensive:**
- *Move edges, not boxes.* A selection highlight or tab indicator moves its front edge first and its back edge slightly later, so it stretches and then settles. Drive `left` and `right` with two springs offset by 2-4 frames.
- *The container moves first, the text second.* When a button expands into a card, its old label disappears before the box changes shape, and the new label appears once there is space for it. Labels overlapping inside a morphing box are the surest sign of unfinished UI animation. The shared-element morph in `social-vertical.md` §4 works this way.
- *A cursor on real UI.* It glides on a spring, presses, and the interface responds on the exact frame of the press, with the click sound on that frame too.
- *A value that heads for several targets* is a sum of springs (`v0 + Σ Δv · S(f − fᵢ)`), never a spring integrated frame by frame. The list reflow in `social-vertical.md` §4 uses the same idea.
- *Restraint*: little overshoot on UI, no generic gradients, no glow for its own sake, tabular figures that never jitter.
