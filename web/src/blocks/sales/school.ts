// Sales principles, modules A–F (source: aenix-org/dream100 SALES-SCHOOL.md).
// Russian prose follows web/STYLE-RU.md.
export interface SchoolItem { n: number; title: string; body: string; today: string }
export interface SchoolModule { letter: string; title: string; items: SchoolItem[] }
export const SALES_SCHOOL: SchoolModule[] = [
  {
    "letter": "A",
    "title": "Основы сложной продажи",
    "items": [
      {
        "n": 1,
        "title": "Продавать значит помогать компании купить.",
        "body": "Крупная компания покупает инфраструктуру через собственный процесс: инженеры проверяют продукт, архитектор сравнивает варианты, руководитель выделяет бюджет, юристы и закупщики согласуют договор. Ваша задача — провести компанию через этот процесс и помогать на каждом шаге, а не уговаривать одного человека.",
        "today": "по одной компании из своего списка запишите, на каком шаге её процесса покупки она сейчас находится и что ей нужно, чтобы перейти к следующему."
      },
      {
        "n": 2,
        "title": "В каждой компании нужно знать нескольких людей.",
        "body": "Если в компании вы знаете одного человека, сделка зависит только от него: он может уволиться, потерять интерес или оказаться не тем, кто решает. Поэтому в каждой компании, с которой идёт разговор, старайтесь держать связь хотя бы с тремя людьми в разных ролях: инженером, руководителем и тем, кто отвечает за бюджет.",
        "today": "найдите в своём списке компанию, где вы знаете только одного человека, и найдите ещё двоих в смежных ролях."
      },
      {
        "n": 3,
        "title": "Сделку двигает внутренний сторонник.",
        "body": "Внутри компании должен быть человек, который хочет, чтобы покупка состоялась, и объясняет коллегам, зачем она нужна, когда вас нет на встрече. В продажах его называют чемпионом. Если такого человека нет, сделка обычно останавливается, как бы хорошо ни прошли ваши встречи.",
        "today": "по одной компании, с которой идёт разговор, запишите, кто ваш внутренний сторонник и какую его собственную задачу решит покупка."
      },
      {
        "n": 4,
        "title": "Сторонник и тот, кто подписывает бюджет, — обычно разные люди.",
        "body": "Внутренний сторонник хочет продукт, но решение о деньгах принимает другой человек, обычно технический директор или руководитель инфраструктуры. Его называют экономическим покупателем. Ему нужно понять не возможности продукта, а что изменится для компании и сколько это стоит.",
        "today": "по одной компании выясните, кто подписывает бюджет на инфраструктуру и знает ли он о разговоре с вами."
      },
      {
        "n": 5,
        "title": "Проверочный список MEDDIC показывает, чего вы ещё не знаете о сделке.",
        "body": "MEDDIC — список из шести вопросов, по которому продавцы проверяют сделку. Измеримый результат (Metrics): какие цифры улучшатся у клиента. Экономический покупатель (Economic buyer): кто решает о деньгах. Критерии решения (Decision criteria): по каким признакам сравнивают варианты. Процесс решения (Decision process): какие шаги и согласования предстоят. Проблема (Identify pain): что у клиента болит и чего это ему стоит. Внутренний сторонник (Champion): кто продвигает покупку. Если ответа на какой-то вопрос нет, именно там сделка рискует остановиться.",
        "today": "разберите одну сделку по шести вопросам и запишите, на какой из них у вас нет ответа."
      },
      {
        "n": 6,
        "title": "Сделка отвечает на три вопроса: зачем менять, почему сейчас и почему вы.",
        "body": "Компании нужно понять, зачем вообще что-то менять, почему этим стоит заняться сейчас и почему выбрать именно ваш продукт. Чаще всего сделки останавливаются на втором вопросе: если нет события, которое заставляет действовать сейчас, например окончания договора с прежним поставщиком или нового требования регулятора, покупку откладывают из квартала в квартал.",
        "today": "по одной компании запишите, какое событие заставляет её действовать в этом году, или отметьте, что вы его пока не знаете."
      },
      {
        "n": 7,
        "title": "На первых встречах больше спрашивайте, чем рассказывайте.",
        "body": "Чтобы понять, как устроена задача клиента, нужно, чтобы говорил в основном он. Расспросы о том, как сейчас работает их инфраструктура, что в ней мешает и сколько это стоит, дают больше, чем презентация продукта, и показывают клиенту, что вы разбираетесь в его деле.",
        "today": "подготовьте три открытых вопроса к ближайшему разговору: о том, как устроена их работа сейчас и что в ней мешает, а не о вашем продукте."
      },
      {
        "n": 8,
        "title": "Проблему должен назвать сам клиент.",
        "body": "Пока клиент сам не сказал вслух, что у него есть проблема и чего она стоит, он не станет тратить силы на её решение, даже если вы видите эту проблему ясно. Поэтому цель первых разговоров — помочь ему сформулировать проблему своими словами.",
        "today": "после ближайшего разговора запишите, какими словами клиент сам описал свою проблему; если он её не назвал, запишите вопрос, который поможет это сделать в следующий раз."
      },
      {
        "n": 9,
        "title": "Отказ «сейчас не время» отличается от отказа «не пишите мне».",
        "body": "В крупной компании отказ часто означает, что у проекта нет приоритета или бюджета в этом году. Различайте четыре случая: человек не ответил; человек отказался от предложения сейчас; человек попросил больше ему не писать; вы договорились вернуться в определённую дату. Запишите причину и случай в карточку компании. Возвращаться можно только во втором и четвёртом случаях и только с новым поводом; просьба не писать действует навсегда.",
        "today": "разберите три старых отказа: к какому из четырёх случаев относится каждый, и для тех, к кому можно вернуться, запишите, какое событие станет поводом."
      },
      {
        "n": 10,
        "title": "Сделку двигают небольшие согласия.",
        "body": "Крупную покупку редко решают за одну встречу. Сделка продвигается через небольшие шаги, на которые клиенту легко согласиться: познакомить вас с коллегой, провести двадцатиминутный разбор их архитектуры, устроить технический созвон с инженерами. Каждый такой шаг показывает, что интерес настоящий.",
        "today": "по каждой компании, с которой идёт разговор, запишите следующий небольшой шаг и дату, когда вы о нём попросите."
      }
    ]
  },
  {
    "letter": "B",
    "title": "Роли закупочного центра",
    "items": [
      {
        "n": 11,
        "title": "Чаще всего разговор начинается с инженеров платформы.",
        "body": "Инженеры платформы, инфраструктуры и архитекторы сами сталкиваются со стоимостью эксплуатации, ручной работой и зависимостью от одного поставщика. С ними можно говорить на одном инженерном языке, и среди них чаще всего находится внутренний сторонник.",
        "today": "в двух компаниях из своего списка найдите в LinkedIn руководителя или ведущего инженера платформы."
      },
      {
        "n": 12,
        "title": "К техническому директору приходят через внутреннего сторонника.",
        "body": "Холодное письмо техническому или ИТ-директору редко получает ответ: он не знает вас, и у него нет причины тратить время. Когда внутренний сторонник уже заинтересован, он может сам рассказать о вас руководителю и позвать вас на встречу, и тогда разговор начинается с доверия.",
        "today": "в одной компании, где вы ещё не знаете инженеров, отложите письмо директору и сначала найдите инженера платформы."
      },
      {
        "n": 13,
        "title": "Руководитель информационной безопасности может стать союзником.",
        "body": "Руководителя безопасности волнует, сможет ли компания уйти от поставщика без потерь, откуда берутся компоненты продукта и можно ли проверить, что продукт делает. Открытый код помогает ответить на эти вопросы: его можно прочитать, проверить и при необходимости поддерживать без поставщика.",
        "today": "запишите одно предложение о том, почему открытый код вашего продукта снижает риски для их безопасности, и проверьте, что каждое слово в нём можно доказать."
      },
      {
        "n": 14,
        "title": "Архитектор определяет, по каким критериям сравнивают варианты.",
        "body": "Корпоративный архитектор решает, какие требования войдут в сравнение продуктов. Если вы помогли ему сформулировать требования, которые честно отражают задачу и в которых ваш продукт силён, вы уже на полпути к победе. Если требования писали вместе с конкурентом, выиграть будет трудно.",
        "today": "выясните, есть ли у компании принятый стандарт или список требований, с которым будут сравнивать ваш продукт."
      },
      {
        "n": 15,
        "title": "Инженеры проверят всё, что вы скажете.",
        "body": "Инженеры эксплуатации в тот же вечер после встречи откроют вашу документацию и репозиторий и попробуют повторить демонстрацию. Ошибка в демонстрации или цифра, которую нельзя воспроизвести, подрывают доверие ко всему остальному, что вы говорили.",
        "today": "перед ближайшим техническим разговором проверьте, что демонстрация работает и каждую названную цифру можно воспроизвести."
      },
      {
        "n": 16,
        "title": "Закупщики обычно подключаются, когда решение уже принято.",
        "body": "Отдел закупок отвечает за договор, риски и цену. Обычно он вступает в работу, когда руководитель и инженеры уже выбрали продукт. Если начать разговор с закупок раньше, вас сравнят только по цене. Бывают исключения: в государственных компаниях и в некоторых банках закупки ведут процесс с самого начала по формальным правилам, и тогда эти правила нужно узнать сразу.",
        "today": "по одной компании выясните, как в ней устроена закупка: кто подключается первым и есть ли формальная процедура с заявками."
      },
      {
        "n": 17,
        "title": "У сделки должен быть руководитель, которому она нужна сейчас.",
        "body": "Спонсор сделки — руководитель направления, у которого есть срочная причина: истекает договор с прежним поставщиком, руководство требует сократить расходы или регулятор выпустил новое требование. Он даёт проекту приоритет и деньги.",
        "today": "по одной компании найдите руководителя, у которого есть срочная причина заняться вашей задачей."
      },
      {
        "n": 18,
        "title": "Знакомство с закупочным центром идёт от тёплых контактов к остальным.",
        "body": "Начинайте с человека, который уже на вашей стороне, и просите его познакомить вас с коллегами в смежных ролях. Если человек не ответил на одно письмо и одно напоминание, можно написать коллеге в другой роли со своим поводом, но не тому же человеку через его коллег и не всем подряд. Если человек отказался, к другим людям этой компании идите только через тёплое знакомство и не ссылайтесь на него без разрешения.",
        "today": "по одной компании попросите знакомого вам человека познакомить вас с коллегой в смежной роли."
      }
    ]
  },
  {
    "letter": "C",
    "title": "Как покупают разные компании",
    "items": [
      {
        "n": 19,
        "title": "Банки и регулируемые компании начинают с небольшого некритичного шага.",
        "body": "В банках решение принимают сверху, и каждый шаг проходит проверку рисков. Первая покупка почти никогда не касается основных банковских систем: это платформа для разработчиков или замена одного кластера VMware. Цикл сделки длинный, нужны связи с несколькими людьми и рекомендации от других банков. Сильные доводы — требования европейского регламента об устойчивости финансовых систем DORA, возможность уйти от поставщика и хранение данных в своей стране.",
        "today": "для одного банка из списка сформулируйте первый шаг, который не затрагивает основные банковские системы."
      },
      {
        "n": 20,
        "title": "Телеком-операторы и провайдеры покупают долго, но крупно.",
        "body": "Операторы строят на платформе собственное облако для клиентов, поэтому им важны экономика такого облака, надёжность операторского уровня и масштаб. Часто сделку ведёт местный интегратор, которому оператор доверяет. Цикл длинный, но контракты большие.",
        "today": "для одного оператора из списка найдите интегратора, который с ним работает и мог бы вас представить."
      },
      {
        "n": 21,
        "title": "Промышленность и автопроизводители заботятся о периферии и данных.",
        "body": "Этим компаниям важны вычисления на заводах и в машинах, хранение данных у себя и системы, от которых зависит безопасность людей; закупка у них долгая. Заходить лучше через их платформенные команды, которые часто выступают на KubeCon.",
        "today": "проверьте, кто из инженеров одной такой компании из вашего списка выступал на KubeCon или местных митапах."
      },
      {
        "n": 22,
        "title": "Исследовательские центры и университеты выбирают снизу.",
        "body": "Здесь решают инженеры и системные администраторы, открытый код и сообщество важны, а деньги часто приходят из грантов. В этом сегменте маленькая компания может конкурировать с крупной на равных.",
        "today": "для одного исследовательского центра найдите, где обсуждают его инфраструктуру: рассылку, репозиторий на GitHub или канал в чате CNCF."
      },
      {
        "n": 23,
        "title": "Новые облака для ИИ нужен готовый слой платформы.",
        "body": "Компании, которые строят облака на собственных серверах с видеокартами, и суверенные центры обработки данных часто нуждаются в готовом слое платформы, и для инфраструктурного продукта это хороший сегмент. Но часть из них пишет платформу сама, и тогда они ваши конкуренты, а не покупатели.",
        "today": "для одной такой компании выясните, нужен ли ей готовый слой платформы или она строит свой: посмотрите вакансии и их репозитории."
      },
      {
        "n": 24,
        "title": "Первый контракт делают небольшим.",
        "body": "Первая покупка в крупной компании обычно небольшая: платный пилот на некритичной нагрузке. Если он прошёл хорошо, компания расширяет использование. Предложение продать всё сразу пугает и затягивает согласование.",
        "today": "для одной компании сформулируйте минимальный платный пилот: какая нагрузка, на какой срок и как вы вместе поймёте, что он удался."
      }
    ]
  },
  {
    "letter": "D",
    "title": "Регионы и деловая культура",
    "items": [
      {
        "n": 25,
        "title": "В США ждут быстрого перехода к пользе.",
        "body": "Американские покупатели обычно ценят прямоту и скорость: что продукт даст им сейчас и какой будет результат в цифрах. Должность собеседника и рекомендации других клиентов имеют большой вес. Длинное вступление раздражает.",
        "today": "в ближайшем письме американскому покупателю начните с результата для его компании и цифры, которую можно проверить."
      },
      {
        "n": 26,
        "title": "В Германии, Австрии и Швейцарии доверие строится на точности.",
        "body": "Покупатели в этих странах осторожны, проверяют каждое утверждение и доверяют инженерной компетентности и рекомендациям. Напористая продажа отталкивает. Хорошо работают темы хранения данных в стране и соблюдения GDPR и DORA, если вы говорите о них конкретно.",
        "today": "перепишите одно письмо немецкоязычному покупателю: уберите оценочные слова и добавьте факты, которые можно проверить."
      },
      {
        "n": 27,
        "title": "Во Франции важны иерархия, отношения и французский язык.",
        "body": "Решения во Франции часто принимают на верхних уровнях, а отношения с людьми важны. Материалы на французском помогают. Суверенное облако — сильная тема: в стране есть собственные проекты облаков, которые соответствуют государственным требованиям.",
        "today": "для одной французской компании решите, нужен ли французский язык в первом письме, и если да, кто его проверит."
      },
      {
        "n": 28,
        "title": "В северных странах ценят прямоту без пафоса.",
        "body": "В Скандинавии и Финляндии иерархии плоские, решения принимают согласием, а люди ценят прагматизм, короткие ясные письма и заботу об устойчивости и хранении данных в регионе.",
        "today": "сократите одно письмо скандинавскому покупателю до пяти предложений без оценочных слов."
      },
      {
        "n": 29,
        "title": "В Великобритании ценят компетентность и вежливую дистанцию.",
        "body": "Британские покупатели вежливы, ценят компетентность и умеренный юмор. Светская часть разговора короче, чем кажется, но решения проходят через формальный процесс.",
        "today": "в письме британскому покупателю держите профессиональный лёгкий тон и изложите суть в первых двух предложениях."
      },
      {
        "n": 30,
        "title": "На Ближнем Востоке решают личные отношения.",
        "body": "В ОАЭ и Саудовской Аравии доверие строится долго и лично, статус собеседника важен, а темы суверенитета и проектов национального масштаба стоят в центре. Личная встреча или знакомство через общего знакомого работают лучше письма.",
        "today": "для одной компании из этого региона найдите человека, который может вас познакомить, или событие, где вы встретитесь лично."
      },
      {
        "n": 31,
        "title": "В Японии решения принимают через согласование.",
        "body": "Японские компании принимают решения согласием: предложение обсуждают заранее со всеми, кого оно касается, эту практику называют немаваси. Нужны терпение и формальность, и почти всегда нужен местный партнёр. Быстрого согласия не будет, и это нормальная часть процесса.",
        "today": "для одной японской компании найдите местного партнёра, который уже с ней работает."
      },
      {
        "n": 32,
        "title": "В Корее после решения всё идёт быстро.",
        "body": "Иерархия в корейских компаниях строже, чем в европейских, но когда решение принято, работа идёт быстро. Важно показать, что вашим продуктом пользуются крупные и известные компании.",
        "today": "подготовьте для корейского покупателя список крупных клиентов, которых вы можете назвать с их разрешения."
      },
      {
        "n": 33,
        "title": "В Индии важны масштаб и цена.",
        "body": "Индийские покупатели работают с большими объёмами, считают стоимость на единицу нагрузки, ценят инженерную глубину и окупаемость и обычно торгуются. Английский язык в переписке привычен.",
        "today": "для индийской компании из списка подготовьте расчёт стоимости на единицу нагрузки при её масштабе."
      }
    ]
  },
  {
    "letter": "E",
    "title": "Тактика касаний",
    "items": [
      {
        "n": 34,
        "title": "Базы контактов нужны для карты компании, а не для рассылок.",
        "body": "Сервисы вроде Apollo помогают понять, кто работает в компании и в какой роли. Массовая рассылка по руководителям из такой базы попадает в спам и портит репутацию вашего почтового домена. Используйте базу, чтобы найти нужных людей, а пишите каждому отдельно.",
        "today": "по одной компании составьте с помощью базы контактов список людей по ролям закупочного центра, не отправляя ни одного письма."
      },
      {
        "n": 35,
        "title": "В LinkedIn работают личные сообщения и содержательные комментарии.",
        "body": "Автоматические сообщения в LinkedIn узнают сразу. Работает другое: изучить человека, написать ему лично со ссылкой на то, что он действительно делал или писал, и оставлять продуманные комментарии к его публикациям. Комментарий — самый безопасный способ попасть в поле зрения: он ничего не просит.",
        "today": "оставьте один содержательный комментарий к публикации человека из компании в вашем списке."
      },
      {
        "n": 36,
        "title": "Первое касание что-то даёт человеку.",
        "body": "Первое сообщение должно приносить пользу: наблюдение о его задаче, расчёт, ссылку на нужное исследование, вопрос по его докладу. Просьба о получасовой встрече в первом же письме чаще всего остаётся без ответа.",
        "today": "напишите одно первое письмо, которое ничего не просит, кроме ответа, если человеку это интересно."
      },
      {
        "n": 37,
        "title": "Поводом для разговора служат события в компании.",
        "body": "Хороший повод — событие, которое меняет задачи компании: скорое продление договора с VMware, жалоба на счёт за облако в годовом отчёте, новое требование о хранении данных, смена технического директора, закупка видеокарт. Письмо по такому поводу попадает в момент, когда человек уже думает о задаче, поэтому на него отвечают чаще.",
        "today": "настройте уведомления о новостях и вакансиях для трёх компаний из вашего списка."
      },
      {
        "n": 38,
        "title": "Свои каналы теплее холодного письма.",
        "body": "Приглашение в гости на ваш подкаст, встреча на вашем воркшопе или на KubeCon, знакомство через общих знакомых в сообществе CNCF начинают разговор с доверия, которого у холодного письма нет.",
        "today": "для одной компании придумайте, через какой из ваших каналов можно познакомиться с её инженерами."
      },
      {
        "n": 39,
        "title": "Возражение часто означает, что человеку не хватает сведений.",
        "body": "Фразы «дорого», «рискованно», «мы уже работаем с другим поставщиком» часто показывают, что человеку не хватает данных, чтобы обосновать решение перед коллегами. Не спорьте, а уточните, что стоит за возражением. Но если человек прямо отказался, отказ уважают и не пытаются переубедить.",
        "today": "подготовьте ответ на вопрос «вы маленькие, вдруг исчезнете?»: что будет с системой клиента, если вашей компании не станет."
      },
      {
        "n": 40,
        "title": "Рекомендация похожего клиента снимает страх лучше презентации.",
        "body": "Банку проще поверить другому банку, оператору — другому оператору. Рекомендация от компании того же типа отвечает на главный страх покупателя: работает ли это у таких, как мы.",
        "today": "для каждой компании из своего списка подберите клиента того же типа, который согласится рассказать о своём опыте."
      },
      {
        "n": 41,
        "title": "Каналы касаний чередуют, а число касаний ограничивают.",
        "body": "Письма в одном канале быстро перестают замечать, поэтому касания чередуют: письмо, комментарий к публикации человека, встреча на событии, знакомство через общего знакомого. Каждое касание приносит что-то новое, а одному человеку — не больше трёх касаний за три недели, как описано в модуле Dream 100; после этого вы останавливаетесь до нового повода. Отказ и просьба не писать отменяют любую последовательность.",
        "today": "по одной компании, где разговор затих, выберите другой канал и новый повод, который действительно полезен человеку."
      },
      {
        "n": 42,
        "title": "Проигрывать нужно так, чтобы можно было вернуться.",
        "body": "Если компания отказалась сейчас, поблагодарите за время, спросите, при каких условиях вопрос станет снова актуальным, и запишите это. Сделку, проигранную с обидой и давлением, не вернуть; к компании, с которой вы расстались по-хорошему, можно прийти через год с новым поводом.",
        "today": "по одному недавнему отказу напишите короткое благодарственное письмо и запишите, при каком событии вы вернётесь."
      }
    ]
  },
  {
    "letter": "F",
    "title": "Продажи силами основателя против гигантов",
    "items": [
      {
        "n": 43,
        "title": "Маленький размер компании даёт преимущества.",
        "body": "Маленькая компания быстро отвечает, легко меняет продукт под важного клиента, а на созвон приходит основатель. Крупный поставщик такого внимания клиенту обычно дать не может. Об этом стоит говорить прямо.",
        "today": "в ближайшем письме предложите клиенту прямой разговор с инженерами, которые делают продукт."
      },
      {
        "n": 44,
        "title": "Открытый код открывает двери, которые закрыты для продавцов.",
        "body": "В чатах CNCF, на FOSDEM и в репозиториях проектов люди говорят с вами как с участником сообщества, а не как с продавцом. Вклад в код и помощь с ответами создают доверие, а возможность проверить код снимает страх перед зависимостью от маленького поставщика.",
        "today": "познакомьтесь с одним человеком из своего списка через сообщество: ответьте на его вопрос или прокомментируйте его вклад в общий проект."
      },
      {
        "n": 45,
        "title": "Публичная экспертиза накапливается годами.",
        "body": "Подкаст, статьи и доклады приводят к тому, что покупатель уже слышал о вас до первого письма. Это медленный путь, и его результат трудно измерить в одном квартале, но конкуренту его быстро не повторить.",
        "today": "выберите одного человека из своего списка, которого можно пригласить гостем на подкаст или в соавторы статьи."
      },
      {
        "n": 46,
        "title": "Честность о границах продукта создаёт доверие.",
        "body": "Фраза «это мы делаем, а это нет» убеждает технического покупателя лучше обещаний. Он доверяет тому, кто сам называет ограничения продукта, потому что всё равно их найдёт при проверке.",
        "today": "на ближайшей встрече назовите одно ограничение продукта до того, как вас о нём спросят."
      }
    ]
  }
];

