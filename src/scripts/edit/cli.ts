/**
 * Talking-head editing pipeline. See skill/editing.md for the full workflow.
 *
 *   pnpm edit ref <slug> <ref1> [ref2…] [--lang auto|pt|en|…]           01  analyse reference videos (files or URLs)
 *   pnpm edit cut <slug> --raw <file> [--script <txt>]        03a transcribe, pick takes, cut pauses
 *                 [--pick 3:1] [--gap 0.25] [--lang auto|pt|en|…]
 *   pnpm edit assemble <slug> [--lut auto|none|apple-log|slog3|flat|file.cube] [--exposure 1]
 *                                                             03b cut + LUT + voice to −14 LUFS
 *   pnpm edit head <slug>                                     head track for yap/split framing (assemble runs it)
 *   pnpm edit lut <file> [--profile apple-log|slog3|flat]     check one file for LOG / write a LUT
 *   pnpm edit kit                                             synthesise the SFX kit
 *   pnpm edit preview <slug>                                  03d half-res preview + stills for approval
 *   pnpm edit final <slug>                                    03e full render, mastered to −14 LUFS
 */
import path from "path";
import { arg, flag } from "./lib";
import { ref } from "./ref";
import { cut } from "./cut";
import { assemble } from "./assemble";
import { detectLog, writeCube, type LogProfile } from "./lut";
import { final, kit, preview } from "./render";
import { head } from "./head";

async function main() {
  const [cmd, slug, ...rest] = process.argv.slice(2);
  const positional = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1].startsWith("--")));
  const needSlug = () => {
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error("slug must be lower-case letters, digits and hyphens");
  };
  switch (cmd) {
    case "ref":
      needSlug();
      if (!positional.length) throw new Error("give at least one reference file or URL");
      return ref(slug, positional, arg("lang", "auto")!);
    case "cut":
      needSlug();
      return cut(slug, { raw: arg("raw") ?? (() => { throw new Error("--raw <file> is required"); })(), script: arg("script"), lang: arg("lang", "auto")!, picks: arg("pick"), gap: Number(arg("gap", "0.25")) });
    case "assemble":
      needSlug();
      return assemble(slug, { lut: arg("lut", "auto")!, exposure: Number(arg("exposure", "1")) });
    case "head":
      needSlug();
      head(slug);
      return;
    case "lut": {
      const file = path.resolve(slug);
      const det = detectLog(file);
      console.log(`${det.tagged ? "Tagged LOG" : det.likely ? "Looks flat, possibly LOG (untagged)" : "Looks like normal Rec.709"}: ${det.reason}`);
      const profile = (arg("profile") ?? det.profile) as LogProfile | undefined;
      if (profile) console.log(`Wrote ${writeCube(profile, file.replace(/\.[^.]+$/, `.${profile}-to-709.cube`), 33, Number(arg("exposure", "1")))}`);
      return;
    }
    case "kit":
      return kit();
    case "preview":
      needSlug();
      return preview(slug);
    case "final":
      needSlug();
      if (!flag("approved")) console.log("Note: run final only after the preview was approved.");
      return final(slug);
    default:
      console.log(require("fs").readFileSync(__filename, "utf8").split("*/")[0]);
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
