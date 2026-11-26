# Pipeline run — espeak-ng + whisper-cli

Completed media and mechanical plugin run. Editorial coverage remains incomplete by design: the lead owns the draft and accepted prose. No lesson .ru.md files were edited.

## Voice and rights

Homebrew espeak-ng 1.52.0, `espeak-ng -v ru -s 160`. The GPL-3.0 engine is not bundled; generated speech is not covered by its licence. Text and original assets retain Apache-2.0 attribution in SOURCE.md and LICENSE.txt. No macOS System Voices are used, per lead decision concerning macOS licence §2F.

## Environment

MacBook Air Mac16,12, Apple M4, 10 cores (4 performance + 6 efficiency), 16 GB RAM; macOS 26.4.1 (25E253), arm64. Python 3.15.2; ffmpeg 8.1.1; Homebrew whisper-cpp 1.8.6 (whisper-cli); Node v26.9.0; Playwright 1.65.1.

Plugin: /Users/tym83/projects/video-to-article; commit 469f2c732f27e72f1fbf50fb7468961cb83870c8; plugin source unchanged. Model: ~/whisper-models/ggml-large-v3-turbo.bin; SHA-256 1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69. Source commit: 1a2bbf63a0283cd6a7ab0581c43e3a663aa4e82e.

## Result

Video container: 1248.000000 seconds; 12663988 bytes (<30 MB). Audio: 1247.810000 seconds, mono AAC at 48 kHz. Exact synthesized section sum: 1247.8102947845805 seconds (20:47.810). Video is quantized to one frame/second; slide boundaries are rounded to that grid. No speech-rate adjustment or filler silence was needed.

WER: 36.32463354%; source 2797 words, transcript 2905 words; S=686, D=111, I=219. Unit-cost Levenshtein on Unicode NFC lowercase letter/digit runs, punctuation removed; ё retained; no acronym/number expansion. Punctuation-only mismatches are additional TSV rows and do not count toward WER. Timestamps identify Whisper segment starts, not word-level alignment. Category labels are heuristic.

transcribe-cli.py loads the unchanged plugin transcribe.py, registers a local whisper-cli backend, and invokes its main() and standard JSON/TXT/SRT writers. Word timestamps are unavailable and words arrays are empty. Whisper runs with temperature 0, no fallback and no text context; raw output and log are included. No recognition errors were manually corrected.

chunk.py and frames.py ran against the actual media/transcript. Nine frame requests use section starts +2 seconds. coverage.py exits 2 because all 04-text editor files are absent; coverage.md is evidence of missing editorial work, not a passing factual review. proofcheck.py ran on the raw transcript without --fix; its findings are editorial hints.

Initial sandbox Whisper attempt failed to allocate a Metal buffer (exit -11); the authorized retry with GPU access succeeded. Historical preparation/render/test attempts are retained in the log, including failures and successful retries. The initial 16 kHz AAC media was rebuilt at the brief’s 48 kHz before delivery. The two builds use identical speech PCM.

## Reproduce

From the repository root: run tools/build-media.py, tools/transcribe-cli.py, then the plugin chunk/frames/coverage/proofcheck commands below, tools/asr-diff.py, tools/validate-run.py, tools/write-run.py and tools/package.py (all tool paths below are explicit). Temporary section text/WAV files are recreated by build-media.py and removed after synthesis. 01-source/audio.wav is the 16 kHz ASR input; it is not stored in the repository or the ZIP (see the note at the end). Source and slide preparation commands are retained as historical provenance.

Every external artifact command is logged with argv, cwd, UTC start, wall time and exit code. Nested wrapper durations overlap child durations and must not be summed. Read-only environment inspection was not timed. Report generation and packaging are timed separately in ../pipeline-run-delivery.json outside the archive, avoiding a self-referential archive log.

## Exact commands in start order

- 2026-11-26T04:06:05.567530+00:00 | 0.213820 s | exit 0

```sh
python3 web/public/media/aicontent/pipeline-run/tools/extract-source.py
```

- 2026-11-26T04:06:05.858028+00:00 | 0.132198 s | exit 0

