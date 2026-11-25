<!-- lesson: aicontent.publishing | Publishing: Habr, a blog, Telegram and several languages | 20 -->
<!-- section: hook -->
We published the same article on Habr, on the company blog in English and German, and as an announcement on Telegram, and each platform has its own requirements for the same text. On Habr, the title goes in a separate field and sections start with one hash; on a Hugo blog, the title comes from metadata and sections start with two; on Telegram, text is pasted without quotation markers. During one blog migration, 411 pages lacked link-preview images and German words ended up in English text. This lesson examines preparing material for each platform and avoiding a broken publication at the final step.

<!-- section: theory | Platform formats -->
For Habr, write the article title on a separate line without a hash, use level-one headings for sections and level-two headings for subsections. Prepare images as PNG or GIF and decide in advance after which paragraph each belongs. A saved draft is not a publication: after insertion, check that every image loaded and every link works. Remember that since July 2026 Habr's rules have discouraged AI-created or AI-edited material, except illustrations and small supporting fragments within a substantive original article, so a technical Habr article must rest on the author's own experience.

For a Hugo blog, the title and description are set in file metadata, and body sections begin with two hashes. Each post has a specific author appropriate to their role: during the company blog migration, 53 of 55 posts had impersonal bylines and were reassigned. In a multilingual blog, release and correct all language versions together, with reciprocal language links; otherwise the second version is forgotten after the first edit.

For Telegram, prepare separate text to paste as-is, without quotation markers that hinder copying. A Telegram announcement of a major article or release should stand alone with its own structure; a shortened article will not do. For a release review, the editor required each project's changes, how they work, what they look like in practice and what they offer to be explained, using a piece with 24 illustrations as the model: a 2,600-character text without images did not fulfil that task.

<!-- section: theory | A browser assistant for publishing -->
Placing twelve images in a Habr editor is repetitive work suitable for a browser assistant. Write its task as an operation list: the text is already inserted; each image has a filename, opening words of an anchor paragraph and a caption; set the 780×440 cover separately; insert links and the table at specified places; save but do not publish the draft; finish by listing what was inserted successfully. The editor presses Publish, and the brief should state this on its own line: being able to press a button does not mean the platform permits automated publication.

Playwright suits repeatable post-publication checks: it opens the page, checks links and images and takes screenshots. If a site returns 403 to an ordinary downloader, as Medium did during migration of old posts, read the text in a real browser; leave material unavailable without its source as a placeholder rather than reconstructing it by guessing.

<!-- section: theory | What breaks during bulk publishing -->
When many pages are published at once, errors hide in the build more often than in the text. During the company-site rebuild, checks found double-encoded search-engine markup, a hidden portion of an introductory answer, German quizzes that did not render, asymmetric language links and 411 missing preview images. After fixes, the build counted 1,422 valid markup blocks across 534 pages and zero broken internal links. A bulk automated word replacement mixed German words into English text and damaged page URLs, so mechanical replacements must be followed by a build and visual reading in every locale.

Different hosting services create another trap. Redirects that worked in a Netlify preview did not work on GitHub Pages, where the site was published; the site's generator mechanisms had to be used instead. Test the platform where the page will live, even if the preview is easier to inspect.

<!-- section: theory | The publication card -->
Before publication, fill in a short card: platform; a link to its rules and the date checked; AI's contribution to the material; whether a platform-interface label and reader-facing disclosure are required; whether the material can be monetised; which editor owns publication. The same video may require different captions and disclosure settings on different platforms; the card prevents confusion.

<!-- quiz -->
? A browser assistant inserted text and every image into a Habr draft. What happens next?
+ The editor checks the draft on the platform and presses the Publish button themselves || The assistant prepares the draft; the human retains the publication decision.
- The assistant publishes the article itself at the time specified in the brief || Automated publication on an external platform requires separate authorisation and checks.
- The article can be considered published because Habr shows drafts to the author's subscribers || Only the author sees the draft.
? A blog is published in English and German. The editor corrected a fact in the English post. What else is needed?
+ Apply the correction to the German version in the same change, in the same commit || Language versions are corrected together or they diverge.
- Nothing; the translator will fix the German version in the next scheduled blog update || Until then, readers will see different facts in different versions.
- Remove the German version until the translator checks it against the corrected English one || Removal breaks language links and search visibility.
<!-- /quiz -->

<!-- section: task | Task: publishing on three platforms -->
Complete the task in the document on this page. Take one finished piece and prepare it for three platforms your audience uses. For each, record heading formats, image positions, how the text differs from the main version, applicable AI rules and what you will check after publication. If you plan to delegate insertion to a browser assistant, write its task as an operation list.

