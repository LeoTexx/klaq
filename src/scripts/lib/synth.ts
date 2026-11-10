/**
 * Tiny deterministic synth for code-generated scores: oscillators, filters, drums,
 * tonal instruments, FX, Freeverb, a lookahead limiter and a 16-bit WAV writer.
 * No samples, no dependencies. Shared by every *-score.ts script in this folder.
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

export const SR = 48000;

/* ------------------------------ utilities ------------------------------ */
let seed = 0x9e3779b9;
export const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const noise = () => rand() * 2 - 1;
export const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
export const TAU = Math.PI * 2;

export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private z1 = 0;
  private z2 = 0;
  set(type: "lp" | "hp" | "bp", f: number, q = 0.707) {
    const w = (TAU * Math.min(Math.max(f, 10), SR * 0.45)) / SR;
    const c = Math.cos(w);
    const al = Math.sin(w) / (2 * q);
    let b0: number, b1: number, b2: number;
    if (type === "lp") [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
    else if (type === "hp") [b0, b1, b2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
    else [b0, b1, b2] = [al, 0, -al];
    const a0 = 1 + al;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * c) / a0;
    this.a2 = (1 - al) / a0;
    return this;
  }
  run(x: number) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}

export const blep = (t: number, dt: number) => {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
};
export class Saw {
  ph: number;
  constructor(ph = rand()) {
    this.ph = ph;
  }
  next(f: number) {
    const dt = f / SR;
    const v = 2 * this.ph - 1 - blep(this.ph, dt);
    this.ph += dt;
    if (this.ph >= 1) this.ph -= 1;
    return v;
  }
}

export type Mono = Float32Array;
export type Stereo = [Float32Array, Float32Array];
export const buf = (sec: number) => new Float32Array(Math.max(1, Math.round(sec * SR)));
export const fadeEdges = (x: Float32Array, ms = 4) => {
  const n = Math.min(x.length, Math.round((ms / 1000) * SR));
  for (let i = 0; i < n; i++) x[x.length - 1 - i] *= i / n;
  return x;
};

/* ----------------------------- instruments ----------------------------- */
export function kick(o: { decay?: number; pitch?: number; punch?: number; click?: number } = {}): Mono {
  const { decay = 0.3, pitch = 47, punch = 1, click = 0.35 } = o;
  const x = buf(0.7);
  const hp = new Biquad().set("hp", 2200);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const f = pitch + 175 * punch * Math.exp(-t / 0.028) + 26 * Math.exp(-t / 0.14);
    ph += (TAU * f) / SR;
    const env = Math.exp(-t / decay) * Math.min(1, t / 0.0008);
    const v = Math.sin(ph) * env + hp.run(noise()) * Math.exp(-t / 0.0035) * click;
    x[i] = Math.tanh(v * 1.7) * 0.9;
  }
  return fadeEdges(x, 20);
}

export function boom(o: { dur?: number; f0?: number; f1?: number; decay?: number } = {}): Mono {
  const { dur = 1.8, f0 = 78, f1 = 33, decay = 0.75 } = o;
  const x = buf(dur);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t / 0.16);
    ph += (TAU * f) / SR;
    x[i] = Math.tanh(1.5 * Math.sin(ph) * Math.exp(-t / decay) * Math.min(1, t / 0.003)) * 0.9;
  }
  return fadeEdges(x, 60);
}

export function clap(): Mono {
  const x = buf(0.55);
  const bp = new Biquad().set("bp", 1250, 1.1);
  const hp = new Biquad().set("hp", 450);
  const hits = [0, 0.0095, 0.0195, 0.03];
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    let env = 0;
    for (const h of hits) if (t >= h) env += Math.exp(-(t - h) / 0.0055);
    if (t >= 0.03) env += 0.75 * Math.exp(-(t - 0.03) / 0.15);
    x[i] = bp.run(hp.run(noise())) * Math.min(1.2, env) * 2.4;
  }
  return fadeEdges(x);
}

export const HAT_F = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => f * 1.6);
export function hat(decay = 0.045): Mono {
  const x = buf(Math.min(0.9, decay * 8));
  const bp = new Biquad().set("bp", 10200, 0.8);
  const hp = new Biquad().set("hp", 7200);
  const ph = HAT_F.map(() => rand());
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    let v = 0;
    for (let k = 0; k < HAT_F.length; k++) {
      ph[k] += HAT_F[k] / SR;
      v += ph[k] % 1 < 0.5 ? 1 : -1;
    }
    v = v / 6 + noise() * 0.35;
    x[i] = hp.run(bp.run(v)) * Math.exp(-t / decay) * Math.min(1, t / 0.0006) * 1.6;
  }
  return fadeEdges(x);
}

