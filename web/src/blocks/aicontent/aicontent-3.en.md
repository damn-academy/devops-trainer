<!-- lesson: aicontent.checks | Checks: fact-checkers, role-based reviewers, fictional readers and a critic | 26 -->
<!-- section: hook -->
The platform's eight business courses passed every automated check: tests, the style linter and concept-order validation. Then a worker went through them as 48 fictional learners and found 22 defects that would make at least one of them abandon a course. These included an incorrect prioritisation formula, contradictory advice on when to contact a customer again after a refusal, and quizzes where the correct answer was almost always the longest. This lesson examines checks that find what neither the author nor a linter notices, and how to organise them with AI.

<!-- section: theory | Author and reviewer are separate roles -->
The author is the worst person to spot errors in their own text, and this is as true of AI as of humans: it tends to confirm its own wording. Our pipelines therefore use a separate worker as fact-checker. In the video-to-article plugin, the fact-checker receives the article and source, writes a report with a quotation, source and severity for each issue, and does not edit the text. Severity has levels: a blocking error prevents release, a major one requires revision, and minor issues and nitpicks are left to the editor. After assembly, at most three rounds of blocking-error fixes are allowed; unresolved issues then go to the editor.

The worker marks uncertain passages with `[VERIFY]`; silently turning such a marker into a claim is forbidden. This simple rule prevents the most unpleasant error: an AI assumption passing through every stage and emerging in publication as fact.

<!-- section: theory | Role-based reviewers -->
For technical articles, we assembled a panel of reviewers with distinct tasks. Five workers checked an article about a Kubernetes distribution using 1C terminology: facts, 1C terms, Kubernetes terms, style and proofreading. Articles about forgotten operating systems were checked for experimental methods, facts, infrastructure, history and voice. These are not five confirmations of one fact but five different checks: the 1C terminology reviewer does not check history, and the historian does not check style.

The same technique worked before writing. The platform design was split into ten role-specific documents, each read by two other roles: Linux through the eyes of a learning designer and a container specialist, networking through Kubernetes and multimedia specialists. Twenty reviews found gaps the document authors had missed, and many platform decisions grew out of them.

<!-- section: theory | Fictional readers -->
Fictional readers proved the most useful technique. We invented six people for each course: two beginners, two practitioners and two experienced learners. Each has a life story, study schedule and behavioural mechanisms: an attention budget per session, an irritation counter with a dropout threshold, reasons to return or skip a session, habits when stuck, reading style and reactions to errors. A literature teacher hates bureaucratic wording and condescending “this is very simple”; a former salesperson hates three screens of theory without an action; a finance director hates outdated tax rules.

The worker opens the built site in a real browser and takes the course as each person: reading pages, trying trainers, switching to phone width if that character studies on a phone, and logging every event. The report shows the day and duration of each session, where attention ran out, which phrase raised irritation and by how much, where the learner got stuck and what they did, and where they left. It ends with a consolidated defect list: blockers that caused someone to quit, major and minor defects, each with a lesson, exact quotation and suggested fix.

A report for one course runs to 40,000–95,000 characters, and need not be read in full: address blockers first, then major issues. After fixes, the characters take the course again to check that improving the beginner's path has not worsened the experienced learner's. This is behaviour modelling and must not be presented as research with real people. But it finds defects before the course reaches real people; we have not compared its timing with live testing.

<!-- section: theory | A critic for interactive material -->
Interactive longreads in the Sankofa museum went through a cycle: content and interface revisions, build and deployment, automated browser tests, then another review by the critic. The project log contains at least fifteen numbered critic rounds. In round twelve, the web worker received 31 comments; round fourteen was still rated “almost”; round fifteen found that the page security policy blocked embedded YouTube, media loaded slowly and narrative connections broke. The critic views the material as a reader would: is the story clear, does the scene work, does the interface get in the way?

The number of rounds and tests proves nothing by itself. Our project logs contain repeated editorial rejections after every check passed. Checks reduce the number of rounds with the editor but do not replace them.

<!-- section: theory | Mechanical checks worth automating -->
Some checks can be delegated to scripts, and in our projects they paid for themselves many times over. Completeness checks for translations or retellings of long sources compare each fragment's length with the original: in a scientific article translation, the translated-to-original ratio was 1.07, and each of 28 fragments fell within the allowed range. This signals that there are probably no major omissions, but is not proof: an omission in one place can be hidden by verbosity elsewhere, so meaning must be checked separately. Proofreading automatically inserted 675 non-breaking spaces, while a script compared formulas, links and image paths byte for byte before and after to ensure typography had not damaged them.

A quiz test found that 37 of 39 marketing-course questions could be answered by picking the longest option: AI elaborates on the correct answer more than the distractors because it tries to explain. After revision, the correct answer was longest in ten of seventy-three questions, and the test stayed in the repository to prevent the bias returning. This is how a one-off finding becomes a permanent check.

