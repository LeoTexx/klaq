# Scene Transitions

> Using `@remotion/transitions` for smooth scene-to-scene transitions.

## TransitionSeries

The primary component for sequencing scenes with transitions between them.

```tsx
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
import { clockWipe } from "@remotion/transitions/clock-wipe";

export const Video: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={90}>
        <Intro />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />

      <TransitionSeries.Sequence durationInFrames={120}>
        <MainContent />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-left" })}
        timing={springTiming({ config: { damping: 200 }, durationInFrames: 25 })}
      />

      <TransitionSeries.Sequence durationInFrames={60}>
        <Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

// Total duration = sum of sequences - sum of transitions
// 90 + 120 + 60 - 15 - 25 = 230 frames
```

---

## Available Transitions

### fade()
Cross-fade between scenes. The most versatile transition.

```tsx
import { fade } from "@remotion/transitions/fade";

<TransitionSeries.Transition
  presentation={fade()}
  timing={linearTiming({ durationInFrames: 15 })}
/>
```

### slide()
Slide one scene over another. Supports direction.

```tsx
import { slide } from "@remotion/transitions/slide";

// Directions: "from-left", "from-right", "from-top", "from-bottom"
<TransitionSeries.Transition
  presentation={slide({ direction: "from-right" })}
  timing={springTiming({ config: { damping: 200 }, durationInFrames: 20 })}
/>
```

### wipe()
Wipe effect — one scene reveals the next.

```tsx
import { wipe } from "@remotion/transitions/wipe";

// Directions: "from-left", "from-right", "from-top", "from-bottom"
<TransitionSeries.Transition
  presentation={wipe({ direction: "from-left" })}
  timing={linearTiming({ durationInFrames: 20 })}
/>
```

### flip()
3D flip effect.

```tsx
import { flip } from "@remotion/transitions/flip";

// Directions: "from-left", "from-right", "from-top", "from-bottom"
<TransitionSeries.Transition
  presentation={flip({ direction: "from-right" })}
  timing={springTiming({ config: { damping: 200 }, durationInFrames: 30 })}
/>
```

### clockWipe()
Circular wipe like a clock hand.

```tsx
import { clockWipe } from "@remotion/transitions/clock-wipe";

<TransitionSeries.Transition
  presentation={clockWipe()}
  timing={linearTiming({ durationInFrames: 25 })}
/>
```

---

## Timing Functions

### linearTiming

Constant speed transition.

```tsx
import { linearTiming } from "@remotion/transitions";

linearTiming({ durationInFrames: 15 })
```

### springTiming

Physics-based transition timing.

```tsx
import { springTiming } from "@remotion/transitions";

springTiming({
  config: { damping: 200 },       // High = smooth, Low = bouncy
  durationInFrames: 25,            // Optional: fix the duration
})
```

---

## Duration Calculation

Total video duration when using TransitionSeries:

```
totalFrames = sum(allSequenceDurations) - sum(allTransitionDurations)
```

Example:
- Scene A: 90 frames
- Transition: 15 frames (fade)
- Scene B: 120 frames
- Transition: 25 frames (slide)
- Scene C: 60 frames
- **Total**: 90 + 120 + 60 - 15 - 25 = **230 frames**

---

## Choosing Transitions

| Context | Recommended Transition | Duration |
|---|---|---|
| Subtle scene change | `fade()` | 10-20 frames |
| Directional narrative flow | `slide()` | 15-25 frames |
| Bold, editorial style | `wipe()` | 15-25 frames |
| Playful / fun content | `flip()` | 20-30 frames |
| Dramatic reveal | `clockWipe()` | 20-30 frames |
| No transition needed | Omit `<TransitionSeries.Transition>` | — |

### Tips

- **Don't over-transition** — use 1-2 transition types per video for consistency
- **Match timing to mood** — faster transitions (10-15 frames) for energetic content, slower (20-30) for contemplative
- **Use spring timing for organic feel** — `springTiming` with high damping looks more natural than `linearTiming`
- **Fade is the safe default** — when in doubt, use `fade()` with 15 frames