export function snare(): Mono {
  const x = buf(0.35);
  const hp = new Biquad().set("hp", 1400);
  const bp = new Biquad().set("bp", 4200, 0.6);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    ph += (TAU * (185 + 60 * Math.exp(-t / 0.025))) / SR;
    const body = Math.sin(ph) * Math.exp(-t / 0.055) * 0.7;
    const sn = bp.run(hp.run(noise())) * Math.exp(-t / 0.12) * 1.6;
    x[i] = Math.tanh((body + sn) * 1.3) * Math.min(1, t / 0.0008);
  }
  return fadeEdges(x);
}

export function crash(decay = 0.9, len = 2.4): Stereo {
  const out: Stereo = [buf(len), buf(len)];
  for (let c = 0; c < 2; c++) {
    const hp = new Biquad().set("hp", 3200);
    const hp2 = new Biquad().set("hp", 2600);
    const ph = HAT_F.map(() => rand());
    for (let i = 0; i < out[c].length; i++) {
      const t = i / SR;
      let m = 0;
      for (let k = 0; k < HAT_F.length; k++) {
        ph[k] += (HAT_F[k] * (1.37 + c * 0.02)) / SR;
        m += ph[k] % 1 < 0.5 ? 1 : -1;
      }
      const v = hp2.run(hp.run(noise() * 0.8 + (m / 6) * 0.4));
      out[c][i] = v * Math.exp(-t / decay) * Math.min(1, t / 0.002);
    }
    fadeEdges(out[c], 200);
  }
  return out;
}

export function pluck(f: number, o: { decay?: number; bright?: number } = {}): Mono {
  const { decay = 0.42, bright = 1 } = o;
  const x = buf(decay * 5);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const ok = (r: number) => (f * r < SR * 0.45 ? 1 : 0);
    const v =
      Math.sin(TAU * f * t) * Math.exp(-t / decay) +
      ok(3.93) * 0.45 * bright * Math.sin(TAU * f * 3.93 * t) * Math.exp(-t / (decay * 0.13)) +
      ok(9.2) * 0.16 * bright * Math.sin(TAU * f * 9.2 * t) * Math.exp(-t / (decay * 0.04));
    x[i] = v * Math.min(1, t / 0.0015);
  }
  return fadeEdges(x, 30);
}

export function bell(f: number, decay = 1.6): Mono {
  const x = buf(decay * 3.2);
  const parts = [
    [1, 1, 1],
    [2.76, 0.42, 0.45],
    [5.4, 0.22, 0.2],
    [8.93, 0.12, 0.09],
  ];
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    let v = 0;
    for (const [r, a, d] of parts) if (f * r < SR * 0.45) v += a * Math.sin(TAU * f * r * t) * Math.exp(-t / (decay * d));
    x[i] = v * Math.min(1, t / 0.001) * 0.6;
  }
  return fadeEdges(x, 80);
}

export function stab(notes: number[], o: { dur?: number; decay?: number; hi?: number; lo?: number; detune?: number } = {}): Stereo {
  const { dur = 0.9, decay = 0.24, hi = 6500, lo = 700, detune = 0.12 } = o;
  const out: Stereo = [buf(dur), buf(dur)];
  for (let c = 0; c < 2; c++) {
    const lp = new Biquad();
    const oscs = notes.flatMap((m) => [-detune, 0, detune].map((d) => ({ f: hz(m + d + (c ? 0.03 : -0.03)), o: new Saw() })));
    for (let i = 0; i < out[c].length; i++) {
      const t = i / SR;
      if (i % 16 === 0) lp.set("lp", lo + (hi - lo) * Math.exp(-t / 0.085), 0.9);
      let v = 0;
      for (const o2 of oscs) v += o2.o.next(o2.f);
      v /= Math.sqrt(oscs.length) * 1.6;
      out[c][i] = lp.run(v) * Math.exp(-t / decay) * Math.min(1, t / 0.003);
    }
    fadeEdges(out[c], 40);
  }
  return out;
}

