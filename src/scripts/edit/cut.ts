/**
 * Step 03a — transcribe the raw recording and plan the cuts.
 *
 *   pnpm edit cut <slug> --raw <file> [--script roteiro.txt] [--lang pt] [--pick 3:1,5:2] [--gap 0.25]
 *
 * - Word-level whisper transcript of the raw take (cached in work/<slug>/).
 * - With a script: every script sentence is matched against the transcript; each spoken attempt is a
 *   "take"; the LAST good take wins (the recording rule is "got it wrong? say the sentence again").
 *   Without a script: an utterance that is restarted within the next three utterances is dropped.
 * - Pauses longer than --gap and hesitation sounds are cut out. Cut points are refined on the audio
 *   envelope so they always fall in the silence between words, never inside one.
 * - Writes public/projects/<slug>/cuts.json (segments + words/sentences on the output timeline)
 *   and work/<slug>/takes.md (every take found, which one was chosen, how to override).
 */
import fs from "fs";
import path from "path";
import { decode, dirs, envelope, extractAudio, fmtT, norm, probe, compFps, similarity, transcribe, type Word } from "./lib";

export type Segment = { in: number; out: number; sentence: number };
export type Cuts = {
  slug: string;
  raw: string;
  fps: number;
  width: number;
  height: number;
  segments: Segment[];
  /** output timeline, seconds */
  words: (Word & { sentence: number })[];
  sentences: { text: string; start: number; end: number }[];
  /** output-timeline seconds where one source segment ends and the next starts */
  cuts: number[];
  durationSec: number;
  durationFrames: number;
};

// Portuguese hesitations only: "um"/"uma" are articles, never strip them
/** hesitations dropped between words: Portuguese (ahn, hã, hum, éé) and English (um, uh, er, hmm); extend for other languages */
const FILLER = /^(a+h+n+|h[ãa]+|hum+|hmm+|é{2,}|ã+|eh+|u+m+|u+h+|e+r+m*|m+h*m+)[.,!?…]*$/i;

type Take = { a: number; b: number; score: number }; // word index range [a, b)

function splitSentences(script: string) {
  return script
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => norm(s).length > 0);
}

/** Every attempt at `sentence` in the transcript, best-scoring span per attempt, chronological. */
function findTakes(sentence: string[], toks: string[][], min = 0.6): Take[] {
  const L = sentence.length;
  const cands: Take[] = [];
  for (let a = 0; a < toks.length; a++) {
    // a take must start on a word that appears near the start of the sentence
    if (!sentence.slice(0, 3).some((t) => toks[a].includes(t))) continue;
    for (let len = Math.max(1, Math.floor(L * 0.5)); len <= Math.ceil(L * 1.4) && a + len <= toks.length; len++) {
      const span = toks.slice(a, a + len).flat();
      const s = similarity(sentence, span);
      if (s >= min) cands.push({ a, b: a + len, score: s });
    }
  }
  // non-max suppression: overlapping spans are the same attempt
  cands.sort((x, y) => y.score - x.score || y.b - y.a - (x.b - x.a));
  const takes: Take[] = [];
  for (const c of cands) if (!takes.some((t) => c.a < t.b && t.a < c.b)) takes.push(c);
  return takes.sort((x, y) => x.a - y.a);
}

/** A full take scores close to the best; an abandoned one ("Hoje eu vou… hoje eu vou te mostrar") scores low. */
function chooseTake(takes: Take[]) {
  const best = Math.max(...takes.map((t) => t.score));
  for (let i = takes.length - 1; i >= 0; i--) if (takes[i].score >= best - 0.08) return i;
  return takes.length - 1;
}

/**
 * Caption text should follow the script (spelling, casing, "cinco" not "5"), timing should follow the voice.
 * Align script words to the take's whisper words (LCS on normalised words); unmatched script words between
 * two anchors are spread over the time the unmatched spoken words occupy.
 */
function alignScript(sentence: string, ws: Word[]): Word[] {
  const sw = sentence.split(/\s+/).filter((w) => norm(w).length);
  const key = (w: string) => norm(w).join("");
  const A = sw.map(key);
  const B = ws.map((w) => key(w.text));
  const Wd = B.length + 1;
  const dp = new Uint16Array((A.length + 1) * Wd);
  for (let i = 1; i <= A.length; i++)
    for (let j = 1; j <= B.length; j++)
      dp[i * Wd + j] = A[i - 1] === B[j - 1] ? dp[(i - 1) * Wd + j - 1] + 1 : Math.max(dp[(i - 1) * Wd + j], dp[i * Wd + j - 1]);
  const pairs: [number, number][] = [];
  for (let i = A.length, j = B.length; i > 0 && j > 0; ) {
    if (A[i - 1] === B[j - 1]) pairs.unshift([--i, --j]);
    else if (dp[(i - 1) * Wd + j] >= dp[i * Wd + j - 1]) i--;
    else j--;
  }
  const out: Word[] = [];
  const anchors: [number, number][] = [[-1, -1], ...pairs, [A.length, B.length]];
  for (let k = 0; k < anchors.length - 1; k++) {
    const [i0, j0] = anchors[k];
    const [i1, j1] = anchors[k + 1];
    const gapS = sw.slice(i0 + 1, i1);
    if (gapS.length) {
      const spoken = ws.slice(j0 + 1, j1);
      const t0 = spoken.length ? spoken[0].start : j0 >= 0 ? ws[j0].end : ws[0].start;
      const t1 = spoken.length ? spoken[spoken.length - 1].end : j1 < ws.length ? ws[j1].start : ws[ws.length - 1].end;
      const step = Math.max(0.05, t1 - t0) / gapS.length;
      gapS.forEach((text, n) => out.push({ text, start: +(t0 + n * step).toFixed(3), end: +(t0 + (n + 1) * step).toFixed(3) }));
    }
    if (i1 < A.length) out.push({ ...ws[j1], text: sw[i1] });
  }
  return out;
}

/** Utterances when there is no script: split at long pauses or sentence punctuation. */
function utterances(words: Word[], pause = 0.7) {
  const out: [number, number][] = [];
  let a = 0;
  for (let i = 0; i < words.length; i++) {
    const last = i === words.length - 1;
    if (last || words[i + 1].start - words[i].end > pause || /[.!?…]$/.test(words[i].text)) {
      out.push([a, i + 1]);
      a = i + 1;
    }
  }
  return out;
}

/** Move word edges onto the real speech onset/offset using the energy envelope. */
function refineEdges(words: Word[], env: Float32Array) {
  const sorted = [...env].sort((x, y) => x - y);
  const floor = sorted[Math.floor(sorted.length * 0.1)];
  const speech = sorted[Math.floor(sorted.length * 0.9)];
  // above the room noise, but well under speech (digital silence would otherwise make every breath "speech")
  const thr = Math.max(floor + 10, speech - 38);
  const at = (t: number) => env[Math.max(0, Math.min(env.length - 1, Math.round(t * 100)))];
  // speech needs a few loud 10 ms frames in a row, so a click does not count as an onset
  const loud = (t: number) => at(t) > thr && at(t + 0.01) > thr && at(t + 0.02) > thr;
  return words.map((w, i) => {
    const prevEnd = i ? words[i - 1].end : 0;
    const nextStart = i < words.length - 1 ? words[i + 1].start : w.end + 1;
    let s = w.start;
    // whisper often stretches a word back into the silence before it: move the start to the onset…
    while (s < w.end - 0.05 && !loud(s)) s += 0.01;
    // …or, when it starts the word late, walk back while there is still speech energy
    while (s - 0.01 > Math.max(prevEnd, w.start - 0.25) && at(s - 0.01) > thr) s -= 0.01;
    let e = w.end;
    // trailing silence inside the word goes, an audible tail stays
    while (e > s + 0.05 && at(e - 0.01) <= thr) e -= 0.01;
    while (e + 0.01 < Math.min(nextStart, w.end + 0.3) && at(e + 0.01) > thr) e += 0.01;
    return { ...w, start: +s.toFixed(3), end: +e.toFixed(3) };
  });
}

