<!-- lesson: marketing.platforms-x-bluesky | X, Bluesky, and Mastodon: where engineers talk now | 16 -->
<!-- section: hook -->
Five years ago, the CTO of an open-source project ran a Twitter account followed by thousands of engineers, and every release attracted hundreds of replies. In 2026, that same account on X posts a link to release notes, and almost nobody sees the post; some former readers have moved to Bluesky and Mastodon, while others have stayed but read only posts without links. This lesson covers how these platforms have changed, where the technical audience is now, and how to work on several at once.

<!-- section: theory | X after 2023 -->
X, formerly Twitter, published part of its recommendation system's code in 2023. After coming under xAI's management, it published a new repository describing how the feed collects posts from accounts a person follows and from other authors, then ranks them. The repository's changelog for August–October 2026 records that the system is learning to predict reading time and whether a person will finish reading a post. The repository's authors explicitly warned that the weights in the code are multiplied by predicted probabilities of actions and do not apply to raw counts of likes and reports, so popular calculations such as “one report cancels out this many likes” misread the code. Screenshots of old weights from 2023 do not describe the current system.

The most noticeable change for companies concerns links. In 2025, Buffer analyzed 18.8 million posts from around 71 thousand accounts and found that by August, median engagement on posts with links had fallen to zero for accounts without a paid Premium subscription, while for subscribed accounts it remained around 0.28%. A median of zero means that more than half of those posts received no reactions; they may still have had impressions and clicks. The study compared different accounts without an experiment, so it shows a trend. The practical rule that follows is this: on X, it is more useful to explain the idea within the post itself, with a diagram or code, and check whether a link generates visits, than to expect a post with a link to spread on its own.

Executives, investors, and journalists still read X, and for a founder it remains a place to express a view on the market and be heard. For the engineering audience, X is no longer the only place for conversation.

<!-- section: theory | Bluesky -->
Bluesky grew from around 25 to 41 million registered accounts during 2025, and in May 2026 the platform reported 44 million. A registered account is not the same as an active reader, and there is no reliable estimate of what share of engineers moved from X to Bluesky. Observations suggest a noticeable migration of experienced developers and people who write about technology, but the surveys behind those observations collected responses through the authors' followers and are therefore biased.

Bluesky differs from X in that users choose their own feeds. Besides the following feed, there are custom feeds on particular topics that collect posts by keywords or a list of authors, and starter packs: collections of accounts and feeds that newcomers can add with one click. For a project, this means that including maintainers in a starter pack about Kubernetes or cloud infrastructure and in a topic feed helps new people find them, but does not guarantee they will read them. Working on Bluesky is much like working on early Twitter: real people discuss solutions, reply to one another, and share discoveries. The platform has not announced link restrictions similar to those on X.

<!-- section: theory | Mastodon, Fosstodon, and Hachyderm -->
Mastodon is a network of independent servers that exchange posts. People discover posts through follows, reposts called boosts, hashtags, and search, and search covers only what a particular server knows about. A post's distribution therefore depends on which servers its readers use.

Two servers with technical communities matter for an infrastructure company. Fosstodon focuses on free software; its code of conduct requires, among other things, disclosure of AI involvement in creative material, and moderators also consider members' behavior outside the server. Hachyderm distinguishes personal accounts, open-source project accounts, and corporate accounts; a corporate account requires the server's approval, has been subject to paid terms since March 2023, and will be suspended if unapproved. A maintainer's personal account discussing their work is not considered corporate.

Both communities value discussions of architectural tradeoffs, answers to questions, and links to reproducible examples, and are unreceptive to anonymous brand accounts posting every release. In 2025, Fosstodon experienced a crisis of trust over a former moderator's behavior and changed leadership; this story is a reminder that platforms sustained by volunteers have their own resilience considerations, which are worth taking into account when choosing a home for a community.

<!-- section: theory | How to work on several platforms at once -->
The audience has split, and companies need a presence in two or three places at once. The simplest way is through people: the founder writes about the market on X and LinkedIn, engineers talk with peers on Bluesky and Mastodon, and the project account posts the same releases and talk recordings everywhere. The same text copied to every platform feels out of place, so the central idea should be rewritten for each: shorter on X, without a link in the first post; on Bluesky and Mastodon, with the project's hashtag and participation in the conversation; on LinkedIn, with context for a manager.

Reactions under a post say little, so measure what happens afterward: visits to documentation, new members in the project's chat, and questions in sales meetings that begin “I saw your post.” Compare platforms on these measures over an entire quarter: one successful post proves nothing.

<!-- section: task | Task: one idea on three platforms -->
Complete this task in drafts on three platforms. Take one observation from your team, such as why virtual machines in Kubernetes start more slowly on a particular storage system and how you fixed it. Write a post for X without a link, using a diagram or code; a post for Bluesky with a question for peers and a hashtag; and a post for LinkedIn with context for a head of infrastructure. Compare the three texts and check that each communicates the main idea without the other two.

<!-- quiz -->
? What had Buffer found about posts with links on X by August 2025?
- X banned links in posts from accounts without a paid subscription and hides such posts || There is no ban; engagement changed.
+ For accounts without Premium, median engagement on such posts fell to zero || More than half of these posts received no reactions at all; they could still have had impressions and clicks.
- Posts with links began getting more reach than posts without them, for all accounts || Buffer's data shows the opposite for accounts without a subscription.
<!-- /quiz -->

<!-- section: sources -->
- xAI, open-source X recommendations code — https://github.com/xai-org/x-algorithm (updates 13.08–13.10.2026)
- Buffer, links on X — https://buffer.com/resources/links-on-x/ (14.10.2025)
- Pew, news influencers on Bluesky and X — https://www.pewresearch.org/short-reads/2025/05/29/bluesky-has-caught-on-with-many-news-influencers-but-x-remains-popular/ (29.05.2025)
- Bluesky, 2025 transparency report — https://bsky.social/about/blog/01-29-2026-transparency-report-2025 (29.01.2026)
- Bluesky, starter packs — https://bsky.social/about/blog/06-26-2024-starter-packs (26.06.2024)
- Hachyderm, account types — https://community.hachyderm.io/docs/account-types/ (checked 25.11.2026)
- Fosstodon, code of conduct — https://hub.fosstodon.org/coc/ (version 19.06.2025)

<!-- lesson: marketing.platforms-youtube | YouTube: demonstrations people search for over years | 18 -->
<!-- section: hook -->
An engineer recorded a twenty-minute video showing how to deploy a platform on three servers and what to do if installation stopped during network configuration. In its first month, two hundred people watched it, and the marketer decided that YouTube did not work. A year later, the video had forty thousand views, people were sending its link to newcomers in the project's chat, and a third of those contacting sales mentioned that they had started with it. This lesson covers how YouTube brings viewers to a technical demonstration and why results arrive slowly and last a long time.

<!-- section: theory | Search and recommendations -->
Viewers find YouTube videos in two different ways. The first is search: someone enters a query such as “kubevirt live migration not working” and gets videos that answer their question. The second is recommendations on the home page and alongside other videos: YouTube suggests what it expects that person to like, based on their interests and how other viewers responded to the video. YouTube's help documentation describes both paths without prescribing a posting frequency or an ideal length.

For an infrastructure product, search remains the main path. A demonstration that solves a specific problem answers queries that engineers enter for years, so it gains views slowly over a long period. A news roundup or an outspoken opinion video may reach recommendations and attract many views in a week, but stop being shown a month later.

<!-- section: theory | Tailscale's channel: what worked -->
Tailscale, which makes a networking product for private networks, described its channel's growth in November 2025. Over two and a half years, the channel grew from around 1,500 to 50,000 subscribers and from 6,000 to more than 500,000 views a month. It was run mainly by one person, Alex Kretzschmar, who filmed and edited the videos himself. He drew topics from community questions, and the videos showed real work: how to configure a specific function, how a particular feature works, or how to solve a home lab problem. The figures were published by the company itself, and it does not report how many customers came from the channel, but this is one of the few detailed cases of an infrastructure vendor's channel earning a technical audience.

