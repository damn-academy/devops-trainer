<!-- lesson: marketing.platforms-reddit | Reddit: communities with their own rules | 18 -->
<!-- section: hook -->
A company engineer wrote a Reddit post saying “We released an open-source private cloud platform, give it a try” and posted it in five communities at once. Within an hour, two communities had removed it, a third had downvoted it, and in a fourth, a member wrote that the company was “spamming every subreddit.” That comment received more votes than the post itself. A month later, the same engineer answered a question in r/kubernetes about why someone's namespace deletion was stuck, explained the cause in detail, and mentioned at the end that they were working on a similar problem in an open-source project. Hundreds of people saved that answer, and several later joined the project's chat. This lesson covers how Reddit works for a company building an infrastructure product, and why these two stories ended differently.

<!-- section: theory | How Reddit works and who decides what belongs -->
Reddit consists of communities called subreddits, each with its own moderators and rules. The platform's general rules prohibit spam: repetitive mass posting, unsolicited private messages, and vote manipulation. Everything else, including how much you can write about your own product, is decided by the moderators of each community.

Advice about Reddit often repeats the “nine to one” rule: for every post about yourself, there should be nine useful posts about something else. Reddit abandoned this as a general rule back in 2017, but individual communities kept it or devised their own. The only reliable way to find out what is allowed is therefore to read the community's rules on its page in full and, when in doubt, message the moderators before posting.

Four communities matter for an infrastructure product, and their rules differ considerably as of late 2026. In r/kubernetes, stricter rules on advertising and disclosing employment were discussed in 2025; before posting, check which were adopted. r/devops has a regular self-promotion thread, where product announcements belong, while the main feed is for discussing problems. In r/selfhosted, moderators require promoted software to run on your own server and to be released, documented, and working; projects less than three months old are directed to a separate thread for new projects. In 2026, r/homelab introduced mandatory labels for software projects, disclosure of AI assistance in development, and a requirement for a repository to have at least a month's commit history and screenshots; commercial advertising is restricted and discussed separately with moderators.

<!-- section: theory | What works for an engineering company -->
Reddit rewards people who solve other people's problems. A company engineer who regularly answers questions in their field, discloses their employer when mentioning their product, and mentions it only where it solves the person's problem gradually becomes a recognizable member of the community. One day, that person can talk about a release, and the community will treat it as news from someone they know.

A post that sparks discussion usually tells the story of a problem: how a team migrated a cluster from one storage version to another and what broke, what measurements they obtained for virtual machines in Kubernetes on specific hardware, or why a project dropped one component in favor of another. The product's name appears as part of the story. A post that starts with the product name and an invitation to try it reads as advertising, even if the product is open-source and free.

An AMA, or “ask me anything” session, works when the author has something to discuss openly: architectural tradeoffs, a license change, or an outage and its causes. Reddit provides tools for announcing these sessions, but the session needs to be agreed with the community's moderators.

<!-- section: theory | Reddit in search and AI answers -->
In February 2024, Google signed an agreement with Reddit to access its content. Reddit discussions subsequently began appearing more often in search, and many people concluded that any Reddit post automatically gets a ranking boost. The agreement makes no such promise. Research shows that Reddit is prominent in AI answers, but its share fluctuates considerably: according to Ahrefs data for May 2025, Reddit appeared in 5.5% of Google AI Overviews; according to Profound data for September and October 2025, Reddit accounted for around 6% of links in Perplexity answers and around 1% in ChatGPT answers; and in summer 2026, Reddit's share of ChatGPT links fell almost sevenfold within a few weeks. These figures support one reliable observation: a good Reddit answer may surface a year later in an AI answer about your category, but you cannot build a plan around that.

<!-- section: theory | What not to do -->
Do not post the same announcement in several communities on the same day: members see the repetition, and moderators consider it spam. Do not ask employees and friends to vote for a post: Reddit tracks coordinated votes, and penalties affect both the account and the domain. Do not create accounts pretending to be satisfied users: these schemes get exposed, and afterward any mention of the company in the community is met with ridicule. Do not argue with the author of a harsh product review: thank them, investigate the problem, respond with facts, and, if they are right, say what you will fix and when.

