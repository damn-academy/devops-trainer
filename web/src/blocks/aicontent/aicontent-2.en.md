<!-- lesson: aicontent.research | Research before writing: facts, sources and their statuses | 24 -->
<!-- section: hook -->
While researching a music feature, a worker AI marked a music video's setting as unconfirmed even though it was visible in the official video itself. In another investigation, the same logic worked in reverse: a sample's absence from the official recording credits was treated as disproof, even though credits can be incomplete. Both mistakes were corrected, producing two rules now included in every research brief. This lesson examines how to organise research before AI writes a single sentence: where to gather facts, how to record their status and why narrative must wait until the fact base is ready.

<!-- section: theory | The fact base comes before the narrative -->
An AI asked to write about an unfamiliar subject will fill gaps with plausible prose. An international audit by the European Broadcasting Union and the BBC in October 2025 checked around three thousand answers by four assistants to news questions in fourteen languages: 45% had at least one significant problem and 31% had a serious sourcing problem. This does not mean 45% of facts were invented—the unit was the whole answer—but the editorial implication is clear: text written from a model's memory needs checking almost in full.

That is why our historical, music and technical projects separate research from writing. The researcher gathers a fact base and delivers it in machine-readable form; writing publishable prose is prohibited. Another worker writes the narrative, with every claim grounded in a database entry. The same principle applied to the platform's business courses: before each course, a worker with web search gathered a dossier of 50,000–120,000 characters, giving every fact a link and date, and only then did the lead AI write the lessons.

<!-- section: theory | How to record a fact -->
A fact record in our projects looked like this:

```yaml
id: fact-001
section: recording
claim: "A verifiable claim in one sentence"
status: single   # single, confirmed or disputed
sources:
  - title: "Source title"
    url: "Link"
    quote: "A short exact quotation supporting the claim"
    date: "Source date"
```

The status `single` means one source, `confirmed` means two independent sources, and `disputed` means evidence of opposing versions has been found. Two pages retelling the same interview do not count as two sources: at the Sankofa museum, two workers independently opened every source for this purpose, and accepted wordings and translations were tied to checksums so that any record change required rechecking.

Alongside the facts are a source catalogue and a media inventory. The inventory records provenance and rights for each image, video or recording, because “may we publish this?” is easier to resolve before the file enters the text.

<!-- section: theory | What counts as confirmation -->
The two mistakes at the start of the lesson became two rules. First: an official video, recording, cover or document itself confirms what can be directly seen or heard in it. If the setting is visible in the official video, two written retellings are unnecessary. Two independent accounts are required for circumstances of creation, motives and historical explanations. Your own listening observations are also acceptable, but must be recorded as their own evidence type so they are not mistaken for archival sources.

The second rule: lack of confirmation does not mean a dispute. If a sample is absent from the credits, that means “not yet confirmed by sources”; it is not disproof. Use `disputed` only when positive evidence of opposing versions has been found. Without this rule, research turns gaps into disputes that do not exist.

<!-- section: theory | Primary sources and archives -->
For a historical study of early press coverage of computing devices, we built a search chain: from secondary research to a bibliographic index, then to the exact publication, year, issue and page, then to the digitised primary source and its transcription. Unpublished archival materials required collection, inventory and file numbers. Searches included pre-revolutionary spelling variants and old names. A newspaper mention found only in a later biography was not treated as equivalent to reading the issue itself: it remained unconfirmed until the actual issue was located.

When one session's search limit ran out, research continued through a browser assistant: it received a task listing indexes and archives and was asked to save results in the project. This is a general rule for long investigations: save each step's results in files so a tool failure does not cost you what you found.

<!-- section: theory | Technical facts: code and measurements -->
In technical articles, working code, specifications, command output and measurements serve as sources. In a series on forgotten operating systems, about two hundred claims across two articles were checked against the code, and the articles were rechecked after code changes. Numbers appeared only after a fresh measurement: in an article about moving a chatbot to Google Sheets, command response time was recorded after fixes brought it from 6–8 to 2.5–3.7 seconds, with measurement conditions stated.

If an article promises a full specification implementation but the code lacks something, the editor in our projects would not accept admissions such as “this part is not implemented yet”. The missing code was written, tested, and only then was the article checked. Research therefore continues after the first draft: the text and implementation check one another.

<!-- section: theory | Research tools -->
Deep research modes in ChatGPT, Claude, Gemini, Perplexity and Kimi suit research with web searches; terminal agents with search that write results to files suit repeatable work. Links in a report do not mean every link supports the adjacent sentence: in one dossier, a link supposedly reporting the outcome of a European tender led to its announcement, something found only during verification. A research brief should therefore require a short source quotation beside each fact, and links should be spot-checked while preparing the text.

