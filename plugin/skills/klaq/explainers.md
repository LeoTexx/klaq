# Explainers: Arc, World and Mechanism Motion

For any "how X works" video: a product mechanism, a process, a system, a concept. Brand films and ads follow `production-pipeline.md` and `social-vertical.md`; this file adds what an explainer needs on top: a story arc that teaches, a world to set it in, and motion where every move means something.

---

## 1. Decide before any frame

Answer these in the brief:

| Decision | Ask | Strong answer | Weak answer |
|---|---|---|---|
| Outcome | What will the viewer be able to explain afterwards? | "Who asks whom, in order, when a page loads" | "DNS, roughly" |
| One case | Which single concrete example runs through the whole film? | One order, one booking, one message, with fixed names and numbers | A fresh example in every scene |
| Everyday moment | Where has the viewer already met this without noticing? | Typing an address and the page appearing | A definition |
| Reveal | Which surprising fact makes the rest worth watching? | "What comes back isn't a page, it's a number" | A definition |
| Real proof | How does the viewer see that the drawing is true? | A real screenshot, log line, command output or published figure | Only our own animation |
| Failure | What happens when a condition changes, and how does it break? | Cache hit vs miss; a missed appointment | Only the happy path |
| Boundary | What is left out, and where do we admit the simplification? | Said once, in the voice or on screen | Simplified without saying so |

The single case matters most. Every scene reuses its names, numbers and colours, and the figures on the final screen are the ones built up earlier. Work out all the results before drawing anything.

## 2. The arc

An eight-step teaching arc, compressed for a 30-90 s video. Practice turns into a "what would happen if…" beat, and the close returns to the hook.

| # | Step | Purpose | Finished when |
|---|---|---|---|
| 1 | Hook | The everyday moment, plus an open question | Within 3 s the viewer recognises the situation and sees the question (frame-0 rules in `social-vertical.md` §2 apply) |
| 2 | Reveal | Show the hidden fact in the real tool or situation | The line ends on something the viewer did not expect |
| 3 | Vocabulary | Introduce the parts one per beat, each with its own drawing | No term is used before it has been shown |
| 4 | Model | The static structure: who is who | Every part is in its final position |
| 5 | Mechanism | The process, one event per beat | Each beat shows one cause and its effect, with a visible counter or state |
| 6 | Real proof | The same mechanism in real material | The voice connects them: "the same chain we just drew" |
| 7 | Variation | One condition changes, or something fails | The viewer can guess the outcome before seeing it |
| 8 | Close | Back to the hook, now answered | The last line returns to the opening situation |

For videos longer than about 40 s, open a loop: promise a payoff within the first 12 s and deliver it explicitly near the end. Re-engage every 6-10 s with a question, a reveal or a jump in scale. The re-hook rule for reels is in `social-vertical.md` §2.

**Mechanism beats:** the whole cast is on screen from the first beat, in its final position and a neutral tone. One event per beat. Only the element involved in the event gets the attention colour. What has already happened leaves a quiet trace (a dashed edge, a small note) so the final beat shows the whole story at once. Counters change on the exact frame of the event. The last beat sums up in numbers.

## 3. Pick the world from the medium

| The topic lives in | World | Example |
|---|---|---|
| A physical process (data moving through systems, a cable, logistics, a machine) | One illustrated world connected by one physical path that the camera follows | A pipe with stations, a road, the floors of a building |
| A screen (software, platforms, money, algorithms) | The product's own UI: real app screens on phones, one main panel per act in the product's design language, real screenshots arriving large on the phrase that mentions them | A lock screen, a work board, a chat |

Illustrated worlds tend to fail for software topics; use the product-UI world there.

Either way, keep two devices: **one travelling subject** that a person creates in the first seconds (an order, a message, a booking) and that changes state at every step, and **one recurring device** that returns in a new state (an overview of the stages, a screen you keep returning to, a scorecard). The protagonist rule in `motion-craft.md` §1 is the same idea for brand films.

The camera follows what the story is doing (no more than two camera grammars per film):

| The story is about | Camera |
|---|---|
| Stages in sequence | Travel along the path |
| Layers or a hierarchy | Move down or up through the layers |
| What is inside something | Push in through the scales, or orbit an exploded object |
| A comparison | Split screen or parallel lanes, one subject per lane |
| Size or reach | Start on a detail and widen to the full picture |

Check you are not re-skinning: if the world, path and camera are the same as the previous explainer while the topic is different, swap out the world and the camera at minimum.

**Show, don't label.** When the voice says "a chart, a report", show what that business actually looks at (its chart drawing itself), never boxes with the spoken words written in them. **Accuracy**: structure the explanation the way an expert in the field would.

## 4. Motion must mean something

Decide what each visual change means before choosing a curve.

