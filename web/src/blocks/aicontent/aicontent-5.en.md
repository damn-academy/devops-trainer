<!-- lesson: aicontent.bots | Community bots and games: a chat tournament as content | 20 -->
<!-- section: hook -->
KUBER KOMBAT began as a playful tournament in a community chat: participants vote in battles, each with a matchup card and a short eight-bit-style video. Over three seasons it became a system of scripts, videos, a bot, polls and a publishing schedule; in the latest season, questions analysing real incidents replaced calculation problems. The first tournament produced 120 matchup cards, and an accelerated full tournament run took 18 minutes for 15 battles. This lesson examines making such game formats with AI: what a season contains, how the bot works and how to check everything before participants see the first message.

<!-- section: theory | A season as one system -->
A community game format is a system with a script and state, rather than a collection of posts. Season production followed this order: concept; questions and explanations; video scripts; synthesised lines and subtitles; rendering; publishing schedule; checks of voting and state recovery after failure. Videos used the same method as the cartoon in the video lesson: synthesised lines, mouths moving with the voice's amplitude envelope, different pitches for different characters and eight-bit audio processing.

The editor intervened in game content just as in an article. They rejected the calculation questions AI proposed for season three: they are boring to solve in chat, and the answer depends on who calculates fastest. Short cases with precise incident descriptions and video briefings replaced them. The rules must be explainable in a minute: elaborate bonuses and multipliers, which AI readily adds, obscure how to win.

<!-- section: theory | The bot as a stateful program -->
The tournament bot publishes battles, accepts votes, calculates results and advances to the next battle. Its most important component is state: if the bot restarts mid-season or you replace one video's text, the tournament must resume from the same place. The transferable idea is simple: bot code, media and tournament state are stored separately, so replacing text or video does not reset scores. In a typical bot, this means code lives in a repository, videos in a folder or file storage, and state in a database or at least a separate spreadsheet. In our tournament, the bot ran in an unusual environment: the author's experimental layer on top of Google Sheets and Apps Script that simulates Kubernetes containers and volumes. You do not need to recreate it to apply the same idea.

A separate script exports season text and media into one `season.json` file, preserving them byte for byte as the editor approved them. This prevents a common error: AI “improving” an already approved line while editing the bot's code.

<!-- section: theory | Test the entire season before launch -->
Do not test the bot in a live chat. A test with a fake Telegram API accelerates time, runs the entire season, checks vote counting and text against approved versions, and verifies that the bot cannot send a message to the main chat during the test. Only after this run is the tournament launched in the community.

Bot work invites endless trials: start it, look, fix a small detail, ask a person to check manually, start again. In our projects, the editor stopped this with a rule: incorporate each trial's result into the implementation immediately, and test the entire target scenario. Trials for their own sake do not bring launch closer.

<!-- section: theory | Environment-specific behaviour -->
Every bot environment has traps worth recording. Here are the traps of ordinary Apps Script, without the extra layer: in Apps Script, `ContentService` returned a 302 response to Telegram's webhook, causing Telegram to retry delivery; `HtmlService.createHtmlOutput('ok')` returned 200, while duplicates still had to be filtered separately. The script needs user permission to access spreadsheets and external addresses, and Apps Script did not always detect the required permissions itself; they had to be listed manually in the project settings file (manifest). Creating an asynchronous function through a constructor did not work, so the bot processed each command to completion before responding, without deferred operations. Record such findings in the lead AI's memory so the next bot does not repeat the same mistakes.

<!-- section: theory | Platform rules and boundaries -->
A community chat bot operates under the platform's and chat's rules. Automated unsolicited messages and impersonating people violate most platforms' rules, and X prohibits unauthorised account automation. A game bot that participants voluntarily add to their chat and vote in is a different matter. Participants' personal data and message contents are not published in material about the tournament.

