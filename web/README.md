# DevOps Trainer — web

English · [Русский](README.ru.md)

An interactive in-browser textbook and hands-on trainer for people entering DevOps, in Russian and English. It is a static site: no accounts, no server, progress lives in the browser.

The course rests on three pillars, with practice on top:

- **Textbook.** Coherent theory where a term is never used before the lesson that introduces it. A linter enforces this on every build.
- **Process explainers.** Diagrams the learner drives. Steps go forward, back and pause. Knobs recompute the process at once, with one line saying what changed and why. "Break it" stops the process at the break. A "what will happen?" question comes before a change. Every block, arrow and label opens a card that explains it.
- **Documentation ladder.** It runs from DL1 (a doc chip) through DL2 (a page fragment with the line highlighted), DL3 (a link only) and DL4 (a task that needs something not taught, with no hints) to DL5 (an exam with only the official docs).

Each block has three levels (beginner, intermediate, experienced) and a placement check, "show what you already know". The course is not a game: there are no points, badges, streaks or leaderboards.

The design is in `../design/` (`00-DESIGN.ru.md` is the master document). The honest per-block status is in [`STATUS.ru.md`](STATUS.ru.md).

## Run

```bash
npm install
npm run dev          # http://localhost:5173 (COOP/COEP headers on)
npm run build        # tsc --noEmit + vite build → dist/
npm run preview      # serve dist/ on :4173
npm test             # vitest: unit tests + the content linter
npm run test:e2e     # Playwright smoke tests (starts Vite on :5288 itself)
npm run screenshots  # needs a dev server on :5288; writes screenshots/
npm run fetch:v86    # download the v86 BIOS and kernel into public/v86/ (also run by prebuild)
```

Playwright needs Chromium once: `npx playwright install chromium`.

## Structure

```
src/
  core/        types (the contracts), registry, router, store, i18n, markdown, linter
  app/         shell, home (route map), block page, lesson page, sections, placement, exams, review, settings
  engine/
    terminal/  tier A "Стенд": VFS, bash subset, process table, kernel model (namespaces, cgroups v2, caps), systemd, xterm widget
    explainer/ process explainer renderer: diagram, stepper, knobs, breaks, predictions, cards, label placement (tidy.ts)
    docs/      offline documentation corpus, doc viewer, documentation ladder policy
    quiz/      quiz renderer and grading, FSRS review scheduler, placement and exam scoring, rubrics
    sim-net/   simulated network: netfilter, NAT, ARP, routing, TCP, DNS hierarchy, HTTP/nginx, TLS
    dsim/      simulated Docker: CLI, images and layers, registry, build, compose, crun
    kube-lite/ simulated Kubernetes (k3s-like): API server, admission, controllers, scheduler, kubelets, kubectl, constructor
    flowlab/   Kanban flow simulator, board widget, charts, debrief
    v86/       tier B: real Linux in the browser (v86), multi-machine lab on a learning switch
    ai/        bring-your-own AI: provider settings, encrypted key store, tutor panel, mentor
    pwa/       service worker and manifest for offline use
  blocks/      content, one folder per block (see the route below); each exports a module via defineModule
  styles/      tokens (light and dark), base typography, app layout, widgets
tests/         vitest unit tests and the content linter (concept-order.test.ts)
e2e/           Playwright smoke tests
scripts/       fetch-v86.mjs, screenshots.mjs
screenshots/   desktop 1440 and phone 390, light and dark, of home, a lesson and the flagship explainers
```

Blocks and engines plug in by discovery (`import.meta.glob` in `src/core/registry.ts`); there is no shared list to edit. `CONTRACTS.md` describes how a block plugs in.

## Course route

The route is in `src/core/route.ts`. Blocks are listed in route order; a block that is not delivered yet shows as a placeholder on the map.

| # | Block | Folder | State |
|---|---|---|---|
| F | Orientation (beginners only) | methodology | placeholder |
| 1 | Methodology | methodology | delivered |
| 2 | Linux | linux | delivered |
| 2a | Git and YAML | git-cicd | delivered |
| 3 | Networks | networks | delivered |
| 4 | Containers | containers | delivered |
| 5 | CI/CD | git-cicd | delivered |
| 6 | Kubernetes, stage 1 | kubernetes | delivered |
| 7 | Kubernetes, stage 2 | kubernetes | delivered (real-machine lessons, self-check) |
| 8 | IaC: Ansible and Terraform | iac | delivered |
| 9 | A cluster from code | iac | placeholder |
| 10 | Monitoring | monitoring | delivered |
| 11 | On-call shift and final exam | career | delivered (no placement, by design) |
| 12 | Career | career | delivered |

## Implemented compared with the design

**Implemented:**
- The app shell: hash routing, RU/EN switch, light and dark themes, `prefers-reduced-motion` and calm mode, and phone layout. At 390 px no route scrolls sideways; a wide diagram scrolls inside its own frame instead.
- The content linter for concept order. It covers `uses`, glossary links and the glossary scan, and runs on every `npm test`.
- Lesson sections: text, callout, explainer, terminal lab, quiz, docs and widget. Progress is saved per section, in IndexedDB.
- Tier A simulators for Linux, network, Docker, Kubernetes, Git and GitLab CI, Ansible, Terraform and Prometheus. Every terminal task is checked by machine state, not by the text the learner typed.
- The process explainer engine, with 50+ explainers across the blocks. On mount, edge labels are placed off boxes, off other labels and off other lines. Node labels that are too long shrink or wrap. A waterfall view is available for timed processes (the URL explainer).
- Doc ladder DL1–DL5 with an offline corpus (man pages, `--help`, short copies of official pages). The ladder schedule, hint policy and "where did you look?" are in place.
- Quiz kinds: mcq, multi, order, match, fill-command, predict-output, bugfind, label. Confidence marks are recorded, and the FSRS review queue is built from them.
- Placement checks, block exams with a protocol, the on-call board, and the career widgets (vacancy reader, answer translator, drills, mock interview, pitch, CV).
- The flowlab Kanban board with scenarios, charts and a debrief.
- Tier B: v86 real Linux and a multi-machine lab page (`#/lab/multinode`).
- Bring-your-own AI tutor, with the key encrypted in IndexedDB.
- PWA offline support.

**Not implemented yet** (see `STATUS.ru.md` for the full list):
- The Orientation segment and the "A cluster from code" block (k8s-3).
- Lessons that run on v86 (`machine: 'v86'`). The engine and lab page exist, but no lesson uses them yet.
- Block exams for Networks, CI/CD, Kubernetes, IaC and Monitoring.
- The RV64 track.
- Splitting the main bundle by block. Today the main chunk is about 4.9 MB, 1.6 MB gzipped.

## Tests

- `npm test` runs 520 unit tests. Reference solutions run against the simulators and prove that every lab task can be solved. The content linter runs over the whole build.
- `npm run test:e2e` runs 27 Playwright smoke tests:
  - open home, check the route order, switch RU/EN and the theme;
  - open every block and its first lesson;
  - run a terminal command and pass a task check;
  - drive an explainer: step, change a knob through its prediction, break it, open a card;
  - answer a quiz item;
  - drag a Kanban card;
  - run `kubectl apply` and see the pod Running;
  - check that progress persists after a reload;
  - check for no sideways scroll at phone width;
  - check that no edge label sits on a box.
