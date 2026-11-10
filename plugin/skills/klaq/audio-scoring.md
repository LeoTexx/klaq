# Audio Scoring: Synthesized, Frame-Synced Scores

No stock music, no samples: the score is synthesized by a Node script from the same timeline as the picture, so every hit is frame-accurate and the output is deterministic. You cannot listen to it, so it is verified by measurement (section 6).

Files:
- `src/scripts/lib/synth.ts`: oscillators, filters, instruments, Freeverb, lookahead limiter, dithered 16-bit WAV writer, `Mix` class.
- `projects/<name>/score.ts`: the arrangement for one film, run with `pnpm tsx projects/<name>/score.ts`. Worked example: `src/scripts/showreel-score.ts`.
- Output: `public/projects/<name>/score.wav` (48 kHz stereo), played by `<Audio src={staticFile("projects/<name>/score.wav")} />`.

---

## 1. Script skeleton

```ts
import path from "path";
import { DURATION, FPS, T } from "./timeline";
import { Mix, hz, kick, pad, pluck, rand /* … */ } from "../../src/scripts/lib/synth";

const OUT = path.resolve(__dirname, "../../public/projects/<name>/score.wav");
const s = (frame: number) => frame / FPS;

const mix = new Mix(DURATION / FPS);
const DRUMS = mix.bus();
const MUSIC = mix.bus(true);   // ducked by the pulse
const LEAD = mix.bus();
const FX = mix.bus();
const place = mix.place.bind(mix);   // place(bus, signal, atSec, gain = 1, pan = 0, reverbSend = 0)

place(DRUMS, kick(), s(T.drop), 0.9);
// … arrangement …

mix.duckAt(kickFrames.map(s), 0.62, 0.12);   // depth, release (s)
mix.render({ revGain: 2.4, room: 0.83, damp: 0.28, headroom: 1.35 });
mix.writeWav(OUT);
console.log(`RMS ${mix.sectionRms(0, 4)} | ${mix.sectionRms(4, 8)} dBFS`);
```

Bus order is the summing order. Keep it stable (`DRUMS, MUSIC, LEAD, FX`): changing it changes floating-point sums and breaks bit-identical regression checks.

## 2. Instrument palette (`synth.ts`)

| Instrument | Signature | Use |
|---|---|---|
| `kick({decay, pitch, punch, click})` | sine with fast pitch drop + click | 4-on-the-floor, drops |
| `thump(f0, f1, decay)` | soft round kick, no click | calm half-time pulse |
| `heartbeat()` | lub-dub (two thumps 0.15 s apart) | "still running", after a launch |
| `boom({dur, f0, f1, decay})` | sub with pitch glide | impacts, final hit |
| `clap()`, `snare()`, `hat(decay)`, `crash(decay, len)` | 808-style noise/metal | groove, rolls, drops |
| `ksString(f, {dur, decay, bright, bend})` | Karplus-Strong pluck, settles from sharp | a line snapping taut; reuse an octave lower at the resolution |
| `pluck(f, {decay, bright})` | marimba-like additive | arpeggios, notes on events |
| `bell(f, decay)` | inharmonic partials | shimmer, landings |
| `stab(notes, {dur, decay, hi, lo})` | detuned supersaw chord, filter env | word hits, drops |
| `pad(notes, dur, {attack, release, cutoff})` | slow saw pad with LFO filter | harmonic bed per bar |
| `sub(f, dur, attack, release)` | sine + 2nd harmonic | sustained bass |
| `bass(f, len)` | sine + filtered saw | off-beat house bass |
| `whoosh(dur, {f0, f1, q, peak, pan0, pan1})` | band-passed noise sweep with pan | camera moves, wipes |
| `riser(dur, …)`, `reverseSwell(dur, bright)` | rising noise / reversed cymbal | build into hits |
| `scribble(envPerFrame, fps, {f0, f1, q})` | grainy band-passed noise following an envelope | a pen drawing |
| `bloop`, `ping`, `tick`, `beep`, `glitch`, `sine`, `swirl` | small UI/FX sounds | drops, sonar, clocks, errors, glitches, swells |
| `pop`, `typing`, `buzz`, `coin`, `rewind`, `powerDown` | phone UI sounds | message bubble, typing, vibration, cash chime, time-lapse, nobody answered |
| `chime()` | two rounded blips a fourth apart, 85 ms | a notification signature; give a campaign one shared sound and reuse it in every film |
| `loadAudio(file)` | ffmpeg decode to mono float | voice-over and any recorded clip on a bus |