<!-- quiz -->
? An AI fixed a bot bug and also changed an already approved line. How can this be prevented?
+ Keep approved text separate from code and export it byte for byte || When text lives in a separate file, code edits do not touch it.
- Prohibit AI from touching the bot's code || This removes the pipeline's speed; separating text from code is enough.
- Reread every season line after each bot code change before launching the tournament || This is slow and unreliable; file separation prevents the problem.
? How should you test a tournament bot before launching it in the community?
+ Run the whole season with accelerated time and a fake platform API || This checks votes, text and protection against sending to the main chat.
- Start it in the main chat at night when few participants are around and watch the first battles || Participants will see errors, and fixes will have to happen live.
- Ask AI to read the code and confirm that there are no errors || Reading code does not replace running the whole scenario.
<!-- /quiz -->

<!-- section: task | Task: a game format for your community -->
Complete the task in the document on this page. Invent a game format for your community: a tournament, quiz or incident analysis. Write rules that can be explained in a minute, one season's scenario, what AI generates and the editor approves, where text and state live, how you will test the whole season before launch and which platform and chat rules you must follow.

<!-- section: sources -->
- Telegram Bot API — https://core.telegram.org/bots/api (checked 25.11.2026)
- Google Apps Script, ContentService and HtmlService — https://developers.google.com/apps-script/guides/content (checked 25.11.2026)
- X, authenticity and automation rules — https://help.x.com/en/rules-and-policies/authenticity (04.2025)

<!-- lesson: aicontent.interactive | Interactive material: longreads, courses and simulators | 26 -->
<!-- section: hook -->
Our most labour-intensive AI projects were interactive: music longreads in the Sankofa museum, where scenes come alive on scroll; a horizontal horse-racing story in the Dormer feature; and the damn.academy learning platform with diagrams, trainers and department simulators. One longread has 16 scenes and 52 art layers, the racing story has 140 graphics files, and the platform accumulated nearly four hundred commits in eight days. This lesson examines their production, from storyboard to browser acceptance review.

<!-- section: theory | The longread workflow -->
Interactive longread work followed this order: source research; independent fact-checking; a storyboard by the lead AI; Russian prose; an illustrator brief; layer generation; scene assembly; proofreading; browser checks; critic rounds; release. The editor saw the storyboard before anything was drawn or programmed: revising a storyboard is cheaper than reworking a finished scene. Each scene was judged both on narrative clarity and how it worked.

Each longread has its own mechanics on a shared engine. In one, a song's rhythm plays through WebAudio while its chain of versions unfolds interactively. In another, eleven album tracks receive their own imagery, with visual distortions increasing chapter by chapter. In the horizontal racing story, the page pauses while a chapter is read; the pause length depends on measured text height, and distance is recalculated when the window, fonts or expanded sources change. The artistic horse trajectories are not presented as an exact reconstruction of the race.

<!-- section: theory | Rules for interactivity -->
Editorial feedback produced rules for interactive material. A feature gets a separate page with its own URL, not an overlay on the site. A glossary card opens over the current scene, closes without losing the reading position and does not interrupt audio. On phones, the illustration appears full-screen first and text moves over it later. Borders around text are replaced with a soft, borderless backing, while administrative warnings such as “this page has sound” are removed: the interface, rather than disclaimers, should make things clear. Scrolling backward returns the same text; reduced-motion mode and the version without JavaScript provide the full article.

Working material—briefs, scans, researchers' notes and letters—is not published with the result. Only what the finished page needs goes into the public repository; research remains local.

<!-- section: theory | Browser acceptance review -->
Interactive material is checked in a browser at several widths, scrolling forward and backward, returning to a reading position, switching languages, using audio and exercising loading states. The racing story's second-round acceptance report counted 12 unit tests, 30 browser checks and 127 screenshots across three screen sizes and nine narrative stops. Checks found a horizontal page shift when following an anchor, a one-pixel frame mismatch and a race between delayed startup and table-of-contents navigation. The report also listed what had not been tested: real phones, WebKit and Firefox, and live YouTube playback.

