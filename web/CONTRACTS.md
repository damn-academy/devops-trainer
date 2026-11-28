# DevOps Trainer web — contracts for builders

English · [Русский](CONTRACTS.ru.md)

All shapes live in `src/core/types.ts` (read its comments — they are the spec).
This page says how to plug in without touching anyone else's files.

## Commands

```
npm run dev     # http://localhost:5173, COOP/COEP headers on
npm run build   # tsc --noEmit + vite build → dist/
npm test        # vitest: unit tests + the content linter (tests/concept-order.test.ts)
```

`npm test` runs `lintRegistry()` over every module of the build. It fails on any
contract error, with a list of `where: message` lines.

## How a block plugs in

Create `src/blocks/<your-folder>/index.ts`:

```ts
import { defineModule } from '../../core/define';
export default defineModule({ blocks, lessons, concepts, quiz, explainers, commands, docs, exams, widgets, facts, setup, settings });
```

It is discovered by `import.meta.glob` in `src/core/registry.ts`; there is no
shared list to edit. Engines do the same with `src/engine/<name>/module.ts`
(engine modules load before block modules).

The route map does not wait for these modules. At build time (and in dev after
a change) `src/core/manifest-plugin.ts` imports every module in Node and keeps
only what the map shows — blocks without placement tasks and sources, lesson
ids, titles, tiers and minutes — as `virtual:dt-manifest`. The home page paints
from it; the first visit to any other page loads every module and the page
code. Nothing to do for builders, except: a module must import cleanly in Node
(no `document`/`window` at the top level, guard with `typeof`), or the build
fails. Code that runs only on the home page sees lesson stubs with empty
`sections`; use `registry.placementCount(id)`, not `block.placement.length`.

- **Block ids and order** come from `src/core/route.ts` (`ROUTE`). Use the id
  and `order` given there; until your block exists the route map shows the
  placeholder. One folder may export several blocks (`git-cicd` → `git-yaml`,
  `cicd`; `kubernetes` → `k8s-1`, `k8s-2`; `iac` → `iac`, `k8s-3`; `career` →
  `career`, `final`; `methodology` → `orient`, `methodology`).
- **Lesson ids**: `<block>.<slug>`. A lesson belongs to exactly one block and
  is listed in `Block.lessons` in route order.
- **Concept ids**: `<prefix>.<name>` (prefixes in `types.ts`). Every concept
  has `introducedIn` = the lesson whose `introduces` lists it.
- **Levels**: `beginner | intermediate | experienced`. Never L0/L1/L2 in data.
- **Text**: every learner-facing string is `Bi { ru, en }` (use `bi(ru, en)`).
  Commands, terminal output, man/--help pages stay English plain strings.
- **Sources**: every lesson and block has `sources.en[]` and `sources.ru[]`
  with real `https://` URLs.

## The concept-order rule (the linter)

A lesson may rely on a concept only after the lesson that introduces it, in
route order (blocks by `order`, then `Block.lessons`). Checked:

1. `Lesson.uses` — each concept must be introduced in an earlier lesson.
2. Glossary links `[[concept.id]]` / `[[concept.id|words]]` in any Bi of the
   lesson (text, callouts, task prompts and hints, quiz items incl. bank items
   it references) — the concept must be introduced here or earlier.
3. Glossary scan — `Concept.term` and `Concept.forms` (whole words,
   case-insensitive, code spans excluded) must not appear in the prose of an
   earlier lesson. Give Russian declension forms in `forms.ru`. For everyday
   words that are also terms ("файл", "server") set `scan: false`.

Flags and subcommands are not concepts: they can be looked up before they are
taught (that is the documentation ladder).

## Sections of a lesson