`synth.ts` is engine code: don't edit it for a project. Write new instruments in the project (for example `projects/<name>/instruments.ts`) on top of its primitives. If you contribute an instrument to the engine, append it at the END of `synth.ts`: instruments only consume the seeded RNG when called, so appending never changes existing scores.

## 3. Arrangement recipes

- **Drop**: kick + `boom` + `crash` + `stab(chord)` on one bar downbeat; precede with `riser` and a `reverseSwell` ending exactly on the hit.
- **Groove (energetic)**: kick every beat, clap on beats 2 and 4, closed hats on off-beats, off-beat `bass` on the chord root, ducked pads.
- **Pulse (calm)**: `thump` every 60 frames, quiet hats, pad + `sub` per section.
- **Montage**: one distinct sound per cut (click, blips, swish, odometer ticks, whomp, boing, glitch), 16th hats, snare roll accelerating into the last eighth.
- **Breath**: everything stops for 0.5-1 s before the final hit; leave only a faint tone. The contrast makes the hit.
- **Final hit**: kick + long `boom` + `crash` + the resolving chord + bells staggered 3 frames, plus a soft echo of the motif (a `ksString` an octave below the earlier snap).
- **End card**: one or two quiet notes for the offer/CTA reveal; optional faint heartbeats under the card.

## 4. Harmony as story

Write the chord arc to match the picture:
- Showreel: A minor groove (Am9 → Fmaj9 → Cmaj9 → G6/9 → E7sus) → final lift to A major add9 on the name.
- Calm brand film: an uneasy bed (B2 F#3 C4, a flat nine that never resolves) → D major add9 when the line snaps taut → Bm9 → Gmaj9 → A13sus (tension) → D/F# at launch → Dmaj9 when the logo completes.
- Corners, steps and strokes can be notes of the current chord, rising as the system takes shape.

## 5. Geometry-driven sound

Import the geometry module in the score so sound follows motion, not a guess:
- **Pen**: loudness = actual drawing speed per frame.
  ```ts
  const penEnv = (from: number, to: number, head: (f: number) => number, norm: number) =>
    Array.from({ length: Math.ceil(to - from) + 2 }, (_, i) => Math.min(1, Math.abs(head(from + i + 1) - head(from + i)) / norm));
  place(FX, scribble(penEnv(T.knotIn, T.knotOut + 4, knotHead, 24), FPS), s(T.knotIn), 0.11, 0.1, 0.12);
  ```
- **Corners as notes**: `frameAtRoute(ROUTE.lengthAt(i))` for each vertex → a pluck from the chord, panned by position.
- **Per-unit ticks**: for each moving unit and each block, `frame = spawn + blockFlowLength / speed` → a quiet tonal `ping` at the block's pitch. Sonifies "automation" as a machine you can hear.
- **Queue and drops**: units settling → soft `tick`; units falling off → descending `sine` glide.

## 6. Mixing and verification

- Ducking: pads and bass on a ducked bus, `duckAt(pulseFrames)`; never duck stabs on their own kick.
- Voice-led films: duck every bed bus from the voice with `duckFrom(VOICE)` and check that the voice sits ≥ 6 dB over the ducked bed in each speech window (`MUTE_VO` + `render({ gain })`, see `social-vertical.md` §6).
- Limiter: `render()` normalises the pre-limiter peak to `ceiling * headroom` (1.22-1.35) then a lookahead limiter shaves transients to `ceiling` 0.89 (-1 dBFS). Limiter active 5-12% of samples is healthy.
- Targets: integrated **-14 to -16 LUFS**, true peak about **-1 dBFS** (AAC adds about +0.1 dB), LRA 2-4 LU. Section RMS: intros 5-10 dB below the body; breath -30 dB or lower.
- Commands: `ebur128` and `showspectrumpic` (see `production-pipeline.md` step 6). In the spectrogram look for hits at the right seconds, staircases for arpeggios, the silence gap, and no continuous wall of yellow below 150 Hz (too much sub: lower `sub()` gain).

## 7. Pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Inharmonic hiss on high plucks | partials above Nyquist alias | include a partial only if `f * ratio < 0.45 * SR` |
| Double-loud kick on a drop | drop helper and groove both place a kick | skip the helper's kick when the groove has one |
| Muddy low end | sustained `sub` + boom + pads | `sub` gain ≈ 0.2, short release, HP at 28 Hz |
| Score out of sync after an edit | timeline changed, score not regenerated | re-run `pnpm tsx projects/<name>/score.ts` before every final render |
| Refactor changed the sound | bus/sum order or RNG call order changed | compare the WAV's md5 (`md5 -q` / `md5sum`) before and after |
| Clicks at sample ends | abrupt tail | instruments end through `fadeEdges(x, ms)` |
