<!-- lesson: aicontent.video | Video and audio: intros, animation, podcasts and voice | 26 -->
<!-- section: hook -->
We assembled a short cartoon with two speaking characters without a single hand-drawn frame. A program synthesised their lines in two voices, built a timeline from their actual durations, drew the scene on Canvas and captured it with Playwright as MP4. Podcast intros and battle videos for a chatbot were made the same way, while a podcast recording was once lost entirely because the program recorded digital silence despite a working microphone. This lesson covers video and audio production with AI and code: what to generate, what to render from code, how to work with voice and which checks prevent a broken video from being published.

<!-- section: theory | Video from code -->
The most reliable way to make repeatable video is to draw it in code. A scene is described on Canvas in an HTML page, Playwright plays it and captures frames, and ffmpeg joins them and adds audio. The cartoon pipeline worked as follows: `build.py` synthesises lines, measures their duration and writes `timeline.js` and the combined `audio.wav`; `scene.html` draws characters according to the timeline; `render.js` captures it as MP4. Piper supplied two voices, and drawing functions came from the podcast graphics kit.

A useful technique is to build the timeline from actual audio duration: a synthesised line almost never lasts as long as the scriptwriter expected, and fitting the visuals to the audio makes lips and subtitles align automatically. A second technique is to render individual frames first, such as frames five and forty, and inspect them before starting a lengthy full render. In the chatbot's battle videos, a character's mouth moved with the voice's amplitude envelope, different characters had different voice pitches, and audio received eight-bit processing to match the visual style.

<!-- section: theory | Video generators -->
Generative video models in 2026 change faster than people can document them. OpenAI closed the Sora 2 and Sora 2 Pro APIs on September 24, 2026, without a direct replacement, so a pipeline can no longer be built on them. Google's Veo 3.1 costs 40 cents per second of video with audio in Cloudflare's catalogue; Runway's Standard plan at $15 per month provides 625 credits, which the service equates to roughly 52 seconds of Gen-4.5 generation; Pika's $10 Starter plan provides 600 credits, with a five-second 720p clip costing 20. HeyGen and Synthesia provide avatars and dubbing.

Measure cost per accepted second: all generations and retries divided by the seconds remaining after the editor selects usable footage. Avatars require consent to use a person's likeness; translation requires terminology checks by a native speaker; advertising requires watching the complete version with audio and subtitles. Generative video works well for backgrounds, cutaways and illustrations, but real screen recordings remain better for explaining how a product works.

<!-- section: theory | Voice and music -->
Speech synthesis has become inexpensive: ElevenLabs' $6 monthly Starter plan includes a commercial licence and instant voice cloning, while Creator at $22 includes professional cloning. OpenAI's `tts-1` and `gpt-4o-mini-tts` models have been deprecated with shutdown scheduled for January 6, 2027, and their replacement uses a different interface. Open models such as Piper suit local work. Disclose a synthetic voice to listeners; cloning another person's voice requires consent covering specific languages, channels, duration and advertising. Consent to record an interview does not mean consent to synthesise new lines in that voice.

Music requires more care. Suno and Udio reached agreements with some labels in 2025, but disputes with others continue; Udio had disabled audio downloads as of early 2026, and paid commercial rights in service terms do not amount to copyright registration. For a commercial video, check the particular track's licence separately from the model's name.

<!-- section: theory | Podcasts: from recording to show notes -->
Each weekly Kubernetes Community Podcast episode was assembled from several automated components. A news digest gathers candidates from RSS and releases, normalises links, removes duplicates and noise, ranks material by a formula, and produces a full version of up to a hundred links, a short fifteen-item version and a rejection log. The quality threshold is not lowered to reach a hundred; the rejection log helps reveal when a regex error silently discards an entire source. After recording, the audio becomes a transcript, timestamps and a YouTube description.

News collection has its own traps. Feeds can return status 200 without data, so check the number of parsed entries as well as the response status. Dates without time zones silently fall outside the time window. One Habr article arrives under several URLs, which are normalised by article number. Some sites block datacentre requests or return 429 to parallel requests, so an empty collection does not mean there is no news.

<!-- section: theory | Recording and checking audio -->
Missing audio is the most frustrating video and podcast failure. Once, camera-recording software captured digital silence despite a working microphone: the mixer's master output was disabled. Since then, a five-second test precedes every long recording, with volume checked using `ffmpeg -i test.mov -af volumedetect -f null -`. The same rule applies to all renders: a process ending without errors does not mean the file contains what it should. A Canvas error may appear inside the frame, and audio may be absent despite a successful render, so watch and listen to the final video.

