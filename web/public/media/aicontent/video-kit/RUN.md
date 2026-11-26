# Re-voice record

Run `python3 web/public/media/aicontent/video-kit/revoice.py` from the repository root.
Engine: Homebrew espeak-ng 1.52.0, `espeak-ng -v ru -s 160`; ffmpeg 8.1.1; Python 3.15.2.
GPL-3.0 covers the engine, not generated audio. No macOS System Voices are used (lead decision, macOS licence §2F). See LICENSE.txt.

The exact commands, measured wall times, line durations, narration anchors, and compressed video SHA-256 checks are in revoice-report.json.
Text comes unchanged from script.txt with only the numeric list prefixes removed.
Each line is padded with silence to its original 44100 Hz sample count; no speech is trimmed or accelerated.
Line durations remain 5.619002, 3.746009, and 5.512993 seconds.
Narration anchors remain 0/4/8 seconds in before.mp4 and 0.3/6.2/10.4 in after.mp4.
Both clips remain exactly 17.000000 seconds. Compressed video stream hashes match the original files.
The replacement audio is padded to 17 seconds. The original audio streams ended earlier; only trailing silence is added.
Both subtitle files remain unchanged because clip and padded line durations are unchanged.
