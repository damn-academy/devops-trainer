<!-- lesson: strategy.ecosystem | Ecosystem: embedded distribution, partners, and cloud marketplaces | 22 -->
<!-- section: hook -->
A company signed twenty partnership agreements with integrators and put their logos on its website. Over a year, the partners brought in one deal. Meanwhile, Supabase integrated into products where developers build applications with AI, and those products created millions of Supabase projects through its API in a few months. This lesson explains how a partnership that delivers distribution differs from a logo in a directory, how programs for integrators and hosting providers work, what cloud marketplaces charge, and what technology alliances offer.

<!-- section: theory | Embedded distribution -->
On 5 December 2025, Supabase launched its white-label Supabase for Platforms offering and reported that Lovable, Bolt.new, and Baidu MeDo had created millions of Supabase projects in the preceding months. A partner platform creates and manages projects through an API or a remote MCP server, embeds administration into its own interface, and can transfer a project to a user. The Lovable case study says Lovable integrated in January 2025, around 90 % of its interactions with Supabase use the Management API, and Lovable itself creates around one million projects a week, many on Supabase. Not every such project is a Supabase customer, but this is distribution within someone else's workflow.

An integration directory and an embedded creation and purchasing path are different assets. Vercel distinguishes native marketplace integrations that sell third-party products within Vercel from other integrations, guides, and templates. For a cloud platform, a package for a hosting provider or hardware manufacturer should explicitly describe tenant creation, usage metering, billing integration, branding, updates, incident ownership, and customer handover. An integrator package describes migration deliverables, training, and escalation. Count retained production tenants, usage, and support costs; the number of signed agreements says little.

Sidero separates technology partners, solution providers, and resellers, making it clear who implements, who resells, and who is merely compatible. Vates and Exodata turned a strategic alliance into nine independent XCP-ng platforms in six regions, and by the third month Exodata reported performance on par with the previous platform without any loss of service quality.

<!-- section: theory | Cloud marketplaces -->
Marketplace fees depend on the type of offer. AWS charges 3 % on public SaaS offers and 20 % on public server offers: machine images, containers, and machine-learning models. For private offers, AWS charges 3 % for a total contract value below one million dollars, 2 % from one million to ten million, and 1,5 % from ten million; renewals cost 1,5 %. This schedule has applied since 5 January 2024. Private offers through channel partners add half a percentage point. Since 21 April 2025, Google Cloud has left vendors 97 % on standard offers and private offers below one million dollars, 98 % from one million to ten million, and 98,5 % from ten million. Microsoft states a standard fee of 3 % for offers sold through its marketplace. The claim that “all marketplaces charge 3 %” is wrong for an infrastructure product distributed as an image or container.

An AWS-commissioned IDC study in August 2025 surveyed 287 sellers: they reported that their marketplace business was growing 41 % faster than the rest of their business; 45 % said the marketplace shortened the sales cycle, and 33 % said it improved renewals. The sample contains more large sellers, and “45 % of respondents” does not mean “a sales cycle that is 45 % shorter.” In March 2026, Grafana signed a five-year strategic collaboration agreement with AWS, combining technical integration, joint sales, migrations, and the marketplace. This illustrates how an open-source vendor can work with a hyperscaler instead of changing its license against it, as Redis did.

An open-source project with a container image does not automatically become a product that can be sold through a cloud marketplace: Google checks both compliance with its rules and the business case. For a private-cloud platform running on your own hardware, first check whether your buyer purchases through a cloud budget at all.

<!-- section: theory | Technology alliances -->
NVIDIA Partner Network distinguishes cloud providers, hardware manufacturers, software vendors, integrators, solution providers, and service partners, with requirements and benefits depending on partner type and competency; saying “we support GPUs” is not enough to qualify. Red Hat's 2025 certification rules distinguish partner-validated products from Red Hat-certified products for commercial software on OpenShift; a compatible application, a certified Operator, and an alternative Kubernetes distribution are different offerings. For a small vendor, a tested reference configuration and a service partner who can install it give buyers more than a broad alliance announcement. Public prices and measured sales growth from these programs for small vendors are unavailable.

<!-- section: theory | Example partner package for a hosting provider -->
Here is a completed package for the fictional regional hosting provider Westhost, which wants to sell managed databases and Kubernetes clusters on your company's platform.

The partner receives the right to sell services under its own brand, licenses at a 40% discount from end-customer prices, training for two engineers and a dedicated second-line support channel. The partner operates the platform on its hardware, provides first-line support, finds customers and invoices them. Your company releases updates, responds to second-line requests within four working hours, provides training and reviews incidents and plans with the partner quarterly.

