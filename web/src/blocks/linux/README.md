# src/blocks/linux

**What lives here:** Linux block (route id `linux`): M0–M17, the full command set of the simulated machine.

**Design source:** `design/02-linux.md`; the lessons on real machines follow `design/00-DESIGN.ru.md` §6.13.

**Real machines (`reallab/`):** the widget `linux.lab` runs a lab of Alpine machines from the
trainer's image in the tab (`engine/v86` `V86Lab`) — one terminal per machine, goals judged by
state on the machine they name, plus probes (`reach['id']`: a root command's exit code and output).
`reallab/labs.ts` holds the labs as data: SSH between three machines, nginx and OpenRC, installing
Alpine onto a blank disk, a full partition; and the pages `#/lab/linux-disk`, `#/lab/linux-access`,
`#/lab/linux-install` (in-browser variants of the learning exams, exam mode: no hints, soft timer,
score). Reference solutions run on the real emulator: `V86_LINUX=1 npx vitest run tests/linux-reallab-v86.test.ts`.

**Owner:** the Linux builder. Other builders do not edit files in this folder; if you need
something from it, ask through the lead or add a backwards-compatible extension
point in your own folder.

**How it plugs in:** create `index.ts` here with `export default defineModule({ blocks, lessons, concepts, quiz, explainers, commands, docs, exams })` — it is discovered automatically by `src/core/registry.ts`.

See `web/CONTRACTS.md` for the contracts (types in `src/core/types.ts`).