export function pad(notes: number[], dur: number, o: { attack?: number; release?: number; cutoff?: number } = {}): Stereo {
  const { attack = 0.25, release = 0.5, cutoff = 1500 } = o;
  const out: Stereo = [buf(dur + release), buf(dur + release)];
  for (let c = 0; c < 2; c++) {
    const lp = new Biquad();
    const oscs = notes.flatMap((m) => [-0.08, 0.08].map((d) => ({ f: hz(m + d + (c ? 0.04 : -0.04)), o: new Saw() })));
    for (let i = 0; i < out[c].length; i++) {
      const t = i / SR;
      if (i % 32 === 0) lp.set("lp", cutoff * (1 + 0.25 * Math.sin(TAU * 0.35 * t + c)), 0.6);
      let v = 0;
      for (const o2 of oscs) v += o2.o.next(o2.f);
      const env = Math.min(1, t / attack) * (t > dur ? Math.max(0, 1 - (t - dur) / release) : 1);
      out[c][i] = (lp.run(v) / Math.sqrt(oscs.length)) * env * 0.5;
    }
  }
  return out;
}

export function bass(f: number, len = 0.2): Mono {
  const x = buf(len + 0.05);
  const lp = new Biquad();
  const saw = new Saw(0);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    if (i % 16 === 0) lp.set("lp", 240 + 1500 * Math.exp(-t / 0.04), 1.1);
    ph += (TAU * f) / SR;
    const env = Math.min(1, t / 0.004) * Math.exp(-t / 0.17) * (t > len ? Math.max(0, 1 - (t - len) / 0.05) : 1);
    x[i] = Math.tanh((Math.sin(ph) * 0.95 + lp.run(saw.next(f)) * 0.6) * 1.4) * env;
  }
  return x;
}

export function whoosh(dur: number, o: { f0?: number; f1?: number; q?: number; peak?: number; pan0?: number; pan1?: number } = {}): Stereo {
  const { f0 = 300, f1 = 5000, q = 1.3, peak = 0.7, pan0 = -0.5, pan1 = 0.5 } = o;
  const out: Stereo = [buf(dur), buf(dur)];
  const bp = new Biquad();
  const bp2 = new Biquad();
  for (let i = 0; i < out[0].length; i++) {
    const u = i / out[0].length;
    if (i % 16 === 0) {
      const f = f0 * Math.pow(f1 / f0, u);
      bp.set("bp", f, q);
      bp2.set("bp", f * 1.5, q);
    }
    const env = u < peak ? Math.pow(u / peak, 2) : Math.pow((1 - u) / (1 - peak), 1.6);
    const v = (bp.run(noise()) + bp2.run(noise()) * 0.6) * env * 2.2;
    const pan = pan0 + (pan1 - pan0) * u;
    out[0][i] = v * Math.cos(((pan + 1) * Math.PI) / 4);
    out[1][i] = v * Math.sin(((pan + 1) * Math.PI) / 4);
  }
  return out;
}

export function riser(dur: number, o: { f0?: number; f1?: number; tone?: number } = {}): Stereo {
  const { f0 = 250, f1 = 7000, tone = 0.25 } = o;
  const out: Stereo = [buf(dur), buf(dur)];
  for (let c = 0; c < 2; c++) {
    const hp = new Biquad();
    const bp = new Biquad();
    const saw = new Saw();
    for (let i = 0; i < out[c].length; i++) {
      const u = i / out[c].length;
      if (i % 16 === 0) {
        hp.set("hp", f0 * Math.pow(f1 / f0, u) * 0.5);
        bp.set("bp", f0 * Math.pow(f1 / f0, u), 0.9);
      }
      const env = Math.pow(u, 2.2);
      const n = bp.run(hp.run(noise())) * 1.8;
      const sw = saw.next(110 * Math.pow(4, u) * (c ? 1.004 : 0.996)) * tone * 0.3;
      out[c][i] = (n + sw) * env;
    }
    fadeEdges(out[c], 3);
  }
  return out;
}

export function reverseSwell(dur: number, bright = 1): Stereo {
  const out: Stereo = [buf(dur), buf(dur)];
  for (let c = 0; c < 2; c++) {
    const hp = new Biquad().set("hp", 1800 * bright);
    const lp = new Biquad();
    for (let i = 0; i < out[c].length; i++) {
      const t = i / SR;
      const u = t / dur;
      if (i % 16 === 0) lp.set("lp", 1500 + 12000 * u * u);
      out[c][i] = lp.run(hp.run(noise())) * Math.exp((t - dur) / (dur * 0.28)) * Math.min(1, (dur - t) / 0.004) * 1.3;
    }
  }
  return out;
}

