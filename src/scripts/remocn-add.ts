/**
 * remocn-add.ts — install remocn components safely (see skill/remocn.md).
 *
 *   pnpm remocn <name> [<name> …]          install, re-pin Remotion, report
 *   pnpm remocn <name> --dry-run            show the files and dependencies it would add
 *
 * Why a wrapper: `shadcn add` runs a bare `pnpm add remotion`, which moves `remotion` to npm's latest while the
 * @remotion/* packages stay put, and Remotion requires every remotion and @remotion/* version to match exactly.
 * This script pins the shadcn CLI, puts every remotion/@remotion/* package back on the version installed before,
 * lists each new dependency so a person can review it, and typechecks.
 */
import { execFileSync, spawnSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";

const SHADCN = "shadcn@4.23.0"; // bump deliberately; read its changelog first
const ROOT = path.resolve(__dirname, "../..");
const BANNED: Record<string, string[]> = { axios: ["1.14.1", "0.30.4"] }; // known-malicious releases

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const names = args.filter((a) => !a.startsWith("-"));
if (!names.length) {
  console.error("usage: pnpm remocn <component> [<component> …] [--dry-run]   (names from https://remocn.dev/llms-components.txt)");
  process.exit(1);
}
const items = names.map((n) => (n.startsWith("@remocn/") ? n : `@remocn/${n}`));

type Pkg = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
const readPkg = (): Pkg => JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf-8"));
const allDeps = (p: Pkg) => ({ ...p.dependencies, ...p.devDependencies });
const isRemotion = (n: string) => n === "remotion" || n.startsWith("@remotion/");

const before = readPkg();
const pinned = before.dependencies?.remotion;
if (!pinned || !/^\d+\.\d+\.\d+$/.test(pinned)) {
  console.error(`package.json must pin remotion to an exact version (found ${pinned ?? "none"}).`);
  process.exit(1);
}

const run = spawnSync("npx", ["-y", SHADCN, "add", ...items, ...(dry ? ["--dry-run"] : ["--yes"])], {
  cwd: ROOT,
  stdio: "inherit",
});
if (run.status !== 0) process.exit(run.status ?? 1);
if (dry) process.exit(0);

// Re-pin every remotion / @remotion/* package that moved off the pinned version.
const after = readPkg();
const moved = Object.entries(allDeps(after)).filter(([n, v]) => isRemotion(n) && v !== pinned);
if (moved.length) {
  const isDev = (n: string) => Boolean(after.devDependencies?.[n]);
  const prod = moved.filter(([n]) => !isDev(n)).map(([n]) => `${n}@${pinned}`);
  const dev = moved.filter(([n]) => isDev(n)).map(([n]) => `${n}@${pinned}`);
  console.log(`\nRe-pinning to ${pinned}: ${moved.map(([n, v]) => `${n} (${v})`).join(", ")}`);
  if (prod.length) execFileSync("pnpm", ["add", "--save-exact", ...prod], { cwd: ROOT, stdio: "inherit" });
  if (dev.length) execFileSync("pnpm", ["add", "-D", "--save-exact", ...dev], { cwd: ROOT, stdio: "inherit" });
}

// Report new dependencies, and stop on a known-bad release.
const final = allDeps(readPkg());
const old = allDeps(before);
const added = Object.entries(final).filter(([n]) => !(n in old));
let bad = false;
for (const [n, v] of added) {
  const installed = (() => {
    try {
      return JSON.parse(readFileSync(path.join(ROOT, "node_modules", n, "package.json"), "utf-8")).version as string;
    } catch {
      return "?";
    }
  })();
  const flag = BANNED[n]?.includes(installed) ? "  <-- BANNED RELEASE, remove it" : "";
  if (flag) bad = true;
  console.log(`new dependency: ${n} ${v} (installed ${installed})${flag}`);
}
if (!added.length) console.log("No new dependencies.");

const tsc = spawnSync("npx", ["tsc", "--noEmit"], { cwd: ROOT, stdio: "inherit" });
console.log(tsc.status === 0 ? "Typecheck passed." : "Typecheck FAILED: fix before using the component.");
process.exit(bad || tsc.status !== 0 ? 1 : 0);