| Motion | Can stand for | Can be misread as |
|---|---|---|
| Moving across | Something travelling along a path | Physical transport, when only a status changed |
| Growing | An amount increasing | An exaggerated change, if both axes scale |
| A line drawn between things | A dependency becoming relevant | Cause and effect that has not been shown |
| Opening up | The internal structure | A physical separation of something that is only logical |
| Highlighting | Where to look | A change of state, when it is only focus |
| Zooming | Looking at a detail | Losing track of the whole |
| Changing colour | A state or category | Two meanings packed into one colour |

Choose the curve by what is animating: linear for constant rates and the passage of time; ease-in-out for moving focus or an object between places; ease-out for a label that should settle; springs only for emphasis that can tolerate overshoot, never for an amount that would dip below zero or a probability outside 0-1. If the thing itself moves at constant speed, an eased position teaches the wrong idea.

Keep focus and state on separate layers: a focus outline must not use the colour that means "running".

## 5. The transition contract

For every transition in a mechanism scene, write down:

- the state before and the state after;
- which properties change continuously (a token's position, a level) and which switch (a "running" chip, "delivered");
- the frame on which each switch happens;
- what the text says during the move, and the frame the move ends;
- the state that holds afterwards.

Any frame you pause on must agree with itself: 40% of the way through a transfer, the level, the counter and the label all read 40%. Never run a counter on its own clock to suggest progress. Text describing the end state appears at the end, not while the drawing still shows the earlier state.

Determinism: SKILL.md's anti-patterns already rule out `Math.random()`, `setTimeout`, CSS transitions, side effects, reading the clock inside a component (use `calculateMetadata`, `production-pipeline.md` §2) and carrying state from frame to frame (`x += v`). Compute every value from the frame and the segment bounds.

When one title replaces another in the same place: the old one leaves (about 0.2 s), the space stays empty for a moment, then the new one arrives. Exits finish before entrances in the same area, consistent with "exit together" in `motion-craft.md` §3.

## 6. Recipes

Mechanism recipes in Remotion terms. `seg(f, a, b)` below is `prog()` from `src/lib/motion.ts`.

| Recipe | Use for | Build | Frames to check |
|---|---|---|---|
| Path with a delivery moment | A message, item or request travelling | Highlight the origin, move the token along the path with ease-in-out, and update the destination only on the delivery frame (`delivered = f >= T.deliver`). For constant speed, sample by arc length (a `Poly.at(len)` helper, `motion-craft.md` §8), not by Bézier `t` | Start, midway, delivery − 1, delivery. The destination never shows "done" while the token is still travelling |
| Conserved amount | Budgets, stock, volume moving between two places | One `moved = amount * seg(...)` drives both sides, the bars and the labels (`left = initial - moved`). Linear, not a spring | Start, end, midway: `left + right` is the same on every frame |
| Dependencies | Workflows, prerequisites, conditional states | List the discrete events first (A starts, A ends, B becomes eligible, B starts), then animate. Light the edge when its condition is met | One frame before and after each event; text, colour and caption agree |
| Opening up | Layers, parts of a system | A rest and an open position for each part, one shared curve, one fixed anchor, labels only where there is room | Halfway, label collisions, the open set fits the frame |
| Cursor click | Showing an action in a real UI | The cursor travels 0.6-1.0 s on a spring to the control's measured rect, presses briefly (scale about 0.9-0.96), the UI responds on the press frame, then the result you can verify. Keep a "simulation" label if the result is staged | Cursor on the right control, click only after it arrives, result after the click |
| Zoom to a detail | Reading a control, a line in a document, part of a chart | Measure the target and destination rects, compute a contain-fit scale, interpolate scale in log space (`motion-craft.md` §6). Show the whole first, and keep a hint of where the crop came from | Target fully visible at the end and sharp (never zoom a low-res image past its detail) |
| Code in sync | One instruction and its effect | Code, scene and explanation in separate regions; stable line ids; the highlight lands on the same frame as the effect | Highlight timing, no clipped text |
| Follow camera | Trees, maps, diagrams too big to read whole | A fixed-aspect frame around the active node; camera and object share one curve | Focus inside the frame on every frame; no label cut off in the middle |

Combine only a few recipes per scene and name the main one. Before building a combination, write a table of frame, element, property and meaning; event boundaries are where labels and states tend to contradict each other.

## 7. Extra QA for explainers

Add to `qa-checklist.md`:
- [ ] Every term appears with its drawing before the voice uses it
- [ ] One event per mechanism beat; the counter changes on the event frame
- [ ] Every discrete change checked one frame before and one after
- [ ] The final screen's numbers match the ones built earlier
- [ ] The real-proof beat shows real material (screenshot, log, published figure) with its source
- [ ] The simplification is said once