A worker takes screenshots with a Playwright script, and the lead AI inspects them for things tests miss: an icon silhouette overlapping text, an empty half of a large card, an arrow stuck to a word. The platform catalogue went through four screenshot rounds in light and dark themes at widths of 1440 and 390 pixels before the editor accepted it.

<!-- section: theory | Learning courses -->
The learning platform is our largest interactive project, and its production is covered in a separate article. Here are the practices transferable to any learning material. Start with role-based design and cross-reviews, then reference lessons that guide the rest. Use a style guide and linters. Create six fictional learners per course and revise from their reports. Research fresh sources before every course. Make diagrams learners can manipulate and break, and tasks that check the outcome of work rather than comparing typed text with a sample.

<!-- section: theory | A simulator hosted by AI -->
For the platform's business courses, we built department simulators: a quarter in marketing, a week of PR crisis, a year of a project in the CNCF incubator. The learner's AI hosts the simulator, while the platform assembles one large prompt from shared game rules, a world description with hidden circumstances, the company the learner built in a configurator and the department scenario. Learners can play on the page using their own AI key or copy the prompt into any chat.

The main difficulty is that AI indulges the player and produces optimistic outcomes. To counter this, the platform generates a table of 400 random numbers from a recorded seed, and the host must consume them in order and state which it used. An outcome depends on decision quality, buyer fit, competitors, market conditions and hidden circumstances that may or may not emerge. After each turn, the host records game state in a separate block so play can resume. The first trainers were deterministic calculators, and the editor sent them back: in real life, the same decision can have different outcomes.

<!-- quiz -->
? When should the editor see an interactive longread's storyboard?
+ Before drawing layers and programming scenes, so revisions are inexpensive || Revising a storyboard is cheaper than reworking a finished scene.
- After the first scene is assembled, so there is something to show || If the storyboard is wrong, the assembled scene will have to be discarded.
- At the end, with the whole longread, to avoid distracting the editor with intermediate versions || Late storyboard revisions are the most expensive.
? An AI simulator host almost always gives the player successful outcomes. How can this be fixed?
+ Give the host pre-generated random numbers it must consume in order || A roll table with a recorded seed prevents the model from substituting optimism for randomness.
- Add a request to be stricter and punish the player more often for poor decisions || Models follow such requests inconsistently; external randomness is needed.
- Replace AI with a calculator giving fixed outcomes for every player decision || This removes the different outcomes of one decision that make the simulator useful.
<!-- /quiz -->


Below is an actual simulator from the PR course: a week of crisis. You do not need an AI key to try it: choose a company and difficulty, click “Copy prompt” or “Download prompt” and paste the text into any AI chat. The host will describe Monday morning and two stories that have landed on the press team's desk, then ask what you do. After each turn, it records the game state so you can resume another day.

![Simulator screen: company selection, difficulty, number of turns, and buttons to copy and download the prompt](media/aicontent/sim.jpg "The simulator before the game starts")

<!-- widget: deptsim {"scenario":"pr.crisis"} -->

<!-- section: task | Task: storyboard one interactive piece -->
Complete the task in the document on this page. Choose a topic for interactive material: a longread, a lesson with a diagram or a simulator. Create a storyboard of five to seven scenes: what the reader sees, what they do, what changes and what text accompanies the scene. For each, record which facts you need and from where, which illustrations you will make and how, and how you will check the scene in a browser on a phone and a computer.

<!-- section: sources -->
- Sankofa museum — https://sankofa.black (checked 25.11.2026)
- damn.academy — https://damn.academy (checked 25.11.2026)
- Playwright — https://playwright.dev/docs/intro (checked 25.11.2026)
- MDN, ResizeObserver — https://developer.mozilla.org/docs/Web/API/ResizeObserver (checked 25.11.2026)
- MDN, Web Audio API — https://developer.mozilla.org/docs/Web/API/Web_Audio_API (checked 25.11.2026)