```sh
python3 web/public/media/aicontent/pipeline-run/tools/prepare.py
```

- 2026-11-26T04:06:19.741583+00:00 | 1.400440 s | exit 0

```sh
node web/public/media/aicontent/pipeline-run/tools/render.mjs
```

- 2026-11-26T04:07:02.299587+00:00 | 0.295048 s | exit 0

```sh
python3 web/public/media/aicontent/pipeline-run/tools/validate.py
```

- 2026-11-26T04:07:02.681696+00:00 | 1.230718 s | exit 1

```sh
npm --prefix web test -- tests/aicontent-course.test.ts tests/lesson-images.test.ts
```

- 2026-11-26T04:07:15.249486+00:00 | 3.976763 s | exit 0

```sh
npm --prefix web test -- tests/aicontent-course.test.ts tests/lesson-images.test.ts
```

- 2026-11-26T04:30:27.896885+00:00 | 0.196361 s | exit 0

```sh
espeak-ng -v ru -s 160 -f /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/01.txt -w /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/01.wav
```

- 2026-11-26T04:30:28.128783+00:00 | 0.116279 s | exit 0

```sh
espeak-ng -v ru -s 160 -f /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/02.txt -w /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/02.wav
```

- 2026-11-26T04:30:28.277216+00:00 | 0.099584 s | exit 0

```sh
espeak-ng -v ru -s 160 -f /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/03.txt -w /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/03.wav
```

- 2026-11-26T04:30:28.408659+00:00 | 0.148240 s | exit 0

```sh
espeak-ng -v ru -s 160 -f /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/04.txt -w /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/04.wav
```

- 2026-11-26T04:30:28.589292+00:00 | 0.108768 s | exit 0

```sh
espeak-ng -v ru -s 160 -f /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/05.txt -w /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/05.wav
```

- 2026-11-26T04:30:28.733068+00:00 | 0.104841 s | exit 0

```sh
espeak-ng -v ru -s 160 -f /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/06.txt -w /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/06.wav
```

- 2026-11-26T04:30:28.870844+00:00 | 0.116027 s | exit 0

```sh
espeak-ng -v ru -s 160 -f /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/07.txt -w /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/07.wav
```

- 2026-11-26T04:30:29.022087+00:00 | 0.122696 s | exit 0

```sh
espeak-ng -v ru -s 160 -f /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/08.txt -w /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/08.wav
```

- 2026-11-26T04:30:29.180791+00:00 | 0.090165 s | exit 0

```sh
espeak-ng -v ru -s 160 -f /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/09.txt -w /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/09.wav
```

- 2026-11-26T04:30:29.306010+00:00 | 0.473828 s | exit 0

```sh
ffmpeg -v error -y -f concat -safe 0 -i /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/audio.txt -ar 16000 -ac 1 /Users/tym83/projects/devops-trainer-wave3/web/public/media/aicontent/pipeline-run/01-source/audio.wav
```

- 2026-11-26T04:30:29.822290+00:00 | 12.364535 s | exit 0

```sh
ffmpeg -v error -y -i /Users/tym83/projects/devops-trainer-wave3/web/public/media/aicontent/pipeline-run/01-source/audio.wav -c:a aac -b:a 64k /Users/tym83/projects/devops-trainer-wave3/web/public/media/aicontent/pipeline-run/talk.m4a
```

- 2026-11-26T04:30:42.240164+00:00 | 2.460726 s | exit 0

```sh
ffmpeg -v error -y -f concat -safe 0 -i /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-vk3ugg5n/slides.txt -i /Users/tym83/projects/devops-trainer-wave3/web/public/media/aicontent/pipeline-run/talk.m4a -t 1247.8102947845805 -vf fps=1 -c:v libx264 -preset slow -tune stillimage -crf 28 -pix_fmt yuv420p -c:a copy -movflags +faststart /Users/tym83/projects/devops-trainer-wave3/web/public/media/aicontent/pipeline-run/talk.mp4
```

- 2026-11-26T04:30:51.379659+00:00 | 0.349725 s | exit 1

