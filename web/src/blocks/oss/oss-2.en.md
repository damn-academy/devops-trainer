<!-- lesson: oss.governance | Project governance: GOVERNANCE.md, roles, and decisions | 24 -->
<!-- section: hook -->
An engineer from a large user company had been submitting good changes to a project for six months when they asked in an issue how to become a maintainer. There was no answer because nobody in the project knew: all maintainers worked for the founding company, merge permissions were handed out through personal connections, and GOVERNANCE.md had appeared a week before the application to a foundation, describing a committee that had never met. A month later, the engineer started contributing to a competing project. This lesson covers how to make open source project governance work in practice: which documents are needed, how the role ladder works, how decisions are made, and how a project with a single vendor stays neutral.

<!-- section: theory | Project documents -->
CNCF provides document templates for projects. The GOVERNANCE.md template comes in two versions: maintainer-led governance and governance with elections. The maintainer template covers nomination, acceptance, removal, emeritus status, meetings, resource requests, vulnerability response, and code of conduct enforcement, while leaving specific thresholds, such as the number of votes required, to the project. An emeritus maintainer retains neither voting rights nor merge permissions under the template. The template guide warns against three mistakes: organizational diversity for appearances, rules that nobody applies, and a mismatch between the permissions described in the document and those in the repository.

The practical advice is to choose the smallest structure that describes how the project works now, and keep evidence of it in use: nominations, votes, and decisions. A committee invented just before an application is not evidence.

CONTRIBUTING describes how someone starts contributing: how to run tests locally, fix documentation, reproduce a bug, request a review, sign off a commit under the DCO (the author’s confirmation that they have the right to submit the change under the project’s license; see the CLA and DCO section below), and report a vulnerability. Rules about who makes decisions belong in GOVERNANCE.md, and the two documents should not be mixed.

<!-- section: theory | The role ladder -->
Kubernetes distinguishes contributors, reviewers, and approvers, tying each role to responsibility for reviews and areas of code. The simplified ladder “contributor, reviewer, approver, maintainer” is useful for teaching, but CNCF does not require these four titles. What matters is that each promotion is tied to a scope of responsibility, evidence of work and sponsorship, and repository permissions. A reviewer should not silently receive merge permissions. Expectations of a maintainer should be described in terms of review quality and ongoing responsibility; commit counts say little about them.

<!-- section: theory | How decisions are made -->
Lazy consensus is a process in which a proposal is published, a deadline for objections is announced, a decision owner and an escalation path are named, and the decision is accepted if no objections arise within a reasonable period. It suits routine, reversible decisions. Lazy consensus does not override explicit votes, security procedures, or rules on employer balance. There is no CNCF requirement for “72 hours for lazy consensus”: each project sets the period in its own rules.

<!-- section: theory | Neutrality with a single vendor -->
Many CNCF projects are developed mainly by one company. The 2024 Cilium project journey report lists more than a thousand organizations and nearly 4500 contributors, but Isovalent accounted for 90 % of contributions in the cited breakdown and Google for 1 %. Broad participation does not mean equal control or equal funding, and the foundation knows this.

CNCF's vendor neutrality rules require the same rules for all vendors in project channels, prohibit unsolicited direct sales messages, and require fair representation of commercial providers; the project blog should direct readers who need enterprise support to a neutral providers page. In practice, this means that fixes from a competitor are accepted under the same rules as those from the founding company, a competitor can be listed as a support provider, and technical review is kept separate from commercial rivalry. Maintainers' company affiliations and decision rights should be disclosed openly.

The CNCF charter requires the project's trademark and logo to be transferred to the foundation and an OSI-approved license to be chosen. Contributors' copyright in the code does not automatically transfer to the foundation, so the claim that “CNCF owns all the code” is incorrect.

<!-- section: theory | CLA and DCO -->
The DCO, Developer Certificate of Origin, is a contributor's confirmation that they have the right to submit a change under the project's license and understand that the contribution is public. A `Signed-off-by` line in the commit serves as the DCO signoff. The DCO does not transfer copyright or grant permission to relicense the code. A CLA, a contributor license agreement, may grant a company or foundation broader rights, depending on its wording. The CNCF charter allows projects to choose an approved CLA while also describing DCO signoff and acceptance of contributions under Apache 2.0, so the choice is not always mutually exclusive. Explain signoff in CONTRIBUTING and check it automatically, without treating a missing signoff as hostility.

<!-- section: theory | The code of conduct in practice -->
A code of conduct works when it is enforced. CNCF's 2025 transparency report describes a case in which a community leader repeatedly behaved with hostility and disrupted work: the foundation investigated through documents and interviews, removed the person from their leadership role, restricted their participation in events for six months, and allowed them to apply for a leadership role again after a year. The maintainer governance template excludes an accused maintainer from private discussions of their case and describes escalation to the CNCF committee. Specify reporting contacts and recusal procedures before the first conflict: the accused person's employer should not decide complaints about its own employees alone.

<!-- section: task | Exercise: GOVERNANCE.md in an evening -->
Complete the exercise in the “GOVERNANCE.md in an Evening” simulator on this page. Assemble a governance file for a fictional project from CNCF template blocks: roles, nomination, removal, decision-making, security, and code of conduct. The simulator will then show the project's CODEOWNERS file and repository permissions and identify contradictions between your GOVERNANCE.md and who actually has merge permissions. Resolve the contradictions so that the document describes reality.

<!-- widget: governance {"data":"oss.governance"} -->

<!-- section: sources -->
- CNCF, GOVERNANCE.md template — https://github.com/cncf/project-template/blob/main/GOVERNANCE.md; CNCF, maintainer-led governance template — https://github.com/cncf/project-template/blob/main/GOVERNANCE-maintainer.md; CNCF, CONTRIBUTING.md template — https://github.com/cncf/project-template/blob/main/CONTRIBUTING.md (checked 25.11.2026)
- Kubernetes, contributor roles — https://github.com/kubernetes/community/blob/main/community-membership.md
- CNCF, Cilium project journey — https://www.cncf.io/reports/cilium-project-journey-report/ (11.11.2024)
- CNCF, vendor neutrality — https://contribute.cncf.io/projects/best-practices/community/vendor-neutrality/
- CNCF, charter — https://github.com/cncf/foundation/blob/main/charter.md
- Developer Certificate of Origin — https://developercertificate.org/
- CNCF, code of conduct transparency — https://www.cncf.io/conduct/transparency/ (2025)