The partner pays a monthly rate for each running customer cluster. Deals your company brings are recorded in a shared table and receive a smaller discount. Register each deal before the first customer meeting to avoid ownership disputes. If an incident remains unresolved after eight hours, the partner's support lead calls your on-call engineer; after a day, both company leaders speak.

For the first joint deal, the partner selects one customer needing a managed database. Together you run a month-long pilot. Success means the customer's workload runs on the platform and a one-year contract is signed. Both sides then review the result and decide whether to expand the package.

Explain each term: why a 40% discount instead of 20%, why a four-hour second-line response, and why registration precedes the meeting. A partner may sign unexplained terms but dispute them at the first conflict.

<!-- section: task | Task: one partner package -->
Complete this task in a document. Choose one partner type for your platform: a hosting provider, an integrator, or a hardware manufacturer. Describe its package using the Westhost example, explaining why you chose each term: what the partner receives, what they do and what you do, how revenue is shared, who owns incidents, and how the first joint deal works. Then calculate how much you would pay the AWS marketplace on a new private offer worth 400 000 dollars sold directly to the customer without a channel partner, and on a public container offer for the same amount. Calculate from the pretax contract value. Check: 12 000 and 80 000 dollars.

<!-- section: sources -->
- Supabase for Platforms — https://supabase.com/blog/introducing-supabase-for-platforms (05.12.2025); Lovable case — https://supabase.com/customers/lovable
- Vercel, integrations — https://vercel.com/docs/integrations (04.12.2025)
- Sidero, partners — https://www.siderolabs.com/partners
- Vates, sovereign IT infrastructure and Exodata — https://vates.tech/blog/what-sovereign-it-looks-like-in-practice-the-exodata-use-case-with-vates/
- AWS Marketplace, fees — https://docs.aws.amazon.com/marketplace/latest/userguide/listing-fees.html
- Google Cloud, marketplace revenue share — https://cloud.google.com/terms/marketplace-revenue-share-schedule (from 21.04.2025)
- Microsoft, marketplace publisher FAQ — https://learn.microsoft.com/en-us/partner-center/marketplace-offers/marketplace-faq-publisher-guide
- Grafana and AWS — https://grafana.com/press/2026/03/10/grafana-labs-signs-strategic-collaboration-agreement-with-aws-to-accelerate-open-observability-adoption-at-scale/ (10.03.2026)
- NVIDIA Partner Network — https://www.nvidia.com/en-us/about-nvidia/partners/
- Red Hat, OpenShift certification policy 2025 — https://docs.redhat.com/en/documentation/red_hat_software_certification/2025//html-single/red_hat_openshift_software_certification_policy_guide/index

<!-- lesson: strategy.standards | Standards, foundations, certification, and training | 20 -->
<!-- section: hook -->
A buyer at a bank opened the platform procurement requirements and read: “Certified Kubernetes distribution, Kubernetes AI Conformance for the current version, certified specialists on the supplier's staff.” One bidder had all of this; another had only GitHub stars. This lesson explains how foundations, conformance programs, professional certifications, and training work as a long-term strategy.

<!-- section: theory | Donating a project to a foundation and membership -->
Donating a project to CNCF and a company joining the foundation are different decisions. To donate a project, it undergoes review by the foundation’s Technical Oversight Committee (TOC), signs a contribution agreement, transfers its trademark to the Linux Foundation, and establishes a neutral project organization; this is a decision about governance and assets, not a way to buy visibility. In December 2025, Anthropic donated MCP to the Agentic AI Foundation under the Linux Foundation, when the protocol had more than ten thousand public servers and 97 million software development kit (SDK) downloads a month. The mechanism behind such a transfer is that competitors can more easily adopt a common interface under shared governance. A foundation does not guarantee a project will live forever: in 2025, CNCF archived 13 projects.

<!-- section: theory | Conformance programs -->
The Certified Kubernetes program checks technical evidence, product identity, and the participation agreement; commercial vendors must be CNCF members or pay a comparable fee, while nonprofit and community distributions can participate without it. Certification applies to a specific product and version, not to the vendor's other services. On 11 November 2025, CNCF launched the Kubernetes AI Conformance program to standardize support for AI workloads; by 24 March 2026, the number of certified AI platforms had grown from 18 to 31, including OVHcloud and Spectro Cloud, and requirements for Kubernetes version 1.35 had become stricter. Ordinary Kubernetes certification does not establish conformance with the AI profile, and buyers check the current profile and version.

