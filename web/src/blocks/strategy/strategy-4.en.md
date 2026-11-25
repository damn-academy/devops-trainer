<!-- lesson: strategy.agents | AI models and agents as advisers, implementers, and channels | 18 -->
<!-- section: hook -->
A founder learns that programs make two thirds of requests to the project's documentation and people only one third, and that developers increasingly tell an assistant to “deploy a Kubernetes cluster for my customers” without opening a single website. The founder wonders who the buyer is now: a person, an AI model giving advice, or an agent doing the work. This lesson covers three different roles AI models play in the infrastructure buyer's journey and how to prepare a product for each.

<!-- section: theory | Three different mechanisms -->
An AI model can play three roles. It can advise: a person asks which platform to choose and receives an answer with links; the marketing course's lesson on AI visibility covers this. It can execute: a developer's agent deploys and configures a product using documentation or an API. It can be a channel: a product is embedded in an agent's workflow by agreement with its creators, as Supabase is in Lovable. Agents that independently approve corporate infrastructure budgets are still virtually nonexistent, and there is no reliable data about them.

The Supabase and Lovable case shows the difference between a model's choice and a commercial integration: around 90 % of Lovable's interactions with Supabase use the API, but this is the result of an agreement between the companies; the model did not compare every database and select the best one.

<!-- section: theory | Documentation for agents and MCP -->
Vercel serves documentation in Markdown, including a separate `.md` page for each website page. In an experiment with Next.js 16 tasks, agents completed every task when the documentation index was in AGENTS.md, compared with 79 % in the best setup where the agent had to invoke a skill itself. Google, meanwhile, says search does not need special files such as `llms.txt`; Markdown is useful for developer agents, but not for Google Search.

On 3 October 2025, Supabase launched a remote MCP server with OAuth connections and warned in the announcement that permission was granted for everything at once. Three weeks earlier, on 16 September 2025, the company described a demonstrated prompt-injection scenario: text stored in a database could make an MCP-connected assistant execute someone else's commands. It also examined layered defenses. Easy connections increase the potential damage from untrusted text. For an infrastructure platform, a safe path is an MCP server or API for a learning environment with limited permissions and explicit human confirmation for costly and destructive operations.

In July 2025, Cloudflare counted around 71 thousand requests by Anthropic's crawler to HTML pages for every user visit from an AI answer. A huge volume of crawling does not prove that the channel brings people in.

<!-- section: theory | How to evaluate -->
Create a set of realistic tasks: choose a regional platform that must store data within the country, compare options for leaving VMware, deploy a customer's cluster, and restore a backup. Repeat them regularly on named models and versions, recording links, factual errors, completed operations, permission failures, and cost. Keep tests of neutral recommendations separate from tests through partner integrations. Publish stable product descriptions, versions, requirements, prices or pricing rules, license terms, limitations, reference architectures, and safe examples.

<!-- section: task | Task: five tasks for an agent -->
Complete this task with the developer assistant you use and record the results in a table. Give it five tasks for your product: the four from the lesson—choose a regional platform, compare VMware migration options, deploy a cluster and restore a backup—plus a task your support team frequently receives. If you have no developer assistant, use any chatbot with search and note that it cannot perform actions. For each task, record whether it found the needed documentation, completed the task, where it made mistakes and which permissions it needed. Identify three documentation gaps that hindered it and record how to fix them.

<!-- section: sources -->
- Anthropic, donating MCP — https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation
- Supabase, Lovable case — https://supabase.com/customers/lovable
- Vercel, Markdown documentation — https://vercel.com/docs/agent-resources/markdown-access
- Vercel, AGENTS.md versus skills experiment — https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals
- Google, generative search optimization guide — https://developers.google.com/search/docs/fundamentals/ai-optimization-guide (10.07.2026)
- Supabase, remote MCP server — https://supabase.com/blog/remote-mcp-server (03.10.2025); MCP and security — https://supabase.com/blog/mcp (16.09.2025)
- Cloudflare, crawl-to-referral ratio — https://blog.cloudflare.com/ai-search-crawl-refer-ratio-on-radar (01.07.2025)