export async function cut(slug: string, opts: { raw: string; script?: string; lang: string; picks?: string; gap: number }) {
  const d = dirs(slug);
  const raw = path.resolve(opts.raw);
  const p = probe(raw);
  const fps = compFps(p.fps);
  const audio = extractAudio(raw, path.join(d.work, "audio.wav"));
  const env = envelope(decode(audio), 16000);
  const words = refineEdges(transcribe(audio, path.join(d.work, "transcript.json"), opts.lang), env);
  const toks = words.map((w) => norm(w.text));

  // saved overrides survive re-runs; --pick adds to them
  const picksFile = path.join(d.work, "picks.json");
  const picks: Record<string, number> = fs.existsSync(picksFile) ? JSON.parse(fs.readFileSync(picksFile, "utf8")) : {};
  for (const kv of (opts.picks ?? "").split(",").filter(Boolean)) {
    const [s, t] = kv.split(":").map(Number);
    picks[s] = t;
  }
  fs.writeFileSync(picksFile, JSON.stringify(picks, null, 2));

  // ranges of word indices to keep, tagged with the sentence they belong to
  const keep: { a: number; b: number; sentence: number; display?: Word[] }[] = [];
  const sentences: string[] = [];
  const md: string[] = [`# Takes — ${slug}`, "", `Raw: ${raw} (${fmtT(p.duration)}, ${p.width}x${p.height} @ ${p.fps.toFixed(2)})`, ""];

  if (opts.script) {
    const script = fs.readFileSync(path.resolve(opts.script), "utf8");
    splitSentences(script).forEach((s, k) => {
      sentences.push(s);
      const takes = findTakes(norm(s), toks);
      md.push(`## ${k + 1}. ${s}`);
      if (!takes.length) {
        md.push("", "**No take found.** Re-record this sentence or edit the script to match what was said.", "");
        return;
      }
      const auto = chooseTake(takes);
      const chosen = picks[k + 1] ? Math.min(takes.length, picks[k + 1]) - 1 : auto;
      takes.forEach((t, i) =>
        md.push(
          `- ${i === chosen ? "**→**" : "  "} take ${i + 1} @ ${fmtT(words[t.a].start)}–${fmtT(words[t.b - 1].end)} · match ${(t.score * 100).toFixed(0)}%${i === auto ? " (auto)" : ""} — "${words
            .slice(t.a, t.b)
            .map((w) => w.text)
            .join(" ")}"`,
        ),
      );
      md.push("");
      const t = takes[chosen];
      keep.push({ a: t.a, b: t.b, sentence: k, display: alignScript(s, words.slice(t.a, t.b)) });
    });
  } else {
    const us = utterances(words);
    const ut = us.map(([a, b]) => toks.slice(a, b).flat());
    let k = 0;
    us.forEach(([a, b], i) => {
      const restarted = ut.slice(i + 1, i + 4).some((later) => {
        const n = Math.min(ut[i].length, later.length);
        return n >= 2 && similarity(ut[i].slice(0, n), later.slice(0, n)) >= 0.6;
      });
      const text = words.slice(a, b).map((w) => w.text).join(" ");
      md.push(`- ${restarted ? "✗ dropped (said again later)" : "✓"} ${fmtT(words[a].start)} "${text}"`);
      if (!restarted && ut[i].some((t) => !FILLER.test(t))) {
        sentences.push(text);
        keep.push({ a, b, sentence: k++ });
      }
    });
  }

  // turn kept word ranges into source segments, cutting pauses and fillers
  const segments: Segment[] = [];
  const outWords: Cuts["words"] = [];
  const padIn = 0.05;
  const padOut = 0.09;
  const display: Word[][] = [];
  for (const r of keep) {
    const ws = words.slice(r.a, r.b).filter((w) => !FILLER.test(w.text));
    display[r.sentence] = (r.display ?? ws).filter((w) => !FILLER.test(w.text));
    let seg: Segment | null = null;
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i];
      const prev = ws[i - 1];
      if (!seg || w.start - prev.end > opts.gap) {
        if (seg) segments.push(seg);
        const room = prev ? (w.start - prev.end) / 2 : padIn;
        seg = { in: Math.max(0, w.start - Math.min(padIn, room)), out: w.end, sentence: r.sentence };
      }
      const next = ws[i + 1];
      const room = next ? (next.start - w.end) / 2 : padOut;
      seg.out = Math.min(p.duration, w.end + Math.min(padOut, room));
    }
    if (seg) segments.push(seg);
  }

  // frame-align and lay out the output timeline
  const snap = (t: number) => Math.round(t * fps) / fps;
  let t = 0;
  const cuts: number[] = [];
  const sentenceSpan: Record<number, { start: number; end: number }> = {};
  for (const s of segments) {
    s.in = snap(s.in);
    s.out = Math.max(s.in + 1 / fps, snap(s.out));
    const off = t - s.in;
    for (const w of display[s.sentence] ?? []) {
      const mid = (w.start + w.end) / 2;
      if (mid >= s.in && mid < s.out) {
        outWords.push({ text: w.text, start: +(Math.max(w.start, s.in) + off).toFixed(3), end: +Math.min(w.end + off, t + s.out - s.in).toFixed(3), sentence: s.sentence });
      }
    }
    t += s.out - s.in;
    const span = (sentenceSpan[s.sentence] ??= { start: t - (s.out - s.in), end: t });
    span.end = t;
    cuts.push(+t.toFixed(3));
  }
  cuts.pop();

  const durationFrames = Math.round(t * fps);
  const result: Cuts = {
    slug,
    raw,
    fps,
    width: p.width,
    height: p.height,
    segments,
    words: outWords,
    sentences: sentences.map((text, k) => ({ text, start: +(sentenceSpan[k]?.start ?? 0).toFixed(3), end: +(sentenceSpan[k]?.end ?? 0).toFixed(3) })).filter((s) => s.end > s.start),
    cuts,
    durationSec: +t.toFixed(3),
    durationFrames,
  };
  fs.writeFileSync(path.join(d.pub, "cuts.json"), JSON.stringify(result, null, 1));

  const removed = p.duration - t;
  md.push(
    "",
    `**Result:** ${fmtT(p.duration)} raw → ${fmtT(t)} edited (${((removed / p.duration) * 100).toFixed(0)}% removed), ${segments.length} segments, ${cuts.length} cuts, ${Math.round((outWords.length / t) * 60)} words/min.`,
    "",
    "Override a take: `pnpm edit cut <slug> --raw <file> --script <file> --pick <sentence>:<take>` (e.g. `--pick 3:1`). Picks are saved in picks.json.",
  );
  fs.writeFileSync(path.join(d.work, "takes.md"), md.join("\n"));
  console.log(md.join("\n"));
  console.log(`\nWrote ${path.join(d.pub, "cuts.json")} and ${path.join(d.work, "takes.md")}`);
  return result;
}