<!-- section: sources -->
- Habr, site rules — https://habr.com/ru/docs/help/rules/ (08.07.2026)
- Hugo, documentation — https://gohugo.io/documentation/ (checked 25.11.2026)
- Playwright MCP — https://github.com/microsoft/playwright-mcp (checked 25.11.2026)
- Medium, AI content policy — https://help.medium.com/hc/en-us/articles/22576852947223-Artificial-Intelligence-AI-content-policy (11.11.2026)
- dev.to, guidelines for AI-assisted articles — https://dev.to/guidelines-for-ai-assisted-articles-on-dev/ (08.04.2024)

<!-- lesson: aicontent.rules | Platform rules, copyright and what research says | 24 -->
<!-- section: hook -->
In November 2026, Medium stopped distributing articles beyond the author's network if AI use was undisclosed, even when AI only assisted. Habr has discouraged AI-created or AI-edited material since July. In 2025, YouTube renamed repetitive content as inauthentic and clarified monetisation rules, while Europe's AI Act transparency obligations took effect in August 2026. This lesson examines platform and legal requirements, what AI-writing research actually measures and how to distinguish a marketing promise from evidence.

<!-- section: theory | What platforms require -->
Platform rules differ; one disclosure does not fit all.

- Since November 11, 2026, Medium requires disclosure for both AI-generated and AI-assisted writing; without it, distribution is limited to the author's network, and minimally reworked machine text cannot go behind a paywall even with disclosure.
- Since July 8, 2026, Habr has discouraged partially or fully AI-generated or AI-edited material and restricted it through moderation; exceptions cover covers, illustrations and small supporting fragments in substantive original technical articles.
- dev.to allows verified AI-assisted articles with disclosure in the text or a tag, but prohibits using such material to promote businesses, software and courses.
- YouTube requires disclosure of realistic synthetic depictions of events and people, but not assistance with scripts, titles, covers or subtitles. Since July 15, 2025, mass-produced repetitive content is called inauthentic and cannot be monetised.
- LinkedIn recommends disclosing substantial AI assistance and adding personal experience; responsibility remains with the author.
- Google does not ban AI text from search, but since March 2024 has penalised mass production of pages for ranking purposes, regardless of who wrote them.

The editorial rule is simple: check disclosure requirements separately for each platform, together with monetisation and distribution rights. On Habr, disclosure alone is insufficient; the material must be original and grounded in the author's experience.

<!-- section: theory | Copyright and voice -->
The U.S. Copyright Office's 2025 report on AI outputs says human contributions are protected: selection, arrangement and transformation, while a prompt alone is usually insufficient. Its report that year on model training is not final and does not declare all training either permissible or prohibited. The NYT case against OpenAI continues; in 2026 Anthropic received final approval for a $1.5 billion settlement with book authors covering past claims without granting a future licence; and in 2025 the UK trial court rejected the principal claim in Getty v. Stability AI, but the case went to appeal. None of these events means all training is lawful or unlawful.

Separate laws govern human voice and likeness: Tennessee's ELVIS Act has protected voice and likeness against imitation since 2024, while the federal NO FAKES Act in the U.S. had only been introduced in Congress as of November 2026. Since August 2, 2026, Europe's AI Act requires disclosure of deepfakes and AI text on matters of public interest; text has an exception where a human reviewed it and someone holds editorial responsibility, but this exception does not extend to deepfake video.

<!-- section: theory | What has and has not been measured -->
Studies show gains on specific tasks. In Noy and Zhang's experiment, ChatGPT access reduced writing-task time by 40% and raised quality scores by 18%. In Dell'Acqua's experiment, consultants completed tasks within the model's capabilities 25% faster and with better quality, but made more errors beyond those capabilities. Neither study proved that a fully automated content pipeline raises profits or that smoother prose becomes more accurate.

A 2026 systematic review of 47 studies on reader trust found no universal “AI penalty”: trust depends on context, disclosure wording and human involvement. In an experiment with nearly five thousand participants, an “AI-generated” label reduced trust in headlines regardless of their truthfulness because people read it as full automation; explaining exactly what AI did changed the reaction. Thus, “AI assisted with transcription and the draft structure; an editor checked the facts and quotations” is better than a bare label, if true.

Three commercial studies concern search. Ahrefs in 2025 found no relationship between the share of AI text and search position; Semrush in 2026 found that around 80% of first-position texts were classified as human by a detector; Originality.ai classified about 22% of sampled pages as containing AI text. All three rely on detectors and examine only pages already in search results, so they prove neither that AI texts rank well nor that they rank poorly.

