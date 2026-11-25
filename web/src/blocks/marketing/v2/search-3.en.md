<!-- lesson: marketing.search-docs | Documentation, AI crawlers, and technical SEO | 18 -->
<!-- section: hook -->
A company rewrote its project documentation and moved it to a new site generator. A month later, it discovered that search traffic had fallen by a third. There were three causes: old page addresses did not redirect to new ones, the preview site had been indexed alongside production and was considered a duplicate, and bot protection blocked AI search crawlers from accessing the pages. This lesson covers why documentation is an open-source project's main search asset, how search engines and AI systems work with it, and what to check before each website release.

<!-- section: theory | Documentation as search content and a first introduction -->
For an open-source infrastructure project, documentation brings more people from search than any other part of the site. According to Similarweb's estimate for October 2026, almost half of desktop visits to kubernetes.io come from organic search. This estimate applies to one large project and is not a benchmark for small ones, but the direction is clear: people search for answers to specific questions about installation, upgrades, and errors, and find documentation.

CNCF assesses its projects' documentation against public criteria, including public access, analytics only on the production site, Search Console ownership, functioning search, absence of errors, maintainability, and programmatic access. In its 2026 analysis of KubeVirt documentation, the foundation found missing analytics in the user guide, analytics polluted by preview-site data, errors in sitemap and robots.txt, unclear analytics ownership, and fragmented search. Such errors occur even in mature projects, and until they are fixed, a team cannot understand where people come from or where they get stuck.

Useful documentation answers questions from people at different stages: evaluating the project, installing it for the first time, designing a production system, upgrading, troubleshooting, or wanting to contribute. For a private cloud platform, buyers should be able to find supported hardware, network and storage requirements, tenant boundaries, backup and recovery, and version compatibility during upgrades before speaking with sales.

<!-- section: theory | Documentation versions -->
An infrastructure project's documentation exists in several versions, and a search engine may show instructions for an old version that install the wrong thing. Supported versions should be discoverable through search, and old versions should be clearly marked on the page itself. Do not mechanically point every old version's canonical link to the latest one if the instructions differ. Check what the search engine and the site's own search show for a real user question.

<!-- section: theory | AI crawlers and agents -->
OpenAI has three different bots: `OAI-SearchBot` collects pages for ChatGPT search, `GPTBot` for model training, and `ChatGPT-User` visits when a user asks to open a page in a conversation. They are controlled separately, so you can allow the search crawler and block the training crawler. A bot's name in a request is easy to spoof, so OpenAI publishes its server addresses for verification. Bot protection that shows every unfamiliar visitor an “I'm not a robot” challenge also blocks AI search engines, even if the pages open in a browser.

Programs increasingly read documentation: developer assistants and agents that install and configure products from it. In summer 2026, Mintlify counted 213 million agent requests on its customers' sites versus 105 million human page loads, and most agents requested page versions prepared for programs. In May 2026, GitBook calculated that agents accounted for around 39% of documentation requests, humans for around 36%, and search crawlers for around 24%. The platforms count differently, and one later acknowledged mistaking vulnerability scanners for agents, but the shared conclusion is that a person may never open the page their assistant used to assemble a working installation command. It is therefore useful to measure successful installations and product activation as well as page views.

The `llms.txt` file is a proposed format: a short Markdown index of useful pages on a website. In May 2026, Ahrefs found such a file on 28% of 137 thousand sites, and 97% of those files received no requests over a month; of requests to the rest, around a fifth came from AI programs. Google says the file is not needed for search. If it is easy to generate an index and clean Markdown versions of pages from the same source as the site, do so for agents and check whether a developer assistant can use them to find installation requirements and supported versions. Do not expect the file to improve search performance.

<!-- section: theory | Markup that still works -->
In June 2025, Google removed several types of rich results, including those for courses and educational videos, and in May 2026 stopped showing rich results for questions and answers. Old advice to add FAQ markup for space in search results is outdated. Useful markup still includes `BreadcrumbList` for deep documentation pages, `Organization` that truthfully describes the company and distinguishes it from the software project, and `Article` with author and dates for technical posts. Ahrefs compared 1,885 pages that had markup added with 4,000 similar pages without it and found no convincing increase in citations in AI answers.

<!-- section: theory | Checks before a website release -->
Before every documentation site release, especially when migrating to a new generator, check the production build. Open pages without JavaScript and confirm that text, code, and links are present. Check headings, response codes, redirects from old addresses to the closest new ones, canonical links, robots.txt, sitemap, and the 404 page. Ensure preview sites are blocked from indexing and do not send analytics data. Assign someone to own Search Console and analytics so access does not disappear with a departing employee.

For multilingual documentation, Google accepts language-version annotations through HTML, HTTP headers, or a sitemap; links must be absolute, reciprocal, and include the page itself. Check language and version combinations: a Russian installation page for one version must not point to an English page for a different, incompatible version.

<!-- section: task | Task: accepting a documentation site -->
Complete this task on your project's documentation site or that of any open-source project. Open three pages—installation, upgrading, and troubleshooting—with JavaScript disabled and record what disappeared. Check robots.txt and sitemap: does the sitemap include preview-site or old-domain addresses? Find the project's installation instructions in a search engine and check which version they cover. Then ask a developer assistant how to install the project and check which pages it used and whether its command is correct.

<!-- quiz -->
? Which OpenAI crawler collects pages for search in ChatGPT?
+ OAI-SearchBot || GPTBot collects training data, while ChatGPT-User visits at a user's request in a conversation.
- GPTBot || GPTBot is associated with model training.
- Googlebot || This is Google's crawler.
<!-- /quiz -->

<!-- section: sources -->
- CNCF, documentation assessment criteria — https://contribute.cncf.io/techdocs/analysis/criteria/ (checked 25.11.2026)
- CNCF, KubeVirt documentation analysis — https://contribute.cncf.io/techdocs/analyses/2026/kubevirt/analysis/ (2026)
- Similarweb, kubernetes.io — https://www.similarweb.com/website/kubernetes.io/ (October 2026)
- OpenAI, bots — https://developers.openai.com/api/docs/bots (checked 25.11.2026)
- Mintlify, documentation traffic — https://www.mintlify.com/blog/state-of-docs-traffic (29.07.2026)
- GitBook, documentation and agent data — https://www.gitbook.com/blog/ai-docs-data-april-2026 (13.05.2026)
- llms.txt — https://llmstxt.org/ (10.08.2026)
- Ahrefs, llms.txt study — https://ahrefs.com/blog/llmstxt-study/ (15.06.2026)
- Google, simplifying search results — https://developers.google.com/search/blog/2025/06/simplifying-search-results (12.06.2025)
- Ahrefs, schema and AI citations — https://ahrefs.com/blog/schema-ai-citations/ (11.05.2026)
- Google, localized page versions — https://developers.google.com/search/docs/specialty/international/localized-versions (checked 25.11.2026)
- Hugo, sitemap — https://gohugo.io/templates/sitemap/ (08.11.2026); Docusaurus, SEO — https://docusaurus.io/docs/seo (checked 25.11.2026)
