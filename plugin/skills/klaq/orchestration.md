# Splitting a film across agents, and writing the script

Agents help a film where the work is **independent and judged by the user's eye**: options to choose from, a fresh
critic, versions that do not touch each other. They hurt where the film needs one hand: one protagonist, one
motion language, one timeline. A single builder agent usually makes the better short film; do not split the
build for its own sake. Use the lightest mechanism that works (a subagent before a team of them).

## The shape

| Stage | Who | Parallel? | Owns (writes) | The user's part |
|---|---|---|---|---|
| 1. Concepts | 3 fresh agents, one direction each | yes, read-only + one file each | `work/<name>/concepts/<n>.md` | picks one, or mixes |
| 2. Script | the main thread (or a copywriting skill), fed the chosen concept and the script brief below | 2 variants in one run | `work/<name>/script.md` | picks lines; approves claims |
| 3. Timeline | main thread | no | `projects/<name>/timeline.ts`, `tokens.ts` | — |
| 4. Build | one builder (default) | see "When to split the build" | `projects/<name>/**` except timeline/tokens/score | — |
| 5. Score | one agent, alongside the build | yes, after step 3 | `projects/<name>/score.ts`, `public/projects/<name>/score.wav` | listens |
| 6. Critique | fresh agent with the brief, the script and the stills, never the builder's notes | after each still round | `work/<name>/critique-<round>.md` | final eye |
| 7. Versions | one agent per language or format, after picture lock | yes | the version's own file in the project | spot-checks |
| 8. Render | main thread, one render at a time | **no** | `out/<name>/` | — |

Every agent writes only the files in its row. `projects/<name>/index.tsx`, `package.json`, `pnpm-lock.yaml` and
anything outside the project have one owner: the main thread. Engine files under `src/` are never edited for a
project. Agents that need a new package say so in their report instead of adding it.

## 1. Concepts: agents propose, the user chooses

Give each agent the same brief (product facts, approved claims, format, length, audience, brand files) and a
different **direction**, so the three do not converge:

- **Protagonist**: one element carries the film and transforms (`motion-craft.md` §1).
- **Product-led**: the product's own UI or object is the stage; motion explains the mechanism (`explainers.md`).
- **Type-led**: animated typography carries it; colour flips only where a colour has a job.

Each returns one page: the concept in one line, a storyboard table (`time · beat · on screen`), the palette with
the job of each colour, the hook frame and the end card, and the riskiest moment. No code. The user picks;
mixing two is fine. Text only, so this stage is cheap: always offer it for brand films and ads.

## 2. The script

Every on-screen word and every voice-over line is written against this brief. If a copywriting skill is
installed, invoke it with the brief; otherwise write the script yourself to the same brief.

```
Write the script for a <length> s <format> video: <product>, <audience>, awareness level <level>.
Concept (chosen): <one line> — storyboard attached.
Approved facts (the only claims allowed): <list>.
Voice: <voice guide or brand voice notes>. Language(s): <list>.
Constraints from the video:
- On-screen text: one idea per card, at most <N> words; each card holds words/3 + 1 s after it has entered
  (motion-craft.md hold rule), so count the words against the film's length.
- Hook in frame 0 (no logo, no fade); re-hook near <t> s; payoff; CTA once, after the payoff (social-vertical.md).
- Voice-over (if any): written for TTS (narration.md); total spoken length <= <seconds>. Estimate about 2.5
  words/s for English until the first TTS take is measured.
- End card: <name, line, date/CTA>.
Return two variants as a table: time · on screen · voice-over · claim it relies on. Flag any line that needs a
fact we do not have.
```

Save it as `work/<name>/script.md`. The user approves the claims; the builder uses the approved table verbatim.
Many languages run 15-30 % longer than English (`production-pipeline.md` §3): write all languages in the same
run and size the cards for the longest.

## 3-5. Timeline first, then build and score in parallel

`timeline.ts` (frames, beats, named events) and `tokens.ts` (palette, type sizes, easing presets) are the
contract. The main thread writes both before anyone builds. After that, the builder and the score agent work at
the same time: the score imports the timeline (`audio-scoring.md`) and never edits it. A timing change goes
through the main thread, which edits `timeline.ts` and tells both agents.

### When to split the build

Default: **one builder**. Split only when all three hold:
- the film is long (over about 30 s) or has more than about 6 independent scenes;
- a style frame (one finished scene) is approved first, and `tokens.ts` holds everything that keeps it consistent;
- each scene is its own file under `projects/<name>/scenes/`, and the plan names which agent owns which file.

Then one agent per scene range, in parallel, in one checkout (file ownership is disjoint by construction). The
main thread owns the film component that sequences the scenes and the transitions between them, because a
transition belongs to two scenes.

## 6. The critic

A fresh agent (never a fork: the builder's reasoning is what it must not inherit) gets the brief, the approved
script, the stills and the contact sheet, plus `qa-checklist.md` and the user's taste notes if they gave any
(useful defaults: clarity over pace, few colour flips, several hues each with a job, type that is not weak). It
returns ranked defects with frame numbers and one proposal for the next round. It proposes; the main thread
decides whether another round is worth it (no fixed round cap). AI critique is secondary: the user's eye decides.

## 7-8. Versions and renders

Language and format versions (another language, 9:16, 4:5) start after picture lock, one agent each, each in its
own file in the project, registered as its own entry in `compositions`. Renders run one at a time from the main
thread: a render already uses every core, so parallel renders only slow each other down.
