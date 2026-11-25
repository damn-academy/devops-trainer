<!-- lesson: aicontent.team | Who does what: the editor, lead AI and workers | 22 -->
<!-- section: hook -->
The damn.academy learning platform, with a DevOps profession and eight business courses, was built in eight days. AI wrote the lessons, diagrams, trainers and code, but no lesson reached learners without a human reading it and sending it back for revision. The work involved four roles: an editor who makes decisions and accepts the work; a lead AI that designs, writes and checks; worker AIs that write code and gather research; and fictional readers who work through the finished material. This lesson examines how to divide the work so that AI speed does not produce a mountain of text you would be embarrassed to publish.

<!-- section: theory | The editor decides and accepts -->
AI writes quickly and confidently, but it does not know what you want until you tell it, and readily invents things you never asked for. This became apparent in the platform's first few days. The project acquired a broker that handed virtual machines to learners, along with a calculation of their cost; the editor stopped this with a single remark that the platform did not sell cloud services and nobody received machines from it. A day later, the AI proposed running training Kubernetes clusters on the most popular lightweight distribution, and the editor chose another. The AI recorded both decisions in memory files it reads at the start of each session and removed the rejected approaches from all documents.

The editor's first duty is therefore to make product decisions and ensure they are recorded. The second is to read everything that goes to readers and refuse to accept work until it is good. The third is to turn recurring feedback into rules, as the editing lesson explains in detail. The editor does very little writing themselves: in the projects behind this course, the editor wrote comments and the AI rewrote the text in response.

<!-- section: theory | The lead AI designs, writes and checks -->
The lead AI acts as editor-in-chief and architect at once. In our projects, Claude in the terminal filled this role: it designed the product, wrote text, assigned tasks to other AIs, checked their results, kept a work log and took browser screenshots of finished pages to inspect the layout visually. One AI must own the voice of the text: when several models are assigned lessons, the course starts speaking in different voices.

On the learning platform, this rule grew out of a mistake. On November 19, language editing for several course blocks was assigned to a worker, and the result had to be rolled back: bureaucratic language appeared, question wording changed, and the Russian and English versions diverged. After that, only the lead AI wrote Russian text for learners, following a single style guide. Workers were later allowed to write prose, but only with mandatory linting and editing; for a course, this means a simple rule: one worker owns the voice, while the others supply drafts for it to rewrite.

<!-- section: theory | Workers write code and gather research -->
The lead AI assigned code, English translations, builds, tests and research involving web searches to two workers, Codex and Kimi. Each received its brief in a file and worked in a separate repository copy so parallel tasks would not interfere. A typical command looked like this:

```bash
codex exec --skip-git-repo-check -s workspace-write -c tools.web_search=true -C ~/research - < brief.md
```

The first part allows the worker to write files in the specified folder, the second enables web search, and the task is read from `brief.md`. Coding tasks used a mode in which the worker approves its own actions; it is incompatible with the folder restriction flag, something we discovered through an error. Kimi quickly hit its limit and ended with `Prompt turn ended with reason: failed` without explaining why, so the rule was simple: if Kimi stopped responding, its task went to Codex without discussion.

Research was also divided by source: one worker searched open archives and English-language material, another searched in Russian. During preparation of this course, five investigations ran simultaneously this way: finances, metrics, a tool review, dossiers on our projects and material for reworking three other courses. Meanwhile, the lead AI wrote text and waited for notifications that a worker had finished.

<!-- section: theory | Fictional readers check the finished material -->
The fourth role belongs to readers who do not exist. For each course, we invented six people with different experience, habits and irritations, and a worker went through the built site as each one, recording where they would abandon the course. The lesson on checks explores this technique in detail; here, what matters is that it covers a weakness in the whole arrangement. AI is worst at checking text it wrote itself, while the editor gets tired and misses things. Other eyes, even fictional ones, find what both miss: an incorrect formula in the product course, contradictory advice in the sales course, quiz questions where the correct answer is always the longest.

<!-- section: theory | What not to hand over to AI -->
There is work AI does poorly even with a good brief. A human makes product decisions about what to create and for whom. One worker maintains the voice. Someone other than the author checks facts: in the video-to-article pipeline covered in a later lesson, the fact-checker is a separate role that only writes a report and does not improve the text itself. A human confirms publication on an external platform: a browser assistant can insert text and pictures into a Habr draft, but the editor presses Publish.

