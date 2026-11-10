import type React from "react";

/** Mirrors src/scripts/edit/cut.ts `Cuts` (kept separate so the bundle never imports node code). */
export type Word = { text: string; start: number; end: number; sentence: number };
export type Cuts = {
  slug: string;
  fps: number;
  width: number;
  height: number;
  words: Word[];
  sentences: { text: string; start: number; end: number }[];
  cuts: number[];
  durationSec: number;
  durationFrames: number;
};

/**
 * window: camera in a rounded window in the lower half, a graphic above it
 * full:   camera fills the frame (hook, punchlines, CTA)
 * yap:    camera fills the frame, the head framed lower; one graphic at a time pops up beside or above the
 *         head, never over it (needs head.json from `pnpm edit head`)
 * split:  screen + face: a screen recording (or a graphic) on top, the whole head below
 */
export type Mode = "window" | "full" | "yap" | "split";

/** Mirrors src/scripts/edit/head.ts `HeadTrack`: head boxes [x, y, w, h], normalised to the source frame. */
export type HeadBox = [number, number, number, number];
export type HeadTrack = { rate: number; boxes: (HeadBox | null)[]; segments: { from: number; to: number; box: HeadBox }[]; coverage: number };

/** A screen recording shown in split mode, on the output timeline. */
export type Screen = {
  from: number;
  to: number;
  /** path under public/, e.g. "edits/<slug>/screen.mp4" */
  src: string;
  /** seconds into the clip where this span starts (default 0) */
  start?: number;
  /** playback speed, to fit the clip to the words (default 1) */
  rate?: number;
  /** draw a browser address bar with this URL above the recording */
  url?: string;
  /** contain (default: whole screen visible) or cover */
  fit?: "contain" | "cover";
  /** zoom into part of the screen: 1 = whole, 2 = half; centred on focus (0..1, default .5/.5) */
  zoom?: number;
  focus?: { x: number; y: number };
};

export type Theme = {
  /** CSS font-family, already loaded by the plan file (e.g. via @remotion/google-fonts) */
  font: string;
  weight?: number;
  bg: string;
  /** text on bg */
  ink: string;
  /** graphics accent */
  accent: string;
  /** second accent for multi-hue graphics */
  accent2?: string;
  /** card surface behind graphics */
  card: string;
  /** caption text */
  caption: string;
  /** colour of keywords in captions */
  keyword: string;
};

export type GraphicProps = { f: number; fps: number; dur: number; theme: Theme; w: number; h: number };

export type Graphic = { from: number; to: number } & (
  | { kind: "headline"; text: string; sub?: string }
  | { kind: "step"; n: number; text: string; total?: number }
  | { kind: "stat"; value: number; prefix?: string; suffix?: string; label: string; decimals?: number }
  | { kind: "list"; title?: string; items: string[] }
  | { kind: "compare"; left: { label: string; value: string }; right: { label: string; value: string } }
  | { kind: "custom"; render: React.FC<GraphicProps> }
);

export type EditPlan = {
  slug: string;
  cuts: Cuts;
  /** path under public/, e.g. "edits/<slug>/footage.mp4" */
  footage: string;
  theme: Theme;
  /** lower-case words coloured in the captions (accents and punctuation ignored) */
  keywords: string[];
  /** layout changes on the output timeline, seconds; first entry should be at 0 */
  layout: { at: number; mode: Mode }[];
  graphics: Graphic[];
  /** head track (import public/edits/<slug>/head.json); required for yap, used by every mode for framing */
  head?: HeadTrack;
  /** screen recordings for split mode */
  screens?: Screen[];
  /** where the face sits in the source frame, 0..1 (default x .5, y .38); used when there is no head track */
  face?: { x: number; y: number };
  /** alternate a punch-in on every cut so jump cuts read as intentional (default true) */
  punchIn?: boolean;
  /** discreet SFX on layout changes and graphic entrances (default true) */
  sfx?: boolean;
  sfxVolume?: number;
  /** draw the paid-placement safe zones (QA stills only) */
  qa?: boolean;
};
