/**
 * Klaq root: the two shipped examples, then every project found in projects/ (see src/klaq.ts).
 * Don't add your own films here; put them in projects/<name>/ and they appear automatically.
 */
import React from "react";
import { Composition, Folder } from "remotion";
import { Demo, demoSchema } from "./compositions/demo";
import { Showreel, SHOWREEL_DURATION, SHOWREEL_FPS } from "./compositions/showreel";
import { Launch, LAUNCH_DURATION, LAUNCH_FPS } from "./compositions/launch";
import { PROJECTS } from "./projects.generated";

const folderName = (s: string) => s.replace(/[^a-zA-Z0-9-]/g, "-");

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="Examples">
      <Composition
        id="Demo"
        component={Demo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        schema={demoSchema}
        defaultProps={{ title: "Klaq", subtitle: "Videos from code, made by Claude", backgroundColor: "#0f0f23", accentColor: "#6366f1" }}
      />
      <Composition id="Showreel" component={Showreel} durationInFrames={SHOWREEL_DURATION} fps={SHOWREEL_FPS} width={1920} height={1080} />
      {/* needs `pnpm tsx src/compositions/launch/prepare.ts` once */}
      <Composition id="Launch" component={Launch} durationInFrames={LAUNCH_DURATION} fps={LAUNCH_FPS} width={1920} height={1080} />
    </Folder>
    {PROJECTS.map((p) => (
      <Folder key={p.name} name={folderName(p.name)}>
        {p.compositions.map((c) => (
          <Composition key={c.id} {...c} />
        ))}
      </Folder>
    ))}
  </>
);