Finally, AI has no memory of previous sessions unless it is written down. Everything that must survive a closed terminal—decisions, rules and work status—lives in files. That is the subject of the next lesson.

<!-- section: theory | The cost of an accepted unit of content -->
AI speed is easy to overestimate if you count only generation time. Noy and Zhang's 2023 study in Science found that access to ChatGPT reduced average time on professional writing tasks by 40% and raised quality scores by 18%. Dell'Acqua's experiment with consultants, whose final version appeared in 2026, also found the reverse: on tasks within the model's capabilities, consultants completed 12% more and worked 25% faster, while on a task outside those capabilities the probability of a correct answer fell by roughly 19 percentage points. AI speeds up work where it is strong and makes confident mistakes where it is weak.

Measure the time until the editor accepts the material; time to first draft tells you almost nothing. The full cost of one accepted article, video or lesson includes subscriptions, generations and retries, source-material licences, author, fact-checker and editor time, production editing and corrections after publication. In our projects, every Habr article went through several revision rounds, and a music longread underwent at least fifteen numbered rounds of review by a critic; this work accounted for most of the cost.

<!-- quiz -->
? An editorial team assigned language editing of a course to two different AIs to finish faster. What will most likely need fixing?
+ Different voices across lessons and diverging wording between versions || This happened on the learning platform: editing by different workers introduced bureaucratic language and made the Russian and English versions diverge.
- Nothing, provided both AIs receive the same style guide and identical brief || Even with one guide, two models write differently; one worker must own the voice.
- Only typos, because modern AIs write with flawless grammar and identical style || Grammar is not the main problem here; style, terminology and wording diverge.
? How should you measure the benefit of AI in producing an article?
+ By the time until the editor accepts it, including checks and revisions || Time to first draft excludes revision rounds and fact-checking, which account for most of the work.
- By draft generation time, because the remaining work would exist without AI too || Without AI, there would be fewer revisions elsewhere; compare the full cycle through acceptance.
- By the number of words AI writes per minute multiplied by the author's rate || Generation speed says nothing about how much text will need rewriting.
<!-- /quiz -->

<!-- section: task | Task: map the roles in your editorial team -->
Complete the task in the document on this page. Choose one recurring type of content your team produces: a blog article, newsletter issue, video or lesson. Describe who makes it: what the human editor decides; which AI owns the voice; what you will delegate to workers and how they will receive the task; who checks the facts if not the author; who presses Publish. Then estimate how much time went into drafting and how much into revisions and checks for the most recently published item, and record where AI saved time and where it added work.

<!-- section: sources -->
- Noy, Zhang. Experimental evidence on the productivity effects of generative artificial intelligence. Science — https://doi.org/10.1126/science.adh2586 (07.2023)
- Dell'Acqua et al. Navigating the jagged technological frontier. Organization Science — https://doi.org/10.1287/orsc.2025.21838 (11.03.2026)
- OpenAI, Codex pricing — https://learn.chatgpt.com/docs/pricing (checked 25.11.2026)
- Kimi, pricing and Kimi Code — https://www.kimi.ai/help/membership/membership-pricing (19.10.2026)
- Anthropic, Claude pricing — https://claude.com/pricing (checked 25.11.2026)

<!-- lesson: aicontent.brief | Brief, log and memory: keeping work between sessions | 20 -->
<!-- section: hook -->
An AI session can end at any moment: the terminal closes, context runs out, a worker hits a limit or the computer restarts. In one of our projects, a restart destroyed uncommitted results from several background workers, and we had to reconstruct them from briefs and the log. After that, the rule became strict: everything that must survive a session goes into files as work proceeds, before the session ends. This lesson covers three such files—the brief, session log and memory—and offers templates you can reuse.

<!-- section: theory | The brief as a contract with the worker -->
A brief is a task written so the worker can complete it without questions. In our projects, a good brief always contained the same parts: the goal and intended audience; input files to read; the folder where writing is allowed and everything that must not be touched; expected output files; language and source rules; prohibitions; verification commands and the condition that defines completion.

Compare two tasks for a browser assistant formatting a Habr article. The first was “make the article look nice”. The second, which we actually used, said: the text is already inserted; for each of twelve images, here are the filename, the opening of the paragraph after which to place it, and the caption; set the cover separately; links and the table position are listed separately; save the draft, do not publish it, and list what you managed to insert. The first task gives the worker room to get things wrong; the second specifies operations and a way to verify the result.

