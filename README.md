# DevOps Trainer

English · [Русский](README.ru.md)

An interactive, bilingual (Russian and English) in-browser textbook and hands-on trainer for people entering DevOps. It is a static site: no accounts and no server; progress is kept in the browser.

What the course contains:

- **Textbook prose.** Coherent theory in which a term is never used before the lesson that introduces it. A linter checks this on every build.
- **Interactive process explainers.** Diagrams the learner drives: steps forward and back, knobs that recompute the process, "break it" switches, "what will happen?" questions and a card for every element.
- **In-browser simulators.** Linux (shell, files, processes, systemd, namespaces, cgroups), networks (routing, NAT, netfilter, DNS, HTTP, TLS), Docker, Kubernetes, Git and GitLab CI, Ansible, Terraform, Prometheus and logs, and a Kanban flow board. Terminal tasks are checked by machine state, not by the text typed. Real Linux also boots in the tab through the v86 emulator.
- **Real-VM stages.** Some exams run on the learner's own cloud machines and a kubeadm cluster; a read-only fact collector script reports machine state back to the browser.
- **Quizzes and review.** Eight quiz kinds, confidence marks and an FSRS review queue.
- **Practical exams.** Block exams, an on-call shift and a final exam, plus a career block with mock interviews.
- **Documentation ladder.** From DL1 (a doc chip) to DL5 (an exam with only the official docs), backed by an offline documentation corpus.
- **Three levels.** Beginner, intermediate and experienced, with a placement check per block.
- **Bring your own AI.** An optional tutor that uses the learner's own provider key, stored encrypted in the browser.

## Course route

The route is defined in [`web/src/core/route.ts`](web/src/core/route.ts). Per-block status is in [`web/STATUS.md`](web/STATUS.md).

| # | Block | Notes |
|---|---|---|
| F | Orientation | Beginners only; other levels close it with three questions |
| 1 | Methodology | |
| 2 | Linux | |
| 2a | Git and YAML | |
| 3 | Networks | |
| 4 | Containers | |
| 5 | CI/CD | |
| 6 | Kubernetes, stage 1 | |
| 6a | Deploying to Kubernetes from CI | |
| 7 | Kubernetes, stage 2 | Real VMs: a kubeadm cluster |
| 8 | IaC: Ansible and Terraform | |
| 9 | A cluster from code | |
| 10 | Monitoring | |
| 11 | On-call shift and final exam | One exam for every level |
| 12 | Career | |

## Run

Requires Node.js and npm.

```bash
cd web
npm ci
npm run dev                  # http://localhost:5173
npm test                     # vitest: unit tests and the content linter
npx playwright install chromium   # once, before the first e2e run
npm run test:e2e             # Playwright smoke tests
node scripts/fetch-v86.mjs   # download the v86 BIOS and kernel into public/v86/
```

`npm run build` writes the static site to `web/dist/`. The full command list is in [`web/README.md`](web/README.md).

## Repository layout

```
design/   design documents: 00-DESIGN is the consolidated design, 01–10 cover pedagogy, blocks, engine, platform and assessment
web/      the application (Vite + TypeScript): src/core, src/app, src/engine, src/blocks, tests, e2e, scripts
```

## Documentation

- [`design/00-DESIGN.md`](design/00-DESIGN.md) ([Russian](design/00-DESIGN.ru.md)) — the consolidated design.
- [`web/README.md`](web/README.md) — the application: commands, structure, tests.
- [`web/CONTRACTS.md`](web/CONTRACTS.md) — how blocks and engines plug in.
- [`web/STATUS.md`](web/STATUS.md) — what is done, partial and missing.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to run the tests, how lessons, diagrams and labs are built, and how to send a change.
- [`deploy/README.md`](deploy/README.md) and [`service/feedback/README.md`](service/feedback/README.md) — how to run the course and the feedback service yourself. The course has the same in its help section, `#/about`.

## Credits

The course structure follows the public devops413 checklist for beginner DevOps engineers. Only the order of topics and the list of areas are taken from it; no texts or materials from the checklist are used or redistributed.

## License

[Apache-2.0](LICENSE)
