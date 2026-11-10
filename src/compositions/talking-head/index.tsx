/**
 * TalkingHead edit engine. A project's edit plan becomes a composition with:
 *
 *   import { editComposition } from "../../src/compositions/talking-head";
 *   export const compositions = [editComposition(plan)];   // registers "Edit-<slug>"
 */
import React from "react";
import type { KlaqComposition } from "../../klaq";
import { TalkingHead } from "./TalkingHead";
import type { EditPlan } from "./types";

export { TalkingHead, sentence } from "./TalkingHead";
export type { Cuts, EditPlan, Graphic, GraphicProps, HeadTrack, Mode, Screen, Theme } from "./types";

export function editComposition(plan: EditPlan, opts: { width?: number; height?: number } = {}): KlaqComposition {
  const Edit: React.FC<{ qa?: boolean }> = ({ qa }) => <TalkingHead plan={qa ? { ...plan, qa } : plan} />;
  return {
    id: `Edit-${plan.slug}`,
    component: Edit,
    durationInFrames: plan.cuts.durationFrames,
    fps: plan.cuts.fps,
    width: opts.width ?? 1080,
    height: opts.height ?? 1920,
    defaultProps: { qa: false },
  };
}