`text` (markdown-lite: paragraphs, `###`, lists, `> quote`, ``` fences,
`` `code` ``, `**bold**`, `*em*`, `[text](https://…)`, `[[concept]]`),
`explainer`, `terminal`, `quiz`, `docs`, `callout`, `widget`. Every section has
a unique `id` (progress is stored per section), optional `levels` (shown only
for these levels) and `step` (hook/look/try/explain/practice/exit/review; for
Experienced the first `practice` section moves up after the `hook`).
A lesson is done when every visible section is done: text/callout when
scrolled into view, explainer when every step was seen, terminal when every
task passed, quiz when every item was answered, docs when solved, widget when
it calls `ctx.complete()`.

## Process explainers

Write a `ProcessModel` (types.ts, 08 §3.1) with `defineModel`, register it with
`fromModel(model)` from `src/engine/explainer/render.ts` in `explainers`. The
working example is `src/blocks/demo/pipe.ts`. Rules the linter enforces:
≤ 12 nodes; every edge has a `label` (drawn on the line) and a `card`; every
node and group has a `card { what, who, see?, doc? }`; `run(defaults)` returns
steps whose `focus` ids exist; every break makes some step report `broken`
(warning). Model rules: `run` is pure and fast (< 16 ms); `states`, `values`,
`fill` fold over steps (later steps override); `metrics` are given in full per
step; `explainDelta` returns one sentence; `Prediction.resolve(prev, next)`
reads the recomputed run and returns the right option id. Knobs with
`predict` ask "what will happen?" before their first change; every break asks
before it is switched on. Colour families: `ColorFamily` in types.ts (tokens in
`src/styles/tokens.css`). Use `shape: 'bar'` for the kernel strip (drawn under
edges), `'hex'` control plane, `'doc'` API object, `'rack'` node, `'buffer'`
for queues with a fill gauge.

A custom explainer (not from a model) is any `ExplainerReg` with your own
`mount(el, ctx)`; call `ctx.onComplete()` when the learner has seen it all.

## Terminal, machine, commands, checks

- `TerminalSection { machine: 'sim', setup: TerminalSetup, tasks: Task[] }`.
  The simulated machine (`src/engine/terminal/shell.ts`, `SimMachine`) has a VFS
  with inodes/permissions/users, a process table, a bash-subset parser (quotes,
  `| > >> < 2> 2>&1 &>`, `&& || ;`, `$VAR ${VAR:-x} $? $(…)`, globs, `~`),
  scripts (`./x.sh` needs `x`; `bash x.sh` does not; `$1… $# $@`, `exit`).
- **Register commands** in `commands: ShellCommand[]`: `name`, `summary` (Bi),
  English `help` (printed for `<cmd> --help`, becomes doc page `help/<name>`),
  `man` (sections → page `man/<name>.<section>`), `run(ctx)`. Use
  `ctx.fs` (bound to the user and cwd; throws `FsError` — let it propagate or
  use `fsErr()`), `ctx.out/err`, `ctx.isatty`, `ctx.machine.procs`,
  `ctx.machine.ext('docker', () => new DockerState())` for engine state (make it
  `Snapshotable` to survive snapshots/reset). Helpers for GNU-like parsing in
  `src/engine/terminal/commands/util.ts`. A name clash is a registry error;
  set `override: true` to replace a core basic command (core ships: echo pwd cd
  ls cat mkdir touch rm grep clear help man export unset true false exit
  history bash/sh). The Linux builder owns the full set.
- **Facts** (`Facts`, `dt.facts/v1` subset): `user, cwd, hostname, vars, procs,
  files[path]{type,mode('0644'),owner,group,size,ino,nlink,text}, term.main[]
  {line, exit, out}, users, groups`. Engines add scopes with
  `facts: [{ scope: 'containers', collect(m) }]` using 09 §2.2 field names.
- **Setup hooks**: `setup: [{ key: 'docker', apply(m, value) }]` consumes
  `TerminalSetup.ext.docker`.
- **Checks** (`Task.check`): `when` is a predicate (`src/core/predicate.ts`,
  09 §2.3: `files['/x'].type=f`, `procs[cmd=nginx]`, `cgroups[path=/box].memory.max<=20Mi`,
  `term['main'][last].exit=0`, `&& || ! ( )`, `has in ~ =~`, `#` count, `@pid(cmd)`,
  `@start.<path>`) or a function `(facts, start) => boolean`; `stdout` matches
  the last command's output; `fail[]` gives targeted explanations. `when` must
  not read typed text (`term.*.line`) — the linter fails; check the effect.
- **Doc ladder in tasks**: `docRef` (page + anchor + highlighted line),
  `hints { H1…H5 }`, `chips` (the expected command), `docStep` override,
  `beyond: true` + `solutionTokens` for DL4 (no hints allowed except H1).
  The step per source is computed in `src/engine/docs/ladder.ts`
  (start by level, schedule by lesson position in the block, never down,
  carry-over −1 to a new block, early rise after 3 clean tasks).

## Quiz items

Kinds: `mcq`, `multi`, `order`, `match`, `fill-command`, `predict-output`,
`bugfind`, `label` (types.ts). Every wrong option needs `why`; `explain` is
shown after any answer. `fill-command` with `setup` + `check` is graded by
running the line on a fresh machine; `predict-output` takes its reference from
running `command` on the simulator. Put reusable items in `quiz` (the bank;
reference by id from `QuizSection.items`; the review queue picks bank items by
`concepts`). Confidence (guess / think / know) is asked before every answer.

## Documentation corpus

Pages come from commands (`man`, `help`) and from `docs: DocPage[]` (ids like
`explain/pod.spec`, `web/kubernetes.io/…`; `source` is the ladder source:
`kubectl-explain`, `kubernetes.io`, `docs.docker.com`, …). Sections have ids
(`NAME`, `SYNOPSIS`, `DESCRIPTION`, `OPTIONS`, `EXIT STATUS`, `EXAMPLES`,
`SEE ALSO`, `FIELDS`); the reader shows their anatomy in the margin. Open with
`openDoc(ref, { mode: 'peek' | 'page' | 'exam' })`; DL1 chip: `docChip(ref)`.

## Engines, widgets, settings, AI

- `widgets: [{ id, mount(el, props, ctx) }]` + `{ kind: 'widget', widget: id }`
  section — for flowlab boards, cluster views etc.
- `settings: [{ id: 'ai', order, title, mount(el) }]` — the AI builder's
  section replaces the placeholder "Your AI".
- `mentor: Mentor` — the AI hook (`ready()`, `ask(req)`); the engine folds
  answers that contain `solutionTokens` and never offers it in exams.
- `exams: Exam[]` + `Block.exam` — rendered at `#/exam/<id>` (exam/training
  modes, DL5 doc reader limited to `allowedDocs`, soft timer).
- `Block.placement: PlacementTask[]` — rendered at `#/block/<id>/placement`
  (no hints, no feedback, "guessing" never counts, 80% + all `key`).
- **Key trainer** (`src/engine/editor-drill`, Vim and Emacs courses):
  `{ kind: 'widget', widget: 'editor.drill', props: { drill } | { drills } | { set: 'vim' | 'emacs' } }`.
  A drill (`types.ts`) is a start text and cursor, a target state and a
  solution in the editor's own notation, tagged `engine: 'cm-vim' | 'cm-emacs'`.
  The check compares the state (text, cursor, registers, kill ring), never the
  keys. `applyDrill(engine, start, keys)` (`session.ts`) replays keys headless
  for tests and for the comparison with the real Vim and Emacs. CodeMirror
  loads only with the widget. Sample drills: `#/lab/editor-keys`.

## Progress store

`src/core/store.ts`: append-only event log in IndexedDB, written on every
`store.record(event)` (no save button); progress is `replay(events)`
(`src/core/progress.ts`, pure). Engines may log their own events with kinds
`x.<engine>.<what>`. Machine snapshots: `store.saveSnapshot(key, data)`.
Export/import JSON (`devops-trainer/progress@1`), `navigator.storage.persist()`,
weekly "export or sign in" line; sign-in plugs in later via `store.setAccount()`.

## File ownership

| Path | Owner |
|---|---|
| `src/core/*`, `src/app/*`, `src/styles/*`, `src/main.ts`, `index.html`, configs | platform core (change only by minimal backwards-compatible extension; report it) |
| `src/engine/{explainer,terminal,quiz,docs}` | platform core |
| `src/blocks/demo` | platform core (showcase; Linux may replace the pipeline) |
| `src/blocks/methodology`, `src/engine/flowlab` | methodology builder |
| `src/blocks/linux` | Linux builder |
| `src/blocks/networks`, `src/engine/sim-net` | networks builder |
| `src/blocks/containers`, `src/engine/dsim` | containers builder |
| `src/blocks/kubernetes`, `src/engine/kube-lite` | Kubernetes builder |
| `src/blocks/{git-cicd,iac,monitoring}` | CI/CD–IaC–monitoring builder |
| `src/blocks/career` | assessment and career builder |
| `src/engine/{ai,v86}` | platform/v86/AI builder |
| `tests/<your-folder>-*.test.ts` | the builder of that folder |

Do not run docker/kind/colima/VMs on this Mac. Do not commit; the lead commits.

## Real Linux (tier B, v86), BYO AI, offline

Owner: platform/v86/AI builder. Files: `src/engine/v86`, `src/engine/ai`, `src/engine/pwa`.

**Assets.** `npm run fetch:v86` (also run by `prebuild`, non-fatal offline) downloads
SeaBIOS/VGABIOS (v86 commit 315b2b0) and the Buildroot `bzImage` of the v86
demo (Linux 5.6.15 i686 + BusyBox, GPL-2.0, 5 MB) into `public/v86/`
(git-ignored), verifies SHA-256 and writes `manifest.json`. The emulator is
the `v86` npm package (BSD-2-Clause, pinned 0.5.473).

**A real machine in a lesson** — a widget section; the emulator loads only when it mounts:

```ts
{ kind: 'widget', id: 'real', widget: 'v86.linux', props: {
    intro: bi('…', '…'),
    hostname: 'linux',               // default
    setup: ['mkdir -p /srv/app'],    // run as root before the learner gets the prompt
    tasks: [{ id: 't1', prompt: bi('…','…'), check: { when: "files['/root/demo'].type=d" } }],
} }
```

- The guest is root in `/root`; the shell is BusyBox `ash`. Checks run after
  every command on facts collected from the real machine: `files[...]` (only
  the paths named in string predicates, or `props.watch`), `procs` (from
  `/proc`, the trainer's service shell hidden), `cwd`, `hostname`, `users`,
  `groups`, `term.main` (line, exit, output — from the prompt marker), `env.kind = 'v86'`.
- Function checks work too, but list their paths in `props.watch`.
- The lab's machine is saved in OPFS (per lesson+section) after each passed
  goal and on leaving; the learner continues where they stopped. "Reset the
  machine" returns to the state after `setup`.
- Autostart only when `navigator.deviceMemory >= 4`; otherwise a "Start" card
  with the download size and memory.
- Programmatic use: `new V86Machine(opts)` (`src/engine/v86/machine.ts`,
  implements `Machine`: `exec`, `facts`, `snapshot`/`restore`, `on`) +
  `mountConsole(el, machine)` (`console.ts`).

**Pages.** `#/lab/linux` (sandbox), `#/lab/multinode` (2–3 machines on the
in-page learning switch `dt-switch`: MAC table with aging, flood/forward/filter,
802.1Q access/trunk, hub mode, port up/down; live diagram). Any engine can add
a page `#/lab/<id>` by registering a widget `lab:<id>`.

**AI tutor.** `registry.mentor` is the BYO-AI mentor (the core "Ask" box uses it).
A lesson can place `{ kind: 'widget', widget: 'ai.tutor', props: { mode?, label?, question? } }`;
lessons and labs also get a floating "Ask the tutor" button (hidden on exams
and placement, where the AI worker refuses requests). The tutor sees the
lesson, the introduced concepts (white list), the current goal (`.goal.current[data-task]`),
the last 40 terminal lines and the doc trail; never `solutionTokens` (answers
naming them are rephrased once, then folded). H4/H5 in practice mode deliver
the author's `hints.H4/H5` text only. Terminal widgets dispatch
`document` event `dt:terminal` `{ machine, line, out, exit }` after each command.

**Offline.** The build emits `sw.js` + `manifest.webmanifest` (plugin
`src/engine/pwa/vite-plugin.ts`): app shell and all chunks precached; v86
engine/images cached on first use or by Settings → Offline; a new version
waits and is applied on the button or on moving to another lesson.


### Editors in a real machine (lab-editors, v86.editor)

Profile `lab-editors` (256 MB): lab-node's toolbox plus Neovim, Emacs (no X),
tmux, ripgrep and make, with read-only agents in `scripts/lab-editors`
(`dt.vim`, `dt.lua`, `dt-agent.el` loaded by `site-start.el`) and training
files in `/srv/train`. A lesson places the widget:

```ts
{ kind: 'widget', id: 'vim-lab', widget: 'v86.editor', props: {
    editors: ['vim'],
    tasks: [{ id: 'm', prompt: bi('…', '…'), check: { when: "vim.reg.a ~ ';' && vim.recording = ''" } }],
} }
```

- Facts (only when a predicate names them): `vim`, `nvim`, `emacs` —
  `running`, `instrumented`, `source` (`socket` | `file` | `none`), `buf`
  (current buffer), `buffers[]{file,name,modified,text,…}`; Vim/Neovim also
  `mode`, `recording`, `reg`, `regtype`, `marks`, `qf`, `windows`, `layout`,
  `undo`, `opt`; Emacs `killhead`, `killring[]`, `point`, `mark`, `major`,
  `minor`, `registers`. `editor.{active,running,instrumented}`. An editor
  started without plugins (`vim -u NONE`, `nvim --clean`, `emacs -Q`) has
  `instrumented=false`: judge files and say so in `fail[]`.
- Trigger: `new V86Machine({ editorWatch: true })` polls ttyS1 every 400 ms
  while an editor runs (1 s while another command runs) and emits
  `editor.change`; the prompt trigger stays. `m.editorFacts()` returns the
  editor area alone (cheaper than `facts()`).
- Demo: `#/lab/editors`. End-to-end run: `node scripts/check-editors-lab.mjs`
  (on a build host).
- Behaviour probes: `props.probes: EditorProbeSpec[]` (`editor-probes.ts`) run
  the learner's macro (`{ macro: 'a' }`, Emacs `{ macro: 'last' }`), keys
  through their config (`{ keys, config? }`) or an Emacs command from their
  init file (`{ call }`) on a hidden `input` in a fresh batch editor; a goal
  reads `probe['id'].{ok,text,error}`. Results are cached by macro and input.
- Cost: goals reading only `files[...]`, editor scopes and `probe[...]` are
  judged on `m.focusedFacts()` (one round trip, no process list).
- The widget always shows how to leave the editor in front, warns about a
  non-Latin layout (Vim/Neovim agents count non-Latin letters in Normal and
  Visual mode; Emacs: Meta, C-x, C-c chords), and while an editor is open the
  tutor gets the rendered screen and a compact editor state instead of the
  command tail (`registerTerminalContext` in `engine/ai/context.ts`).

### Cross-terminal goal source

A simulator terminal may declare `setup.ext.goalSource: "<mountLab key>"`.
This explicitly checks all its tasks against the source terminal's facts and
initial facts (including delta checks). Both mounts must have the same
`lessonId`. The value is the source's full storage key, not a section title.
Without this property, each terminal continues to check its own machine.
Commands and resets on the source notify mounted goal subscribers. A missing,
unmounted, or other-lesson source never falls back to the checking terminal.
Machines, persistence keys and reset buttons remain independent; this contract
shares goal evidence only. Dispose removes the source and its subscriptions.
Content must opt in; existing lessons are not implicitly joined by lesson id.

## Bilingual Markdown lessons

Import `loadMarkdownLessons(files, blockId)` and `markdownQuizItems(lessons)`
from `src/core/md-lessons.ts`. Pass an eager `?raw` glob of paired `.ru.md` /
`.en.md` files; register the returned lessons and quiz items in the block module.
The marketing parser path remains a compatibility re-export.

A file may contain multiple lessons. Start each with
`<!-- lesson: course.lesson-id | Localized title | 10 -->`, followed by exactly
one `<!-- section: hook -->`. Use `<!-- section: theory | Title -->` and
`<!-- section: task | Title -->` for prose. Russian sources are required, last:
`<!-- section: sources -->`, then `- Source title — https://example.com (date)`.
English sources may be omitted to reuse Russian references.

Insert `<!-- widget: marketing.budget {"total":10000} -->` anywhere inside
lesson prose. It creates a practice section at that position; following prose
resumes the previous section kind. Props must be a JSON object. Other examples:
`<!-- widget: marketing.dns-lab -->` and
`<!-- widget: deptsim {"scenario":"marketing.quarter"} -->`.
Department scenarios are registered once by the deptsim engine module.

Enclose MCQs in `<!-- quiz -->` / `<!-- /quiz -->`. Each item starts with
`? Question`, followed by one `+ Correct option || Explanation` and one or more
`- Wrong option || Explanation` lines. Separate items with a blank line.
IDs are `lesson-id.q1`, `lesson-id.q2`, etc., counted across quiz sections.
Keep question order stable to preserve progress. RU and EN must mirror lesson
IDs, minutes, section kinds, widget IDs/props, option order and correct answers.
Translate all question, option and explanation text. Markers in fenced code
blocks are literal examples. Invalid markers and translation drift fail loading.

The budget model's parameter table contains teaching assumptions, not market
estimates. Spend repeats for three months under a monthly ceiling; unused money
is reserve. Lognormal costs, beta conversion rates, a shared market factor and
an occasional channel cost shock generate 300 twelve-month paths. Cumulative
bands are quantiles of path totals, not sums of monthly quantiles.
The DNS lab uses the existing simulated DNS engine with an isolated fake zone.
Completion checks a valid DMARC record in `/home/learner/dmarc.txt`, for example
`echo 'v=DMARC1; p=none; rua=mailto:dmarc@example-cloud.test' > dmarc.txt`.
No DNS changes are published.