<!-- section: theory | Your editorial policy -->
Major newsrooms publish AI policies with recurring principles: a human is responsible for the material, facts are checked against primary sources, and generated images of real events are not presented as photographs. Write a similar one-page policy for your team: what may or may not be delegated to AI, how facts are checked, how AI involvement is disclosed on each platform, who owns publication, and how source rights, service terms and people's consent are stored.

<!-- quiz -->
? A company wants to publish AI-written articles on Habr with a disclosure. What do Habr's rules since July 2026 say?
+ Habr discourages such material, and a label disclosing AI use alone does not permit it || The rules allow illustrations and small supporting fragments in an original article, not labelled AI texts.
- Habr allows such articles if a label at the beginning says AI wrote the text || A label does not remove the restriction; an original article based on the author's experience is needed.
- Habr allows such articles only in corporate blogs of companies paying for publication || The AI rule applies to every publication.
? An “AI-generated” label reduced reader trust in headlines in an experiment. What should an editorial team infer?
+ Explain exactly what AI did and what a human checked in the disclosure, if true || Readers interpret a bare label as full automation, and clarification changes their reaction.
- Do not disclose AI involvement, to preserve reader trust and publication reach || Where rules or law require disclosure, omitting it violates them.
- Label only material where AI wrote more than half the article || No platform sets that threshold; rules vary by platform.
<!-- /quiz -->

<!-- section: task | Task: a one-page AI policy -->
Complete the task in the document on this page. Write a one-page editorial policy: what may or may not be delegated to AI; how facts are checked; how AI involvement is disclosed on each of your platforms, with rule links and check dates; who owns publication; how source rights, service terms and people's consent to use their voice and likeness are stored.

<!-- section: sources -->
- Medium, AI content policy — https://help.medium.com/hc/en-us/articles/22576852947223-Artificial-Intelligence-AI-content-policy (11.11.2026)
- Habr, site rules — https://habr.com/ru/docs/help/rules/ (08.07.2026)
- dev.to, guidelines for AI-assisted articles — https://dev.to/guidelines-for-ai-assisted-articles-on-dev/ (08.04.2024)
- YouTube, disclosing synthetic content — https://support.google.com/youtube/answer/14328491 (checked 25.11.2026)
- YouTube, monetisation policies — https://support.google.com/youtube/answer/1311392 (15.07.2025)
- LinkedIn, responsible use of AI — https://www.linkedin.com/help/linkedin/answer/a1481496 (checked 25.11.2026)
- Google Search, spam policies — https://developers.google.com/search/docs/essentials/spam-policies (checked 25.11.2026)
- U.S. Copyright Office, AI reports — https://www.copyright.gov/ai/ (checked 25.11.2026)
- Bartz v. Anthropic, settlement website — https://www.anthropiccopyrightsettlement.com/ (checked 25.11.2026)
- Getty Images v. Stability AI, trial court judgment — https://caselaw.nationalarchives.gov.uk/ewhc/ch/2025/2863 (04.11.2025)
- EU AI Act, Article 50 — https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50 (checked 25.11.2026)
- Licenji, Hoxha. Systematic review of trust and disclosure — https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2026.1815243/full (05.05.2026)
- Altay, Gilardi. People are skeptical of headlines labeled as AI-generated — https://pmc.ncbi.nlm.nih.gov/articles/PMC11443540/ (01.10.2024)
- Ahrefs, AI text and Google rankings — https://ahrefs.com/blog/ai-generated-content-does-not-hurt-your-google-rankings/ (07.07.2025)
- Semrush, does AI content rank — https://www.semrush.com/blog/does-ai-content-rank-in-search-data-study/ (01.04.2026)

<!-- lesson: aicontent.tools | Tools as of late 2026 and budgeting | 18 -->
<!-- section: hook -->
Almost everything about content tools changed during 2026: the Sora 2 API closed, Kimi adopted new plans and a new client, Suno released its sixth model, and OpenAI announced shutdowns for older speech-synthesis models and cloud Whisper. Year-old comparison tables mislead. This lesson groups tools by task, with late-November 2026 prices, and shows how to budget without fooling yourself with the price of one generation.

<!-- section: theory | Agents for pipelines -->
Terminal agents underpin the pipelines discussed throughout the course. Claude Code is included in Claude Pro at $20 per month, with higher plans at $100 and $200. Codex CLI is included in ChatGPT Plus at $20 and Pro at $100–500, while API-key access is billed separately. Kimi moved from an archived Python client to Kimi Code CLI; Plus, Pro, Max and Ultra plans cost $19–199 per month, with a shared credit pool and a rolling five-hour limit. Gemini CLI offers up to a thousand requests daily for free when signed in with a Google account, though one agent cycle can use several requests.

