/**
 * The contract between the Klaq engine and your projects.
 *
 * A project is a folder in `projects/<name>/` (gitignored) whose `index.tsx` exports
 *   export const compositions: KlaqComposition[] = [...]
 * `pnpm registry` (run automatically before studio, render, stills and edit) finds every project and
 * writes `src/projects.generated.ts`, which Root.tsx renders. You never edit Root.tsx for a project.
 */
import type React from "react";
import type { CalculateMetadataFunction } from "remotion";

export type KlaqComposition = {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.ComponentType<any>;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  defaultProps?: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  calculateMetadata?: CalculateMetadataFunction<any>;
};

export type KlaqProject = { name: string; compositions: KlaqComposition[] };
