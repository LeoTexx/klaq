/**
 * ElevenLabs voice-over clips for a project.
 *
 * Setup: copy `.env.example` to `.env` and set ELEVENLABS_API_KEY.
 * Write projects/<name>/vo.json:
 *   { "timestamps": true, "lines": [ { "id": "hook", "file": "hook.mp3", "text": "…" }, … ] }
 *
 *   pnpm tts --list-voices                 print available voices (name + id)
 *   pnpm tts --project <name>              generate every clip → public/projects/<name>/vo/
 *   pnpm tts --project <name> --only hook  regenerate one clip
 *   pnpm tts --project <name> --voice <id> override the voice for this run
 * With "timestamps": true each clip also gets <clip>.json (character timings for captions).
 * Requires Node 18+ (global fetch). No external deps.
 */
import fs from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const API = "https://api.elevenlabs.io/v1";

/** Minimal .env loader (no dotenv dep). */
function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

interface Manifest {
  lines: { id: string; file: string; text: string }[];
  outDir: string;
  /** also write <file>.json with ElevenLabs character timings (for burned-in captions) */
  timestamps?: boolean;
}

function loadManifest(project: string): Manifest {
  const file = path.join(PROJECT_ROOT, "projects", project, "vo.json");
  if (!fs.existsSync(file)) throw new Error(`No ${path.relative(PROJECT_ROOT, file)}. See the header of src/scripts/tts.ts for the format.`);
  const m = JSON.parse(fs.readFileSync(file, "utf8")) as { lines: Manifest["lines"]; timestamps?: boolean };
  return { lines: m.lines, timestamps: m.timestamps, outDir: path.join("public", "projects", project, "vo") };
}

function parseArgs() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const out: { listVoices: boolean; project?: string; voice?: string; only?: string } = {
    listVoices: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--list-voices") out.listVoices = true;
    else if (args[i] === "--project") out.project = args[++i];
    else if (args[i] === "--voice") out.voice = args[++i];
    else if (args[i] === "--only") out.only = args[++i]; // regenerate a single scene id
  }
  return out;
}

async function listVoices(apiKey: string) {
  const res = await fetch(`${API}/voices`, { headers: { "xi-api-key": apiKey } });
  if (!res.ok) throw new Error(`list voices failed: ${res.status} ${await res.text()}`);
  const { voices } = (await res.json()) as {
    voices: { voice_id: string; name: string; labels?: Record<string, string> }[];
  };
  console.log(`\n${voices.length} voices:\n`);
  for (const v of voices) {
    const labels = v.labels ? Object.values(v.labels).join(", ") : "";
    console.log(`  ${v.name.padEnd(22)} ${v.voice_id}   ${labels}`);
  }
  console.log("\nPick one → set ELEVENLABS_VOICE_ID in .env (or pass --voice <id>).\n");
}

type Alignment = { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] };

async function synth(apiKey: string, voiceId: string, modelId: string, text: string, timestamps = false): Promise<{ audio: Buffer; alignment?: Alignment }> {
  const res = await fetch(`${API}/text-to-speech/${voiceId}${timestamps ? "/with-timestamps" : ""}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: modelId,
      // Expressive read: low stability + high style; speed slightly above 1 keeps it lively.
      voice_settings: {
        stability: 0.3,
        similarity_boost: 0.8,
        style: 0.55,
        use_speaker_boost: true,
        speed: 1.08,
      },
    }),
  });
  if (!res.ok) throw new Error(`TTS failed (${res.status}): ${await res.text()}`);
  if (!timestamps) return { audio: Buffer.from(await res.arrayBuffer()) };
  const json = (await res.json()) as { audio_base64: string; alignment: Alignment };
  return { audio: Buffer.from(json.audio_base64, "base64"), alignment: json.alignment };
}

async function main() {
  loadEnv();
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("❌ ELEVENLABS_API_KEY not set. Copy .env.example → .env and add your key.");
    process.exit(1);
  }
  const { listVoices: doList, project, voice, only } = parseArgs();

  if (doList) return listVoices(apiKey);

  if (!project) {
    console.error("❌ Pass --project <name> (reads projects/<name>/vo.json).");
    process.exit(1);
  }
  const manifest = loadManifest(project);

  // Sarah — warm, natural female; a safe multilingual default until you pick one.
  const voiceId = voice || process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
  const { lines: allLines, outDir } = manifest;
  const lines = only ? allLines.filter((l) => l.id === only) : allLines;
  if (only && lines.length === 0) {
    console.error(`❌ --only "${only}" matched no scene. Ids: ${allLines.map((l) => l.id).join(", ")}`);
    process.exit(1);
  }
  const absOut = path.join(PROJECT_ROOT, outDir);
  fs.mkdirSync(absOut, { recursive: true });

  console.log(`\n🎙️  ${project} · voice ${voiceId} · model ${modelId} → ${outDir}\n`);
  for (const line of lines) {
    process.stdout.write(`   ${line.file} … `);
    const { audio, alignment } = await synth(apiKey, voiceId, modelId, line.text, manifest.timestamps);
    fs.writeFileSync(path.join(absOut, line.file), audio);
    if (alignment) fs.writeFileSync(path.join(absOut, line.file.replace(/\.mp3$/, ".json")), JSON.stringify(alignment));
    console.log(`ok (${(audio.length / 1024).toFixed(0)} KB${alignment ? " + timings" : ""})`);
  }
  console.log(`\n✅ Done. ${lines.length} clips in ${outDir}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