<!-- quiz -->
? A synthesised line is a second and a half longer than scripted. How do you prevent lips and subtitles falling out of sync?
+ Build the timeline from the actual duration of the synthesised audio, not from the script || Fitting the visuals to the real audio makes lips and subtitles align automatically.
- Speed up the line in an audio editor to the duration specified in the video script || Accelerated speech sounds unnatural, and the next line will drift again.
- Shorten the line and synthesise it repeatedly until its duration matches the script || This slow trial and error damages the script; adjusting the visuals is easier.
? A video render finished without errors. What should happen before publication?
+ Watch and listen to the entire final file, from the first second to the last || A successful process does not guarantee there is no Canvas error in the frame or that the file contains audio.
- Nothing, because render errors always appear in program output and stop execution || An error may appear in the picture without any output message.
- Check the file size: if it is larger than expected, audio and visuals are present || File size says nothing about frame contents.
<!-- /quiz -->

<!-- section: task | Task: a pipeline for one video -->
Complete the task in the document on this page. Describe the pipeline for one recurring video your team produces: an intro, product-release video or podcast episode. For each step, record what AI generates, what code renders, what is recorded live and what a human checks. Separately list three checks you will perform before publication and the cost per accepted second or minute of your last video.

<!-- section: sources -->
- OpenAI, Sora 2 Pro model card and API closure — https://developers.openai.com/api/docs/models/sora-2-pro (checked 25.11.2026)
- Cloudflare, Veo 3.1 — https://developers.cloudflare.com/ai/models/google/veo-3.1/ (checked 25.11.2026)
- Runway, pricing — https://runway.com/pricing (checked 25.11.2026)
- Pika, pricing — https://pika.art/pricing (28.10.2026)
- ElevenLabs, pricing — https://elevenlabs.io/pricing (checked 25.11.2026)
- OpenAI, text to speech — https://developers.openai.com/api/docs/guides/text-to-speech (checked 25.11.2026)
- Piper — https://github.com/rhasspy/piper (checked 25.11.2026)
- Udio, changes following the UMG agreement — https://help.udio.com/en/articles/12683565-changes-associated-with-the-universal-music-group-umg-partnership (17.02.2026)
- FFmpeg, volumedetect filter — https://ffmpeg.org/ffmpeg-filters.html#volumedetect (checked 25.11.2026)

<!-- lesson: aicontent.video-to-article | From video to article, and translating a long text | 22 -->
<!-- section: hook -->
A conference talk lives on in a recording watched by a few hundred people, while an article based on it can be found through search for years. Turning a recording into a good article takes time: transcription, removing repetition, reconstructing the logic, finding frames and checking facts. We packaged this process into an open-source Claude Code plugin, then applied it to translating a sixty-thousand-character scientific article. This lesson examines the pipeline's stages, the roles it needs and the checks that prevent meaning from being lost.

<!-- section: theory | Fifteen stages -->
The video-to-article plugin follows fifteen stages numbered zero through fourteen: environment check; obtaining a file from a link or disk; identifying language and task; transcription; gathering context and a glossary; splitting into fragments and processing them; assembly; fact-checking; literary editing and repeat fact-checking; proofreading; optional search optimisation; headline alternatives; extracting frames; final article; delivery to the chosen channel. Scripts handle downloading, transcription, splitting, frames, completeness checks and Habr export; Whisper transcribes, using `large-v3` by default and `large-v3-turbo` for long recordings.

Ten roles work on the text, each with one task. One gathers context and a terminology glossary. Another writes fragments: each fragment author receives the previous fragment only as context, the shared glossary and editorial rules, and an overly short result is sent back for reprocessing. A third assembles the article, a fourth checks facts, a fifth edits language, a sixth proofreads, a seventh offers five headlines for the editor to choose from, and the remaining roles handle search optimisation, final assembly and publication.

<!-- section: theory | Barriers to errors -->
The pipeline is designed to stop errors passing unnoticed. After assembly, blocking fact-checker comments are addressed for at most three rounds; anything unresolved goes to the editor. After literary editing, the fact-checker checks the version diff again to ensure style has not changed facts, negations or modality. Frames are checked for blur, closed eyes and black screens. Passages marked `[VERIFY]` must not silently become assertions. Edits proceed by section without regenerating the entire article, and all intermediate files are saved so an error can be traced to the stage that introduced it.

Delivery to a site ends with a CMS draft or a prepared change request; the editor retains the publication decision.

