import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const C = {
  ink: "#0B0B0D",
  paper: "#F1ECE4",
  orange: "#FF4F1A",
  cobalt: "#2B3BFF",
  lime: "#D6FF3D",
};

export const FONT = {
  flex: "Roboto Flex",
  serif: "Instrument Serif",
  mono: "JetBrains Mono",
};

// Variable fonts are loaded locally so the wdth/wght axes animate frame-accurately.
loadFont({ family: FONT.flex, url: staticFile("fonts/RobotoFlex-latin.woff2"), weight: "100 1000", stretch: "25% 151%" });
loadFont({ family: FONT.serif, url: staticFile("fonts/InstrumentSerif-italic-latin.woff2"), style: "italic", weight: "400" });
loadFont({ family: FONT.serif, url: staticFile("fonts/InstrumentSerif-latin.woff2"), style: "normal", weight: "400" });
loadFont({ family: FONT.mono, url: staticFile("fonts/JetBrainsMono-latin.woff2"), weight: "100 800" });

/** Roboto Flex axes as inline style */
export const flex = (wght: number, wdth: number, opsz = 144): React.CSSProperties => ({
  fontFamily: FONT.flex,
  fontVariationSettings: `'wght' ${wght.toFixed(1)}, 'wdth' ${wdth.toFixed(2)}, 'opsz' ${opsz}`,
});

export const monoLabel: React.CSSProperties = {
  fontFamily: FONT.mono,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
};