```sh
python3 web/public/media/aicontent/pipeline-run/tools/transcribe-cli.py
```

- 2026-11-26T04:30:51.457434+00:00 | 0.241449 s | exit -11

```sh
whisper-cli -m /Users/tym83/whisper-models/ggml-large-v3-turbo.bin -f /Users/tym83/projects/devops-trainer-wave3/web/public/media/aicontent/pipeline-run/01-source/audio.wav -l ru -tp 0 -tpi 0 -nf -mc 0 -oj -of /Users/tym83/projects/devops-trainer-wave3/web/public/media/aicontent/pipeline-run/02-transcript/whisper-raw
```

- 2026-11-26T04:30:51.824300+00:00 | 0.163210 s | exit 0

```sh
espeak-ng -v ru -s 160 -f /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/01.txt -w /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/01.wav
```

- 2026-11-26T04:30:52.020972+00:00 | 0.096096 s | exit 0

```sh
espeak-ng -v ru -s 160 -f /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/02.txt -w /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/02.wav
```

- 2026-11-26T04:30:52.148912+00:00 | 0.104728 s | exit 0

```sh
espeak-ng -v ru -s 160 -f /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/03.txt -w /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/03.wav
```

- 2026-11-26T04:30:52.286713+00:00 | 0.128520 s | exit 0

```sh
espeak-ng -v ru -s 160 -f /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/04.txt -w /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/04.wav
```

- 2026-11-26T04:30:52.450320+00:00 | 0.108782 s | exit 0

```sh
espeak-ng -v ru -s 160 -f /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/05.txt -w /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/05.wav
```

- 2026-11-26T04:30:52.597959+00:00 | 0.110573 s | exit 0

```sh
espeak-ng -v ru -s 160 -f /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/06.txt -w /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/06.wav
```

- 2026-11-26T04:30:52.744280+00:00 | 0.109517 s | exit 0

```sh
espeak-ng -v ru -s 160 -f /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/07.txt -w /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/07.wav
```

- 2026-11-26T04:30:52.887139+00:00 | 0.114979 s | exit 0

```sh
espeak-ng -v ru -s 160 -f /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/08.txt -w /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/08.wav
```

- 2026-11-26T04:30:53.033214+00:00 | 0.105713 s | exit 0

```sh
espeak-ng -v ru -s 160 -f /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/09.txt -w /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/09.wav
```

- 2026-11-26T04:30:53.173127+00:00 | 0.499667 s | exit 0

```sh
ffmpeg -v error -y -f concat -safe 0 -i /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/audio.txt -ar 16000 -ac 1 /Users/tym83/projects/devops-trainer-wave3/web/public/media/aicontent/pipeline-run/01-source/audio.wav
```

- 2026-11-26T04:30:53.708366+00:00 | 22.689454 s | exit 0

```sh
ffmpeg -v error -y -i /Users/tym83/projects/devops-trainer-wave3/web/public/media/aicontent/pipeline-run/01-source/audio.wav -ar 48000 -c:a aac -b:a 64k /Users/tym83/projects/devops-trainer-wave3/web/public/media/aicontent/pipeline-run/talk.m4a
```

- 2026-11-26T04:31:16.445933+00:00 | 2.761763 s | exit 0

```sh
ffmpeg -v error -y -f concat -safe 0 -i /var/folders/q9/rz9f_rhj1fz9b113mpl140880000gn/T/pipeline-espeak-boq4eyqi/slides.txt -i /Users/tym83/projects/devops-trainer-wave3/web/public/media/aicontent/pipeline-run/talk.m4a -t 1247.8102947845805 -vf fps=1 -c:v libx264 -preset slow -tune stillimage -crf 28 -pix_fmt yuv420p -c:a copy -movflags +faststart /Users/tym83/projects/devops-trainer-wave3/web/public/media/aicontent/pipeline-run/talk.mp4
```

- 2026-11-26T04:31:28.578581+00:00 | 186.844686 s | exit 0

```sh
python3 web/public/media/aicontent/pipeline-run/tools/transcribe-cli.py
```

