<!-- lesson: marketing.site | The company website and the open-source project website | 18 -->
<!-- section: hook -->
An engineer learns about a project at a conference and opens its website that evening. The home page talks about a “unified platform for digital transformation,” the button leads to a “request a demo” form, documentation lives on another domain, and nowhere does it explain how the open-source project differs from the company's paid version. The engineer closes the tab. A week later, their manager asks colleagues in a chat who has tried the project and hears, “The website seems a bit murky.” This lesson covers how to separate the company website from the open-source project website, what belongs on each, and how to guide someone from documentation to a sales conversation.

<!-- section: theory | Two websites with different responsibilities -->
A company that created an open-source project usually has two websites. The project website belongs to the project and, if the project has been donated to a foundation, follows its rules. CNCF's neutrality guidance says a project should not serve as one company's advertising channel: vendors are represented equally on the project site, and the commercial support page lists everyone providing it. A second domain alone does not create neutrality; project governance does.

The project website should describe the software's purpose, license, governance and maintainers, releases, architecture, installation, vulnerability reporting process, and ways to contribute. The company website should say who is selling and what they sell: supported builds and services, scope of support, operational responsibilities, how to buy, security and compliance evidence, customer stories, and how to try the product or talk to someone. Explain the company's relationship with the project openly on the company website: who created it, who develops it now, and what parts of the paid offering are outside the open-source project.

Keep installation and software operation information in project documentation, and commercial commitments on the company website, with relevant links between them. If the same product description is copied onto both sites, it has to be corrected in two places, and readers lose track of which claims are software capabilities and which are the company's contractual commitments.

<!-- section: theory | Where visitors come from -->
Traffic sources differ greatly between sites. According to Similarweb's estimate for October 2026, almost 48% of desktop visits to kubernetes.io came from organic search, followed by direct visits and referrals. For Tailscale's commercial website that month, around 62% of desktop visits were direct, followed by search and referrals. These are third-party estimates for two sites that are difficult to compare directly, not benchmarks for small projects; “direct” also does not mean the person typed the address by hand. For your own site, examine sources in your own analytics and compare the site with itself month by month.

<!-- section: theory | The path from documentation to a conversation -->
An infrastructure product has two valid buyer paths, and the website must support both. The first is self-directed: the person needs requirements and a working installation and wants to install the product themselves. The second goes through the company: the person needs architecture, support terms, and a procurement process and wants to talk. The project site can list all support providers, while the company site offers its own trial and conversation.

To see this journey, measure its steps separately: documentation visits, “try it” clicks, completed installations, the first working workload, and inquiries that sales is ready to work on. Count a product event, such as a running workload, as successful activation; creating an account is not yet activation. If the company and project sites are on different domains, Google Analytics 4 can preserve a person's identity between them through the `_gl` parameter when user consent permits it; without that setting, one person becomes several and referrals from your own site pollute the report. Bear in mind that a neutral project's rules may not allow a company to place its cross-domain analytics on the project website.

<!-- section: theory | The home page and testing -->
The company home page answers three questions within the first few seconds: what is this, who is it for, and what should I do next? The category is expressed in customers' words, as discussed in the course's first module. Immediately below it are two actions for the two paths: “Install” for people proceeding independently and “Talk to an engineer” for those going through the company. Then comes evidence: customer stories, source-code links, the license, and foundation participation if applicable.

An A/B test, where half of visitors see one page variant and half another, almost never produces a reliable answer about inquiries on a site with a few thousand monthly visitors because there are too few inquiries. Instead, it is more useful to watch recordings of how people use the site, talk to five buyers about what they looked for and could not find, and compare months before and after a change, understanding that this comparison is weaker than an experiment.

<!-- section: task | Task: separate the two websites' responsibilities -->
Complete this task in a spreadsheet. Open an open-source project's website and the website of the company that created it, such as your own project or any CNCF project with a commercial vendor. In two columns, list the information available on each site and mark information from this lesson's list that appears on both or is missing from both. Then follow both buyer paths, self-directed and through the company, and record where you got stuck and how many clicks it took to reach installation and the contact form.

<!-- quiz -->
? Where should you keep installation instructions for an open-source project and the company's commercial commitments?
+ Installation instructions in the project documentation and commitments on the company website, with links between them || Copied descriptions have to be updated in two places, and readers confuse software capabilities with contractual commitments.
- Everything on the company website || This makes the project lose its neutrality.
- Everything in the project documentation || One company's commercial commitments should not live on a neutral project's website.
<!-- /quiz -->

<!-- section: sources -->
- CNCF, project neutrality — https://contribute.cncf.io/projects/best-practices/community/vendor-neutrality/ (checked 25.11.2026)
- Similarweb, kubernetes.io and tailscale.com — https://www.similarweb.com/website/kubernetes.io/, https://www.similarweb.com/website/tailscale.com/ (October 2026)
- Google Analytics, cross-domain measurement — https://support.google.com/analytics/answer/10071811 (checked 25.11.2026)
