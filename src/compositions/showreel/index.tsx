import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { C } from "./theme";
import { BALL, DIM, DURATION, FLUID, IDENT, MONTAGE, TYPE } from "./timeline";
import { CameraRig, Grain } from "./Fx";
import { Hud } from "./Hud";
import { Principles } from "./scenes/Principles";
import { KineticType } from "./scenes/KineticType";
import { Matter } from "./scenes/Matter";
import { Range } from "./scenes/Range";
import { Identity } from "./scenes/Identity";

export { DURATION as SHOWREEL_DURATION, FPS as SHOWREEL_FPS } from "./timeline";

/**
 * Klaq — Motion Reel ’26. 15 s · 1920×1080 · 60 fps · 120 BPM.
 * One continuous idea: a single orange dot becomes every technique on the reel.
 * Score is synthesized from the same timeline: `pnpm tsx src/scripts/showreel-score.ts`.
 */
export const Showreel: React.FC<{ muted?: boolean }> = ({ muted }) => {
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <CameraRig>
        <Sequence from={0} durationInFrames={BALL.cut} name="01 Principles">
          <Principles />
        </Sequence>
        <Sequence from={TYPE.timing} durationInFrames={TYPE.end - TYPE.timing} name="02 Kinetic Type">
          <KineticType />
        </Sequence>
        <Sequence from={FLUID.start - 14} durationInFrames={DIM.cut - FLUID.start + 14} name="03–05 Matter">
          <Matter />
        </Sequence>
        <Sequence from={MONTAGE.start} durationInFrames={MONTAGE.end - MONTAGE.start} name="06 Range">
          <Range />
        </Sequence>
        <Sequence from={IDENT.collapse} durationInFrames={DURATION - IDENT.collapse} name="07 Identity">
          <Identity />
        </Sequence>
      </CameraRig>
      <Grain opacity={0.11} />
      <Hud />
      {!muted && <Audio src={staticFile("audio/showreel/score.wav")} />}
    </AbsoluteFill>
  );
};