- 2026-11-26T04:31:28.661126+00:00 | 186.720464 s | exit 0

```sh
whisper-cli -m /Users/tym83/whisper-models/ggml-large-v3-turbo.bin -f /Users/tym83/projects/devops-trainer-wave3/web/public/media/aicontent/pipeline-run/01-source/audio.wav -l ru -tp 0 -tpi 0 -nf -mc 0 -oj -of /Users/tym83/projects/devops-trainer-wave3/web/public/media/aicontent/pipeline-run/02-transcript/whisper-raw
```

- 2026-11-26T04:31:38.549754+00:00 | 0.912437 s | exit 0

```sh
python3 /Users/tym83/projects/video-to-article/skills/video-to-article/scripts/frames.py web/public/media/aicontent/pipeline-run extract --from web/public/media/aicontent/pipeline-run/frame-requests.txt
```

- 2026-11-26T04:33:24.768188+00:00 | 0.275984 s | exit 0

```sh
python3 web/public/media/aicontent/pipeline-run/tools/validate.py
```

- 2026-11-26T04:33:25.105070+00:00 | 1.002908 s | exit 1

```sh
npm --prefix web test -- tests/aicontent-course.test.ts tests/lesson-images.test.ts
```

- 2026-11-26T04:33:43.927359+00:00 | 4.577433 s | exit 0

```sh
npm --prefix web test -- tests/aicontent-course.test.ts tests/lesson-images.test.ts
```

- 2026-11-26T04:34:50.100019+00:00 | 0.054563 s | exit 0

```sh
python3 /Users/tym83/projects/video-to-article/skills/video-to-article/scripts/chunk.py web/public/media/aicontent/pipeline-run
```

- 2026-11-26T04:34:50.190616+00:00 | 0.037601 s | exit 2

```sh
python3 /Users/tym83/projects/video-to-article/skills/video-to-article/scripts/coverage.py web/public/media/aicontent/pipeline-run --mode clean
```

- 2026-11-26T04:34:50.264639+00:00 | 0.055437 s | exit 0

```sh
python3 /Users/tym83/projects/video-to-article/skills/video-to-article/scripts/proofcheck.py web/public/media/aicontent/pipeline-run/02-transcript/transcript.txt --lang ru --report web/public/media/aicontent/pipeline-run/proofcheck.md
```

- 2026-11-26T04:34:50.356838+00:00 | 3.390570 s | exit 0

```sh
python3 web/public/media/aicontent/pipeline-run/tools/asr-diff.py
```

- 2026-11-26T04:34:53.793035+00:00 | 0.509424 s | exit 0

```sh
python3 web/public/media/aicontent/pipeline-run/tools/validate-run.py
```

## Top 20 non-punctuation mismatches

Ranked by frequency; ties retain first appearance.

| Source | Transcript | Category | Count |
|---|---|---|---:|
| ∅ | 0. | number | 69 |
| ∅ | 1. | number | 28 |
| и | ∅ | other | 17 |
| ещё | еще | other | 8 |
| ∅ | 2 | number | 7 |
| ∅ | с | other | 7 |
| за | на | other | 7 |
| ∅ | на | other | 6 |
| а | ∅ | other | 6 |
| ∅ | отмечает | other | 6 |
| ∅ | просившим | other | 6 |
| ∅ | обычным | other | 6 |
| ∅ | кадром. | other | 6 |
| ∅ | 100- | number | 5 |
| ∅ | 188. | number | 5 |
| неё | нее | other | 4 |
| ∅ | в | other | 4 |
| в | ∅ | other | 4 |
| передаёт | передает | other | 3 |
| отвечает | отмечает | other | 3 |

## Inventory

All files and exact byte sizes are listed in ../pipeline-run-inventory.tsv after packaging. ZIP includes every kit file except talk.mp4 and itself; archive integrity and each member’s bytes are checked.

The plugin fetch step writes `01-source/audio.wav` (16 kHz mono WAV, about 40 MB) from `talk.mp4`; it is not stored in the repository or the ZIP and is recreated by the first command below.