Three practical conclusions follow from this case. A video should solve a problem the viewer is already trying to solve. It should show a real system and real commands. The channel should be run by someone who is interested in the topic and whose voice viewers recognize.

<!-- section: theory | Chapters, Shorts, and podcasts -->
Chapters help viewers find the right part of a long demonstration. Under YouTube's rules, the first chapter starts at 00:00, there must be at least three chapters, timestamps must be in ascending order, and each chapter must last at least ten seconds. For an infrastructure demonstration, useful divisions are architecture, requirements, installation, verification, failure and recovery, and removal.

Shorts are vertical videos up to three minutes long. Since March 31, 2025, YouTube has counted every start and replay of a Short as a view, with no minimum watch time, while retaining the previous counting method under the name “engaged views.” If a channel's Shorts views rose sharply after that date, the reason may be the new counting method, with nothing to do with video quality. Shorts are useful as excerpts from longer demonstrations and talks that lead viewers to the full video.

YouTube has become the largest podcast platform: in February 2025, the company reported that more than a billion people watch podcasts each month. A company podcast recorded with video should be published on YouTube both in full and as excerpts; the lesson on running your own podcast covers this in more detail.

Talk recordings on the CNCF channel are a separate source of viewers. The channel publishes thousands of recordings from KubeCon and the foundation's online programs, and your talk competes with that archive, so link to it in documentation, release notes, and emails.

<!-- section: theory | What not to do -->
In July 2025, YouTube clarified its monetization rules for repetitive and unoriginal content. This rule concerns earning money from videos, but it indicates a direction: the platform considers a stream of nearly identical videos assembled from one template to be inauthentic. Do not judge a video by its first week: a technical demonstration builds an audience over months. Do not make a promotional video instead of a demonstration: an engineer closes the video if they have not seen a terminal in the first minute.

<!-- section: task | Task: a plan for one demonstration -->
Complete this task in a document. List the five questions new users most often ask in your project's chat or issues. For the most frequent question, outline a ten-to-fifteen-minute video: what the viewer will see in the first thirty seconds, which chapters it will contain, what failure you will show and how to fix it, and which link you will include in the description. Record where you will share the video link a month after publication.

<!-- quiz -->
? Why does a technical demonstration on YouTube accumulate views slowly over a long time?
+ People find it by searching for a specific task, and such queries are typed for years || Recommendations bring a spike, while search brings a long tail.
- YouTube first shows long technical videos to a narrow test group of viewers before everyone else || There is no such rule.
- Technical videos are first shown only to the channel's subscribers || People find videos through search and recommendations; a subscription is not required.

? Why could Shorts views jump after March 31, 2025 without any improvement to the videos?
+ YouTube began counting every start and every replay of a Short as a view || The previous counting method was retained as “engaged views.”
- YouTube began promoting Shorts in long-video recommendations || There was no such announcement.
- Shorts were allowed to run longer, up to three minutes || Length affects the format, but does not explain the jump in views.
<!-- /quiz -->

<!-- section: sources -->
- Tailscale, 50,000 YouTube subscribers — https://tailscale.com/blog/50k-youtube-subscribers (20.11.2025)
- YouTube Help, how search and recommendations work — https://support.google.com/youtubecreatorstudio/answer/141805 (checked 25.11.2026)
- YouTube Help, chapters — https://support.google.com/youtube/answer/9884579 (checked 25.11.2026)
- YouTube Help, counting Shorts views — https://support.google.com/youtube/answer/10059070 (change effective 31.03.2025)
- Google, podcast listeners on YouTube — https://blog.google/feed/youtube-podcast-listeners/ (26.02.2025)