<!-- quiz -->
? A band's official video shows filming on an empty beach. The researcher found no two written sources confirming this. What status should the fact receive?
+ Confirmed: the official video itself confirms what is visible in it || Two independent accounts are needed for circumstances of creation; what is visible in a primary source is confirmed by that source.
- Disputed until two independent texts describe the video's filming location || Missing texts do not make a fact disputed; opposing evidence does.
- Unconfirmed, because video can be edited while articles undergo editorial review || The band's official video is a primary source; editing does not negate what is visible in it.
? A sample of a famous song is not listed in a recording's official credits. How should this be recorded in the fact base?
+ Not yet confirmed by sources || Absence from the credits does not disprove a sample; credits may be incomplete.
- Disproved, because the official credits are a primary source and do not list the sample || Absence of a mention is not evidence of the opposite.
- Disputed, because some sources mention the sample while the credits are silent || Positive evidence of opposing versions makes a fact disputed; silence in the credits is not such evidence.
<!-- /quiz -->

<!-- section: task | Task: a fact base for one piece of content -->
Complete the task in the document on this page. Choose a topic you intend to write about with AI. Write a research brief: subject and boundaries, questions by section, which sources count as primary, what confirms directly observable facts and what requires two independent accounts, the fact-record format and a prohibition on writing publication text. Then manually record five facts in the lesson's format, with a quotation and source date, and assign each a status under the lesson's rules.

<!-- section: sources -->
- EBU, BBC. News Integrity in AI Assistants — https://www.ebu.ch/Report/MIS-BBC/NI_AI_2025.pdf (10.2025)
- OpenAI, search and research in ChatGPT — https://learn.chatgpt.com/docs/web-search (checked 25.11.2026)
- Google, Gemini subscriptions and Deep Research — https://gemini.google/subscriptions/ (checked 25.11.2026)
- Perplexity, plan comparison — https://www.perplexity.ai/help-center/en/articles/11187416-which-perplexity-subscription-plan-is-right-for-you (checked 25.11.2026)

<!-- lesson: aicontent.editing | Editing: turning feedback into rules | 28 -->
<!-- section: hook -->
The AI's first texts for the learning platform were grammatical and empty. They sounded smooth but contained many choppy phrases joined by dashes, words such as “simply”, “precisely” and “essentially”, “not X but Y” constructions, literal translations such as “the process died”, and terms introduced before their explanations. When the editor demanded connected prose, the next release announcement went to the other extreme, overloaded with metaphors and introductory phrases. Such rounds produced more than seventy editorial rules across our projects. This lesson shows the most important ones with examples and explains how to turn feedback into a style guide and checks so the same corrections do not recur in every text.

<!-- section: theory | Why AI prose is recognisable -->
AI texts have persistent traits that readers recognise before they can name them. Empty intensifiers—“exactly”, “honestly”, “literally”, “essentially”, “directly”, “really”, “simply”, “precisely”—prove nothing and occupy the space where an argument should be. “Not X but Y” contrasts appear when nobody asserted X: “this is not just a tool but an entire platform”. Sentences use a colon or dash instead of a verb: “Method: the layer first”, “RAM—fast, but forgets everything”. A paragraph's final sentence summarises without adding anything. English metaphors are translated literally into Russian: processes “die”, locks are “let go”, exceptions get “lost”.

Each trait alone is harmless, but together they make prose recognisable and tiring. Since July 2026, Habr's rules have discouraged material partially or fully generated or edited by AI, and moderators restrict such publications. For a technical blog, the issue is therefore not whether to disclose AI involvement, but how to make the text an original piece grounded in your own experience that does not read as generated.

<!-- section: theory | Rules for coherence and precision -->
These are the main rules we applied to everything from longreads to diagram captions.

Write complete sentences. Check every sentence of seven words or fewer: it often lacks a subject, object or connection to its neighbours. “It brought the author little” needs to say what and to whom. “No buttons” and “Goal” remain fragments that need expanding.

Every pronoun needs a clear nearby noun. In one longread, “their voices” referred to people named five screens earlier, leaving readers lost. If something was named long ago, name it again.

Introduce concepts and participants in order, without relying on knowledge readers do not yet have. In the first Linux permissions lesson, an example involving a web server's 403 error was confusing because web servers appeared later in the course.

Finish every story you start. If the text describes an argument over who will sing a song, it must say who eventually sang it.

Give numbers meaning. A percentage without an explanation of what was measured and why readers need it only clutters the text; internal details can go in a collapsible block.

A heading names its subject. “Time you can stop” sounds attractive but does not say what mechanism the section covers.