<!-- section: theory | AI-text detectors -->
AI-text detectors are unsuitable for quality checks. OpenAI withdrew its classifier in 2023: on the published dataset it recognised 26% of AI texts and wrongly flagged 9% of human texts. Liang and colleagues found that detectors more often flag writing by non-native English speakers, while simple rephrasing can bypass them. Separate three checks: where the text came from, whether a claim matches its source, and whether the source itself is correct. A detector performs none of them.

<!-- quiz -->
? Why does the fact-checker in an article pipeline only write a report and not edit the text?
- Because the fact-checker uses a weaker model that cannot be trusted with style editing || It is about role separation, not model strength.
+ An author tends to confirm their own wording, while a fact-checker should check rather than rewrite || Separating roles prevents the checker from quietly introducing new errors and leaves decisions to the editor.
- Because editing costs more while a report costs less for the same benefit to the article || Cost is not the main point; independent checking is.
? A worker took a course as six fictional learners and found two blockers. How should the team report describe this check?
+ As modelling learner behaviour to find defects before testing with real people || Personas are a model, not research with real people, and must not be presented as a user survey.
- As user research on six respondents that can replace interviews with real learners || There were no respondents; this is modelling.
- As an automated test that guarantees learners will not drop out after the fixes || A model gives no guarantees; it reduces risk.
<!-- /quiz -->

<!-- section: task | Task: six readers for your material -->
Complete the task in the document on this page. Invent six readers for one piece of your content: two beginners, two practitioners and two experienced readers. For each, record what they know, how and when they read, what irritates them, when they will quit, what keeps them engaged and what they check in the material. Then go through it as the two most different readers, yourself or with AI, and record where each would stop and why.

<!-- section: sources -->
- OpenAI, AI-text classifier and its withdrawal — https://openai.com/index/new-ai-classifier-for-indicating-ai-written-text/ (20.07.2023)
- Liang et al. GPT detectors are biased against non-native English writers — https://arxiv.org/abs/2304.02819 (10.07.2023)
- EBU, BBC. News Integrity in AI Assistants — https://www.ebu.ch/Report/MIS-BBC/NI_AI_2025.pdf (10.2025)

<!-- lesson: aicontent.visuals | Illustrations: real captures, graphics from code and generative layers | 26 -->
<!-- section: hook -->
For a technical article, the editor asked for console and interface captures from the test environment but received eight tidy SVG diagrams the AI had drawn itself. They looked good and proved nothing: a technical reader wants to see that the command ran and produced that output. This led to a rule: capture real actions for technical articles. This lesson covers three ways to create illustrations with AI—documentary captures, graphics drawn by code and generative illustrations—and explains when each fits.

<!-- section: theory | Documentary captures -->
A documentary illustration confirms an action happened: an interface screenshot, command output or terminal recording. We had an established terminal pipeline. First, write a demonstration script that only reads state and changes nothing. Then `asciinema rec -c` records its execution, a separate step adjusts pauses for smooth viewing, and `agg` converts it to a GIF. Capture interfaces in a real browser using a Chrome extension or Playwright. If output is slowed for readability, disclose it in the caption.

The main rule is to collect captures during the work, while the environment is still running. By the time the article is written, useful states may be gone: the cluster rebuilt, the error fixed. After every significant step, save a screenshot, log or GIF; after checks, create an inventory linking every file to a future article section, with provenance, caption and privacy check. In the article about moving a chatbot to Google Sheets, the browser window was too small to capture the whole sheet, so the screenshot was assembled from fragments with exact offsets; the inventory discloses this and the original fragments are retained. Blur or remove personal data: in the same article, chat screenshots were removed at the editor's request.

<!-- section: theory | Graphics drawn by code -->
The second method uses program-generated graphics. For Kubernetes Community Podcast, a graphics kit is drawn on Canvas: letters are specified by coordinates, objects drawn in code, Playwright captures frames and ffmpeg assembles video. One set of sources produces thirteen formats, from a 3000×3000 square cover to a 1280×720 thumbnail and stories, plus a seventeen-second intro: ten seconds of objects and seven seconds of titles. Participant photos are selected automatically: MediaPipe searches the recording for faces and smiles every two seconds, a script selects sharp frames at least forty seconds apart, and rembg removes backgrounds.

The advantage is reproducibility: after two diverging generator copies were merged, the combined kit reproduced episode five's published cover pixel for pixel. The disadvantage is that a Canvas error may appear in the picture even though the script succeeds. Before a full render, run a short twenty-frame pass and inspect it visually: episode number, every letter, cropping, small-thumbnail legibility and final titles. Once, we discovered the episode number was not inserted into every scene, and changing the colour file did not recolour the graphics because colours were hard-coded in the Canvas sources.

The same approach works for blog covers: a script assembles HTML and SVG and captures them with headless Chrome, alternating motifs by date. This produced sixty covers for old company blog posts in one run.

