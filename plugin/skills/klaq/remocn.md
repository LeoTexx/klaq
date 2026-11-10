# remocn: ready-made Remotion components

[remocn](https://remocn.dev) is a shadcn registry of about 940 Remotion components (MIT): typography, numbers and
charts, product scenes (whole app screens), UI blocks, media collages, logo stings, transitions, captions,
shaders. A component is **copied into the workspace as source** (`src/components/remocn/`, shared helpers in
`src/lib/remocn-ui/`), so you can read and adapt it. Nothing is a runtime dependency on remocn.

- **The catalogue is live, never vendored:** start every search at `https://remocn.dev/llms-components.txt`
  (one table per section with `Use for` / `Avoid for`, length, dependencies), then fetch the shortlisted pages
  (`https://remocn.dev/docs/<section>/<name>.md`). Never invent props or lengths from memory.

## When to reach for it

A component earns its place when it is a **known pattern we would otherwise hand-build**: a counter or chart
reveal, a product UI mock (prompt box, cursor, dialog, checkout), a device frame, a caption style, a standard
transition. It does not replace the film's own idea: the protagonist, the match cuts and the brand's signature
device stay hand-built (`motion-craft.md` §1). The film's taste rules apply to every component: clarity over
pace, few colour flips, colour with a job, strong type. Restyle a component to the film's `tokens.ts` before
using it; its default look is a starting point, not the brand.

## Installing (always through the wrapper)

```bash
pnpm remocn <name> --dry-run     # files and dependencies it would add
pnpm remocn <name> [<name> …]    # install
```

`src/scripts/remocn-add.ts` runs a pinned shadcn CLI (`shadcn@4.23.0`), then puts every `remotion` /
`@remotion/*` package back on the installed version (shadcn runs a bare `pnpm add remotion`, which would break
Remotion's exact-version rule), lists every new dependency, refuses known-malicious releases, and typechecks.
Never call `npx shadcn add` directly. Review each new dependency before keeping it (most components need only
`remotion` and `@remotion/google-fonts`; 19 shader components pull `@paper-design/shaders-react`).

Workspace wiring (already in place): `components.json` (registry `@remocn`), `remotion.config.ts` (the `@/`
alias for the CLI and Studio), and `src/scripts/lib/bundle-alias.ts` (the same alias for `bundle()` in
`stills.ts` and `render.ts`). A new script that calls `bundle()` must pass `webpackOverride: withAtAlias`.

## Using a component

1. Read its docs page: props, `Length`, `Avoid for`. If `Avoid for` matches the use, take the replacement it names.
2. Place it in a `<Sequence durationInFrames>` of at least its `Length` plus the hold rule
   (`motion-craft.md`: words/3 + 1 s); transitions go in `TransitionSeries.Transition` at their `Length`.
3. Time it from `timeline.ts`, never with literal frame numbers.
4. Look at a still at the end of its motion (`pnpm stills`), at phone size too, before building on it.
5. To change a component's source, copy it into `projects/<name>/` first and edit that copy, with a comment at the
   top naming the original. A later `pnpm remocn <name>` would overwrite edits made in `src/components/remocn/`
   (shadcn asks before overwriting; answer no).

Installed in the workspace: `blur-in`, with the shared `src/lib/remocn-ui/` helpers.

`src/components/remocn/` is shared by every project: a component installed there is available to all of them.
Edits made there can conflict with `klaq-setup --update`, which is why restyled variants live in the project (step 5).
