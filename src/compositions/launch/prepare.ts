/**
 * Prepare the launch film's local assets (gitignored, in public/examples/launch/):
 *   pnpm tsx src/compositions/launch/prepare.ts
 * 1. talk.mp4: a talking-to-camera clip from Pexels (Pexels licence, video 8814493), trimmed to 6 s.
 *    Downloaded on your machine rather than shipped in the repo.
 * 2. qa/*.png: showreel stills for the contact-sheet act.
 * 3. score.wav: the synthesized score (score.ts).
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "public", "examples", "launch");
fs.mkdirSync(OUT, { recursive: true });
const sh = (cmd: string, args: string[]) => execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit" });

async function clip() {
  const dst = path.join(OUT, "talk.mp4");
  if (fs.existsSync(dst)) return console.log("talk.mp4: present");
  const raw = path.join(ROOT, "work", "launch", "pexels-8814493.mp4");
  fs.mkdirSync(path.dirname(raw), { recursive: true });
  if (!fs.existsSync(raw)) {
    console.log("Downloading Pexels video 8814493…");
    const res = await fetch("https://www.pexels.com/download/video/8814493/", { headers: { "user-agent": "Mozilla/5.0 (klaq launch example)" }, redirect: "follow" });
    if (!res.ok) throw new Error(`Pexels download failed (${res.status}). Download https://www.pexels.com/video/8814493/ by hand to ${raw}`);
    fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  }
  sh("ffmpeg", ["-loglevel", "error", "-y", "-ss", "0.5", "-i", raw, "-t", "6", "-an", "-vf", "fps=60,scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", dst]);
}

async function main() {
  await clip();
  if (!fs.existsSync(path.join(OUT, "qa", "Showreel-0890.png"))) {
    sh("pnpm", ["-s", "stills", "--id", "Showreel", "--frames", "30,180,330,480,560,640,720,800,890", "--out", path.join(OUT, "qa"), "--scale", "0.3"]);
  }
  sh("pnpm", ["exec", "tsx", "src/compositions/launch/score.ts"]);
  console.log(`Launch assets ready in ${path.relative(ROOT, OUT)}/`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
