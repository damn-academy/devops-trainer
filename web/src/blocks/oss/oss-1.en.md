<!-- lesson: oss.why | Why companies need open source projects and how they make money from them | 22 -->
<!-- section: hook -->
The board asks the founder why the company gives away its main product for free and suggests “closing off at least the new features.” The founder recalls HashiCorp, Redis, Elastic, and Linkerd and realizes that every decision about licensing and the boundary between free and paid features has consequences that become visible years later. This course covers how an open source project owned or supported by a company works: from revenue models and governance to contributors, community, the CNCF foundation, and crises. The first lesson examines revenue models and what happened to companies that changed their licenses.

<!-- section: theory | Four ways to make money -->
Companies built around open source infrastructure projects earn revenue in four ways, often combining several. Open core means that the company sells an enterprise version with features for large organizations: Kubermatic, for example, keeps its Community Edition under Apache 2.0 and its Enterprise Edition with paid features for large deployments in a single repository. A managed service means that the company operates the product for the customer. A support subscription means that the customer pays for support, updates, and certified builds. An enterprise distribution means that the company releases its own tested build of an open source project.

In September 2025, Grafana Labs reported annual revenue of more than 400 million dollars and more than 7000 paying organizations, with an open core under AGPL. This shows that a large paid business and an open source ecosystem can coexist; the figure does not prove that AGPL caused the growth. The general rule from these companies' experience is to sell the work that customers want to stop doing themselves and clearly describe what the open source project can do on its own.

<!-- section: theory | What happened to companies that changed their licenses -->
On 10 August 2023, HashiCorp moved future releases of its products from MPL 2.0 to Business Source License 1.1, citing competition from commercial providers. BSL is not on the list of OSI-approved open source licenses. The community responded with a fork: OpenTofu became a Linux Foundation project, and in June 2025, by release 1.10, its GitHub releases were approaching ten million downloads. These are downloads, including those from automated builds, so the number of users is lower.

In March 2024, Redis moved future releases to RSALv2 and SSPLv1, which allow people to read the code but are not considered open source. Within weeks, AWS, Ericsson, Oracle, Google, and other companies, together with the Linux Foundation, established the Valkey fork under BSD; within six months, Valkey released version 8.0, followed by 8.1 in April 2025, and in March 2025 the project had 150 core contributors from 27 companies. On 1 May 2025, Redis added an AGPLv3 license option for Redis 8 alongside the existing options; it did not return to its previous BSD license, and its CEO acknowledged that relations with the community had suffered.

Elastic moved away from Apache 2.0 in 2021 and added an AGPL option for the free parts of Elasticsearch and Kibana alongside SSPL and Elastic License 2.0 in August 2024. In April 2021, Grafana Labs moved its core projects from Apache 2.0 to AGPLv3; AGPL remains an open source license, which is substantially different from moving to a license that only allows people to read the code. In November 2023, Sentry introduced the Functional Source License, which converts to Apache 2.0 after two years, and explicitly states that FSL is not OSI-approved.

In February 2024, Linkerd kept its license and changed its release process: the project stopped publishing its own stable builds, and vendors now publish stable distributions, while the source code and interim builds remain open under Apache 2.0. Users objected that they had lost their usual way of obtaining stable versions. Eight months later, the CEO of Buoyant, the company behind Linkerd, reported that enterprise customer numbers and recurring revenue had doubled and the company had become profitable; he did not provide absolute figures.

<!-- section: theory | Lessons from these stories -->
Any decision about licensing and releases should distinguish three things: rights to the source code, availability of supported builds, and paid support and operations services. Linkerd's experience shows that builds can cause conflict without a license change. Redis's experience shows that restoring an open source license does not restore the previous permissive terms or the previous level of trust. None of these companies has a measurement showing the percentage by which restricting a license increases or decreases revenue. What is known is that, after a license change, major users and competitors can organize a fork under a neutral foundation within weeks, leaving the company with a competitor using its own code.

If a project has been transferred to a foundation, the company can no longer change its license unilaterally: the foundation owns the trademark, and changes follow the project's governance rules. The company accepts this constraint in exchange for the trust of major users and participation by other companies.

<!-- section: task | Exercise: the boundary between open source and paid versions -->
Complete the exercise in the “Boundary Between Open Source and Paid Versions” simulator on this page. Assign twenty features of a fictional platform to its open source or paid version. The simulator will show how the community and buyers react, following the rule discussed in the product course: features needed by an organization as a whole are generally accepted as paid features, while charging for features everyone needs causes dissatisfaction. Then list three features of your own project that you would never move to the paid version, and explain why.

<!-- widget: boundary {"data":"product.boundary"} -->

<!-- section: sources -->
- Kubermatic, repository — https://github.com/kubermatic/kubermatic
- Grafana Labs, 400 million dollars in revenue — https://grafana.com/press/2025/09/30/grafana-labs-surpasses-400m-arr-and-7000-customers-gains-new-investors-to-accelerate-global-expansion/ (30.09.2025)
- HashiCorp, move to BSL — https://www.hashicorp.com/en/blog/hashicorp-adopts-business-source-license (10.08.2023)
- OpenTofu 1.10 — https://opentofu.org/blog/opentofu-1-10-0/ (23.06.2025)
- Redis, license change — https://redis.io/blog/redis-adopts-dual-source-available-licensing/ (20.03.2024); AGPL option — https://redis.io/blog/agplv3/ (01.05.2025)
- Linux Foundation, a year of Valkey — https://www.linuxfoundation.org/blog/a-year-of-valkey (22.04.2025)
- Elastic, open source again — https://www.elastic.co/blog/elasticsearch-is-open-source-again (29.08.2024)
- Grafana, licensing — https://grafana.com/licensing/
- Sentry, Functional Source License — https://blog.sentry.io/introducing-the-functional-source-license-freedom-without-free-riding/ (17.11.2023)
- Linkerd, release policy — https://linkerd.io/releases/; Buoyant, clarification — https://www.buoyant.io/blog/clarifications-on-linkerd-2-15-stable-announcement (23.02.2024); Linkerd Forever — https://www.buoyant.io/blog/linkerd-forever (23.10.2024)
