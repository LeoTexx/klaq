/**
 * docs-update.ts — the data step of `/video-maker update`.
 *
 * 1. Compares the installed `remotion` version with the latest on npm.
 * 2. Pulls the Remotion docs into a fresh folder (pull-docs.ts with DOCS_OUT), so a failed or partial pull
 *    never touches the current docs.
 * 3. Diffs the fresh pull against docs/remotion: added, removed and changed pages. A page that failed to
 *    download keeps its old copy and is not counted as removed.
 * 4. Lists which skill files mention a changed or removed page, so the skill review knows where to look.
 * 5. Writes docs/remotion-changes/<date>.md, then swaps: docs/remotion -> docs/.remotion-prev, fresh -> docs/remotion.
 *
 * Usage: pnpm docs-update            (pull, report, swap)
 *        pnpm docs-update --no-swap  (pull and report; leave docs/remotion as it is)
 *
 * Exit 0 on success, 1 when the pull failed or was too incomplete to trust (over 2% of pages failed).
 */
import { execFileSync, spawnSync } from "child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "fs";
import { dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";

const here = typeof import.meta.dirname === "string" ? import.meta.dirname : dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "../..");
const DOCS = join(ROOT, "docs/remotion");
const FRESH = join(ROOT, "docs/.remotion-new");
const PREV = join(ROOT, "docs/.remotion-prev");
const REPORTS = join(ROOT, "docs/remotion-changes");
const SKILL = join(ROOT, "skill");
const swap = !process.argv.includes("--no-swap");
const MAX_DIFF_LINES = 60; // per changed page in the report
const MAX_DIFF_PAGES = 80; // pages whose diff is inlined; the rest are listed only

function listMd(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(dir)) return out;
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith(".md")) out.set(relative(dir, p), readFileSync(p, "utf-8"));
    }
  };
  walk(dir);
  return out;
}

function urlToRel(url: string): string {
  const p = url.replace("https://www.remotion.dev/docs/", "").replace(/\/$/, "");
  return `${p || "index"}.md`;
}

// 1. Versions
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
const installed: string = pkg.dependencies?.remotion ?? pkg.devDependencies?.remotion ?? "?";
let latest = "?";
try {
  latest = execFileSync("npm", ["view", "remotion", "version"], { encoding: "utf-8" }).trim();
} catch {
  console.error("Could not reach npm for the latest version; continuing with the docs.");
}
const remotionPkgs = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter(
  (n) => n === "remotion" || n.startsWith("@remotion/")
);

// 2. Pull into a fresh folder
rmSync(FRESH, { recursive: true, force: true });
console.log(`Pulling docs into ${relative(ROOT, FRESH)} …`);
const pull = spawnSync("pnpm", ["tsx", "src/scripts/pull-docs.ts"], {
  cwd: ROOT,
  env: { ...process.env, DOCS_OUT: FRESH },
  stdio: "inherit",
});
const metaPath = join(FRESH, ".pull.json");
if (pull.status !== 0 || !existsSync(metaPath)) {
  console.error("The pull failed; docs/remotion is unchanged.");
  process.exit(1);
}
const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as { ok: number; fail: number; failedUrls: string[] };
if (meta.fail > Math.max(5, meta.ok * 0.02)) {
  console.error(`${meta.fail} pages failed (over 2%); not trusting this pull. docs/remotion is unchanged; fresh copy left in ${relative(ROOT, FRESH)}.`);
  process.exit(1);
}

// 3. Diff. Failed pages keep their old copy.
const before = listMd(DOCS);
const failed = new Set(meta.failedUrls.map(urlToRel));
for (const rel of failed) {
  if (before.has(rel)) {
    mkdirSync(dirname(join(FRESH, rel)), { recursive: true });
    cpSync(join(DOCS, rel), join(FRESH, rel));
  }
}
const after = listMd(FRESH);
const added = [...after.keys()].filter((k) => !before.has(k)).sort();
const removed = [...before.keys()].filter((k) => !after.has(k)).sort();
const changed = [...after.keys()].filter((k) => before.has(k) && before.get(k) !== after.get(k)).sort();

// 4. Skill files that cite a changed or removed page (by its path stem, e.g. "motion-blur/trail")
const skillFiles = existsSync(SKILL) ? readdirSync(SKILL).filter((f) => f.endsWith(".md")) : [];
const skillText = new Map(skillFiles.map((f) => [f, readFileSync(join(SKILL, f), "utf-8")]));
const citedBy = (rel: string) => {
  const stem = rel.replace(/\.md$/, "");
  return skillFiles.filter((f) => skillText.get(f)!.includes(stem) || skillText.get(f)!.includes(rel));
};
const touched = [...changed, ...removed].map((rel) => [rel, citedBy(rel)] as const).filter(([, f]) => f.length);

function diffOf(rel: string): string {
  const r = spawnSync("diff", ["-u", join(DOCS, rel), join(FRESH, rel)], { encoding: "utf-8" });
  const lines = (r.stdout || "").split("\n").slice(2); // drop the file headers
  const cut = lines.length > MAX_DIFF_LINES;
  return lines.slice(0, MAX_DIFF_LINES).join("\n") + (cut ? `\n… ${lines.length - MAX_DIFF_LINES} more lines` : "");
}

// 5. Report
const date = new Date().toISOString().slice(0, 10);
mkdirSync(REPORTS, { recursive: true });
const reportPath = join(REPORTS, `${date}.md`);
const r: string[] = [];
r.push(`# Remotion docs update, ${date}`, "");
r.push(`| | |`, `|---|---|`);
r.push(`| Installed \`remotion\` | ${installed} |`);
r.push(`| Latest on npm | ${latest}${latest !== "?" && latest !== installed ? " (**bump available**)" : ""} |`);
r.push(`| Remotion packages in package.json | ${remotionPkgs.length} (${remotionPkgs.join(", ")}) |`);
r.push(`| Pages pulled | ${meta.ok} (${meta.fail} failed, kept old copy) |`);
r.push(`| Added / removed / changed | ${added.length} / ${removed.length} / ${changed.length} |`, "");
r.push(`## Skill files citing a changed or removed page`, "");
r.push(touched.length ? touched.map(([rel, f]) => `- \`${rel}\` → ${f.join(", ")}`).join("\n") : "None.", "");
r.push(`## Added pages`, "", added.length ? added.map((a) => `- \`${a}\``).join("\n") : "None.", "");
r.push(`## Removed pages`, "", removed.length ? removed.map((a) => `- \`${a}\``).join("\n") : "None.", "");
r.push(`## Changed pages`, "");
if (!changed.length) r.push("None.");
changed.forEach((c, i) => {
  if (i < MAX_DIFF_PAGES) r.push(`### \`${c}\``, "", "```diff", diffOf(c), "```", "");
  else r.push(`- \`${c}\``);
});
if (meta.fail) r.push("", `## Pages that failed to download`, "", meta.failedUrls.map((u) => `- ${u}`).join("\n"));
writeFileSync(reportPath, r.join("\n") + "\n");

if (swap) {
  rmSync(PREV, { recursive: true, force: true });
  if (existsSync(DOCS)) renameSync(DOCS, PREV);
  renameSync(FRESH, DOCS);
}

console.log(`\nInstalled remotion ${installed}, latest ${latest}.`);
console.log(`Added ${added.length}, removed ${removed.length}, changed ${changed.length}; ${touched.length} cited by skill files.`);
console.log(`Report: ${relative(ROOT, reportPath)}`);
console.log(swap ? `docs/remotion replaced; previous copy in docs/.remotion-prev` : `--no-swap: fresh copy left in ${relative(ROOT, FRESH)}`);