<!-- section: theory | Generative illustrations in layers -->
The third method uses a generative model to draw illustrations. For interactive longreads with figures moving on scroll, the first attempt was to draw the entire scene and then cut figures out into separate layers. Movement exposed holes in the background, the figures were cropped, and patches did not fix it. The editor changed the production method itself. First draw a complete background without moving objects, then each complete figure on a transparent layer with margins of at least eight percent of canvas height, then assemble the layers into a reference composition, and only then animate them on the page. This is an example of fixing the brief instead of generating the same image again.

An illustration brief should specify palette, aspect ratio and dimensions, scene list, layers and their movement, filename rules and a contact sheet showing all results together. On a phone, show the illustration full-screen first and let text move over it later; otherwise text hides the scene before viewers have time to see it.

This is what the result looks like in the Sankofa museum's published longread about the recording of Sea Lion Woman. On a computer, text runs down the left while the scene on the right changes as you scroll: a house, a truck carrying recording equipment, a circle of children. Each scene is assembled from a background and separate figures, so movement leaves no holes in the background.

![The longread's first scene on a computer: text on the left, a drawing of a house on the right](media/aicontent/slg-1.jpg "Sea Lion Girls longread, first scene at a width of 1280 pixels")

![The truck scene with a place label on the map](media/aicontent/slg-3.jpg "The same article further down the page: a new scene has replaced the previous one, with the place label drawn on a separate layer")

On a phone, the order is different: the whole scene appears first, and only then does text move over it.

![A circle of children on a phone screen, with a paragraph of text below](media/aicontent/slg-m.jpg "The same longread at a width of 390 pixels")

<!-- section: theory | Diagrams and interactive explanations -->
Interactive diagrams explaining a process step by step are a separate illustration type. Feedback on platform diagrams produced rules useful for static diagrams too. Begin with a familiar situation and three to five elements, one idea per step. An arrow alone explains nothing: highlight the active element, pass the result as a visible object and label the action. Every line and icon explains itself with a label, and a click opens a card; there is no separate legend. Elements stay in place from the first step rather than jumping, labels remain long enough to read, and the diagram fits on screen.

Here is how this looks in the learning platform's diagram tracing a request from the browser to the database in 18 steps. Step controls and a scale labelled with the stages sit at the top; the active element is highlighted in the centre with an action label, and clicking any element opens an explanation card.

![Interactive diagram: step controls, stage scale, and a Browser element with an action label](media/aicontent/schema.jpg "The Path of a Website Request diagram on damn.academy, step one of eighteen")

<!-- section: theory | Rights to illustrations -->
A generative illustration does not automatically confer exclusive copyright. The U.S. Copyright Office's 2025 report says protection covers human contributions: creative selection, arrangement and transformation of AI material, while text prompts alone are generally insufficient. Service terms such as “you own the output” do not replace legal requirements. For a commercial illustration, keep four records: rights to source material, service terms on the generation date, consent from depicted people and the history of human work on the image. Recordings and videos downloaded for research do not become publishable media: use official embeds on the site.

<!-- quiz -->
? A technical article about a new command needs to show how it works. What should you choose?
- A tidy SVG diagram that shows the command's steps more clearly than terminal output does || A diagram does not prove the command works; technical readers need real output.
+ A terminal recording of the command actually running, converted to a GIF animation || A documentary recording confirms the command ran and produced that output.
- A generated terminal illustration in the brand style || Generated “output” presents fiction as fact.
? Scrolling a longread reveals a hole in the background beneath a moving figure. What should change?
+ Draw the background without figures and each complete figure on its own transparent layer || Cutting figures from a combined image leaves holes; patches do not fix this.
- Regenerate the scene at a higher resolution || Resolution does not fill the hole behind the figure.
- Paint over the hole in an image editor after generation || This patch breaks at a different offset.
<!-- /quiz -->

<!-- section: task | Task: an article's media inventory -->
Complete the task in the document on this page. Choose an article you are preparing and make a media inventory: for every place needing an illustration, choose a documentary capture, graphics from code or a generative illustration, and explain why. For each file, record where it will come from, its section, caption, format, what must be hidden for privacy and what rights you hold.

<!-- section: sources -->
- asciinema — https://asciinema.org/ (checked 25.11.2026)
- agg, GIF generator for asciinema recordings — https://github.com/asciinema/agg (checked 25.11.2026)
- Playwright — https://playwright.dev/docs/intro (checked 25.11.2026)
- MediaPipe — https://ai.google.dev/edge/mediapipe/solutions/guide (checked 25.11.2026)
- rembg — https://github.com/danielgatis/rembg (checked 25.11.2026)
- U.S. Copyright Office. Copyright and Artificial Intelligence, Part 2: Copyrightability — https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf (29.01.2025)
- OpenAI, image generation — https://developers.openai.com/api/docs/guides/image-generation (checked 25.11.2026)
- Midjourney, plans — https://docs.midjourney.com/hc/en-us/articles/27870484040333-Comparing-Midjourney-Plans (checked 25.11.2026)
- Recraft, API pricing — https://www.recraft.ai/docs/api-reference/pricing (checked 25.11.2026)