<!-- section: theory | Professional certification and training -->
According to CNCF's 2025 annual report, 291 thousand people had registered for the Certified Kubernetes Administrator (CKA) exam since its launch, 16 % more than a year earlier, and 429 thousand for the free Kubernetes course; these are exam registrations, and fewer people passed. Cloud Native Platform Associate (CNPA) certification appeared in April 2025 and Cloud Native Platform Engineer (CNPE) in November, and by the end of the year there were 230 certified Kubernetes service providers. In March 2026, CNCF changed its certification renewal process, reporting more than 3500 holders of all five certifications, known as Kubestronauts. A practical exam run by an independent organization and a course completion certificate are different things.

In February 2026, MongoDB described a university program with curricula, free credits, and certification, partners in India, and access through more than one hundred educational institutions; the company had reached hundreds of thousands of students toward a target of 500 thousand by 2028. ScyllaDB University offers practical courses. O'Reilly sells sponsorship of books, reports, and interactive materials; a sponsored book is not independent validation of a product. Educational material for an infrastructure platform should end with a repeatable working result: create a tenant, restore a database, replace a failed node, or rehearse a migration. It should remain openly accessible without a contact form.

<!-- section: theory | Documentation and reference architectures -->
In CNCF's 2024 survey, published in March 2025, 45 % of respondents named insufficient documentation as a problem when using projects, alongside the risk of abandonment and complexity. Vercel tested how agents performed Next.js 16 tasks: with an 8 KB documentation index in AGENTS.md, agents completed every task, compared with 79 % for the best setup using skills the agent had to invoke itself. Documentation and reference architectures are assets for years: executable examples, version compatibility matrices, backup and recovery procedures, assumptions about failure domains, and upgrade and rollback paths.

<!-- section: theory | Standards beyond Kubernetes and how to record conformance -->
Each segment has its own conformance programs. Buyers almost always ask a cloud service provider about a SOC 2 Type II report and ISO/IEC 27001 certification; an encryption product for the US public sector needs a module validated against FIPS 140-3 through NIST's program; a container image registry needs to pass OCI distribution specification conformance tests. A certificate applies to a specific product version and period, so record a row with evidence rather than “we have a certificate”.

An example of a completed row. Procurement requirement: “Certified Kubernetes distribution for the current supported version”. Evidence: an accepted pull request in the cncf/k8s-conformance repository with version 1.34 test results and the acceptance date. Status: met for 1.34; tests for 1.35 have not yet run. Next review: one month after the new Kubernetes version is released. Another example: requirement “SOC 2 Type II report no older than 12 months”; evidence: the auditor's report covering April 2025 to March 2026; status: met; next review: April 2027, when the next report is needed.

Two illustrative requirement excerpts for those without a public procurement notice at hand. A bank: “The platform must be a certified Kubernetes distribution for the current version, the vendor must provide a SOC 2 Type II report, and cryptographic modules must be validated against FIPS 140-3”. A hosting provider: “S3 API compatibility for the operations listed in the appendix, an image registry that passes OCI conformance tests, and vendor disclosure of the telemetry collected”.

<!-- section: task | Task: map the standards for your product -->
Complete this task in a table. List the conformance and certification programs relevant to your product, which ones you already hold, for which version, and when they expire. Find certification requirements in two public procurement notices or tenders in your segment and fill in a row for each with “requirement, evidence, status, next review date”, as in the lesson's example; if you have no procurement notices at hand, use the two illustrative excerpts from the lesson. Then write down one learning outcome that could conclude a free course on your product.

<!-- section: sources -->
- CNCF, project lifecycle — https://contribute.cncf.io/projects/lifecycle/
- Anthropic, donating MCP to a foundation — https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation (December 2025)
- CNCF, 2025 annual report — https://www.cncf.io/reports/cncf-annual-report-2025/ (24.02.2026)
- CNCF, Certified Kubernetes review — https://github.com/cncf/k8s-conformance/blob/master/reviewing.md
- CNCF, Kubernetes AI Conformance launch — https://www.cncf.io/announcements/2025/11/11/cncf-launches-certified-kubernetes-ai-conformance-program-to-standardize-ai-workloads-on-kubernetes/ (11.11.2025); program growth — https://www.cncf.io/announcements/2026/03/24/cncf-nearly-doubles-certified-kubernetes-ai-platforms/ (24.03.2026)
- CNCF, new recertification program — https://www.cncf.io/blog/2026/03/23/cncf-introduces-a-new-recertification-program-as-kubestronaut-community-surpasses-3500/ (23.03.2026)
- O'Reilly, sponsorship — https://www.oreilly.com/content-marketing/available-products.html
- ScyllaDB University — https://university.scylladb.com/courses/
- Vercel, Markdown documentation access — https://vercel.com/docs/agent-resources/markdown-access
- Vercel, AGENTS.md versus skills experiment — https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals
