# How to reproduce the run

These instructions repeat the transcription and checks using the ready-made `talk.mp4`. You do not need to rebuild the talk: it is already included in the package, and its build commands are recorded in `RUN.md`. Run everything below on macOS or Linux in the directory where you extracted `pipeline-run-kit.zip`, with `talk.mp4` alongside it.

## 1. What to install

- Python 3.10 or later and ffmpeg.
- whisper.cpp: on macOS, `brew install whisper-cpp`; on Linux, build it following the project's instructions. The executable is called `whisper-cli`.
- The `ggml-large-v3-turbo.bin` model from the whisper.cpp repository on Hugging Face (about 1.6 GB). On a less powerful computer, `ggml-small.bin` is an option: it is faster but makes more mistakes, so your results will match our discrepancy table less closely.
- The video-to-article plugin: `git clone https://github.com/tym83/video-to-article`. We used commit `469f2c7`.

## 2. Audio for recognition

```bash
mkdir -p 01-source
ffmpeg -i talk.mp4 -ar 16000 -ac 1 01-source/audio.wav
```

The file is about 40 MB, so we left it out of the archive.

## 3. Transcription

```bash
whisper-cli -m ggml-large-v3-turbo.bin -f 01-source/audio.wav -l ru -osrt -otxt -of my-transcript
```

On a MacBook Air M4 with the large-v3-turbo model, this took about three minutes. Compare `my-transcript.txt` with our transcript, `02-transcript/transcript.txt`: a different model or version of whisper.cpp will produce slightly different wording. The hallucination at 2:51–3:08 may recur at the same point or appear elsewhere: the model produces such repetitions unpredictably, so every new transcript needs a fresh check.

## 4. Chunks and plugin checks

The plugin scripts operate on a run directory. To avoid overwriting our files, copy the kit to a separate directory and run these commands there. Replace the Russian placeholder `путь/к` below with the path to your plugin checkout:

```bash
P=путь/к/video-to-article/skills/video-to-article/scripts
python3 $P/chunk.py .
python3 $P/coverage.py . --mode clean
python3 $P/proofcheck.py 04-text/01.md --lang ru
```

`chunk.py` splits the transcript into chunks in `03-chunks/`. `coverage.py` compares each chunk's length with the text in `04-text/`: the accepted section, `01.md`, passes; the other seven are marked as missing because nobody has edited them yet. `proofcheck.py` looks for repetitions, typos and typography errors in the accepted section. The `proofcheck.md` file in the kit root records an earlier check of the raw transcript, `02-transcript/transcript.txt`, not of the accepted section: it has one finding, the repeated word "что что".

## 5. Your own editing

Take any chunk except `03-chunks/01_00-02-43_00-04-59.txt`, which we have already turned into the section `04-text/01.md`, for example `03-chunks/02_00-05-00_00-08-00.txt`. Files are numbered from zero, so the number in the name is one less than the chunk's position. Follow the same process we used:

1. Add your chunk's terms to the glossary, `05-review/glossary.md`.
2. Write a draft from the transcript alone.
3. Compare it with the speaker's text, `talk-source.txt`, and record every discrepancy in a table like `05-review/01-checks.md`.
4. Save the accepted text in `04-text/NN.md` and rerun `coverage.py` and `proofcheck.py`.

If your table has fewer than five rows, reread the chunk alongside the recording: almost every chunk of this talk contains distorted commands and numbers.
