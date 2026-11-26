# Pipeline run — preparation only

Status: BLOCKED before narration; this is not a completed video-to-article run.

## Rights decision required

The requested voice, macOS Milena, is a System Voice. macOS Tahoe license section 2F restricts System Voices to personal non-commercial projects and excludes public sharing, including non-profit distribution. Repository Apache-2.0 licensing covers the lesson text, not the voice. A publicly reusable kit therefore needs a different, appropriately licensed voice or evidence of separate permission from Apple. No narration was generated or represented as cleared.

Primary source: https://www.apple.com/legal/sla/docs/macOSTahoe.pdf (English, page 3, section 2F; inspected 2026-11-25 local time).

## Environment

- Machine: MacBook Air Mac16,12, Apple M4, 10 cores (4 performance + 6 efficiency), 16 GB RAM.
- OS: macOS 26.4.1, build 25E253, arm64.
- Python: 3.15.2.
- Node: v26.9.0; Playwright: 1.65.1 from web/node_modules.
- ffmpeg: 8.1.1, Apple clang 21.0.0, libx264 available.
- whisper-cli: Homebrew whisper-cpp 1.8.6; --help inspected.
- Plugin checkout: /Users/tym83/projects/video-to-article.
- Plugin commit: 469f2c732f27e72f1fbf50fb7468961cb83870c8; clean at inspection.
- Model: /Users/tym83/whisper-models/ggml-large-v3-turbo.bin.
- Model SHA-256: 1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69.
- Source commit: 1a2bbf63a0283cd6a7ab0581c43e3a663aa4e82e (pinned even if the shared branch advances).

Environment inspection commands: `sw_vers`; `system_profiler SPHardwareDataType`; `python3 --version`; `ffmpeg -version`; `whisper-cli --help`; `shasum -a 256 ~/whisper-models/ggml-large-v3-turbo.bin`; `git -C ~/projects/video-to-article rev-parse HEAD`; `git -C ~/projects/video-to-article status --short`; `node -p "require('./web/node_modules/playwright/package.json').version"`. These read-only inspections were not independently timed. No machine identifiers are included.

## Exact artifact commands in execution order

Working directory: /Users/tym83/projects/devops-trainer-wave3. Each command below is invoked through `python3 web/public/media/aicontent/pipeline-run/tools/measure.py <command>`; the wrapper records actual monotonic wall time, exit status and UTC start in commands.jsonl. Initial exploratory extraction/rendering preceded this measured rebuild; the final artifacts were rebuilt with the commands below.

1. 2026-11-26T04:06:05.567530+00:00 — 0.213820 s — exit 0

```sh
python3 web/public/media/aicontent/pipeline-run/tools/extract-source.py
```

2. 2026-11-26T04:06:05.858028+00:00 — 0.132198 s — exit 0

```sh
python3 web/public/media/aicontent/pipeline-run/tools/prepare.py
```

3. 2026-11-26T04:06:19.741583+00:00 — 1.400440 s — exit 0

```sh
node web/public/media/aicontent/pipeline-run/tools/render.mjs
```

4. 2026-11-26T04:07:02.299587+00:00 — 0.295048 s — exit 0

```sh
python3 web/public/media/aicontent/pipeline-run/tools/validate.py
```

5. 2026-11-26T04:07:02.681696+00:00 — 1.230718 s — exit 1

```sh
npm --prefix web test -- tests/aicontent-course.test.ts tests/lesson-images.test.ts
```

6. 2026-11-26T04:07:15.249486+00:00 — 3.976763 s — exit 0

```sh
npm --prefix web test -- tests/aicontent-course.test.ts tests/lesson-images.test.ts
```

The first browser launch in the sandbox failed with Chromium bootstrap_check_in permission denied. The successful render ran with escalated sandbox access. An initial Vitest run could not write the shared node_modules/.vite-temp cache; its retry used escalated access. Neither required a product-code change.

## Implemented and checked

Nine verbatim source sections, 2,588 body words / 2,637 words including source headings (whitespace count). The source consists of Markdown stored in TypeScript bi() literals in the published Networks lessons; details and exact files are in SOURCE.md. No .ru.md lesson was edited and no article draft or accepted section was authored.

Nine 1280×720 PNGs were rendered by Playwright from nine small HTML documents. The renderer checks page overflow. validate.py checks the source text against the pinned git objects after markup removal, the concatenation, section/word counts, source terms, PNG dimensions, and absence of AIFF. Slide 09 was visually inspected.

## Remaining run

No talk.mp4, talk.m4a, transcript, chunks, frame extractions, coverage report, ASR diff, ASR statistics or final ZIP exists yet. Duration, WER and top mismatches are not measured and must not be inferred. Raw AIFF will be temporary outside the repository. The target remains 19–23 minutes and video under 30 MB; actual speech duration must be measured before deciding whether a disclosed timing adjustment is needed.

The source of transcribe.py, chunk.py, frames.py, coverage.py and proofcheck.py was read with:

```sh
cat ~/projects/video-to-article/skills/video-to-article/scripts/{transcribe,chunk,frames,coverage,proofcheck}.py
```

The plugin transcribe.py supports faster, mlx and openai backends, not whisper-cli. To meet the requested backend without changing the plugin, the next stage needs a separately recorded adapter that calls whisper-cli and maps its segments into the plugin writer. No adapter or transcription has been run yet.

coverage.py compares 03-chunks with 04-text processed chunks. Since the lead owns draft prose, a report against absent 04-text must remain explicitly incomplete; a length ratio is not evidence of factual completeness. proofcheck.py can run read-only on the raw transcript, without --fix. Frames can be selected through a metadata-only IMAGE request file at slide boundaries, with no article prose.

## Inventory

| File | Bytes |
|---|---:|
| `LICENSE.txt` | 11358 |
| `SOURCE.md` | 2039 |
| `commands.jsonl` | 1385 |
| `sections.json` | 62919 |
| `slides/01.html` | 1187 |
| `slides/01.png` | 34473 |
| `slides/02.html` | 1201 |
| `slides/02.png` | 40288 |
| `slides/03.html` | 1238 |
| `slides/03.png` | 40303 |
| `slides/04.html` | 1200 |
| `slides/04.png` | 36799 |
| `slides/05.html` | 1140 |
| `slides/05.png` | 31061 |
| `slides/06.html` | 1183 |
| `slides/06.png` | 35620 |
| `slides/07.html` | 1094 |
| `slides/07.png` | 27181 |
| `slides/08.html` | 1201 |
| `slides/08.png` | 39677 |
| `slides/09.html` | 1203 |
| `slides/09.png` | 39946 |
| `talk-source.txt` | 30198 |
| `tools/extract-source.py` | 1107 |
| `tools/measure.py` | 589 |
| `tools/prepare.py` | 4270 |
| `tools/render.mjs` | 864 |
| `tools/validate.py` | 1408 |
| `tools/write-run.py` | 5464 |
