# projects/

Your films and edits live here, one folder each. This folder is gitignored (except this file), so
`klaq-setup --update` never touches your work.

- `pnpm new <name>` scaffolds `projects/<name>/index.tsx` and `timeline.ts`.
- `index.tsx` exports `compositions: KlaqComposition[]` (see `src/klaq.ts`); they appear in Studio automatically.
- Assets go in `public/projects/<name>/`, renders in `out/<name>/`, scratch in `work/<name>/`.
