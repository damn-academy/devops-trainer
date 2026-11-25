// Interactive scheme of the enterprise buying center for the hidden sales
// pilot. Three steps walk the "warm waterfall" from the school: start with the
// champion, let the champion carry you to the economic buyer, then close risk
// and process with CISO and procurement. Cards carry the role playbooks
// (lessons 11–18 of SALES-SCHOOL.md; Russian is the source text, TODO(ru-en)
// for the English pass).

import { defineModel } from '../../core/define';
import { bi } from '../../core/i18n';
import type { Step } from '../../core/types';

type P = Record<string, never>;

const card = (whatRu: string, whoRu: string, whatEn: string, whoEn: string) => ({
  what: bi(whatRu, whatEn),
  who: bi(whoRu, whoEn),
});

export const buyingModel = defineModel<P>({
  id: 'sales.buying',
  block: 'sales',
  title: bi('Кто в компании участвует в покупке', 'The buying center: who actually buys'),
  summary: bi(
    'В крупной покупке участвуют семь ролей, и каждая решает свою часть. Пройдите три шага сделки и откройте карточки ролей щелчком.',
    'Seven roles decide a deal in different ways. Step through the three warm-waterfall steps and open the role cards by clicking.',
  ),
  intro: bi(
    'Нажимайте «Шаг вперёд», и схема подсветит, кто участвует на каждом этапе. Щелчок по роли открывает карточку о том, что этому человеку важно и как с ним начать разговор.',
    'Press "Step forward" — who works at each stage is highlighted. Click a role to open its card: what it cares about and how to approach it.',
  ),
  concepts: ['sales.champion', 'sales.economic-buyer'],
  diagram: {
    width: 960,
    height: 520,
    nodes: [
      {
        id: 'champion', label: bi('Внутренний сторонник', 'Champion'), family: 'flow', shape: 'hex', x: 40, y: 210, w: 170, h: 84,
        sub: bi('инженер платформы', 'Platform Eng / Infra'),
        card: card(
          'Человек внутри компании, который объясняет коллегам, зачем нужна покупка, когда вас нет на встрече. Обычно это инженер или руководитель платформы: он сам платит за эксплуатацию, ручную работу и зависимость от одного поставщика и говорит с вами на одном языке. С него чаще всего начинается разговор с компанией.',
          'Ищите его в LinkedIn по роли в команде платформы. Без внутреннего сторонника сделка обычно останавливается.',
          'The insider who sells for you when you are not in the room. The pain lives here (TCO, ops, lock-in) and you are accepted engineer-to-engineer. This is the door into the account.',
          'Find them on LinkedIn by their platform team role. No champion, no deal.',
        ),
      },
      {
        id: 'validator', label: bi('Инженеры, которые проверяют', 'Engineer validators'), family: 'process', shape: 'box', x: 300, y: 60, w: 190, h: 72,
        sub: bi('эксплуатация', 'SRE / DevOps'),
        card: card(
          'Инженеры эксплуатации в тот же вечер откроют вашу документацию и репозиторий и попробуют повторить демонстрацию. Ошибка в демонстрации подрывает доверие ко всему остальному, что вы сказали.',
          'Перед техническим разговором проверьте, что демонстрация работает и каждую цифру можно воспроизвести.',
          'They google your docs and repo the same evening. One bug in a demo resets all your credibility. They check that you do not lie.',
          'Before a technical call, make sure the numbers and the demo are clean.',
        ),
      },
      {
        id: 'architect', label: bi('Архитектор', 'Architect'), family: 'process', shape: 'box', x: 560, y: 60, w: 170, h: 72,
        sub: bi('критерии выбора', 'decision criteria'),
        card: card(
          'Архитектор решает, по каким требованиям будут сравнивать продукты. Если требования честно отражают задачу и ваш продукт в ней силён, вы на полпути к победе. Узнайте, есть ли у компании принятый стандарт, с которым вас будут сравнивать.',
          'Спросите чемпиона, кто пишет стандарты и когда их пересматривают.',
          'Writes the criteria you will be compared against. Influence the criteria and you have almost won. Find out if the account has a "standard" you will be measured against.',
          'Ask the champion who writes the standards and when they are reviewed.',
        ),
      },
      {
        id: 'econ', label: bi('Экономический покупатель', 'Economic buyer'), family: 'l7', shape: 'hex', x: 330, y: 380, w: 210, h: 84,
        sub: bi('технический директор', 'CTO / Head of Infra'),
        card: card(
          'Подписывает бюджет и принимает решение. Холодное письмо ему обычно остаётся без ответа; к нему приходят, когда внутренний сторонник уже заинтересован и может сам о вас рассказать.',
          'Не пишите техническому директору, пока не нашли внутреннего сторонника.',
          'Signs the budget and says yes. Cold top-down pitches miss: you arrive when the champion is warm and can carry you in.',
          'Do not write to the CTO before you have a champion.',
        ),
      },
      {
        id: 'sponsor', label: bi('Спонсор', 'Sponsor'), family: 'tls', shape: 'pill', x: 640, y: 390, w: 150, h: 64,
        sub: bi('владелец «почему сейчас»', 'owns the "why now"'),
        card: card(
          'Руководитель направления, у которого есть срочная причина: истекает договор с прежним поставщиком, руководство требует сократить расходы или регулятор выпустил новое требование. Он даёт сделке приоритет и деньги.',
          'Найдите в компании руководителя, у которого есть срочная причина заняться вашей задачей.',
          'A BU-VP with a burning issue: renewal, mandate, cost-cutting. Gives the deal priority and money. Owns the "why now" trigger.',
          'Find who in the account has a burning business trigger.',
        ),
      },
      {
        id: 'ciso', label: bi('Безопасность', 'CISO'), family: 'neutral', shape: 'box', x: 790, y: 200, w: 150, h: 72,
        card: card(
          'Руководитель безопасности может стать союзником. Его волнует, сможет ли компания уйти от поставщика без потерь, откуда берутся компоненты продукта и можно ли проверить, что продукт делает. Открытый код помогает ответить на эти вопросы.',
          'Запишите одно предложение о том, почему открытый код снижает риски компании, и проверьте, что каждое слово в нём можно доказать.',
          'Not a blocker but an ally when approached right. Cares about exit-ability, supply chain, auditability. Open source is your card: the code can be checked.',
          'Prepare one sentence on "why open source lowers your risk".',
        ),
      },
      {
        id: 'proc', label: bi('Закупки', 'Procurement'), family: 'neutral', shape: 'box', x: 790, y: 320, w: 150, h: 72,
        card: card(
          'Отдел закупок отвечает за договор, риски и цену и обычно подключается, когда продукт уже выбрали. Если начать с закупок, вас сравнят только по цене. В государственных компаниях и некоторых банках закупки ведут процесс с самого начала, и их правила нужно узнать сразу.',
          'Узнайте, как в компании устроена закупка, но не начинайте с неё, пока нет внутреннего сторонника и решения руководителя.',
          'About contract, risk and price; joins once the business has decided. Come through them early and you stall.',
          'Do not run the deal through procurement before the champion and the economic buyer are in.',
        ),
      },
    ],
    edges: [
      {
        id: 'in', from: 'champion', to: 'validator', label: bi('техническая проверка', 'tech review'),
        card: card(
          'Внутренний сторонник просит инженеров эксплуатации проверить продукт. Демонстрация и цифры должны воспроизводиться.',
          'Первый фильтр качества в аккаунте.',
          'The champion asks the validators to check you are not lying. The demo and numbers must be spotless.',
          'The account\'s first quality gate.',
        ),
      },
      {
        id: 'carry', from: 'champion', to: 'econ', label: bi('знакомит с тем, кто решает о бюджете', 'carries to the budget'),
        card: card(
          'Заинтересованный внутренний сторонник знакомит вас с тем, кто решает о бюджете. Холодное письмо техническому директору обычно остаётся без ответа.',
          'Это главный переход сделки: внутренний сторонник объясняет ценность продукта за вас.',
          'A warm champion carries you to the economic buyer. A cold pitch to the CTO usually misses.',
          'The deal\'s main transition: the champion sells for you.',
        ),
      },
      {
        id: 'why', from: 'sponsor', to: 'econ', label: bi('даёт «почему сейчас»', 'gives the "why now"'),
        card: card(
          'Спонсор даёт сделке приоритет и деньги, потому что у него есть срочная причина: продление договора, требование руководства или регулятора.',
          'Без спонсора покупку откладывают из квартала в квартал.',
          'The sponsor gives the deal priority and money: his burning renewal, mandate or cost-cutting.',
          'Without a sponsor the deal is postponed forever.',
        ),
      },
      {
        id: 'crit', from: 'architect', to: 'econ', label: bi('критерии выбора', 'selection criteria'),
        card: card(
          'Архитектор определяет, по каким требованиям сравнивают продукты, и эти требования пишут до сравнения.',
          'Критерии пишут до сравнения вендоров.',
          'The architect decides the criteria you are compared on. Influence the criteria and you have almost won.',
          'Criteria are written before vendors are compared.',
        ),
      },
      {
        id: 'risk', from: 'ciso', to: 'proc', label: bi('риск → контракт', 'risk → contract'),
        card: card(
          'Безопасность проверяет риски, закупки превращают решение в договор. Обычно это последние шаги сделки.',
          'Сюда приходят после решения бизнеса.',
          'The CISO clears the risk, procurement turns it into a contract. This is the end of the deal, not its start.',
          'You arrive here after the business has decided.',
        ),
      },
    ],
  },
  params: [],
  breaks: [],
  frame: 'visible',
  run(_p: P, _broken: ReadonlySet<string>): Step[] {
    return [
      {
        id: 'start', label: bi('Старт', 'Start'),
        caption: bi(
          'Вы начинаете с внутреннего сторонника и говорите с ним о его задаче на инженерном языке. Тем временем инженеры эксплуатации проверяют каждое ваше слово.',
          'You start with the champion: engineer to engineer, with their pain. Meanwhile the validators check every word.',
        ),
        focus: ['champion', 'validator', 'in'],
        say: { champion: bi('«Покажите, как это работает на нашей задаче». Разговор начинается с проблемы клиента, презентация подождёт.', '"Show me how it really works" — enter through pain, not a deck.') },
      },
      {
        id: 'carry', label: bi('К бюджету', 'To the budget'),
        caption: bi(
          'Внутренний сторонник знакомит вас с тем, кто решает о бюджете. Спонсор приносит срочную причину, архитектор — требования, по которым будут сравнивать.',
          'A warm champion carries you to the economic buyer. The sponsor adds the "why now", the architect the selection criteria.',
        ),
        focus: ['carry', 'why', 'crit', 'econ', 'sponsor', 'architect'],
        say: { econ: bi('«Зачем нам это менять сейчас?» Это вопрос руководителя, и отвечает на него внутренний сторонник.', '"Why change this right now?" — the sponsor\'s question, answered by the champion.') },
      },
      {
        id: 'close', label: bi('Риск и контракт', 'Risk and contract'),
        caption: bi(
          'Когда руководители решили, подключаются безопасность с вопросами о рисках и о том, как уйти от поставщика, и закупки с договором. Если начать с них, сделка обычно застревает.',
          'Once the business has decided, the CISO (risk, exit-ability) and procurement (contract) join. Coming to them first means stalling.',
        ),
        focus: ['ciso', 'proc', 'risk'],
        say: { ciso: bi('«А если вы исчезнете?» Отвечайте, что код открыт и систему можно эксплуатировать без поставщика.', '"What if you disappear?" — the answer: the code is open, exit-ability is in the architecture.') },
      },
    ];
  },
  explainDelta() {
    return bi('Шаг показывает, чья очередь двигает сделку.', 'The step shows whose turn it is to move the deal.');
  },
});
