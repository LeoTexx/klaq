// Resolves the "@/" import alias (tsconfig `paths`) when our scripts call bundle() directly.
// remotion.config.ts does the same for the Remotion CLI and Studio, but bundle() never reads that file,
// and remocn components import each other through "@/" (see skill/remocn.md).
import path from "path";
import type { WebpackOverrideFn } from "@remotion/bundler";

const SRC = path.resolve(__dirname, "../../");

export const withAtAlias: WebpackOverrideFn = (config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...((config.resolve?.alias as Record<string, string> | undefined) ?? {}),
      "@": SRC,
    },
  },
});
