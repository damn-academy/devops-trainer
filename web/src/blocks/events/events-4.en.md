<!-- lesson: events.cfp | Conference talks: submission, preparation, and use after the event | 20 -->
<!-- section: hook -->
A CTO submitted “How our platform solves multitenancy problems” to KubeCon and was rejected. His engineer submitted “Isolating customer clusters on shared hardware: three incidents and what we changed,” with a reproducible test and measurements, and was accepted. This lesson covers how program committees select talks, which proposals they reject, how to prepare for a talk, and how to keep it useful after the conference.

<!-- section: theory | How many proposals are accepted -->
CNCF publishes KubeCon submission counts. KubeCon Europe 2024 received 2541 proposals and accepted 223, around 9 %; KubeCon North America 2024 received 1937 and accepted 218, around 11 %; KubeCon Europe 2025 received 2947 proposals, and organizers reported an acceptance rate of around 8 %. KubeCon North America 2025 received 2247 proposals, and KubeCon Europe 2026 received 2478, but organizers did not publish a comparable acceptance rate. You cannot divide the number of talks in the program by the number of proposals: the program includes maintainer talks, invited talks, and keynotes that do not go through the general selection process. As of late November 2026, final figures for KubeCon North America 2026 had not been published.

These figures suggest that roughly one in ten proposals makes it into KubeCon's general track, so you cannot rely on a single proposal. An individual may submit no more than three proposals to KubeCon North America 2026, including those where they are a co-speaker; excess proposals are removed.

<!-- section: theory | What reviewers reject -->
KubeCon's reviewer guidelines require each reviewer to evaluate proposals independently, disclose conflicts of interest, and maintain confidentiality. Generic topics without specifics, product advertising, copied or poor-quality AI-generated proposals, and proposals with little value for the audience receive low scores. A vendor employee can submit a useful technical talk, and analysis of the KubeCon Europe 2024 selection process showed that accepted speakers included vendor employees. However, sponsorship and employer affiliation do not replace value for the audience.

A good abstract answers five questions: what problem the engineer faces, what system and constraints are involved, what the team did, what measurements or failures demonstrated the results, and what attendees will be able to reproduce themselves. Example abstract: “We enabled customers to create virtual machines and clusters through Kubernetes API aggregation. The talk examines reconciliation failures, recovery behavior, and isolation tradeoffs, and provides a reproducible test.” Include only measurements you actually have: people notice invented deployment scale.

<!-- section: theory | Other routes to the KubeCon stage -->
Foundation projects have separate routes that do not go through general selection: maintainer-track talks, ContribFest sessions where participants contribute to a project together, project-area kiosks, and project lightning talks, seven-minute introductions before the main conference. KubeCon North America 2025 had 83 project kiosks, 38 lightning talks, and 71 maintainer-track talks. Eligibility for these formats belongs to the project and its maintainers; a company selling a distribution of the project does not acquire it. CNCF's co-located events alongside KubeCon, such as ArgoCon and CiliumCon, have their own calls for proposals, and a narrow technical topic often fits them better.

<!-- section: theory | Preparation and the demo -->
PostHog's speaker guide recommends learning about the room and format in advance, building the talk around a real situation, and explaining what broke and what you learned. A demo needs realistic data, readable code and screen content, a tested projector, and a fallback for a network outage; a customer's production account is unsuitable for a demo. Rehearse the entire talk with a colleague acting as an engineer in the audience, including questions and recovery from a failed demo, and remove details that obscure the main result.

<!-- section: theory | Using the talk after the event -->
After the conference, collect the official recording, slides, commands, and any corrections in one place, and link to it from the documentation, blog, and newsletter. A talk recording on CNCF's channel remains useful for years, especially when linked from documentation. One accepted talk can be repeated at meetups and KCDs using the approach from the previous lesson. Count incoming technical questions and repeat lab runs after the talk.

<!-- section: task | Exercise: an abstract for a reviewer -->
Complete the exercise in the “Talk proposal for the program committee” simulator on this page. Write an abstract about a problem your team solved, using the five questions from the lesson. An AI reviewer will assess it against a program committee rubric: audience value, absence of advertising, specificity, novelty, and reproducibility. Rewrite the abstract until every part of the rubric scores at least four out of five, and save the final text.

<!-- widget: rubric {"trainer":"events.cfp-review"} -->

<!-- section: sources -->
- CNCF, KubeCon Europe 2024 selection — https://www.cncf.io/blog/2024/01/30/inside-the-numbers-the-kubecon-cloudnativecon-selection-process-for-europe-2024/ (30.01.2024)
- CNCF, KubeCon North America 2024 selection — https://www.cncf.io/blog/2024/08/19/inside-the-numbers-the-kubecon-cloudnativecon-selection-process-for-north-america-2024/ (19.08.2024)
- CNCF, KubeCon London 2025 recap — https://www.cncf.io/blog/2025/05/09/tea-peaches-kubecon-cloudnativecon-london-recap-atlanta-sneak-peek/ (09.05.2025)
- KubeCon North America 2025, transparency report — https://www.cncf.io/wp-content/uploads/2025/12/KCNA25_TransparencyReport.pdf (19.12.2025)
- KubeCon Europe 2026, transparency report — https://www.cncf.io/wp-content/uploads/2026/04/KCEU26-Transparency-Report.pdf (28.04.2026)
- KubeCon North America 2026, reviewer guidelines and call for proposals — https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/program/submission-reviewer-guidelines/, https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/program/cfp/
- KubeCon, project opportunities — https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/features-add-ons/project-opportunities/
- PostHog, speaker guide — https://posthog.com/handbook/marketing/speaker-guide (checked 25.11.2026)