<!-- section: theory | Translating a scientific article -->
We applied the same pipeline to a Russian translation of the scientific article Keeping CALM. First we prepared the written source and a shared terminology glossary, then translated 28 fragments, checked completeness, assembled the text without rearranging the author's argument, compared it with the source, performed literary editing, a repeat fact-check of the diff, proofreading, Habr export and separate terminology and style checks. The final file contained 60,000 characters.

Quantitative checks showed that the translated fragments were 7% longer in total than the originals, with each of the 28 within the allowed range, so major omissions are unlikely; this check does not catch distortions of meaning. Fact-checking preserved the sequence of all 48 citations, 48 bibliography entries, 30 formulas and the footnotes. “Ready to publish” meant no blocking errors remained, but there were still 2 major issues, 8 minor ones and 5 nitpicks for the editor to address.

The errors found are instructive. A missing blank line after a quotation caused Markdown to attribute the next paragraph to the quoted author. Attribution and licence information for the original were missing. Literary editing turned “can help” into an unqualified statement and “often” into “increasingly often”. Applied to written text, the video pipeline left fake timestamps that had to be removed during assembly. Proofreading automatically inserted 675 non-breaking spaces, while a script compared formulas, links and image paths byte for byte before and after.

<!-- section: theory | Repeating the pipeline with your own recording -->
The pipeline is published as the open-source video-to-article plugin for Claude Code, and you can run it on your own recording in an evening. You need Claude Code with a subscription, ffmpeg and Python 3.10 or newer; the plugin offers to install the remaining packages, including Whisper for transcription, in a separate environment. Install the plugin with two commands in Claude Code: `/plugin marketplace add tym83/video-to-article` and `/plugin install video-to-article@video-to-article`.

For the first run, choose a short recording you have rights to: your own talk or a Creative Commons video, which you can find using the licence filter in YouTube search. Run `/video-to-article` followed by a video link or file path. The plugin asks for the article language, number of illustrations and publication platform, then creates a folder where each stage leaves its own file: the source video and audio, a timestamped transcript, context with a glossary and recognition pitfalls, 2,500-character fragments, processed text for each fragment, the assembled article, a completeness report with length ratios for each fragment, a fact-checker's report, a literary edit with a change log and repeat fact-check, proofreading, five headline options, frames and the final article.

The plugin stops twice for a human decision: after fact-checking and when choosing a headline. On the first run, check three things: whether the completeness report has fragments with ratios substantially below one, what the fact-checker marked FAIL and how it was fixed, and whether literary editing changed any numbers. If any of these went wrong, that is material for your task.

<!-- section: theory | When this pipeline is unnecessary -->
Fifteen stages and ten roles pay off for long recordings and texts intended to last. A short post based on video needs only transcription, one draft and a read-through. At release, the plugin passed 28 regression tests, but a complete run on a real long video was still the next step, so releasing the tool did not prove it could produce finished articles without an editor. This applies to any pipeline: testing the mechanics does not replace checking results on real material.

<!-- quiz -->
? After literary editing of a talk-based article, “this approach may help” became “this approach helps”. Which pipeline stage should catch it?
+ The repeat fact-check of the version diff that follows literary editing || Style changes modality, and only a version comparison finds this.
- Proofreading, because it reads the whole text || Proofreading checks spelling and typography, not meaning.
- Headline selection, because the editor reads the whole article when choosing an option || Selecting a headline does not include checking every sentence's meaning.
? The translated fragments are 7% longer in total than the originals. What does this tell you?
+ There are probably no major omissions, but meaning and fragment completeness must be checked separately || Completeness checks catch omissions, not distortions.
- The translation is wordy and needs cutting by 7% to restore the original's precision || Russian text is usually longer than English; this does not indicate wordiness.
- The translation is accurate because the difference is under ten percent and within the norm || Length does not prove accuracy of meaning.
<!-- /quiz -->

<!-- section: task | Task: an article from a recording -->
Complete the task in the document on this page. Choose a recording of one of your talks, webinars or interviews lasting at least twenty minutes. Map out its conversion into an article: which stages you will retain or combine, who owns facts and who owns language, which checks the text will pass and where the editor decides. Then run the recording through the plugin or manually produce a transcript and first draft of one section, and record what needed fixing.

<!-- section: sources -->
- video-to-article, open-source Claude Code plugin — https://github.com/tym83/video-to-article (checked 25.11.2026)
- Whisper — https://github.com/openai/whisper (checked 25.11.2026)
- AssemblyAI, transcription pricing — https://www.assemblyai.com/pricing/ (checked 25.11.2026)
- Deepgram, pricing — https://deepgram.com/pricing (checked 25.11.2026)
- Descript, pricing — https://www.descript.com/pricing (checked 25.11.2026)