export function bloop(f0: number, f1: number, dur = 0.09): Mono {
  const x = buf(dur * 2.5);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const u = Math.min(1, t / dur);
    ph += (TAU * f0 * Math.pow(f1 / f0, u)) / SR;
    x[i] = Math.sin(ph) * Math.min(1, t / 0.0015) * Math.exp(-t / (dur * 0.45));
  }
  return fadeEdges(x);
}

export function ping(f: number, decay = 0.55): Mono {
  const x = buf(decay * 4);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    x[i] = (Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * f * 2.01 * t) * Math.exp(-t / 0.08)) * Math.exp(-t / decay) * Math.min(1, t / 0.001);
  }
  return fadeEdges(x, 30);
}

export function tick(f = 3200, decay = 0.005): Mono {
  const x = buf(0.04);
  const hp = new Biquad().set("hp", 2000);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    x[i] = (Math.sin(TAU * f * t) * 0.6 + hp.run(noise()) * 0.5) * Math.exp(-t / decay);
  }
  return fadeEdges(x);
}

export function glitch(dur: number): Stereo {
  const out: Stereo = [buf(dur), buf(dur)];
  for (let c = 0; c < 2; c++) {
    let hold = 0;
    let val = 0;
    let gate = 1;
    for (let i = 0; i < out[c].length; i++) {
      if (hold-- <= 0) {
        hold = Math.floor(2 + rand() * 40);
        val = Math.round(noise() * 4) / 4;
      }
      if (i % Math.round(SR * 0.018) === 0) gate = rand() > 0.35 ? 1 : 0;
      out[c][i] = val * gate * 0.55;
    }
    fadeEdges(out[c]);
  }
  return out;
}

export function sine(f0: number, f1: number, dur: number, vib = 0): Mono {
  const x = buf(dur);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const u = t / dur;
    const f = f0 * Math.pow(f1 / f0, u) * (1 + vib * Math.sin(TAU * 7 * t));
    ph += (TAU * f) / SR;
    x[i] = Math.sin(ph) * Math.sin(Math.PI * u);
  }
  return x;
}

export function swirl(dur: number): Stereo {
  const out: Stereo = [buf(dur), buf(dur)];
  for (let c = 0; c < 2; c++) {
    const bp = new Biquad();
    for (let i = 0; i < out[c].length; i++) {
      const t = i / SR;
      const u = t / dur;
      if (i % 16 === 0) bp.set("bp", 900 + 700 * Math.sin(TAU * 5.5 * t + c * 1.6) + 1400 * u, 2.2);
      out[c][i] = bp.run(noise()) * Math.sin(Math.PI * u) * 2.2;
    }
  }
  return out;
}


/* ------------------------------- reverb -------------------------------- */
/** Freeverb (Jezar), stereo */
export function freeverb(inp: Stereo, room = 0.83, damp = 0.28): Stereo {
  const N = inp[0].length;
  const sc = SR / 44100;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const apT = [556, 441, 341, 225];
  const mk = (n: number) => ({ b: new Float32Array(Math.round(n * sc)), i: 0, st: 0 });
  const out: Stereo = [new Float32Array(N), new Float32Array(N)];
  for (let c = 0; c < 2; c++) {
    const combs = combT.map((t) => mk(t + c * 23));
    const aps = apT.map((t) => mk(t + c * 23));
    for (let i = 0; i < N; i++) {
      const x = (inp[0][i] + inp[1][i]) * 0.015;
      let acc = 0;
      for (const cb of combs) {
        const o = cb.b[cb.i];
        cb.st = o * (1 - damp) + cb.st * damp;
        cb.b[cb.i] = x + cb.st * room;
        cb.i = (cb.i + 1) % cb.b.length;
        acc += o;
      }
      for (const ap of aps) {
        const bo = ap.b[ap.i];
        const o = -acc + bo;
        ap.b[ap.i] = acc + bo * 0.5;
        ap.i = (ap.i + 1) % ap.b.length;
        acc = o;
      }
      out[c][i] = acc;
    }
  }
  return out;
}

