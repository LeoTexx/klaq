/**
 * Scaffold a project:  pnpm new <name> [--portrait|--landscape|--square] [--fps 30]
 * Creates projects/<name>/{index.tsx,timeline.ts} and public/projects/<name>/, then refreshes the registry.
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = path.resolve(__dirname, "../..");
const args = process.argv.slice(2).filter((a) => a !== "--");
const name = args.find((a) => !a.startsWith("--"));
if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
  console.error("usage: pnpm new <name>   (lower-case letters, digits, hyphens)");
  process.exit(1);
}
const size = args.includes("--landscape") ? [1920, 1080] : args.includes("--square") ? [1080, 1080] : [1080, 1920];
const fpsArg = args.indexOf("--fps");
const fps = fpsArg >= 0 ? Number(args[fpsArg + 1]) : 30;
const dir = path.join(ROOT, "projects", name);
if (fs.existsSync(dir)) {
  console.error(`projects/${name} already exists`);
  process.exit(1);
}
const Comp = name.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(path.join(ROOT, "public", "projects", name), { recursive: true });
fs.writeFileSync(
  path.join(dir, "timeline.ts"),
  `/** ${name}: timing source of truth (seconds). Picture and score both import this file. */
export const FPS = ${fps};
export const DURATION_SEC = 10;
export const DURATION = Math.round(DURATION_SEC * FPS);

export const T = {
  title: 0.4,
  end: DURATION_SEC,
};
`,
);
fs.writeFileSync(
  path.join(dir, "index.tsx"),
  `import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { KlaqComposition } from "../../src/klaq";
import { clamp, sp } from "../../src/lib/motion";
import { DURATION, FPS, T } from "./timeline";

const ${Comp}: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = clamp(sp(f, T.title * fps, undefined, fps));
  return (
    <AbsoluteFill style={{ background: "#14120F", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#F4EFE5", fontFamily: "sans-serif", fontWeight: 800, fontSize: 120, opacity: k, transform: \`translateY(\${(1 - k) * 40}px)\` }}>${name}</div>
    </AbsoluteFill>
  );
};

export const compositions: KlaqComposition[] = [
  { id: "${Comp}", component: ${Comp}, durationInFrames: DURATION, fps: FPS, width: ${size[0]}, height: ${size[1]} },
];
`,
);
execSync("pnpm -s registry", { cwd: ROOT, stdio: "inherit" });
console.log(`Created projects/${name}/ (composition ${Comp}). Assets go in public/projects/${name}/.`);
