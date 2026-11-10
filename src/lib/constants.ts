/** Standard video dimensions */
export const DIMENSIONS = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
} as const;

/** Default FPS */
export const DEFAULT_FPS = 30;

/** Output directory (relative to project root) */
export const OUTPUT_DIR = "./out";