/* -------------------------------- mixer -------------------------------- */
type BusDef = { sig: Stereo; ducked: boolean };

/** Buses + reverb send → ducking, reverb, HP, lookahead limiter, fade, dithered WAV. */
export class Mix {
  readonly N: number;
  readonly SEND: Stereo;
  private buses: BusDef[] = [];
  private duck: Float32Array;
  L = new Float32Array(0);
  R = new Float32Array(0);
  gainReduced = 0;
  /** master gain applied before the limiter (printed by writeWav; pass it back as `gain` to render a stem on the same scale) */
  preGain = 1;

  constructor(seconds: number) {
    this.N = Math.round(seconds * SR);
    this.SEND = [new Float32Array(this.N), new Float32Array(this.N)];
    this.duck = new Float32Array(this.N).fill(1);
  }

  bus(ducked = false): Stereo {
    const sig: Stereo = [new Float32Array(this.N), new Float32Array(this.N)];
    this.buses.push({ sig, ducked });
    return sig;
  }

  place(dst: Stereo, sig: Mono | Stereo, atSec: number, gain = 1, pan = 0, send = 0) {
    const N = this.N;
    const SEND = this.SEND;
    const start = Math.round(atSec * SR);
    const stereo = Array.isArray(sig);
    const L = stereo ? (sig as Stereo)[0] : (sig as Mono);
    const R = stereo ? (sig as Stereo)[1] : (sig as Mono);
    const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
    const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
    for (let i = 0; i < L.length; i++) {
      const j = start + i;
      if (j < 0 || j >= N) continue;
      const l = L[i] * gl;
      const r = R[i] * gr;
      dst[0][j] += l;
      dst[1][j] += r;
      if (send) {
        SEND[0][j] += l * send;
        SEND[1][j] += r * send;
      }
    }
  }

  /** Sidechain: dip the ducked buses at each trigger time (seconds) */
  duckAt(times: number[], depth = 0.62, release = 0.12) {
    const N = this.N;
    for (const tSec of times) {
      const st = Math.round(tSec * SR);
      for (let i = 0; i < SR * 0.45 && st + i < N; i++) {
        const t = i / SR;
        const d = 1 - depth * Math.min(1, t / 0.004) * Math.exp(-t / release);
        this.duck[st + i] = Math.min(this.duck[st + i], d);
      }
    }
  }

  /**
   * Sidechain from another bus (e.g. the voice-over): an envelope follower on `src`
   * dips the ducked buses while the voice speaks. depth 0.6 ≈ -8 dB under speech.
   */
  duckFrom(src: Stereo, depth = 0.6, attack = 0.012, release = 0.28, threshold = 0.04) {
    const N = this.N;
    const a = 1 - Math.exp(-1 / (attack * SR));
    const r = 1 - Math.exp(-1 / (release * SR));
    let env = 0;
    for (let i = 0; i < N; i++) {
      const x = Math.max(Math.abs(src[0][i]), Math.abs(src[1][i]));
      env += (x > env ? a : r) * (x - env);
      const g = 1 - depth * Math.min(1, env / threshold);
      if (g < this.duck[i]) this.duck[i] = g;
    }
  }

  /**
   * Sum, reverb, limit. headroom: pre-limiter peak over the ceiling (1.35 ≈ +2.6 dB).
   * gain: fixed master gain instead of peak normalisation (to render stems on the full mix's scale).
   */
  render(o: { revGain?: number; room?: number; damp?: number; ceiling?: number; headroom?: number; fadeOut?: number; gain?: number } = {}) {
    const { revGain = 2.4, room = 0.83, damp = 0.28, ceiling = 0.89, headroom = 1.35, fadeOut = 0.12 } = o;
    const N = this.N;
    const rev = freeverb(this.SEND, room, damp);
    const L = new Float32Array(N);
    const R = new Float32Array(N);
    const hpL = new Biquad().set("hp", 28);
    const hpR = new Biquad().set("hp", 28);
    const duck = this.duck;
    const buses = this.buses;
    for (let i = 0; i < N; i++) {
      let l = 0;
      let r = 0;
      for (let b = 0; b < buses.length; b++) {
        const { sig, ducked } = buses[b];
        if (b === 0) {
          l = ducked ? sig[0][i] * duck[i] : sig[0][i];
          r = ducked ? sig[1][i] * duck[i] : sig[1][i];
        } else {
          l = l + (ducked ? sig[0][i] * duck[i] : sig[0][i]);
          r = r + (ducked ? sig[1][i] * duck[i] : sig[1][i]);
        }
      }
      L[i] = hpL.run(l + rev[0][i] * revGain);
      R[i] = hpR.run(r + rev[1][i] * revGain);
    }
    this.L = L;
    this.R = R;
    let peak = 0;
    for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    this.preGain = o.gain ?? (ceiling * headroom) / peak;
    this.limit(ceiling, this.preGain);
    for (let i = 0; i < SR * fadeOut; i++) {
      const k = i / (SR * fadeOut);
      L[N - 1 - i] *= k;
      R[N - 1 - i] *= k;
    }
    return this;
  }

  /** lookahead limiter (window-min + moving-average attack, one-pole release) */
  private limit(ceiling = 0.89, pre = 1.0) {
    const { N, L, R } = this;
    const la = Math.round(0.005 * SR);
    const tgt = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      L[i] *= pre;
      R[i] *= pre;
      const p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
      tgt[i] = p > ceiling ? ceiling / p : 1;
    }
    const wmin = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let m2 = 1;
      for (let k = 0; k <= la && i + k < N; k++) if (tgt[i + k] < m2) m2 = tgt[i + k];
      wmin[i] = m2;
    }
    let acc = la + 1; // window starts as unity gain
    const rel = 1 - Math.exp(-1 / (0.09 * SR));
    let gr = 1;
    for (let i = 0; i < N; i++) {
      acc += wmin[i] - (i - la - 1 >= 0 ? wmin[i - la - 1] : 1);
      const g = acc / (la + 1); // ≤ target at every peak by construction
      gr = g < gr ? g : gr + (g - gr) * rel;
      L[i] *= gr;
      R[i] *= gr;
      if (gr < 0.999) this.gainReduced++;
    }
  }

  sectionRms(a: number, b: number) {
    const { L, R } = this;
    let q = 0;
    const i0 = Math.round(a * SR);
    const i1 = Math.round(b * SR);
    for (let i = i0; i < i1; i++) q += L[i] * L[i] + R[i] * R[i];
    return (20 * Math.log10(Math.sqrt(q / ((i1 - i0) * 2)) + 1e-9)).toFixed(1);
  }

  /** 16-bit PCM with TPDF dither; prints peak / RMS / limiter activity */
  writeWav(out: string) {
    const { N, L, R } = this;
    const pcm = Buffer.alloc(44 + N * 4);
    pcm.write("RIFF", 0);
    pcm.writeUInt32LE(36 + N * 4, 4);
    pcm.write("WAVE", 8);
    pcm.write("fmt ", 12);
    pcm.writeUInt32LE(16, 16);
    pcm.writeUInt16LE(1, 20);
    pcm.writeUInt16LE(2, 22);
    pcm.writeUInt32LE(SR, 24);
    pcm.writeUInt32LE(SR * 4, 28);
    pcm.writeUInt16LE(4, 32);
    pcm.writeUInt16LE(16, 34);
    pcm.write("data", 36);
    pcm.writeUInt32LE(N * 4, 40);
    let sumSq = 0;
    let outPeak = 0;
    for (let i = 0; i < N; i++) {
      for (let c = 0; c < 2; c++) {
        const v = (c ? R : L)[i];
        sumSq += v * v;
        outPeak = Math.max(outPeak, Math.abs(v));
        const d = (rand() - rand()) / 32768;
        const q = Math.max(-32768, Math.min(32767, Math.round((v + d) * 32767)));
        pcm.writeInt16LE(q, 44 + i * 4 + c * 2);
      }
    }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, pcm);
    const rms = Math.sqrt(sumSq / (N * 2));
    console.log(
      `score → ${out}\n  ${(N / SR).toFixed(2)} s · peak ${(20 * Math.log10(outPeak)).toFixed(2)} dBFS · RMS ${(20 * Math.log10(rms)).toFixed(2)} dBFS · limiter active ${((100 * this.gainReduced) / N).toFixed(1)}% of samples · master gain ${this.preGain.toFixed(4)}`,
    );
  }
}

/* ------------------------- more instruments --------------------------- */

