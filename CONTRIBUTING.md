# How to contribute

English · [Русский](CONTRIBUTING.ru.md)

The platform is open and can be improved: by fixing mistakes and inaccuracies, rewriting unclear passages, adding tasks, diagrams, lessons and entire courses, and repairing the simulators. This page tells how the repository is organised and how to shape a change so that it can be accepted quickly.

## How the repository is organised

The whole platform with all its professions and courses is in one repository, [damn-academy/devops-trainer](https://github.com/damn-academy/devops-trainer).

- `web/` holds the application itself, in TypeScript and Vite without a UI framework. `web/src/core` has the types, registry, router, store and linter, `web/src/app` the pages, `web/src/engine` the engines (terminal, diagrams, questions, documentation, simulators, v86, AI, offline), `web/src/blocks` the content of the blocks, one directory per block, and `web/tests` and `web/e2e` the tests.
- `design/` holds the design documents; the main one is [`design/00-DESIGN.md`](design/00-DESIGN.md).
- `lab/` holds the dtlab lab, in Go ([`lab/README.md`](lab/README.md)).
- `service/feedback/` holds the feedback service, in Go ([`service/feedback/README.md`](service/feedback/README.md)).
- `tools/terraform-provider-lab/` holds the Terraform provider for the cloud in the tab.
- `deploy/` holds the nginx configuration, Kubernetes manifests and deployment scripts ([`deploy/README.md`](deploy/README.md)).

Blocks and engines plug in by themselves: the registry finds them through `import.meta.glob`, so there is no shared list to edit when a block is added.

## How to run the course and the tests

Working on the platform needs Node.js and npm, and the lab, the service and the provider also need Go.

```bash
cd web
npm ci
npm run dev                       # http://localhost:5173 with the isolation headers
npm run typecheck                 # TypeScript type check
npm test                          # unit tests and the concept-order linter
npm run lint:explainers           # checks the texts of the diagrams
npx playwright install chromium   # once, before the first e2e run
npm run test:e2e                  # end-to-end tests in a browser
```

Tests on real v86 are skipped by default and switched on by variables, for example `V86_LAB=1 npx vitest run tests/v86-lab-integration.test.ts`; they need the image built first with `npm run build:lab-image`. The Go programs are checked with `go test ./...` in `lab`, `service/feedback` and `tools/terraform-provider-lab`. Before a change is sent, the type check, `npm test` and the linters must pass without errors.

## How a lesson, a diagram and a lab are built

Every data shape is described in `web/src/core/types.ts`, and the plug-in rules are collected in [`web/CONTRACTS.md`](web/CONTRACTS.md). A block exports a module with `defineModule` from `web/src/blocks/<folder>/index.ts`: blocks, lessons, concepts, questions, diagrams, commands, documentation pages and exams.

- **A lesson** has an id of the form `<block>.<name>` and consists of sections: `text`, `explainer`, `terminal`, `quiz`, `docs`, `callout` and `widget`. Each section can be shown only at some levels. A lesson lists the concepts it introduces (`introduces`) and relies on (`uses`), and every learner-facing string is given in two languages with `bi(ru, en)`. Commands, terminal output and `man` pages stay in English.
- **A diagram** is a process model created with `defineModel` and plugged in with `fromModel`. A model has at most twelve nodes, every line has a label and a card, every node has a card, and the `run` function returns the steps of the process for the given parameters. The working example is `web/src/blocks/demo/pipe.ts`.
- **A lab** is a `terminal` section with the machine’s initial state (`setup`) and tasks. A task’s goal is written as a condition over `dt.facts/v1` facts, for example `files['/srv/index.html'].mode=0644`, and the `fail` field gives explanations for typical mistakes. The linter rejects a goal that reads the typed text. Tasks on real Linux plug in with the `v86.linux` widget and the same goal format.

Every task comes with a reference solution, and the tests run it on the simulator to prove that the task can be solved. Every lesson has sources in English and Russian with real links.

## How to write the text

The Russian text of the professions and courses follows the guide [`web/STYLE-RU.md`](web/STYLE-RU.md), and its rules are acceptance conditions. We write in full, connected sentences, without chopped phrases, empty intensifiers, calques from English or officialese, and the guide itself collects examples of every ban. Every term is introduced before it is used and is called the same in the text, on the diagram and in the questions. An example in a lesson may rely only on what the learner has already covered on the route.

Three linters help keep these rules:

- the concept-order linter runs with `npm test` and rejects a term that appears before the lesson that introduces it;
- `npm run lint:explainers` checks every text a diagram can show;
- `node scripts/lint-ru-style.mjs <block>` looks for fragments, sentences built on a colon instead of a verb, and calques in Russian strings.

The last two linters are heuristic, so every finding is worth reading by eye, and before handing in, the page must be opened in a browser and looked through.

## How to report a problem

A mistake in a text, a diagram or a task is easiest to send from the site with “Report a problem”, or by selecting the text and pressing “Comment”: the message names the place on the site by itself and attaches the terminal output. The reply appears on the [“My messages”](https://damn.academy/#/messages) page. Bugs in the code, proposals about how the platform works, and everything about the dtlab lab and the feedback service are better described in a [GitHub issue](https://github.com/damn-academy/devops-trainer/issues): what you did, what you expected to see and what you actually saw, plus the browser and the system.

There are other ways to take part. Send an idea for a course or a profession — we will help build it on this engine. If you have teaching material of your own that you would like to publish, write to the author through the feedback form at the bottom of any page. The platform is non-commercial and sells nothing: it is an attempt to share knowledge with people who need it, not another standard. Over time a way to support the project with a donation will appear.

## How to shape a change

Changes are sent as a pull request from a separate branch, not to `main`. The commit message is written in English in the semantic commits format, `type(scope): description`, where the type is one of `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `perf` and `build`:

```text
fix(linux): explain why chmod needs the x bit on directories
```

Every commit is signed off with `git commit --signoff`, which adds a `Signed-off-by` line and certifies that you have the right to contribute the code under the project’s licence ([Developer Certificate of Origin](https://developercertificate.org/)).

In the pull request description, tell what changed and why, and for changes to the interface or the diagrams attach screenshots at 1440 and 390 pixels wide. One change should solve one problem: a typo fix and a new lesson are better sent separately. All public text in the repository, that is, code, comments, commits and pull request descriptions, is written in English, while Russian stays in lesson texts and in files ending in `.ru.md`.

## Licence

The platform is distributed under the [Apache-2.0](LICENSE) licence, and everything you send is accepted under the same licence. Third-party components keep their licences: the v86 emulator is under BSD-2-Clause, and Alpine packages and the Linux kernel are under their own licences, which the image build script records in the manifest next to each downloaded file.
