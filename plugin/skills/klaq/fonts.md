# Typography & Fonts

> Font loading, text rendering, and dynamic text measurement in Remotion.

## Google Fonts (@remotion/google-fonts)

The recommended way to load fonts. Type-safe, auto-loaded, render-blocking.

### Basic Usage

```tsx
import { loadFont } from "@remotion/google-fonts/Montserrat";

const { fontFamily } = loadFont();

export const Title: React.FC<{ text: string }> = ({ text }) => (
  <h1 style={{ fontFamily, fontSize: 80, fontWeight: "bold" }}>{text}</h1>
);
```

### With Specific Weights & Subsets

```tsx
import { loadFont } from "@remotion/google-fonts/Roboto";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "700"],
  subsets: ["latin"],
});
```

### Wait for Font Before Measuring

```tsx
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily, waitUntilDone } = loadFont();

// Use in calculateMetadata or async setup
await waitUntilDone();
```

---

## Popular Font Pairings for Video

| Heading | Body | Mood |
|---|---|---|
| Montserrat (700) | Open Sans (400) | Professional, clean |
| Playfair Display (700) | Source Sans Pro (400) | Elegant, editorial |
| Oswald (700) | Lato (400) | Bold, modern |
| Poppins (700) | Inter (400) | Friendly, tech |
| Bebas Neue (400) | Roboto (400) | Impact, editorial |
| Space Grotesk (700) | DM Sans (400) | Tech, startup |
| Raleway (700) | Merriweather (400) | Sophisticated, readable |

### Loading Multiple Fonts

```tsx
import { loadFont as loadHeading } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadBody } from "@remotion/google-fonts/OpenSans";

const heading = loadHeading("normal", { weights: ["700"] });
const body = loadBody("normal", { weights: ["400", "600"] });

export const FONTS = {
  heading: heading.fontFamily,
  body: body.fontFamily,
};
```

---

## Custom Fonts (non-Google)

### From URL

```tsx
import { loadFont } from "@remotion/fonts";

const waitForFont = loadFont({
  family: "MyCustomFont",
  url: "https://example.com/fonts/custom.woff2",
  weight: "400",
});

await waitForFont;
```

### From Static File

```tsx
import { staticFile } from "remotion";
import { loadFont } from "@remotion/fonts";

const waitForFont = loadFont({
  family: "BrandFont",
  url: staticFile("fonts/brand-bold.woff2"),
  weight: "700",
});
```

---

## Text Measurement (@remotion/layout-utils)

### measureText — Exact Pixel Dimensions

```tsx
import { measureText } from "@remotion/layout-utils";

const { width, height } = measureText({
  text: "Hello World",
  fontFamily: "Arial",
  fontSize: 48,
  fontWeight: "bold",
  letterSpacing: "1px",  // Optional
});
```

Useful for: auto-sizing containers, calculating line breaks, preventing overflow.

### fitText — Auto-Size to Container Width

```tsx
import { fitText } from "@remotion/layout-utils";

const { fontSize } = fitText({
  text: dynamicTitle,
  withinWidth: 800,
  fontFamily: "Inter",
  fontWeight: "bold",
  validateFontIsLoaded: true,  // Throws if font fallback detected
});
const cappedSize = Math.min(80, fontSize); // Cap maximum size
```

**Font must be loaded before calling fitText/measureText.** Use `waitUntilDone()` from `loadFont()` or call in `calculateMetadata`.

---

## Text Animation Patterns

### Animated Text Reveal (Word by Word)

```tsx
const words = text.split(" ");
const WORD_DELAY = 5; // frames between each word

return (
  <div style={{ fontFamily, display: "flex", flexWrap: "wrap", gap: "0.3em" }}>
    {words.map((word, i) => {
      const enter = spring({
        frame,
        fps,
        delay: i * WORD_DELAY,
        config: { damping: 200 },
      });
      const y = interpolate(enter, [0, 1], [20, 0]);

      return (
        <span key={i} style={{ opacity: enter, transform: `translateY(${y}px)` }}>
          {word}
        </span>
      );
    })}
  </div>
);
```

### Gradient Text

```tsx
<h1 style={{
  fontFamily,
  fontSize: 96,
  fontWeight: 900,
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
}}>
  Gradient Title
</h1>
```

### Text with Stroke Outline

```tsx
<h1 style={{
  fontFamily,
  fontSize: 120,
  fontWeight: 900,
  color: "transparent",
  WebkitTextStroke: "3px white",
}}>
  Outlined
</h1>
```