/** Karplus–Strong plucked string; `bend` starts the pitch slightly sharp and lets it settle */
export function ksString(f: number, o: { dur?: number; decay?: number; bright?: number; bend?: number } = {}): Mono {
  const { dur = 3, decay = 0.9965, bright = 0.55, bend = 0.012 } = o;
  const P = Math.ceil(SR / (f * 0.9)) + 4;
  const len = Math.round(dur * SR);
  const y = new Float32Array(len + P);
  let lp = 0;
  for (let i = 0; i < P; i++) {
    lp += bright * (noise() - lp);
    y[i] = lp;
  }
  for (let n = P; n < len + P; n++) {
    const t = (n - P) / SR;
    const D = SR / (f * (1 + bend * Math.exp(-t / 0.09)));
    const rp = n - D;
    const i0 = Math.floor(rp);
    const fr = rp - i0;
    const a = y[i0] + (y[i0 + 1] - y[i0]) * fr;
    const b = y[i0 - 1] + (y[i0] - y[i0 - 1]) * fr;
    y[n] = decay * 0.5 * (a + b);
  }
  return fadeEdges(y.slice(P), 120);
}

/** soft, round kick: no click, gentle pitch drop */
export function thump(f0 = 92, f1 = 48, decay = 0.22): Mono {
  const x = buf(0.6);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    ph += (TAU * (f1 + (f0 - f1) * Math.exp(-t / 0.035))) / SR;
    x[i] = Math.sin(ph) * Math.exp(-t / decay) * Math.min(1, t / 0.004);
  }
  return fadeEdges(x, 30);
}

/** lub-dub */
export function heartbeat(): Mono {
  const a = thump(88, 46, 0.2);
  const b = thump(104, 56, 0.16);
  const off = Math.round(0.15 * SR);
  const x = buf(0.6 + 0.15);
  for (let i = 0; i < a.length; i++) x[i] += a[i];
  for (let i = 0; i < b.length && i + off < x.length; i++) x[i + off] += b[i] * 0.6;
  return x;
}

/** sustained sub bass note with attack/release */
export function sub(f: number, dur: number, attack = 0.08, release = 0.4): Mono {
  const x = buf(dur + release);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    ph += (TAU * f) / SR;
    const env = Math.min(1, t / attack) * (t > dur ? Math.max(0, 1 - (t - dur) / release) : 1);
    x[i] = (Math.sin(ph) + 0.18 * Math.sin(2 * ph)) * env * 0.85;
  }
  return x;
}

/** pen on paper: band-passed noise whose loudness follows a per-frame speed envelope */
export function scribble(envPerFrame: number[], fps: number, o: { f0?: number; f1?: number; q?: number } = {}): Stereo {
  const { f0 = 1800, f1 = 4200, q = 0.9 } = o;
  const len = Math.round((envPerFrame.length / fps) * SR);
  const out: Stereo = [new Float32Array(len), new Float32Array(len)];
  for (let c = 0; c < 2; c++) {
    const bp = new Biquad();
    const hp = new Biquad().set("hp", 900);
    for (let i = 0; i < len; i++) {
      const fr = (i / SR) * fps;
      const k = Math.min(envPerFrame.length - 2, Math.floor(fr));
      const e = envPerFrame[k] + (envPerFrame[k + 1] - envPerFrame[k]) * (fr - k);
      if (i % 32 === 0) bp.set("bp", f0 + (f1 - f0) * Math.min(1, e), q);
      // grainy: amplitude-modulated noise reads as graphite rather than air
      const grain = 0.6 + 0.4 * Math.abs(noise());
      out[c][i] = bp.run(hp.run(noise())) * e * grain * 1.6;
    }
  }
  return out;
}

/** muted, slightly detuned square beep (a system that's waiting on someone) */
export function beep(f: number, dur = 0.09): Mono {
  const x = buf(dur + 0.05);
  const lp = new Biquad().set("lp", 2200, 0.8);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const sq = (Math.sin(TAU * f * t) > 0 ? 1 : -1) * 0.5 + (Math.sin(TAU * f * 1.006 * t) > 0 ? 1 : -1) * 0.5;
    const env = Math.min(1, t / 0.003) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 0.03));
    x[i] = lp.run(sq) * env * 0.5;
  }
  return x;
}

/* ------------------------ notification sounds ------------------------- */