For research, the brief adds a fact format. In the music feature brief, the worker had to deliver a fact file in which every claim had an identifier, section, wording, status and sources with a short quotation and date, plus a source catalogue and a media inventory with provenance and rights. Writing publishable prose was prohibited. This keeps research separate from narrative and lets the editor see what supports every claim.

<!-- section: theory | The session log -->
The session log is a `SESSION_LOG.md` file in the project folder, created by the lead AI before its first significant action. It has three parts. “Goal” is one sentence stating what we are doing and why. “Current state” is a single overwritten block answering “where are we if I return in an hour”: files, branches, addresses, what works and what does not. “Next step” names one specific command or action. Below is a log to which every significant event is appended with its time: a change applied, a decision made, an error found and its workaround, a switch between tools.

The main logging rule is to write immediately after the event. If the AI takes three steps in a row, the log is updated after the third; otherwise, an interrupted session erases the part hardest to reconstruct. On the learning platform, the log once saved a deployment: a cluster update replaced nodes midway through deployment, and the log showed which commit had already been built, which had not, and that the feedback database had been on a removed node.

<!-- section: theory | Memory and handover -->
Memory is a set of short files the lead AI reads at the beginning of every session. In our projects there are three kinds: project status (done, in progress, next), an editorial rule with a reason and example (such as rules on literal translations or Habr headlines), and a tool's technical peculiarity (such as Google Sheets formulas collapsing arrays into a single value). Every editorial rule recorded in memory turns a one-off comment into a requirement for all later briefs.

Memory has a trap: it becomes outdated. Once, checking a list of “unfinished” items in memory showed that 16 of 19 had already been completed, handed over or deliberately deferred. Before declaring a task open, check the remembered status against the repository, log and publication.

A handover file transfers work to another AI. It contains the goal, current branches and folders, what has been verified, what is published and what is only merged, the next step, constraints and open questions. On the learning platform, such a file let a worker pick up the task without a retelling; the file itself was not published because it contained operational details.

<!-- section: theory | Templates -->
In our projects, a worker's task usually fitted into a paragraph like this: “Read the listed files. Do this in this folder. Save these results. Do not change neighbouring working copies. The work is done when these checks pass. Do not write Russian strings; list where they are needed separately for the editor.”

An editorial rule in memory looks like this: the rule itself; what was wrong with the previous result; an example; how to check compliance; date and context. An article's media inventory contains: file, origin, associated section, caption, format, privacy check and readiness. These forms are dull, but they let you return to the work a week later without starting over.

<!-- quiz -->
? An AI took three steps in a row: built an image, deployed it and found a configuration error. When should it update the session log?
+ After each step, without waiting for the work to finish || An interrupted session erases the latest steps, so write the log immediately.
- At the end of the working day, once it is clear which steps mattered || If the session ends earlier, nobody will be left to record them.
- Only after finding the error, because successful steps are visible in commit history || Deployment and builds may leave no commit; the log covers everything significant.
? The lead AI's memory says an article is not published yet. What should it do before reporting this to the editor?
+ Check the status against the platform, repository and log || Memory becomes outdated: one audit found 16 of 19 “unfinished” tasks were closed.
- Nothing, because the lead AI's memory updates automatically after every publication || Memory updates only when something is written into it.
- Delete the memory entry so it does not interfere with future sessions || The entry may still be needed; first check whether it is accurate.
<!-- /quiz -->

<!-- section: task | Task: a brief and log for your project -->
Complete the task in the document on this page. Write a brief for one task you want to give AI: goal and audience, input files, where it may write and what it must not touch, expected output files, language and source rules, prohibitions and the condition defining completion. Then create a session-log template with “Goal”, “Current state”, “Next step” and “Log” sections, and record your project's initial state. The brief is ready when another person can complete the task without asking you a single question.

<!-- section: sources -->
- Habr, site rules, section on AI-created material — https://habr.com/ru/docs/help/rules/ (08.07.2026)
- Anthropic, Claude Code — https://claude.com/pricing (checked 25.11.2026)
- OpenAI, Codex CLI — https://learn.chatgpt.com/docs/pricing (checked 25.11.2026)