export const SALES_SCHOOL_EN: SchoolModule[] = [
  {
    "letter": "A",
    "title": "Complex sales fundamentals",
    "items": [
      {
        "n": 1,
        "title": "Selling means helping a company buy.",
        "body": "A large company buys infrastructure through its own process: engineers test the product, an architect compares alternatives, a manager allocates the budget, and legal and procurement teams agree the contract. Your job is to guide the company through this process and help at each step, rather than persuade one person.",
        "today": "For one company on your list, record its current buying stage and what it needs to move to the next one."
      },
      {
        "n": 2,
        "title": "You need to know several people in each company.",
        "body": "If you know only one person, the deal depends entirely on them: they may leave, lose interest or turn out not to be the decision maker. Try to stay in contact with at least three people in different roles at each company you are talking to: an engineer, a manager and the budget owner.",
        "today": "Find a company where you know only one person, then find two more in adjacent roles."
      },
      {
        "n": 3,
        "title": "An internal supporter moves the deal forward.",
        "body": "Someone inside the company must want the purchase to happen and explain its value to colleagues when you are not in the room. Salespeople call this person a champion. Without one, a deal usually stalls however well your meetings went.",
        "today": "For one company you are talking to, record who your internal supporter is and which of their own problems the purchase will solve."
      },
      {
        "n": 4,
        "title": "The supporter and the budget approver are usually different people.",
        "body": "The internal supporter wants the product, but someone else decides about money, usually the CTO or head of infrastructure. This is the economic buyer. They need to understand what changes for the company and what it costs, rather than the product's capabilities.",
        "today": "Find out who signs off the infrastructure budget at one company and whether they know about your conversation."
      },
      {
        "n": 5,
        "title": "The MEDDIC checklist shows what you still do not know about a deal.",
        "body": "MEDDIC is a six-question checklist. Metrics: which customer numbers will improve? Economic buyer: who decides about money? Decision criteria: how are alternatives compared? Decision process: which steps and approvals lie ahead? Identify pain: what hurts and what does it cost? Champion: who promotes the purchase internally? Any unanswered question marks a place where the deal could stall.",
        "today": "Review one deal against the six questions and record which answers you lack."
      },
      {
        "n": 6,
        "title": "A deal answers three questions: why change, why now and why you.",
        "body": "The company must understand why anything should change, why it should act now and why it should choose your product. Deals most often stall on the second question: without an event requiring action, such as the end of an incumbent contract or a new regulatory requirement, the purchase slips from quarter to quarter.",
        "today": "Record the event that makes one company act this year, or note that you do not yet know it."
      },
      {
        "n": 7,
        "title": "Ask more than you tell in the first meetings.",
        "body": "To understand the customer's problem, let them do most of the talking. Questions about how their infrastructure works, what gets in the way and what it costs reveal more than a product presentation and show that you understand their business.",
        "today": "Prepare three open questions for your next conversation about how their work runs today and what gets in the way, rather than about your product."
      },
      {
        "n": 8,
        "title": "The customer must name the problem.",
        "body": "Until the customer says aloud that they have a problem and what it costs, they will not invest effort in solving it, even if you see it clearly. The aim of early conversations is to help them express the problem in their own words.",
        "today": "After your next conversation, record the customer's own description of the problem. If they did not name it, write a question that will help them do so next time."
      },
      {
        "n": 9,
        "title": "Not now is different from do not contact me.",
        "body": "In a large company, a refusal often means that the project lacks priority or budget this year. Distinguish four cases: no response; a refusal of the current offer; a request for no further contact; and an agreement to return on a specific date. Record the reason and case in the company record. Return only in the second and fourth cases, and only with a new reason; a do-not-contact request applies permanently.",
        "today": "Classify three old refusals into these four cases. Where returning is allowed, record the event that will justify it."
      },
      {
        "n": 10,
        "title": "Small agreements move a deal forward.",
        "body": "A large purchase is rarely decided in one meeting. It advances through small steps that are easy to agree to: an introduction to a colleague, a twenty-minute architecture review or a technical call with engineers. Each step demonstrates real interest.",
        "today": "For each company you are talking to, record the next small step and the date you will ask for it."
      }
    ]
  },
  {
    "letter": "B",
    "title": "Buying-center roles",
    "items": [
      {
        "n": 11,
        "title": "The conversation most often starts with platform engineers.",
        "body": "Platform and infrastructure engineers and architects experience operating costs, manual work and dependence on one vendor themselves. You can speak the same engineering language with them, and the internal supporter is most often among them.",
        "today": "Find the platform lead or senior platform engineer on LinkedIn at two companies on your list."
      },
      {
        "n": 12,
        "title": "Reach the CTO through an internal supporter.",
        "body": "A cold email to a CTO or CIO rarely gets an answer: they do not know you and have no reason to spend time. Once an internal supporter is interested, they can tell their manager about you and invite you to a meeting, so the conversation starts with trust.",
        "today": "At one company where you do not yet know the engineers, postpone the email to the director and find a platform engineer first."
      },
      {
        "n": 13,
        "title": "The security leader can become an ally.",
        "body": "Security leaders care about whether the company can leave a supplier without losses, where product components come from and whether its behaviour can be inspected. Open source helps answer these questions: the code can be read, audited and, if needed, maintained without the vendor.",
        "today": "Write one sentence explaining how your product's open code reduces their security risks, and check that every word can be supported."
      },
      {
        "n": 14,
        "title": "The architect determines the comparison criteria.",
        "body": "The enterprise architect decides which requirements enter the product comparison. If you helped formulate requirements that honestly reflect the problem and favour your product's strengths, you are halfway to winning. If a competitor helped write them, winning will be hard.",
        "today": "Find out whether the company has an established standard or requirements list against which your product will be compared."
      },
      {
        "n": 15,
        "title": "Engineers will check everything you say.",
        "body": "Operations engineers will open your documentation and repository and try to reproduce the demo that same evening. A broken demo or an irreproducible number undermines trust in everything else you said.",
        "today": "Before your next technical conversation, check that the demo works and every number you cite is reproducible."
      },
      {
        "n": 16,
        "title": "Procurement usually joins after the decision.",
        "body": "Procurement handles the contract, risks and price. It usually joins once management and engineers have selected the product. Starting with procurement earlier gets you compared on price alone. There are exceptions: in state-owned companies and some banks, procurement runs a formal process from the start, and you must learn those rules immediately.",
        "today": "Find out how one company buys: who joins first and whether there is a formal bidding procedure."
      },
      {
        "n": 17,
        "title": "A deal needs a manager who needs it now.",
        "body": "The deal sponsor is a business leader with an urgent reason: an incumbent contract is expiring, management demands lower costs or a regulator has introduced a requirement. They give the project priority and money.",
        "today": "Find the manager at one company who has an urgent reason to address the problem you solve."
      },
      {
        "n": 18,
        "title": "Build buying-center connections outward from warm contacts.",
        "body": "Start with someone already on your side and ask for introductions to colleagues in adjacent roles. If someone ignores one email and one reminder, you may approach a colleague in a different role with a reason relevant to them, but do not reach the same person through colleagues or contact everyone indiscriminately. After a refusal, approach others at that company only through a warm introduction and do not reference the person without permission.",
        "today": "Ask someone you know at one company to introduce you to a colleague in an adjacent role."
      }
    ]
  },
  {
    "letter": "C",
    "title": "How different companies buy",
    "items": [
      {
        "n": 19,
        "title": "Banks and regulated companies start with a small, noncritical step.",
        "body": "Banks make decisions from the top and review risk at every step. The first purchase almost never touches core banking: it is a developer platform or replacement of one VMware cluster. Sales cycles are long and require several contacts and references from other banks. Strong arguments include the European financial resilience regulation DORA, the ability to leave a vendor and domestic data storage.",
        "today": "For one bank on your list, define a first step that does not touch core banking systems."
      },
      {
        "n": 20,
        "title": "Telecom operators and providers buy slowly but at scale.",
        "body": "Operators build their own customer cloud on the platform, so cloud economics, carrier-grade reliability and scale matter. A trusted local integrator often leads the deal. The cycle is long, but contracts are large.",
        "today": "Find an integrator working with one operator on your list who could introduce you."
      },
      {
        "n": 21,
        "title": "Industrial and automotive companies care about the edge and data.",
        "body": "These companies care about computing in factories and vehicles, keeping data in-house and systems that affect human safety; procurement is slow. Their platform teams, which often speak at KubeCon, are a good entry point.",
        "today": "Check which engineers from one such company on your list have spoken at KubeCon or local meetups."
      },
      {
        "n": 22,
        "title": "Research centers and universities choose from the bottom up.",
        "body": "Engineers and system administrators make decisions here, open source and community matter, and funding often comes from grants. A small vendor can compete on equal terms with a large one in this segment.",
        "today": "Find where one research center discusses its infrastructure: a mailing list, a GitHub repository or a CNCF chat channel."
      },
      {
        "n": 23,
        "title": "New AI clouds need a ready-made platform layer.",
        "body": "Companies building clouds on their own GPU servers and sovereign data centers often need a ready-made platform layer, making them a good segment for an infrastructure product. But some build that platform themselves and are competitors rather than buyers.",
        "today": "Check one such company's vacancies and repositories to learn whether it needs a ready-made platform or is building its own."
      },
      {
        "n": 24,
        "title": "Keep the first contract small.",
        "body": "The first purchase in a large company is usually a small paid pilot on a noncritical workload. Successful pilots lead to broader use. Offering everything at once alarms buyers and prolongs approvals.",
        "today": "Define a minimal paid pilot for one company: workload, duration and how you will jointly judge success."
      }
    ]
  },
  {
    "letter": "D",
    "title": "Regions and business culture",
    "items": [
      {
        "n": 25,
        "title": "US buyers expect a quick move to value.",
        "body": "American buyers usually value directness and speed: what will the product do for them now, and what result can be expressed in numbers? The contact's position and customer references carry weight. Long introductions irritate.",
        "today": "Start your next email to a US buyer with a result for their company and a verifiable number."
      },
      {
        "n": 26,
        "title": "In Germany, Austria and Switzerland, precision builds trust.",
        "body": "Buyers in these countries are cautious, check every claim and trust engineering competence and recommendations. Pushy selling puts them off. Domestic data storage and GDPR and DORA compliance work well as topics if you discuss them concretely.",
        "today": "Rewrite an email to a German-speaking buyer: remove evaluative words and add verifiable facts."
      },
      {
        "n": 27,
        "title": "Hierarchy, relationships and French matter in France.",
        "body": "Decisions in France are often made at senior levels, and personal relationships matter. French-language materials help. Sovereign cloud is a strong topic: the country has domestic cloud projects that meet government requirements.",
        "today": "For one French company, decide whether the first email needs to be in French and, if so, who will review it."
      },
      {
        "n": 28,
        "title": "Nordic countries value directness without grandstanding.",
        "body": "In Scandinavia and Finland, hierarchies are flat, decisions are consensual, and people value pragmatism, short clear emails, sustainability and regional data storage.",
        "today": "Cut one email to a Scandinavian buyer to five sentences without evaluative words."
      },
      {
        "n": 29,
        "title": "UK buyers value competence and polite distance.",
        "body": "British buyers are polite and value competence and moderate humour. Small talk is shorter than it may seem, but decisions follow a formal process.",
        "today": "Keep a light professional tone in an email to a British buyer and state the point in the first two sentences."
      },
      {
        "n": 30,
        "title": "Personal relationships drive decisions in the Middle East.",
        "body": "In the UAE and Saudi Arabia, trust takes time and personal contact, the other person's status matters, and sovereignty and national-scale projects are central topics. Meeting in person or through a mutual acquaintance works better than an email.",
        "today": "Find a person who can introduce you to one company in the region, or an event where you can meet in person."
      },
      {
        "n": 31,
        "title": "Japanese decisions require consensus.",
        "body": "Japanese companies decide through consensus: a proposal is discussed in advance with everyone affected, a practice called nemawashi. Patience and formality are needed, and almost always a local partner. Agreement will not be quick; that is a normal part of the process.",
        "today": "Find a local partner already working with one Japanese company."
      },
      {
        "n": 32,
        "title": "In Korea, work moves quickly after the decision.",
        "body": "Korean corporate hierarchies are stricter than European ones, but work moves quickly once a decision is made. It matters to show that large, well-known companies use your product.",
        "today": "Prepare a list of large customers you have permission to name for a Korean buyer."
      },
      {
        "n": 33,
        "title": "Scale and price matter in India.",
        "body": "Indian buyers work at large volumes, calculate cost per unit of workload, value engineering depth and return on investment, and usually negotiate. English is normal in business correspondence.",
        "today": "Prepare a cost-per-workload-unit calculation at the scale of an Indian company on your list."
      }
    ]
  },
  {
    "letter": "E",
    "title": "Touch tactics",
    "items": [
      {
        "n": 34,
        "title": "Contact databases are for mapping companies, not mass mailings.",
        "body": "Services such as Apollo help you see who works at a company and in which role. Mass emails to executives from such a database land in spam and harm your domain's reputation. Use the database to find the right people, then write to each individually.",
        "today": "Use a contact database to list the buying-center roles at one company without sending any emails."
      },
      {
        "n": 35,
        "title": "Personal messages and substantive comments work on LinkedIn.",
        "body": "Automated LinkedIn messages are immediately recognisable. What works is researching a person, writing personally with a reference to something they actually did or wrote, and leaving thoughtful comments on their posts. A comment is the safest way to get noticed: it asks for nothing.",
        "today": "Leave one substantive comment on a post by someone at a company on your list."
      },
      {
        "n": 36,
        "title": "The first touch gives something to the person.",
        "body": "The first message should offer value: an observation about their problem, a calculation, a relevant study or a question about their talk. Asking for a half-hour meeting in the first email usually gets no response.",
        "today": "Write a first email that asks for nothing except a reply if the person is interested."
      },
      {
        "n": 37,
        "title": "Company events provide reasons to talk.",
        "body": "A good reason is an event that changes a company's priorities: an upcoming VMware renewal, a cloud-bill complaint in an annual report, a new data-residency requirement, a new CTO or a GPU purchase. An email tied to such an event arrives when the person is already thinking about the problem, so replies are more likely.",
        "today": "Set news and job-posting alerts for three companies on your list."
      },
      {
        "n": 38,
        "title": "Your own channels are warmer than a cold email.",
        "body": "An invitation to your podcast, a meeting at your workshop or at KubeCon, or an introduction through mutual CNCF community contacts starts the conversation with trust a cold email lacks.",
        "today": "Choose one of your channels through which you could meet engineers at one company."
      },
      {
        "n": 39,
        "title": "An objection often means the person lacks information.",
        "body": "Too expensive, too risky and we already have a vendor often mean someone lacks the evidence to justify a decision to colleagues. Do not argue; clarify what lies behind the objection. But respect an explicit refusal and do not try to change their mind.",
        "today": "Prepare an answer to 'You are small; what if you disappear?': what happens to the customer's system if your company ceases to exist?"
      },
      {
        "n": 40,
        "title": "A similar customer's recommendation eases fears better than a presentation.",
        "body": "A bank finds another bank easier to believe, and an operator another operator. A recommendation from a company of the same type addresses the buyer's main fear: does this work for organisations like ours?",
        "today": "For each company on your list, identify a customer of the same type willing to share their experience."
      },
      {
        "n": 41,
        "title": "Alternate channels and limit touches.",
        "body": "Messages in one channel quickly become invisible, so alternate email, comments on the person's posts, meetings at events and introductions through mutual contacts. Every touch adds something new, and each person receives no more than three touches in three weeks, as described in Dream 100; then stop until there is a new reason. A refusal or do-not-contact request overrides every sequence.",
        "today": "For one company where conversation has stalled, choose another channel and a new reason that is genuinely useful to the person."
      },
      {
        "n": 42,
        "title": "Lose in a way that leaves room to return.",
        "body": "If a company declines now, thank them for their time, ask what would make the subject relevant again and record it. A deal lost through resentment and pressure cannot be recovered; a company you parted with amicably may welcome a new reason a year later.",
        "today": "Write a short thank-you email for a recent refusal and record the event that would justify returning."
      }
    ]
  },
  {
    "letter": "F",
    "title": "Founder-led sales against giants",
    "items": [
      {
        "n": 43,
        "title": "Small company size brings advantages.",
        "body": "A small company responds quickly, readily adapts its product for an important customer and brings the founder to the call. A large vendor usually cannot offer that attention. Say so directly.",
        "today": "In your next email, offer a direct conversation with the engineers building the product."
      },
      {
        "n": 44,
        "title": "Open source opens doors closed to salespeople.",
        "body": "In CNCF chats, at FOSDEM and in project repositories, people talk to you as a community member rather than a salesperson. Code contributions and helpful answers build trust, and inspectable code reduces fears of depending on a small vendor.",
        "today": "Meet someone on your list through the community: answer their question or comment on their contribution to a shared project."
      },
      {
        "n": 45,
        "title": "Public expertise accumulates over years.",
        "body": "Podcasts, articles and talks mean a buyer has heard of you before the first email. This is slow and hard to measure in a single quarter, but a competitor cannot quickly replicate it.",
        "today": "Choose someone on your list to invite as a podcast guest or article coauthor."
      },
      {
        "n": 46,
        "title": "Honesty about product limits builds trust.",
        "body": "We do this and we do not do that persuades a technical buyer more than promises. They trust someone who names product limits themselves, because they will find them during evaluation anyway.",
        "today": "At your next meeting, name one product limitation before being asked about it."
      }
    ]
  }
];