/** message bubble arriving: rounded upward blip with a soft transient */
export function pop(f0 = 760, f1 = 1240, dur = 0.07): Mono {
  const x = buf(dur * 3);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const u = Math.min(1, t / dur);
    ph += (TAU * f0 * Math.pow(f1 / f0, Math.pow(u, 0.6))) / SR;
    x[i] = (Math.sin(ph) + 0.25 * Math.sin(2 * ph)) * Math.min(1, t / 0.001) * Math.exp(-t / (dur * 0.55));
  }
  return fadeEdges(x);
}

/** keyboard taps at a human, uneven rate */
export function typing(dur: number, rate = 13): Mono {
  const x = buf(dur);
  const bp = new Biquad().set("bp", 3200, 1.4);
  let next = 0;
  let amp = 0;
  let age = 1;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    if (t >= next) {
      next = t + (1 / rate) * (0.55 + rand() * 0.9);
      amp = 0.5 + rand() * 0.5;
      age = 0;
    }
    age += 1 / SR;
    x[i] = bp.run(noise()) * amp * Math.exp(-age / 0.007) * 2.4;
  }
  return fadeEdges(x);
}

/** phone vibrating on a table: pulses of low buzz with rattle */
export function buzz(pulses = 2, on = 0.32, off = 0.16): Mono {
  const x = buf(pulses * (on + off));
  const lp = new Biquad().set("lp", 900, 0.9);
  const saw = new Saw(0);
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const k = t % (on + off);
    const gate = k < on ? Math.min(1, k / 0.012) * Math.min(1, (on - k) / 0.02) : 0;
    const rattle = 0.65 + 0.35 * Math.abs(noise());
    x[i] = lp.run(saw.next(148)) * gate * rattle * 0.8;
  }
  return fadeEdges(x);
}

/** small coin/cash chime: two bright bells a breath apart */
export function coin(): Mono {
  const a = bell(hz(96), 0.32);
  const b = bell(hz(103), 0.42);
  const off = Math.round(0.065 * SR);
  const x = buf(0.065 + Math.max(a.length, b.length) / SR);
  for (let i = 0; i < a.length; i++) x[i] += a[i] * 0.8;
  for (let i = 0; i < b.length && i + off < x.length; i++) x[i + off] += b[i];
  return x;
}

/** tape rewind: warbling, accelerating chirp over band-passed noise */
export function rewind(dur = 0.8): Stereo {
  const out: Stereo = [buf(dur), buf(dur)];
  for (let c = 0; c < 2; c++) {
    const bp = new Biquad();
    let ph = 0;
    for (let i = 0; i < out[c].length; i++) {
      const t = i / SR;
      const u = t / dur;
      const f = 900 + 5200 * u * u + 380 * Math.sin(TAU * (9 + 16 * u) * t + c);
      ph += (TAU * f) / SR;
      if (i % 16 === 0) bp.set("bp", f * 1.4, 2.2);
      const env = Math.min(1, t / 0.03) * Math.min(1, (dur - t) / 0.02);
      out[c][i] = (Math.sin(ph) * 0.35 + bp.run(noise()) * 1.4) * env * 0.6;
    }
  }
  return out;
}

/** power-down: a tone that loses its speed (the "nobody answered" moment) */
export function powerDown(f0 = 520, dur = 0.6): Mono {
  const x = buf(dur);
  let ph = 0;
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const u = t / dur;
    ph += (TAU * f0 * Math.pow(1 - u, 2.2)) / SR;
    x[i] = (Math.sin(ph) * 0.8 + Math.sin(ph * 2.01) * 0.2) * (1 - u) * Math.min(1, t / 0.005);
  }
  return x;
}

/* --------------------------- external audio --------------------------- */

/** decode any audio file (mp3, wav…) to mono float at SR through ffmpeg */
export function loadAudio(file: string): Mono {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg failed on ${file}: ${r.stderr.toString()}`);
  const b = r.stdout as Buffer;
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

/* ------------------------------ signatures ----------------------------- */

/**
 * A notification: two rounded blips a fourth apart, 85 ms between them. An original sound,
 * not any app's; reuse one across a campaign so the films share a sonic signature.
 */
export function chime(): Mono {
  const a = pop(880, 1320, 0.06);
  const b = pop(1175, 1760, 0.07);
  const off = Math.round(0.085 * SR);
  const x = buf(0.085 + b.length / SR);
  for (let i = 0; i < a.length; i++) x[i] += a[i] * 0.85;
  for (let i = 0; i < b.length && i + off < x.length; i++) x[i + off] += b[i];
  return x;
}
