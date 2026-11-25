<!-- lesson: marketing.email-newsletter | Your own newsletter: what to write and how to stay out of spam | 20 -->
<!-- section: hook -->
A marketer is proud of the newsletter: 45% of recipients open it. Then it turns out that almost half of those “opens” come from Apple's mail app, which loads emails automatically without human involvement, and that after a change of email service, a third of messages stopped reaching Gmail because the new service's domain signing was not configured. This lesson covers why an infrastructure company needs its own newsletter, the different purposes it can serve, what has changed in email providers' rules and in the law, and which figures in an email report are worth anything.

<!-- section: theory | Three different mailing lists -->
An infrastructure company usually has three types of email, and they must not be mixed. The first is an editorial newsletter sharing knowledge: analyses, category news, the best blog posts, and talk recordings. People read it because it is useful, so the product occupies little space. PostHog's Product for Engineers newsletter, discussed in the lesson on blogging platforms, writes about product engineers' work and grew from 38 thousand to more than 100 thousand subscribers in 2025.

The second type consists of release and security notifications. People operating the project expect them: the version, upgrade path, risks, deprecations, and a link to the full changelog. Keep this mailing list separate and write to it sparingly and only when there is something to say; security notifications must reach even people who have unsubscribed from everything else.

The third type helps people use the product: assistance in the first weeks after installation or signup, and reminders about unfinished setup. PostHog described in detail how it redesigned these emails. In the 2024 version, 52% of recipients opened them, 3.1% clicked links, 2.2% began using the product, and 0.3% unsubscribed. In the 2025 version, emails began taking into account which product the person was interested in and how far they had progressed in setup, and all messages were sent by a real person the recipient could reply to. In the same account, PostHog acknowledges mistakes: setup checks fired incorrectly and sent the wrong emails, sequences became too complex, and handing people over to sales felt too pushy.

In May 2025, CNCF combined its newsletters into one monthly edition. The announcement does not explain why or how readership changed, but the example shows that even for a large organization, less frequent and more complete can be better than frequent and fragmented.

<!-- section: theory | Which numbers matter -->
Email opens no longer measure interest. Since 2021, when privacy protection is enabled, Apple's mail app loads email content in the background regardless of whether the person opened it, and hides their address. The tracking pixel used to count opens therefore loads for unread messages too, inflating the open rate. The click-to-open rate, sometimes used instead of opens, inherits the same error.

It is more useful to count link clicks excluding bots, replies, unsubscribes, and what the person did in the product or documentation after the email. For comparison, a MailerLite study of 3.6 million campaigns from December 2024 to November 2025 found a median click rate of around 2.1% across all industries and around 1.2% for software and web application newsletters, with an unsubscribe rate of 0.2% in that group. The sample consisted of MailerLite customers' newsletters across different industries, so for an infrastructure company these figures are reference points, not targets.

<!-- section: theory | Gmail and Yahoo rules -->
Since February 2024, Gmail and Yahoo have imposed requirements on bulk senders, and in November 2025 Google tightened enforcement up to refusing messages. Gmail considers a bulk sender to be someone sending around 5,000 messages per day to personal Gmail addresses from one primary domain, and that status lasts permanently; splitting sending across subdomains does not circumvent it. The requirements are as follows. The domain must be authenticated through SPF and DKIM records. A DMARC policy must be published with at least `p=none` and domain alignment. The sending server's forward and reverse DNS records must match, and the connection must be encrypted. Messages must include one-click unsubscribe that the mail app displays beside the sender; a link in the footer alone is insufficient. Unsubscribe requests must be processed within two days. The spam complaint rate must stay below 0.3%, and Google recommends keeping it below 0.1%. Yahoo requires almost the same things but differs in unsubscribe details, so check both providers' requirements.

If messages stop arriving, first check the providers' dashboards, such as Google Postmaster Tools, and rejection codes in the sending log; look for a cause in the email content last.

<!-- section: theory | Consent and the law -->
Mailing in the European Union requires a lawful basis, and if that basis is consent, it must be freely given, informed, specific, and withdrawable. A GitHub account or a repository star does not constitute consent to a mailing list. UK rules distinguish corporate subscribers from sole traders, but data protection requirements also apply to business addresses; the claim that “business emails are not covered by GDPR” is incorrect.

Double opt-in, where a person clicks a link in an email after subscribing, is not legally mandatory for every business newsletter, but it proves that the address belongs to the subscriber and protects the list against typos and spam traps. Retain the consent wording, its version, the subscription source, confirmation time, and unsubscribe time.

<!-- section: task | Task: check your mailing domain -->
Complete this task in the terminal on this page. The practice domain `mail.example-cloud.test` sends the company's newsletter, and some messages do not reach Gmail. Inspect its records with `dig TXT mail.example-cloud.test`, `dig TXT selector1._domainkey.mail.example-cloud.test`, and `dig TXT _dmarc.mail.example-cloud.test`. Identify which Gmail requirement the domain does not meet and write down the corrected record. Then check your company's real mailing domain with the same commands and open its latest newsletter in Gmail: does the mail app show an unsubscribe button beside the sender's name?

<!-- widget: marketing.dns-lab -->

<!-- quiz -->
? Why does the email open rate no longer measure readers' interest?
+ With privacy protection enabled, Apple Mail loads messages in the background, triggering the pixel for unread emails || It is more useful to count clicks excluding bots, replies, unsubscribes, and actions taken after the email.
- Email clients stopped displaying images || The cause is background loading of emails; images have nothing to do with it.
- Opens are prohibited by law || The law does not prohibit them.

? What spam complaint rate does Google recommend staying below?
+ Stay below 0.1% and never reach 0.3% || At 0.3% or above, Gmail applies penalties.
- 1% || This is far above the threshold.
- No threshold has been set || Gmail publishes thresholds in its sender requirements.
<!-- /quiz -->

<!-- section: sources -->
- PostHog, how we built email onboarding — https://posthog.com/blog/how-we-built-email-onboarding (18.02.2025)
- PostHog, newsletter handbook — https://posthog.com/handbook/content/newsletter (checked 25.11.2026)
- MailerLite, email industry benchmarks — https://www.mailerlite.com/blog/compare-your-email-performance-metrics-industry-benchmarks (03.12.2025)
- Apple, Mail Privacy Protection — https://www.apple.com/legal/privacy/data/en/mail-privacy-protection/ (checked 25.11.2026)
- Gmail, sender requirements — https://support.google.com/mail/answer/81126 and https://support.google.com/mail/answer/14229414 (checked 25.11.2026)
- Yahoo, sender best practices — https://senders.yahooinc.com/best-practices/ (checked 25.11.2026)
- European Commission, legal grounds for processing data — https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data_en (checked 25.11.2026)
- ICO, business-to-business marketing — https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/ (checked 25.11.2026)
