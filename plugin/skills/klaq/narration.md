# Narration: Writing, Generating and Checking the Voice

How to get a TTS voice-over that sounds like one person talking, and how to check it before any picture is keyed to it. Read this before running `pnpm tts` on a new script. Timing the picture to the voice is in `social-vertical.md` §3; captions are in `captions.md`.

---

## 1. What `pnpm tts` does

`src/scripts/tts.ts` calls ElevenLabs with `ELEVENLABS_API_KEY` from the workspace `.env`. Write the lines in `projects/<name>/vo.json` as `{ "timestamps": true, "lines": [{ "id": "hook", "file": "hook.mp3", "text": "…" }] }`, then `pnpm tts --project <name>` writes one clip per line to `public/projects/<name>/vo/` (with `<clip>.json` character timings when `timestamps` is true). `--only <id>` regenerates one clip, `--voice <id>` overrides the voice, and `pnpm tts --list-voices` is free.

| Item | Behaviour |
|---|---|
| Unit of generation | One ElevenLabs request **per line** of the voice-over list, one mp3 per line |
| Model | `ELEVENLABS_MODEL_ID` or `eleven_multilingual_v2` |
| Voice settings | stability 0.3, similarity 0.8, style 0.55, speaker boost, speed 1.08 |
| Seed | none (each call can vary) |
| Timings | with timestamps on, it calls `/with-timestamps` and writes `<clip>.json` (character alignment) next to each mp3 |
| Cache / budget | none: every run regenerates every line (`--only <id>` regenerates one) |

In the film, lay the clips end to end with a short breath before each (a small `layClips()` helper in the project's timeline: clip start frames from the measured durations plus a `gapBefore`).

Per-line generation works, with known weak points: energy and pitch shift at every join between separately generated lines, a speed above 1 makes the read sound hurried, and every re-run spends credits again on lines that did not change.

## 2. Better: one continuous take (not built into `tts.ts`)

**Status: recommended method, not implemented.** Keep per-line as the default unless the user wants this; doing it today means calling the API by hand or extending `tts.ts`.

| Rule | Detail |
|---|---|
| Send the whole script in one request | All parts in one call, with paragraph breaks between acts. A single performance keeps the intonation flowing from sentence to sentence. eleven_v3 takes roughly 5,000 characters per request. |
| Model and settings | `eleven_v3`, stability 0.3, similarity 0.8, a **fixed seed**, no speed override. v3 does not accept `previous_text`, so per-line continuity hints are not a substitute. |
| Cut it up afterwards | Split the single alignment into cues by paragraph or by word index, and key beats to word indexes in the take. |
| Leave the take alone | Do not re-space pauses, splice in a line from another take or speed it up with `atempo`; each of these makes the speech sound broken. Trim only the start and end. |
| A script change means a new take | Even a single word. Plan the budget for it. |
| Budget credits | Roughly 1 credit per character (an 80 s script is around 1,300 credits). Set a ceiling per run and stop before passing it. Try the hook line alone first (about 150 credits). |
| Cache by hash | Hash voice + model + settings + seed + text; never regenerate an unchanged chunk. Log the credits per request. |
| Audio tags | v3 tags (`[curious]`, `[whispers]`) at only 3-5 turning points, removed from the word timings. |
| Lead-in | About 0.2 s of silence before the first word so it never sits on frame 0. The hook rule (voice by frame 4, `social-vertical.md` §2) allows for it. |

Licensing: eleven_v3 and commercial use need a **paid** ElevenLabs plan; on free plans the API refuses library voices and there is no commercial licence. Check the plan before spending credits (a refused request is not billed). Never use a library voice that imitates a real person without their permission.

Avoid free TTS endpoints with no clear commercial terms for paid or client work.

Building it would mean: a `--one-take` mode in `tts.ts` that sends the joined script, writes one mp3 plus one alignment, and caches by hash with a `--budget` stop; and a helper next to `layClips()` that turns one alignment into per-cue clips so word lookups and captions keep working.

## 3. Writing for TTS

Narration that sounds robotic is usually a script problem rather than a voice problem.

- **Start from a two-column script: voice | picture.** Each sentence sits beside what is on screen while it is spoken, and the image always matches the words being heard. Generate the voice from it, then key the beat sheet to the word times. If a shot needs more time, put a pause between two sentences of the script; never time-stretch the audio.
- **No ellipsis or mid-sentence comma used as a pause.** One sentence is one breath; pauses go between sentences.
- **No spoken list of three nouns.** Voices stumble on them and may insert a filler word. Name one specific thing aloud and leave the others to the visuals.
- **Spell acronyms, loanwords and brand names the way they should sound**, and keep a table from the spoken spelling to the on-screen spelling (`SPOKEN → caption`) so captions never show the phonetic form. Try those words in a brief test generation before the full read.
- **The first narrated line does not repeat the hook.** If the on-screen or on-camera hook asks the question, the voice starts with the next idea.
- Conversational sentences, the odd question, a short sentence after a long one. Capitals for emphasis on one word at most.
- Spell numbers out where the engine misreads digits; never split a spoken number across captions.

## 4. Check the take before building picture

Run these on every new take, per-line or one-take. The checks are manual; an automated diff is planned.

1. **Transcript diff.** Transcribe the take with the local `whisper` CLI (the one `src/scripts/edit/lib.ts` calls) and compare it word by word with the script. A misread word or a misplaced pause can change a sentence's meaning, and the transcript is often the only thing that catches it. A single wrong word means generating again (for one-take, the entire script).
2. **The first 1.5 s on its own.** Transcribe just the opening and look at the energy in 100 ms windows. Cloned voices sometimes add a syllable before the first word, and the alignment may even label it as a word. To fix it without breaking the take: trim the start up to the first real word with a 15 ms fade, keep that word index as a hidden placeholder so every later index stays valid, and shorten the duration.
3. **Pauses inside sentences.** Scan the word timings for gaps over 0.35 s within a sentence; they sound like the voice losing its place.
4. **Pronunciation of mapped words.** You cannot listen, so check that the transcript renders each mapped word as intended, and flag the rest for the user to hear.
5. **Report**: credits spent, take length, and the lines the user must listen to.

## 5. Picking a voice

- Listing voices and their preview clips is free (`pnpm tts --list-voices`). Let the user pick by ear from previews; prefer native speakers of the video's language.
- Compare 2-4 settings on a single short line before generating the full read.
- One brand keeps one voice across a campaign; record the voice id and settings in the project.