ChatGPT, Claude, Gemini (including its free plan), Perplexity and Kimi offer deep research modes. They suffice for one-off investigations; repeatable work benefits from a terminal agent that writes results to files.

<!-- section: theory | Images, video, voice and editing -->
For images: GPT Image is billed by tokens, Midjourney costs $10–120 monthly, Black Forest Labs' FLUX starts at 1.5 cents per image, Imagen 4 in Google Cloud costs 2–6 cents, and Recraft produces vector images from 8 cents. For logos and diagrams, check genuine vector export and manual editability; for photographs, check subject, face and text accuracy.

For video: Veo 3.1, Runway from $15, Pika from $10, avatars and dubbing from HeyGen at $29 and Synthesia at $19. For voice: ElevenLabs from $6 with a commercial licence, or open-source Piper locally. For music: Suno from $10, with download limits and ambiguous rights status. For transcription: open-source Whisper locally, AssemblyAI from 15 cents per hour, Deepgram from half a cent per minute. For editing: Descript from $16 with annual billing and text-based editing, CapCut with region-dependent pricing, Premiere with generative clip extension. For presentations: Gamma, Beautiful.ai from $12, Canva. For page checks and screenshots: open-source Playwright and Playwright MCP.

These prices are from November 2026 and age quickly. Before buying, check the pricing page and do not apply subscription terms to APIs or vice versa: they are different products with different limits.

<!-- section: theory | How to budget -->
The full cost of an accepted unit of content includes subscriptions allocated by volume, generations and retries, source licences, author, fact-checker and editor time, editing and design, and post-publication corrections. One generation's price is only one component, often not the main one: in our projects, revision rounds and checks cost the most.

To choose a tool, run a small pilot: give two tools the same real editorial tasks and source material, then measure editor time to acceptance, errors, retry costs and the share accepted without rework. Do not buy an annual subscription just because it looks cheaper in a table: calculate two scenarios, an ordinary month and a one-off major project.

<!-- quiz -->
? Generating a five-second video costs 20 credits. Why is that insufficient to calculate the cost of an advertising video?
+ Include all retries, editorial selection, editing and checks: the cost per accepted second || Most generations do not pass selection, and human work often costs more than generation.
- Add the subscription cost; nothing else belongs in the video price because the rest is free || Editor time and editing cost money too.
- It is sufficient if the video was generated on the first attempt and needed no editing before publication || A first-attempt video almost never passes selection.
? A video-tool comparison table was published in 2025. Can you use it to choose in late 2026?
+ Not without checking current plans: some services closed or changed their pricing || The Sora 2 API closed in September 2026, while Pika and Kimi changed plans.
- Yes, because generative service prices change by no more than ten percent a year || The services themselves changed, not only prices.
- Yes, if the table links to pricing pages showing where its figures came from || Links help with checking, but the table's figures are still outdated.
<!-- /quiz -->

<!-- section: task | Task: pilot two tools -->
Complete the task in the document on this page. Choose a task for which you need a tool: article images, transcription, intros or research. Pick two tools from the lesson and five real tasks from your editorial team. Record how you will compare editor time to acceptance, errors, retry costs and the share of accepted results, and calculate the full cost of one accepted unit for both.

<!-- section: sources -->
- Anthropic, Claude pricing — https://claude.com/pricing (checked 25.11.2026)
- OpenAI, Codex pricing — https://learn.chatgpt.com/docs/pricing (checked 25.11.2026)
- Kimi, pricing — https://www.kimi.ai/help/membership/membership-pricing (19.10.2026)
- Gemini CLI, quotas — https://geminicli.com/docs/resources/quota-and-pricing/ (checked 25.11.2026)
- Midjourney, plans — https://docs.midjourney.com/hc/en-us/articles/27870484040333-Comparing-Midjourney-Plans (checked 25.11.2026)
- Black Forest Labs, pricing — https://help.bfl.ai/articles/7986977817-what-are-the-costs-associated-with-using-your-models (26.08.2026)
- Google Cloud, model pricing — https://cloud.google.com/model-garden/pricing (checked 25.11.2026)
- HeyGen, pricing — https://www.heygen.com/pricing (checked 25.11.2026)
- Synthesia, pricing — https://www.synthesia.io/pricing (checked 25.11.2026)
- Suno, pricing — https://suno.com/pricing (checked 25.11.2026)
- Deepgram, pricing — https://deepgram.com/pricing (checked 25.11.2026)
- Descript, pricing — https://www.descript.com/pricing (checked 25.11.2026)
- Beautiful.ai, pricing — https://www.beautiful.ai/pricing-plans (checked 25.11.2026)