<!-- section: task | Task: three answers and one post -->
Complete this task on Reddit from your own account, listing your employer in your profile. Over two weeks, find three questions in one relevant community that you can answer better than anyone else in the thread, and answer them in detail, without mentioning the product unless it solves the questioner's problem. Then read that community's rules and draft one post about a technical problem your team solved. Reread the draft through a moderator's eyes: does it contain anything useful to someone who will never use your product?

<!-- quiz -->
? Does Reddit have a rule of nine useful posts for every one about yourself?
- Yes, it is a Reddit-wide rule, and moderators enforce it everywhere || Reddit dropped the site-wide wording in 2017.
- No, it was dropped, and self-promotion is now allowed in every community on Reddit || Site-wide rules prohibit spam, and community moderators set their own limits on promotion.
+ The site-wide rule was dropped in 2017, but communities may keep their own || Each community's moderators decide on self-promotion, so read the rules on the community page.

? What happens if you ask employees to vote for the company's post?
- The post climbs to the top of the community faster and reaches subscribers || The platform detects coordinated votes and does not count them.
+ Reddit detects coordinated votes and penalises both the account and the domain || Vote manipulation is explicitly prohibited by the site-wide spam rules.
- Nothing bad, as long as real people vote from their own accounts || Real people voting by arrangement are still manipulating votes.
<!-- /quiz -->

<!-- section: sources -->
- Reddit, spam rules — https://support.reddithelp.com/hc/en-us/articles/360043504051-Spam (checked 25.11.2026)
- Reddit, State of spam (removal of the general 9:1 rule) — https://www.reddit.com/r/modnews/comments/6bj5de/state_of_spam/ (2017)
- r/homelab, new rules for software projects — https://www.reddit.com/r/homelab/comments/1ty58af/announcement_new_rules_processes_on_software/ (2026)
- Google and Reddit — https://blog.google/company-news/inside-google/company-announcements/expanded-reddit-partnership/ (22.02.2024)
- Ahrefs, Google AI Overview growth — https://ahrefs.com/blog/ai-overview-growth/ (13.05.2025)
- Reddit Help, announcing an AMA — https://support.reddithelp.com/hc/en-us/articles/15484140045204-Announcing-an-AMA-and-ensuring-discovery-visibility (02.10.2026)

<!-- lesson: marketing.platforms-hn | Hacker News and Lobsters: showing your work to engineers | 16 -->
<!-- section: hook -->
A founder spent two months preparing an open-source project's launch on Hacker News: chose a day based on other people's advice, wrote a headline, and asked twenty acquaintances to visit in the morning and vote. The post received twelve votes in half an hour and disappeared from the new submissions list. A day later, the founder learned that the platform detects votes arranged in advance and discounts them. Another founder posted a “Show HN” without preparation, but with a working demo that required no registration, and spent the whole day answering uncomfortable performance questions in the comments. Their post spent several hours on the front page. This lesson explains how Hacker News and Lobsters work and what to expect from the front page.

<!-- section: theory | How Hacker News decides what to show -->
Hacker News is a news site run by venture capital firm Y Combinator, where members submit links and vote on them. A post's position in the list depends on votes and time: a fresh post with a few votes rises above an older one with more votes. Besides votes, ranking is affected by flags from members who consider a post inappropriate, defenses against manipulation, automatic downranking of overly heated arguments, and moderators' decisions. The author's account karma does not by itself move a post higher.

Hacker News guidelines ask people not to use the site primarily for promotion, not to delete and repost the same material for reach, not to ask for votes or comments, and not to post AI-generated text. There is a Show HN section for your own projects, with its own rules: you can show something you made yourself that people can try. Blog posts, newsletters, waiting lists, and ordinary announcements are not accepted in Show HN. Requiring registration to try a project reduces interest, so a sandbox, a quick start on a laptop, or a demo that opens in the browser works well for an infrastructure product.