Translate borrowed expressions by describing the action: in Russian, use “the process terminated abnormally”, “release the lock”, “production server” instead of slang for production, a Russian word for deployment instead of a transliteration, and “presentation” instead of a literal “deck”. Describe the function rather than giving a bare acronym: “the platform builds and deploys the application from code” is clearer than the label PaaS.

State limitations once and where relevant. In talk slides, the editor removed banners offering pre-emptive excuses: caveats about possible criticism were displacing the story itself.

<!-- section: theory | Two extremes and the middle -->
Work on the release announcement shows how comments refine each other. The first Russian version was a list of short phrases. The editor demanded connected prose, and the second acquired metaphors, “perhaps”, “finally” and introductory words at every turn. The third found the middle: connected sentences without decoration. This produced a two-part rule: prose must flow, and imagery must be used sparingly.

The editor refined the disclaimer rule similarly. First, they asked to remove warnings and frames around text from the interface because they looked like unfinished layout. Then some information proved mandatory, such as disclosure of synthesised voice or consent to data storage, and the rule became: remove administrative caveats, keep necessary disclosures. Record such exceptions alongside the rule, or the next worker will apply it too broadly.

<!-- section: theory | The style guide and linters -->
Fixing every text by hand is pointless: the same errors will appear in the next one. We therefore recorded every recurring comment in a style guide. For the platform, this is `STYLE-RU.md`, modelled on Nora Gal's *The Living and the Dead Word*, Artemy Lebedev's *Kovodstvo*, and the tone of Meduza and pre-2010 Vedomosti; two fully rewritten lessons serve as examples of its application. A concrete example is easier for a worker to follow than a list of prohibitions.

A linter checks what can be found mechanically. The script searches for empty intensifiers, “not X but Y”, sentences built on colons and dashes, bureaucratic language and literal translations, printing each suspect sentence with its line number. The linter makes errors in both directions: it may flag “according to” as bureaucratic although it is normal usage, and miss a fragment without a dash. Its output is therefore read by the editor or lead AI; the linter only reminds them of the rules and makes no decisions.

Another check tracks meaning and the order in which concepts are introduced. The platform's concept linter verifies that a lesson does not use a term before the lesson introducing it, and fails the build if it does.

<!-- section: theory | Editing a long text -->
After feedback, a long article is not rewritten wholesale: regeneration introduces new errors into passages already accepted. Edit section by section, keeping a pre-edit copy and a “before, after, reason” log. If the editor is currently editing the file themselves, the AI writes changes into a separate file to avoid overwriting unsaved work.

Literary editing must be followed by another fact-check of the version diff: style edits easily turn “may help” into “helps” or “often” into “increasingly often”. In a scientific article translation, this check found both kinds of strengthening, along with missing licence attribution and a paragraph that Markdown attributed to the quoted author because a blank line was missing after the quotation.

<!-- quiz -->
? An editor flagged “This is not just a bot but a real platform for the community.” What is wrong with it?
+ The contrast argues against something nobody claimed and does not say what the product does || “Not X but Y” without an asserted X gives away AI prose; say what the platform does instead.
- Nothing except the unnecessary “just”, which the linter flagged as an intensifier || Removing “just” leaves a contrast that communicates nothing.
- “Platform” is a literal borrowing here and must be replaced with a native word for a venue || “Platform” is appropriate here; the problem is how the sentence is built.
? After literary editing, an article reads better. What else is needed before publication?
+ Check the version diff for changes to facts, negations and modality || Style edits turn “may help” into “helps”; a repeat fact-check of the diff finds this.
- Nothing, because literary editing changes only style and does not affect the article's content || Style editing strengthened two claims in a scientific article translation.
- Run the article through an AI-text detector to make sure the editing was sufficient || Detectors are unreliable and do not check facts.
<!-- /quiz -->

<!-- section: task | Task: a style guide from your own feedback -->
Complete the task in the document on this page. Take the last three AI texts you edited and list all comments that recurred at least twice. For each, record a rule, what was wrong, a before-and-after example and how to check compliance: visually or mechanically. Then choose one paragraph that best demonstrates the voice you want and make it the reference for future briefs.

<!-- section: sources -->
- Nora Gal. The Living and the Dead Word, Wikipedia article — https://ru.wikipedia.org/wiki/Слово_живое_и_мёртвое (1972 book, later editions)
- Artemy Lebedev. Kovodstvo — https://www.artlebedev.ru/kovodstvo/sections/ (checked 25.11.2026)
- Habr, site rules — https://habr.com/ru/docs/help/rules/ (08.07.2026)
- Google Search, guidance on using generative AI — https://developers.google.com/search/docs/fundamentals/using-gen-ai-content (checked 25.11.2026)
