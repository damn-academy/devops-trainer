// The 30 principles of the hidden "Продукт" pilot, grouped by the eight
// modules of the program. Each principle carries a written thinking task
// (the 🧠 task of the source program); content.ts adapts these tasks into
// platform quizzes. Russian is the source text, English is a faithful
// translation of every field. Claude owns the prose per web/STYLE-RU.md.

export interface ProductPrinciple { n: number; title: [string, string]; body: string[]; bodyEn: string[]; task: [string, string] }
export interface ProductModule { key: string; title: [string, string]; principles: ProductPrinciple[] }

export const PRODUCT_PROGRAM: ProductModule[] = [
  {
    key: 'category',
    title: ['Категория', 'Category'],
    principles: [
      {
        n: 1,
        title: ['Категория важнее продукта', 'The category beats the product'],
        body: [
          'Покупатель выбирает внутри категории и сравнивает вас с двумя-тремя знакомыми альтернативами; весь рынок он не перебирает. Пока вы объясняете, чем продукт лучше, конкурент, который задал категорию, уже продаёт. Поэтому работа начинается с вопроса о рамке сравнения, а список возможностей обсуждают потом: в какой категории вас должны искать.',
          'Позиционирование в этом смысле — решение о том, против чего вас измеряют, и слоган его не заменяет. Если рамку не задали вы, её задали рынок, и тогда вас сравнивают с кем-то, кто вам невыгоден.',
          'Эйприл Данфорд описывает позиционирование как выбор контекста, в котором продукт выигрывает, а Play Bigger превращает это в проектирование самой категории.',
        ],
        bodyEn: [
          'The buyer chooses inside a category and compares you with two or three familiar alternatives, not with the whole market. While you explain why the product is better, the competitor who defined the category is already selling. So the work starts with the question of the comparison frame, not the feature list: which category should people look for you in?',
          'Positioning in this sense is not a slogan but a decision about what you are measured against. If you do not set the frame, the market sets it, and then you are compared with someone who disadvantages you.',
          'April Dunford describes positioning as choosing the context in which the product wins, and Play Bigger turns this into designing the category itself.',
        ],
        task: [
          'Напишите одним предложением, в какой категории ваш продукт сравнивают сейчас, и в какой категории вам выгодно, чтобы его сравнивали через год.',
          'Write one sentence naming the category your product is compared in today, and the category you want it compared in a year from now.',
        ],
      },
      {
        n: 2,
        title: ['Задача, на которую нанимают продукт', 'The job the product is hired for'],
        body: [
          'Инфраструктурный покупатель нанимает продукт на задачу: сократить время развёртывания, снять риск аудита, перестать зависеть от одного эксперта по очереди. Разговор о задаче открывает дверь, разговор о возможностях её закрывает, потому что возможности оценивают все, а задачу клиент узнаёт и признаёт свою.',
          'Теория задач, которую развивали Энтони Алвик и Клейтон Кристенсен, говорит, что задача стабильна, а решения меняются: вчера её решал скрипт, сегодня ваш продукт, завтра — служба облака. Кто понимает задачу, тот переживает смену технологий.',
        ],
        bodyEn: [
          'The infrastructure buyer hires a product for a job: to cut deployment time, to remove audit risk, to stop depending on one queue expert. A conversation about the job opens the door; a conversation about features closes it, because everyone evaluates features, while the client recognises a job as their own.',
          'The jobs theory developed by Anthony Ulwick and Clayton Christensen says the job is stable while solutions change: yesterday a script did it, today your product, tomorrow a cloud service. Whoever understands the job survives the change of technologies.',
        ],
        task: [
          'Выпишите три задачи, на которые реальных пользователей нанимали ваш продукт, словами самих пользователей; слова вашей команды здесь не годятся.',
          'Write down three jobs real users hired your product for, in the users’ own words rather than your team’s.',
        ],
      },
      {
        n: 3,
        title: ['Клин и платформа', 'The wedge and the platform'],
        body: [
          'Начинают с узкой задачи, где продукт незаменим, и расширяются в стороны. Узкий вход называют клином, потому что он вонзается туда, где боль сильная, а альтернативы слабые. Платформа вырастает из доверия, которое продукт заработал на первой задаче.',
          'Широкий старт проигрывает гигантам на их поле, потому что у них шире каталог, больше менеджеров и дешевле маркетинг. Клин переворачивает эту логику, потому что сначала выигрывается одна задача, потом вторая, и через год клиент обнаруживает, что вся его работа устроена вокруг вашей экосистемы.',
        ],
        bodyEn: [
          'Start with a narrow job where the product is irreplaceable, and expand sideways. This narrow entry is called a wedge because it drives in where the pain is strong and the alternatives are weak. A platform grows out of the trust the product earned on the first job.',
          'A broad start loses to giants on their field, because their catalogue is wider, their sales force larger and their marketing cheaper. The wedge flips this logic: one job is won first, then a second, and within a year the client finds their whole work arranged around your ecosystem.',
        ],
        task: [
          'Назовите свой клин: одна задача, в которой вы уже выигрываете у любой альтернативы, и одна соседняя задача, куда разумно расшириться следующей.',
          'Name your wedge: one job where you already beat any alternative, and one adjacent job where expanding next makes sense.',
        ],
      },
    ],
  },
  {
    key: 'gtm',
    title: ['Выход на рынок', 'Go-to-market'],
    principles: [
      {
        n: 4,
        title: ['Три двигателя роста', 'Three growth engines'],
        body: [
          'Есть три способа довести продукт до покупателя. Product-led growth: продукт сам приводит пользователей, которые пробуют его без продавца и платят без звонка. Sales-led: двери открывают продавцы и длинные циклы сделок. Community-led: продукт распространяется через сообщество и открытый код.',
          'У инфраструктурных продуктов типичен гибрид, который описывают как open-source-led со sales-assist: инженер пробует продукт бесплатно, а крупную сделку внутри компании доводит уже человек. Двигатель определяет метрики, состав команды и даже цену, поэтому его выбирают осознанно, без оглядки на моду.',
        ],
        bodyEn: [
          'There are three ways to bring a product to the buyer. Product-led growth: the product brings users who try it without a seller and pay without a call. Sales-led: sellers and long deal cycles open the doors. Community-led: the product spreads through the community and open source.',
          'Infrastructure products typically follow a hybrid described as open-source-led with sales-assist: the engineer tries the product for free, and a human closes the large deal inside the company. The engine determines the metrics, the team composition and even the price, so it is chosen deliberately, not by fashion.',
        ],
        task: [
          'Определите главный двигатель роста вашего продукта сегодня и одну метрику, которая его измеряет. Запишите, что изменится, если выбор ошибочен.',
          'Name the main growth engine of your product today and the one metric that measures it. Write down what would change if the choice were wrong.',
        ],
      },
      {
        n: 7,
        title: ['Два нарратива', 'Two narratives'],
        body: [
          'Один продукт нуждается в двух разных рассказах. Bottom-up обращается к инженеру словами «попробуй за вечер, не спрашивая никого». Top-down обращается к подписанту бюджета словами «снимите риск простоя и верните инженерное время». Эти рассказы не должны противоречить друг другу, но обращены к разным страхам.',
          'Инженер советует купить, а бюджет подписывает другой человек, и его волнуют не фичи, а последствия для компании. Если нарратив один, половина аудитории его не слышит.',
        ],
        bodyEn: [
          'One product needs two different stories. Bottom-up addresses the engineer with words like “try it tonight without asking anyone”. Top-down addresses the budget signer with words like “remove the risk of downtime and give engineering time back”. These stories must not contradict each other, but they speak to different fears.',
          'The engineer advises the purchase, but someone else signs the budget, and that person cares not about features but about consequences for the company. If there is only one narrative, half the audience does not hear it.',
        ],
        task: [
          'Напишите по одному предложению bottom-up нарратива для инженера и top-down нарратива для подписанта бюджета. Проверьте, что они не противоречат друг другу.',
          'Write one sentence of the bottom-up narrative for the engineer and one of the top-down narrative for the budget signer. Check that they do not contradict each other.',
        ],
      },
    ],
  },
  {
    key: 'opencore',
    title: ['Граница open-core и расширение', 'The open-core boundary and expansion'],
    principles: [
      {
        n: 5,
        title: ['Граница open-core', 'The open-core boundary'],
        body: [
          'Open-core означает, что ядро продукта открыто, а за отдельные возможности платят. Решение о границе важнее решения о цене: бесплатная часть должна целиком решать одну задачу маленькой команды, иначе продуктом не начнут пользоваться. Платная часть — то, за что компания платит без торга: безопасность, масштаб, соответствие требованиям, поддержка.',
          'Жадная граница провоцирует форк и сжигает доверие сообщества, щедрая превращает продукт в благотворительность. Границу держат в одном месте годами и двигают её медленно, объясняя каждый шаг сообществу.',
        ],
        bodyEn: [
          'Open-core means the product’s core is open and separate features are paid. The boundary decision matters more than the price decision: the free part must solve one job completely for a small team, or people will not start using the product. The paid part is what a company pays for without haggling: security, scale, compliance, support.',
          'A greedy boundary provokes a fork and burns the community’s trust; a generous one turns the product into charity. The boundary is kept in one place for years and moved slowly, with every step explained to the community.',
        ],
        task: [
          'Перечислите три возможности, которые продукт отдаёт бесплатно, и три возможности, за которые компании платят без торга. Проверьте, что граница между списками совпадает с границей в вашем продукте.',
          'List three features the product gives away free and three that companies pay for without haggling. Check that the boundary between the lists matches the boundary in your product.',
        ],
      },
      {
        n: 6,
        title: ['Маленькая сделка, большое расширение', 'Land small, expand big'],
        body: [
          'Зайдите в компанию маленькой сделкой: одна команда, один кластер, один месяц. Докажите ценность на малом, и расширение станет формальностью, потому что внутри клиента вы уже работаете. Так выручка растёт внутри существующих клиентов, и эту долю измеряет NRR, чистое удержание выручки.',
          'NRR выше 100% означает, что компания растёт даже без новых клиентов: старые платят больше, чем в прошлом году. Привлечение нового клиента стоит в разы дороже, чем расширение старого, поэтому land-and-expand — главный двигатель экономики подписок. В бенчмарках OpenView и High Alpha медианный NRR держится около 110%, и лучшие компании выходят за 120%.',
        ],
        bodyEn: [
          'Enter a company with a small deal: one team, one cluster, one month. Prove the value on something small, and expansion becomes a formality, because you already work inside the client. This is how revenue grows inside existing customers, and the share of this growth is measured by NRR, net revenue retention.',
          'An NRR above 100% means the company grows even without new customers: the old ones pay more than last year. Acquiring a new customer costs several times more than expanding an old one, which makes land-and-expand the main engine of subscription economics. In the OpenView and High Alpha benchmarks the median NRR stays around 110%, and the best companies go beyond 120%.',
        ],
        task: [
          'Посчитайте, какую долю выручки за последний год компания получила от клиентов, которые уже платили год назад. Если эта цифра ниже 100%, найдите, где клиенты сокращают использование.',
          'Calculate the share of this year’s revenue that came from customers who were already paying a year ago. If it is below 100%, find where customers shrink usage.',
        ],
      },
    ],
  },
  {
    key: 'chasm',
    title: ['Волна, плацдарм и пропасть', 'The wave, the beachhead and the chasm'],
    principles: [
      {
        n: 8,
        title: ['Тайминг и волна', 'Timing and the wave'],
        body: [
          'Спрос на категорию чаще создают события снаружи, чем ваш маркетинг. Смена владельца VMware и уход клиентов Broadcom, возврат нагрузок из публичных облаков в собственные центры обработки данных, требования суверенитета данных, дефицит видеокарт — каждая такая волна выносит целые категории продуктов вверх почти без затрат.',
          'Работа против волны превращает каждую сделку в борьбу за внимание, работа на волне даёт многократный рост при тех же усилиях. Поэтому вопрос «почему сейчас» стоит рядом с вопросом «почему мы».',
        ],
        bodyEn: [
          "Demand for a category is more often created by outside events than by your marketing. VMware changing owners and customers leaving Broadcom, workloads returning from public clouds to private data centres, data sovereignty requirements, GPU shortages: each such wave lifts entire product categories almost without expenditure.", // TODO(en-review)
          "Working against the wave turns every deal into a struggle for attention; riding it delivers many times the growth for the same effort. That is why the question ‘why now’ belongs alongside ‘why us’.", // TODO(en-review)
        ],
        task: [
          'Выпишите две волны, которые сейчас идут на ваш рынок, и одно действие, которое вы сделаете в ближайший месяц, чтобы встать на каждую из них.',
          'Write down two waves hitting your market right now and one action per wave you will take this month to ride them.',
        ],
      },
      {
        n: 9,
        title: ['Плацдарм', 'The beachhead'],
        body: [
          'Плацдарм — один узкий сегмент, который вы берёте целиком и где становитесь эталоном: например, не «облако для всех», а «платформа для медицинских стартапов Европы». В новой категории никто никому ничего не обязан, и только концентрация даёт критическую массу историй успеха.',
          'Из плацдарма расширяются по соседям: те, кто доверяет соседям по отрасли. Широкая атака силами маленькой команды распыляет и продукт, и рассказ.',
        ],
        bodyEn: [
          "A beachhead is one narrow segment you capture completely and become the benchmark in: for example, not ‘a cloud for everyone’, but ‘a platform for European medical startups’. In a new category nobody owes anyone anything, and only concentration creates a critical mass of success stories.", // TODO(en-review)
          "You expand from the beachhead into neighbouring segments: those who trust their industry peers. A broad attack by a small team spreads both the product and its story too thin.", // TODO(en-review)
        ],
        task: [
          'Опишите свой плацдарм: один сегмент, в котором вы уже первый или можете им стать за квартал, и назовите ближайший соседний сегмент.',
          'Describe your beachhead: one segment where you are already first or can be within a quarter, and name the nearest adjacent segment.',
        ],
      },
      {
        n: 10,
        title: ['Против гиперскейлера', 'Against the hyperscaler'],
        body: [
          'С гиперскейлером не играют в его игру: он выигрывает широтой каталога, ценой при масштабе и договорами на миллион. Выигрывают там, где он структурно слаб: открытый код, который можно проверить, нейтральность по отношению к чужим облакам, работа в собственном центре обработки данных, экспертиза и скорость маленькой команды.',
          'Покупатель выбирает вас не потому, что вы лучше во всём, а потому что две-три вещи, важные для его ситуации, у вас сильнее. Задача продукта — сделать эти две-три вещи очевидными и измеримыми.',
        ],
        bodyEn: [
          "Do not play a hyperscaler at its own game: it wins on catalogue breadth, price at scale and million-dollar contracts. Win where it is structurally weak: open code that can be inspected, neutrality towards other clouds, operation in a private data centre, expertise and the speed of a small team.", // TODO(en-review)
          "Buyers choose you not because you are better at everything, but because you are stronger at two or three things that matter to their situation. The product’s job is to make those two or three things obvious and measurable.", // TODO(en-review)
        ],
        task: [
          'Назовите две вещи, в которых гиперскейлер структурно не может вас обойти, и проверьте, что ваш сайт и документация подсвечивают в первую очередь их.',
          'Name two things a hyperscaler structurally cannot beat you at, and check that your site and documentation highlight exactly those.',
        ],
      },
      {
        n: 11,
        title: ['Пропасть Мура', 'Moore’s chasm'],
        body: [
          'Между ранними последователями, которые любят новое, и прагматиками, которые покупают только по примеру других, лежит пропасть. Продукт, который восторгает энтузиастов, проваливается у осторожного большинства: прагматик спрашивает, кто ещё так работает и к кому позвонить за опытом.',
          'Пропасть переходят не новыми возможностями, а эталонными клиентами из одного сегмента, целым решением задачи и доверием. Книга Джеффри Мура «Пересечение пропасти» описывает этот переход как отдельную кампанию с плацдармом и эталонными историями, и продолжением того же движения он не служит.',
        ],
        bodyEn: [
          "A chasm separates early adopters who love new things from pragmatists who buy only by following others. A product that delights enthusiasts fails with the cautious majority: the pragmatist asks who else works this way and whom they can call to hear about the experience.", // TODO(en-review)
          "You cross the chasm with reference customers from one segment, a complete solution to the job and trust, rather than new features. Geoffrey Moore’s book Crossing the Chasm describes this transition as a separate campaign with a beachhead and reference stories, rather than a continuation of the same movement.", // TODO(en-review)
        ],
        task: [
          'Определите, на какой стороне пропасти находится ваш рынок сейчас, и назовите одного эталонного клиента, который поможет перейти на другую.',
          'Decide which side of the chasm your market is on now, and name one lighthouse customer who would help you cross to the other side.',
        ],
      },
    ],
  },
  {
    key: 'devex',
    title: ['Опыт инженера', 'Developer experience'],
    principles: [
      {
        n: 12,
        title: ['Время до первой ценности', 'Time to value'],
        body: [
          'Пользователь решает, оставится ли он с продуктом, в первые минуты знакомства: скачал, запустил, получил результат. Этот путь измеряют в минутах и называют временем до первой ценности, и каждый шаг, который его удлиняет, стоит части аудитории.',
          'Главный конкурент в этот момент не другой продукт, а привычка, которая говорит «не буду ничего менять». Поэтому первый успех должен случиться раньше первой настройки, первого звонка и первого чтения документации целиком.',
        ],
        bodyEn: [
          "Users decide whether to stay with a product in their first minutes with it: download, launch, get a result. This journey is measured in minutes and called time to value, and every step that lengthens it costs you part of the audience.", // TODO(en-review)
          "The main competitor at this moment is not another product but the habit that says ‘I will not change anything’. The first success must therefore come before the first configuration, the first call and the first reading of the entire documentation.", // TODO(en-review)
        ],
        task: [
          'Пройдите путь нового пользователя от скачивания до первого результата с секундомером и выпишите каждый шаг, на котором он может остановиться.',
          'Walk the new-user path from download to first result with a stopwatch, and write down every step where the user might stop.',
        ],
      },
      {
        n: 14,
        title: ['Знакомство как воронка', 'Onboarding as a funnel'],
        body: [
          'Знакомство с продуктом устроено как воронка: посетитель становится скачавшим, скачавший — запустившим, запустивший получает результат, получивший возвращается, вернувшийся платит. Каждый переход измеряют, и чинят самое узкое звено, не нагнетая верх воронки.',
          'Усиление верха при дырявом низу напоминает литье воды в решето: новые посетители стекают через то же отверстие, что и вчерашние. Воронка показывает, где продукт расходует ваши усилия впустую.',
        ],
        bodyEn: [
          "Getting to know a product works as a funnel: a visitor downloads, the downloader launches, the launcher gets a result, the person who got a result returns, and the returning user pays. Measure every transition and fix the narrowest step instead of adding more pressure at the top of the funnel.", // TODO(en-review)
          "Strengthening the top while the bottom leaks is like pouring water into a sieve: new visitors drain through the same hole as yesterday’s. The funnel shows where the product wastes your effort.", // TODO(en-review)
        ],
        task: [
          'Постройте воронку знакомства за последний месяц с числами на каждом переходе и найдите самое узкое звено.',
          'Build last month’s onboarding funnel with numbers at every transition and find the narrowest step.',
        ],
      },
      {
        n: 13,
        title: ['Документация — это продукт', 'Documentation is the product'],
        body: [
          'Для инфраструктурного продукта документация — часть интерфейса: по ней ставят первый эксперимент вечером в пятницу и по ней же ищут ответ в три часа ночи. Страница быстрого старта важнее маркетинговой страницы, потому что по ней решают, остаться ли с продуктом.',
          'Плохая документация обнуляет хороший продукт в первый же вечер. Система Diátaxis делит документацию на четыре части по задаче читателя: обучение, задачи, справка и объяснения, и эта рамка помогает держать каждую часть на своём месте.',
        ],
        bodyEn: [
          "For an infrastructure product, documentation is part of the interface: people use it for their first experiment on a Friday evening and to find an answer at three in the morning. The quickstart page matters more than the marketing page because it determines whether people stay with the product.", // TODO(en-review)
          "Bad documentation cancels out a good product on the very first evening. The Diátaxis system divides documentation into four parts by the reader’s task: tutorials, how-to guides, reference and explanation. This framework helps keep each part in its place.", // TODO(en-review)
        ],
        task: [
          'Откройте страницу быстрого старта вашего продукта глазами новичка и выпишите три места, в которых он собьётся или бросит.',
          'Open your product’s quickstart page with a newcomer’s eyes and write down three places where they would stumble or give up.',
        ],
      },
      {
        n: 15,
        title: ['API и командная строка как интерфейс', 'API and CLI as the interface'],
        body: [
          'Для инженера интерфейс продукта — это прежде всего API и командная строка, картинки в браузере идут потом. Они должны быть предсказуемыми, обратимо совместимыми и удобными для скриптов: разработчик читает API раньше, чем маркетинговую страницу, и по нему решает, вписывается ли продукт в его работу.',
          'Неудобный API превращает каждый вызов в переговоры, удобный делает продукт частью привычки. Поэтому изменения в API планируют как изменения в публичном договоре, с версиями и миграциями.',
        ],
        bodyEn: [
          "For an engineer, the product interface is primarily its API and command line, rather than pictures in a browser. They must be predictable, backward compatible and convenient for scripts: developers read the API before the marketing page and use it to decide whether the product fits their work.", // TODO(en-review)
          "An awkward API turns every call into a negotiation; a convenient one makes the product a habit. API changes are therefore planned as changes to a public contract, with versions and migrations.", // TODO(en-review)
        ],
        task: [
          'Попробуйте выполнить главную задачу продукта, не открывая веб-интерфейс, одним лишь API или командной строкой, и запишите каждый раздражающий шаг.',
          'Try to do the product’s main job without opening the web UI, using only the API or the CLI, and record every irritating step.',
        ],
      },
    ],
  },
  {
    key: 'discovery',
    title: ['Продуктовая работа: открытие', 'Product work: discovery'],
    principles: [
      {
        n: 16,
        title: ['Непрерывное открытие', 'Continuous discovery'],
        body: [
          'Открытие продукта — еженедельная практика коротких контактов с пользователями, сфокусированных на исходах. Тереза Торрес описывает её как привычку команды из трёх человек, без превращения в проект на квартал.',
          'Решения, принятые без свежего контакта с реальностью, стареют быстрее, чем код. Если последний разговор с пользователем был больше месяца назад, команда управляет по карте прошлого года.',
        ],
        bodyEn: [
          "Product discovery is not a phase before drawing up the roadmap, but a weekly practice of short contacts with users focused on outcomes. Teresa Torres describes it as a habit of a three-person team, rather than a quarterly project.", // TODO(en-review)
          "Decisions made without fresh contact with reality age faster than code. If the last conversation with a user was more than a month ago, the team is navigating by last year’s map.", // TODO(en-review)
        ],
        task: [
          'Назначьте на следующую неделю два получасовых разговора с пользователями и выпишите желаемый исход, о котором пойдёт речь.',
          'Schedule two thirty-minute conversations with users for next week and write down the outcome they will be about.',
        ],
      },
      {
        n: 17,
        title: ['Дерево возможностей и решений', 'The opportunity-solution tree'],
        body: [
          'Карта продукта строится как дерево: желаемый исход ветвится в возможности, то в боли и желания пользователей, возможности ветвятся в решения, решения — в эксперименты. Сначала ищут возможность, потом придумывают решение.',
          'Команды влюбляются в решения и начинают искать им применение, и тогда каждая фича защищается эмоциями. Дерево переворачивает порядок: обсуждают карту, и любимая идея отходит на второй план, и спор идёт о том, какая ветвь ведёт к исходу быстрее.',
        ],
        bodyEn: [
          "The product map is built as a tree: the desired outcome branches into opportunities, meaning users’ pains and desires; opportunities branch into solutions, and solutions into experiments. Find the opportunity first and then devise the solution, rather than the reverse.", // TODO(en-review)
          "Teams fall in love with solutions and start looking for uses for them, so every feature is defended emotionally. The tree reverses the order: discuss the map rather than a favourite idea, and argue about which branch leads to the outcome faster.", // TODO(en-review)
        ],
        task: [
          'Нарисуйте дерево для одного желаемого исхода: выпишите три возможности и по два решения к каждой. Отметьте, какое решение вы уже проверили бы экспериментом.',
          'Draw a tree for one desired outcome: write three opportunities and two solutions for each. Mark which solution you would already test with an experiment.',
        ],
      },
    ],
  },
  {
    key: 'priorities',
    title: ['Продуктовая работа: решения', 'Product work: decisions'],
    principles: [
      {
        n: 18,
        title: ['Приоритизация и дорожная карта', 'Prioritization and the roadmap'],
        body: [
          'Метод RICE из руководства Intercom оценивает идею четырьмя числами. Охват — сколько людей или компаний затронет изменение за выбранный период, например за квартал. Влияние — насколько сильно оно изменит их поведение, по шкале от 0,25 до 3. Уверенность — насколько вы доверяете этим оценкам, в процентах. Трудоёмкость — сколько человеко-месяцев займёт работа. Оценка равна охвату, умноженному на влияние и на уверенность и делённому на трудоёмкость. Например, функция для 400 компаний за квартал с влиянием 1, уверенностью 50 % и трудоёмкостью 2 человеко-месяца получает 400 × 1 × 0,5 / 2 = 100 баллов, а функция для 100 компаний с влиянием 2, уверенностью 80 % и трудоёмкостью 1 человеко-месяц — 160 баллов. Баллы помогают сравнивать идеи, но не заменяют решения: срочное исправление безопасности или обязательство перед клиентом делают вне очереди, и об этих исключениях говорят открыто.',
          'Полезная дорожная карта называет не только то, что команда сделает, но и то, чего она сознательно делать не будет, с причиной к каждому пункту. Ресурсы конечны, поэтому каждое согласие на одну работу означает отказ от другой, и команде стоит видеть эти отказы так же ясно, как планы.',
        ],
        bodyEn: [
          "Intercom's RICE method scores an idea with four numbers. Reach is how many people or companies the change touches in a chosen period, such as a quarter. Impact is how much it changes their behaviour, on a scale from 0.25 to 3. Confidence is how far you trust these estimates, in percent. Effort is how many person-months the work takes. The score is reach times impact times confidence, divided by effort. For example, a feature for 400 companies a quarter with impact 1, confidence 50% and effort of 2 person-months scores 400 × 1 × 0.5 / 2 = 100, while a feature for 100 companies with impact 2, confidence 80% and effort of 1 person-month scores 160. Scores help compare ideas but do not replace decisions: an urgent security fix or a commitment to a customer goes ahead of the queue, and such exceptions are named openly.",
          "A real roadmap is a list of what you will not do, with explanations of why. Resources are finite, and every spoken ‘yes’ means ten unspoken ‘noes’ that the team must remember.", // TODO(en-review)
        ],
        task: [
          'Возьмите текущий план работ и выпишите пять вещей, которые вы сознательно не делаете, с причиной к каждой.',
          'Take the current plan and write down five things you deliberately do not do, with a reason for each.',
        ],
      },
      {
        n: 19,
        title: ['Сигнал и шум', 'Signal and noise'],
        body: [
          'Громкий запрос не равен важному запросу: самые настойчивые голоса редко принадлежат самым массовым пользователям. Сигнал повторяется, связан с ценностью и приходит от целевого сегмента; шум единичен, громок и приходит не от вашего сегмента.',
          'Запросы прилетают от тех, кто уже пользуется продуктом, а рынок, который вы ещё не взяли, молчит. Поэтому продукт решают не по громкости входящих писем, а по совпадению запросов с данными использования и стратегией.',
        ],
        bodyEn: [
          "A loud request is not the same as an important request: the most persistent voices rarely belong to the most numerous users. Signal repeats, relates to value and comes from the target segment; noise is isolated, loud and comes from outside your segment.", // TODO(en-review)
          "Requests come from people already using the product, while the market you have not yet captured remains silent. Product decisions therefore follow the agreement between requests, usage data and strategy, rather than the volume of incoming mail.", // TODO(en-review)
        ],
        task: [
          'Разделите последние двадцать входящих запросов на сигнал и шум и проверьте свою раскладку по данным использования: согласуются ли они.',
          'Split the last twenty incoming requests into signal and noise, then check your split against usage data: do they agree?',
        ],
      },
      {
        n: 20,
        title: ['Собственная проверка и разговоры', 'Dogfooding and conversations'],
        body: [
          'Команда обязана пользоваться своим продуктом каждый день, а релизы должны проходить проверку сообществом раньше, чем доходят до платящих клиентов. Своя боль читается мгновенно: то, что раздражает вас, раздражает и клиентов, только они молчат.',
          'В разговорах с пользователями работает правило Роба Фитцпатрика из книги «Мамин тест»: спрашивайте о прошлом поведении и потраченных деньгах; мнения и гипотетическое будущее мало что дают. Люди говорят неправду о том, что «купили бы», но честны о том, что уже сделали, и о том, сколько это стоило.',
        ],
        bodyEn: [
          "The team must use its own product every day, and releases must be tested by the community before reaching paying customers. Your own pain is immediately apparent: what irritates you also irritates customers, but they stay silent.", // TODO(en-review)
          "Conversations with users follow Rob Fitzpatrick’s rule from The Mom Test: ask about past behaviour and money spent, rather than opinions and a hypothetical future. People are untruthful about what they ‘would buy’, but honest about what they have already done and how much it cost.", // TODO(en-review)
        ],
        task: [
          'Перепишите три вопроса, которые вы обычно задаёте пользователям, так, чтобы каждый был о прошлом поведении.',
          'Rewrite the three questions you usually ask users so that each is about past behaviour, not a future opinion.',
        ],
      },
    ],
  },
  {
    key: 'oss',
    title: ['Стратегия открытого кода', 'Open-source strategy'],
    principles: [
      {
        n: 21,
        title: ['Петля «сообщество — продукт»', 'The community-product loop'],
        body: [
          'Сообщество даёт продукту доверие, бесплатное тестирование и идеи, продукт даёт сообществу повод собираться. Петля работает, когда кормят её в обе стороны: выходят релизы, которые обсуждают, и обсуждения, которые влияют на следующие релизы.',
          'Одностороннее чтение, при котором компания только берёт из сообщества, выжигает его: вклад без ответа быстро прекращается. Замкнутая петля, напротив, ускоряет и продукт, и сообщество с каждым циклом.',
        ],
        bodyEn: [
          "The community gives the product trust, free testing and ideas; the product gives the community a reason to gather. The loop works when both directions are fed: releases prompt discussions, and discussions influence subsequent releases.", // TODO(en-review)
          "A one-way approach in which the company only takes from the community burns it out: contributions without a response soon stop. A closed loop, by contrast, accelerates both the product and the community with each cycle.", // TODO(en-review)
        ],
        task: [
          'Назовите один случай за последний квартал, когда сообщество изменило ваш план работ, или создайте канал, через который такие случаи начнут происходить.',
          'Name one case from the last quarter when the community changed your plan, or create the channel where such cases would start happening.',
        ],
      },
      {
        n: 22,
        title: ['Монетизация без предательства', 'Monetization without betrayal'],
        body: [
          'Платят компании за то, что нужно им и не обязательно сообществу: корпоративный слой с единым входом и аудитом, поддержка с обязательствами, управляемый хостинг, которому отдают операционную боль. Такая граница не обесценивает открытую часть и потому держится годами.',
          'Резкая смена лицензии, которая закрывает то, что вчера было открыто, сжигает доверие за ночь: переход HashiCorp на Business Source License породил OpenTofu, и рынок получил второй продукт там, где вчера был один. Урок стоит запомнить до того, как менять лицензию.',
        ],
        bodyEn: [
          "Companies pay for what they need and the community does not necessarily need: an enterprise layer with single sign-on and auditing, support with commitments, managed hosting that takes over operational pain. This boundary does not devalue the open part and therefore lasts for years.", // TODO(en-review)
          "A sudden licence change that closes what was open yesterday burns trust overnight: HashiCorp’s move to the Business Source License spawned OpenTofu, and the market gained a second product where there had been one. Remember this lesson before changing the licence, rather than afterwards.", // TODO(en-review)
        ],
        task: [
          'Проверьте каждую платную возможность: нужна ли она компаниям и одновременно не нужна сообществу. Выпишите одно исключение и решите, что с ним делать.',
          'Check every paid feature: is it needed by companies and at the same time not needed by the community? Write down one exception and decide what to do with it.',
        ],
      },
      {
        n: 23,
        title: ['Управление проектом как актив', 'Governance as an asset'],
        body: [
          'Передача проекта нейтральному фонду вроде CNCF или Apache превращает управление в актив: покупатель верит, что проект не исчезнет вместе с продажей компании, а конкуренты соглашаются вкладываться в общий код. Нейтральность снижает риск зависимости от вендора и открывает двери энтерпрайзу.',
          'Даже без фонда видимые правила игры помогают: кто принимает решения, как попасть в список поддерживающих, кому принадлежит марка. Репозиторий, за которым стоит одна компания, и репозиторий под крылом фонда покупают по-разному.',
        ],
        bodyEn: [
          "Transferring a project to a neutral foundation such as CNCF or Apache turns governance into an asset: buyers trust that the project will not disappear when the company is sold, and competitors agree to contribute to shared code. Neutrality reduces vendor lock-in risk and opens enterprise doors.", // TODO(en-review)
          "Even without a foundation, visible rules help: who makes decisions, how to become a maintainer, who owns the trademark. A repository backed by one company and a repository under a foundation’s wing are bought differently.", // TODO(en-review)
        ],
        task: [
          'Опишите, кому принадлежат марка и репозиторий вашего проекта сегодня и что с ними произойдёт при продаже компании.',
          'Describe who owns your project’s brand and repository today, and what happens to them if the company is sold.',
        ],
      },
      {
        n: 24,
        title: ['Дефолт экосистемы', 'The ecosystem default'],
        body: [
          'Самая сильная позиция на рынке — стать дефолтом экосистемы: образом, чартом или дистрибутивом, которые ставят по умолчанию. Дефолт выигрывает без борьбы, потому что его не выбирают и его не меняют: каждый следующий пользователь получает его готовым.',
          'Статус дефолта даёт воронку, которую не купить рекламой: примеры — Terraform в инфраструктуре, Prometheus в наблюдаемости, Kubernetes в оркестрации. Путь туда лежит через плацдарм и через то, чтобы дефолт был заметно проще альтернатив.',
        ],
        bodyEn: [
          "The strongest market position is to become the ecosystem default: the image, chart or distribution installed by default. The default wins without a fight because people neither choose it nor change it: every subsequent user receives it ready-made.", // TODO(en-review)
          "Default status provides a funnel that advertising cannot buy: examples include Terraform in infrastructure, Prometheus in observability and Kubernetes in orchestration. The path there runs through a beachhead and making the default noticeably simpler than the alternatives.", // TODO(en-review)
        ],
        task: [
          'Назовите одно место, где ваш продукт может стать дефолтом, будь то образ, чарт, шаблон или дистрибутив, и один шаг, который приблизит его к этому месту.',
          'Name one place where your product could become the default, be it an image, a chart, a template or a distribution, and one step that brings it closer to that place.',
        ],
      },
    ],
  },
  {
    key: 'pricing',
    title: ['Цена и упаковка', 'Pricing and packaging'],
    principles: [
      {
        n: 25,
        title: ['Метрика ценности', 'The value metric'],
        body: [
          'Цену привязывают к тому, как клиент считает свою выгоду: за узел, за пользователя, за гигабайт, за запрос. Хорошая метрика растёт вместе с успехом клиента и понятна до покупки, плохая наказывает клиента за рост или не даёт вам расти вместе с ним.',
          'Исследования Patrick Campbell и ProfitWell, которое теперь входит в Paddle, показывают, что упаковка и метрика решают не меньше, чем сам уровень цены. Команды, которые пересматривают метрику раз в год, растут быстрее тех, кто повышает цену без изменения упаковки.',
        ],
        bodyEn: [
          "Tie the price to how the customer measures benefit: per node, per user, per gigabyte, per request. A good metric grows with the customer’s success and is clear before purchase; a bad one punishes the customer for growth or prevents you from growing with them.", // TODO(en-review)
          "Research by Patrick Campbell and ProfitWell, now part of Paddle, shows that packaging and the metric matter as much as the price level itself. Teams that revisit the metric once a year grow faster than those that raise prices without changing packaging.", // TODO(en-review)
        ],
        task: [
          'Выпишите, от чего клиент считает свою выгоду от продукта, и выберите единицу, которой эту выгоду можно измерить без вреда для доверия к продукту.',
          'Write down what the customer measures their product benefit by, and pick the unit that measures this benefit honestly without harming trust.',
        ],
      },
      {
        n: 26,
        title: ['Упаковка тарифов', 'Packaging the tiers'],
        body: [
          'Упаковка — это интерфейс цены: ряд тарифов от бесплатного до корпоративного, с чёткой границей «за что платят». Правильные тарифы продают сами: клиент видит, где находится сейчас, и понимает, что получит на следующем уровне.',
          'Бесплатный тариф — инструмент распространения, платные — фильтр серьёзности, и размытая граница между ними создаёт конфликт с сообществом. Раз в год упаковку пересматривают так же спокойно, как метрику ценности.',
        ],
        bodyEn: [
          "Packaging is the interface of pricing: a range of tiers from free to enterprise, with a clear boundary defining what people pay for. The right tiers sell themselves: customers see where they are now and understand what they get at the next level.", // TODO(en-review)
          "The free tier is a distribution tool, paid tiers filter for seriousness, and a blurred boundary between them creates conflict with the community. Review packaging once a year as calmly as you review the value metric.", // TODO(en-review)
        ],
        task: [
          'Выпишите, что сегодня точно лежит в бесплатной части вашего продукта, а что точно в корпоративной, и сверьте списки с опубликованной страницей цен.',
          'Write down what today is definitely in the free tier of your product and what is definitely enterprise, then compare both lists with the published pricing page.',
        ],
      },
    ],
  },
  {
    key: 'cases',
    title: ['Разборы компаний', 'Company case studies'],
    principles: [
      {
        n: 27,
        title: ['HashiCorp', 'HashiCorp'],
        body: [
          'Terraform стал дефолтом управления инфраструктурой через открытый код и экосистему провайдеров, которую писало само сообщество. Монетизация шла через облако и корпоративные возможности, пока в 2023 году компания не перевела продукты на Business Source License.',
          'Смена лицензии породила OpenTofu под крылом Linux Foundation, и рынок получил открытый форк там, где вчера была одна экосистема. Урок HashiCorp в том, что границу open-core меняют медленно и с сообществом, а одно решение может стоить годов доверия.',
        ],
        bodyEn: [
          "Terraform became the infrastructure management default through open source and a provider ecosystem written by the community itself. Monetization came through the cloud and enterprise features until the company moved its products to the Business Source License in 2023.", // TODO(en-review)
          "The licence change spawned OpenTofu under the Linux Foundation’s wing, and the market gained an open fork where previously there had been one ecosystem. HashiCorp’s lesson is that the open-core boundary should change slowly and with the community, while one decision can cost years of trust.", // TODO(en-review)
        ],
        task: [
          'Выпишите один урок из истории HashiCorp, который применим к границе между открытой и платной частью вашего продукта, и проверьте, не повторяете ли вы их ошибку в миниатюре.',
          'Write down one lesson from HashiCorp’s story that applies to the boundary between your product’s open and paid parts, and check that you are not repeating their mistake in miniature.',
        ],
      },
      {
        n: 28,
        title: ['GitLab', 'GitLab'],
        body: [
          'GitLab продаёт не набор функций, а способ работать: всё в одном репозитории, публичный хендбук компании и публичная же дорожная карта. Прозрачность используют как функцию продукта, а движение строят одновременно снизу, через разработчиков, и сверху, через обещание DevOps-трансформации.',
          'Открытость процесса снижает издержки доверия: покупатель может заранее посмотреть, как компания принимает решения и что появится в продукте в следующем году. Это доступный приём для команд любого размера.',
        ],
        bodyEn: [
          "GitLab sells a way of working rather than a set of features: everything in one repository, a public company handbook and a public roadmap. Transparency is used as a product feature, and the movement is built both from the bottom through developers and from the top through the promise of DevOps transformation.", // TODO(en-review)
          "An open process reduces the cost of trust: buyers can see in advance how the company makes decisions and what will appear in the product next year. This is an approach available to teams of any size.", // TODO(en-review)
        ],
        task: [
          'Выберите один элемент публичности GitLab, будь то открытый план или открытый хендбук, и оцените, что помешает вашей команде сделать то же самое в масштабе одной страницы.',
          'Pick one element of GitLab’s openness, be it the open plan or the open handbook, and estimate what would stop your team from doing the same at the scale of a single page.',
        ],
      },
      {
        n: 29,
        title: ['Grafana', 'Grafana'],
        body: [
          'Grafana начиналась как открытый инструмент визуализации и расширялась в стороны: метрики, логи, трассировки, нагрузочное тестирование. Каждая новая панель увеличивала ценность платформы, не вступая в конфликт с сообществом, а управляемый хостинг стал платным слоем, за который компании платят без сомнений.',
          'Движение Grafana описывают как community-led со sales-assist сверху: сообщество и открытый код приводят пользователей, а крупные сделки с облачными контрактами доводят люди. Это ровно гибрид, который мы разбирали в модуле про движки роста.',
        ],
        bodyEn: [
          "Grafana began as an open visualization tool and expanded sideways into metrics, logs, traces and load testing. Each new panel increased the platform’s value without conflicting with the community, while managed hosting became a paid layer that companies willingly pay for.", // TODO(en-review)
          "Grafana’s movement is described as community-led with sales-assist on top: the community and open source bring users, while people close large deals with cloud contracts. This is exactly the hybrid covered in the growth engines module.", // TODO(en-review)
        ],
        task: [
          'Назовите «панель» вашего продукта: соседнюю задачу, которую решают те же пользователи, и проверьте, может ли она вырасти из открытой части без конфликта с сообществом.',
          'Name your product’s “panel”: an adjacent job solved by the same users, and check whether it can grow out of the open part without conflicting with the community.',
        ],
      },
      {
        n: 30,
        title: ['Confluent и Databricks', 'Confluent and Databricks'],
        body: [
          'Confluent и Databricks построили компании на открытых проектах, Kafka и Spark, а деньги взяли за слой вокруг ядра: облако, платформу, поддержку масштаба. Открытый проект работает как канал доверия и распространения, а платный слой — как операционная боль, которую компании отдают с радостью.',
          'Обе истории показывают один путь: ядро остаётся открытым и нейтральным, а выручка приходит из управляемого сервиса и корпоративных возможностей. Когда защищать стало облачную выручку, лицензии пошли ужесточаться — и рынок снова напомнил, как хрупко доверие.',
        ],
        bodyEn: [
          "Confluent and Databricks built companies on open projects, Kafka and Spark, and charged for the layer around the core: the cloud, the platform and support at scale. The open project acts as a channel for trust and distribution, while the paid layer takes over operational pain that companies are happy to hand off.", // TODO(en-review)
          "Both stories show one path: the core remains open and neutral, while revenue comes from a managed service and enterprise features. When cloud revenue needed protecting, licences began to tighten, and the market once again demonstrated how fragile trust is.", // TODO(en-review)
        ],
        task: [
          'Назовите место в вашем продукте, где операционная боль клиента достаточно сильна, чтобы за её снятие платили регулярно, и проверьте, лежит ли оно в открытой части случайно.',
          'Name a place in your product where the customer’s operational pain is strong enough to pay for regularly, and check that it does not sit in the open part by accident.',
        ],
      },
    ],
  },
];
