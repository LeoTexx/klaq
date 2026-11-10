/**
 * Render a single composition to MP4.
 *
 * Usage:
 *   pnpm render -- --id Demo
 *   pnpm render -- --id Demo --props '{"title":"Hello"}'
 *   pnpm render -- --id Demo --output ./out/custom-name.mp4
 *   pnpm render -- --id Demo --quality 18
 */

import path from "path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { withAtAlias } from "./lib/bundle-alias";

const PROJECT_ROOT = path.resolve(__dirname, "../..");

function parseArgs() {
  const args = process.argv.slice(2);
  let id = "Demo";
  let output: string | undefined;
  let props: Record<string, unknown> = {};
  let quality = 18;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--id":
        id = args[++i];
        break;
      case "--output":
        output = args[++i];
        break;
      case "--props":
        props = JSON.parse(args[++i]);
        break;
      case "--quality":
        quality = parseInt(args[++i], 10);
        break;
    }
  }

  return {
    id,
    output: output ?? path.join(PROJECT_ROOT, "out", `${id}.mp4`),
    props,
    quality,
  };
}

async function main() {
  const { id, output, props, quality } = parseArgs();

  console.log(`\n🎬 Rendering: ${id}`);
  console.log(`   Output: ${output}`);
  console.log(`   Quality (CRF): ${quality}\n`);

  // Bundle
  const bundleLocation = await bundle({
    entryPoint: path.join(PROJECT_ROOT, "src/index.ts"),
    webpackOverride: withAtAlias,
    onProgress: (progress) => {
      if (Math.round(progress * 100) % 25 === 0) {
        process.stdout.write(`\r   Bundling: ${(progress * 100).toFixed(0)}%`);
      }
    },
  });
  console.log("\n   Bundling: done");

  // Select composition
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id,
    inputProps: props,
  });

  console.log(
    `   Composition: ${composition.width}x${composition.height} @ ${composition.fps}fps, ${composition.durationInFrames} frames`
  );

  // Render
  await renderMedia({
    serveUrl: bundleLocation,
    codec: "h264",
    composition,
    outputLocation: output,
    inputProps: props,
    crf: quality,
    imageFormat: "jpeg",
    jpegQuality: 90,
    onProgress: ({ progress }) => {
      process.stdout.write(`\r   Rendering: ${(progress * 100).toFixed(0)}%`);
    },
  });

  console.log(`\n\n✅ Done: ${output}\n`);
}

main().catch((err) => {
  console.error("Render failed:", err);
  process.exit(1);
});