<!-- section: theory | What the front page delivers -->
Published accounts show that the results of reaching the front page are hard to predict. In 2024, the team behind developer tool Watermelon reached second place with 107 votes and gained more than 50 GitHub stars and more than 100 installations; the company's website received only 61 visits from Hacker News because readers went straight to the repository. That same year, the founder of Mailhub stayed in the top five for about a day with 101 votes and received around 3,800 visitors and 68 new users. A study of 138 open-source AI projects promoted on Hacker News in 2024–2025 found an average of around 120 new stars in a day and around 290 in a week, but the authors found no advantage from the Show HN label itself. Stars remain stars: they indicate interest and say almost nothing about installations or money.

The most useful thing to know is how often nothing happens. A Syften study of more than 216 thousand submissions from March to October 2026 found that 62% of Show HN posts received no replies. The same study found that posting time affects the number of replies, but less than people tend to think, and its findings for Show HN differ from those for all submissions. Choose the day and time on one criterion: the author must be free to answer comments for several hours in a row.

<!-- section: theory | How to prepare a post -->
A Hacker News headline should be brief and factual: what the project is and what makes it different, without exclamation marks or adjectives such as “revolutionary.” In the first comment, the author briefly explains who they are, why they made the project, how it works, what its limitations are, and what they want to hear from readers. Hacker News comments can be harsh, and the harshest often contain the most useful observations. An author who calmly accepts valid criticism, explains tradeoffs, and acknowledges limitations earns readers' respect; an author who argues and takes offense loses that respect along with attention to the project.

If a post does not take off, you must not delete and repost it. Moderators sometimes offer good posts a second chance themselves, and you can contact them at the email address listed on the site.

<!-- section: theory | Lobsters -->
Lobsters is a small community about programming and computing, which people join by invitation from members. Posts are tagged, and moderators' actions are visible in a public log. Lobsters rules limit a member's own material to a quarter of all their submissions and comments over the past year, and new members may not promote their projects for their first 70 days. Business and startup news are generally not accepted on Lobsters, while a detailed technical architecture analysis is a good fit. The moderation log shows that the rules are enforced: in February 2026, moderators banned a member who circumvented restrictions on new members' submissions and removed material posted solely for promotion.

<!-- section: task | Task: a Show HN draft -->
Complete this task in a document. Write a Show HN headline for your project without evaluative language, then an opening comment of five to seven sentences: who you are, what you made, how it works, what its limitations are, and what you want to ask. Check whether someone can try the project in ten minutes without registration; if not, record what needs to be done to make that possible. Then list the five most uncomfortable questions people will ask in the comments and answer each in two or three sentences.

<!-- quiz -->
? What can you submit to Show HN?
+ Something you made yourself that people can try || Blog posts, newsletters, waiting lists, and ordinary announcements are not accepted in Show HN.
- An announcement of a future product with a waiting list for first users || The Show HN rules explicitly exclude waiting lists.
- A press release about a funding round with a link to the product || Business news is not accepted in Show HN.

? How should you choose when to post on Hacker News?
- Only on Tuesday morning Pacific time, when the most readers are online || Syften's study does not support such a universal rule.
+ When the author can spend several hours answering comments || Timing affects responses less than people tend to think, while the author's presence in the comments always matters.
- At night American time, when fewer competing posts are on the front page || Nighttime hours brought slightly more responses for Show HN, but 62% of posts received none; timing is not the main factor.
<!-- /quiz -->

<!-- section: sources -->
- Hacker News, Show HN rules — https://news.ycombinator.com/showhn.html (checked 25.11.2026)
- Hacker News Guidelines — https://news.ycombinator.com/newsguidelines.html; Hacker News FAQ — https://news.ycombinator.com/newsfaq.html (checked 25.11.2026)
- Watermelon, launching on Hacker News and Product Hunt — https://medium.com/@baristaGeek/lessons-launching-a-developer-tool-on-hacker-news-vs-product-hunt-and-other-channels-27be8784338b (04.01.2024)
- Mailhub, front page experience — https://www.reddit.com/r/SaaS/comments/1eq5gxs (12.08.2024)
- Study of stars following promotion on Hacker News — https://arxiv.org/abs/2511.04453 (06.11.2025)
- Syften, best time to post on Hacker News — https://syften.com/blog/best-time-to-post-on-hacker-news/ (23.10.2026)
- Lobsters, About — https://lobste.rs/about; Lobsters, moderation log — https://lobste.rs/moderations (checked 25.11.2026)
