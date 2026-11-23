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
  title: bi('Закупочный центр: кто реально покупает', 'The buying center: who actually buys'),
  summary: bi(
    'Семь ролей решают сделку по-разному. Пройдите три шага тёплого водопада и откройте карточки ролей кликом.',
    'Seven roles decide a deal in different ways. Step through the three warm-waterfall steps and open the role cards by clicking.',
  ),
  intro: bi(
    'Нажимайте «Шаг вперёд» — подсветится, кто работает на каждом этапе. Клик по роли открывает её карточку: чем она живёт и как к ней заходить.',
    'Press "Step forward" — who works at each stage is highlighted. Click a role to open its card: what it cares about and how to approach it.',
  ),
  concepts: ['sales.champion', 'sales.economic-buyer'],
  diagram: {
    width: 960,
    height: 520,
    nodes: [
      {
        id: 'champion', label: bi('Чемпион', 'Champion'), family: 'flow', shape: 'hex', x: 40, y: 210, w: 170, h: 84,
        sub: bi('Platform Eng / Infra', 'Platform Eng / Infra'),
        card: card(
          'Внутренний человек, который продаёт за вас, когда вас нет в комнате. Здесь живёт боль (TCO, ops, lock-in), сюда примут инженер-к-инженеру. Вход в аккаунт — отсюда.',
          'Ищите в LinkedIn по роли в команде платформы. Без чемпиона сделки нет.',
          'The insider who sells for you when you are not in the room. The pain lives here (TCO, ops, lock-in) and you are accepted engineer-to-engineer. This is the door into the account.',
          'Find them on LinkedIn by their platform team role. No champion, no deal.',
        ),
      },
      {
        id: 'validator', label: bi('Инженеры-валидаторы', 'Engineer validators'), family: 'process', shape: 'box', x: 300, y: 60, w: 190, h: 72,
        sub: bi('SRE / DevOps', 'SRE / DevOps'),
        card: card(
          'Гуглят ваши доки и репу в тот же вечер. Один баг в демо — и вся экспертиза обнулена. Проверяют, что вы не врёте.',
          'Перед тех-разговором убедитесь, что цифры и демо чистые.',
          'They google your docs and repo the same evening. One bug in a demo resets all your credibility. They check that you do not lie.',
          'Before a technical call, make sure the numbers and the demo are clean.',
        ),
      },
      {
        id: 'architect', label: bi('Архитектор', 'Architect'), family: 'process', shape: 'box', x: 560, y: 60, w: 170, h: 72,
        sub: bi('decision criteria', 'decision criteria'),
        card: card(
          'Пишет критерии, по которым вас будут сравнивать. Повлияете на критерии — почти выиграли. Узнайте, есть ли у аккаунта «стандарт», против которого вас будут мерить.',
          'Спросите чемпиона, кто пишет стандарты и когда их пересматривают.',
          'Writes the criteria you will be compared against. Influence the criteria and you have almost won. Find out if the account has a "standard" you will be measured against.',
          'Ask the champion who writes the standards and when they are reviewed.',
        ),
      },
      {
        id: 'econ', label: bi('Экономический покупатель', 'Economic buyer'), family: 'l7', shape: 'hex', x: 330, y: 380, w: 210, h: 84,
        sub: bi('CTO / Head of Infra', 'CTO / Head of Infra'),
        card: card(
          'Подписывает бюджет и говорит «да». Холодным питчем сверху заходить мимо: к нему приходят, когда чемпион тёплый и может вас занести.',
          'Не пишите в CTO раньше, чем есть чемпион.',
          'Signs the budget and says yes. Cold top-down pitches miss: you arrive when the champion is warm and can carry you in.',
          'Do not write to the CTO before you have a champion.',
        ),
      },
      {
        id: 'sponsor', label: bi('Спонсор', 'Sponsor'), family: 'tls', shape: 'pill', x: 640, y: 390, w: 150, h: 64,
        sub: bi('владелец «почему сейчас»', 'owns the "why now"'),
        card: card(
          'BU-VP, у которого горит: renewal, мандат, cost-cutting. Даёт сделке приоритет и деньги. Это владелец триггера «почему сейчас».',
          'Найдите, у кого в аккаунте болит бизнес-триггер.',
          'A BU-VP with a burning issue: renewal, mandate, cost-cutting. Gives the deal priority and money. Owns the "why now" trigger.',
          'Find who in the account has a burning business trigger.',
        ),
      },
      {
        id: 'ciso', label: bi('CISO', 'CISO'), family: 'neutral', shape: 'box', x: 790, y: 200, w: 150, h: 72,
        card: card(
          'Не тормоз, а союзник при правильном заходе. Важны exit-ability, supply-chain, аудируемость. Open source — козырь: код можно проверить.',
          'Сформулируйте одну фразу «почему OSS снижает ваш риск».',
          'Not a blocker but an ally when approached right. Cares about exit-ability, supply chain, auditability. Open source is your card: the code can be checked.',
          'Prepare one sentence on "why open source lowers your risk".',
        ),
      },
      {
        id: 'proc', label: bi('Procurement', 'Procurement'), family: 'neutral', shape: 'box', x: 790, y: 320, w: 150, h: 72,
        card: card(
          'Про контракт, риск и цену; подключается, когда бизнес уже решил. Придёте через них рано — застрянете.',
          'Не ведите сделку через procurement, пока нет чемпиона и эконом-покупателя.',
          'About contract, risk and price; joins once the business has decided. Come through them early and you stall.',
          'Do not run the deal through procurement before the champion and the economic buyer are in.',
        ),
      },
    ],
    edges: [
      {
        id: 'in', from: 'champion', to: 'validator', label: bi('техразбор', 'tech review'),
        card: card(
          'Чемпион просит валидаторов проверить, что вы не врёте. Демо и цифры должны быть безупречны.',
          'Первый фильтр качества в аккаунте.',
          'The champion asks the validators to check you are not lying. The demo and numbers must be spotless.',
          'The account\'s first quality gate.',
        ),
      },
      {
        id: 'carry', from: 'champion', to: 'econ', label: bi('заносит к бюджету', 'carries to the budget'),
        card: card(
          'Тёплый чемпион заносит вас к экономическому покупателю. Холодный питч в CTO — обычно мимо.',
          'Главный переход сделки: чемпион продаёт за вас.',
          'A warm champion carries you to the economic buyer. A cold pitch to the CTO usually misses.',
          'The deal\'s main transition: the champion sells for you.',
        ),
      },
      {
        id: 'why', from: 'sponsor', to: 'econ', label: bi('даёт «почему сейчас»', 'gives the "why now"'),
        card: card(
          'Спонсор даёт сделке приоритет и деньги: это его горящий renewal, мандат или cost-cutting.',
          'Без спонсора сделку откладывают вечно.',
          'The sponsor gives the deal priority and money: his burning renewal, mandate or cost-cutting.',
          'Without a sponsor the deal is postponed forever.',
        ),
      },
      {
        id: 'crit', from: 'architect', to: 'econ', label: bi('критерии выбора', 'selection criteria'),
        card: card(
          'Архитектор определяет, по каким критериям вас сравнивают. Повлияли на критерии — почти выиграли.',
          'Критерии пишут до сравнения вендоров.',
          'The architect decides the criteria you are compared on. Influence the criteria and you have almost won.',
          'Criteria are written before vendors are compared.',
        ),
      },
      {
        id: 'risk', from: 'ciso', to: 'proc', label: bi('риск → контракт', 'risk → contract'),
        card: card(
          'CISO снимает риск, procurement переводит в контракт. Это конец сделки, не её начало.',
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
          'Начинаете с чемпиона: инженер-к-инженеру, с его болью. Одновременно валидаторы проверяют каждое слово.',
          'You start with the champion: engineer to engineer, with their pain. Meanwhile the validators check every word.',
        ),
        focus: ['champion', 'validator', 'in'],
        say: { champion: bi('«Покажи, как это реально работает» — вход через боль, не через презентацию.', '"Show me how it really works" — enter through pain, not a deck.') },
      },
      {
        id: 'carry', label: bi('К бюджету', 'To the budget'),
        caption: bi(
          'Тёплый чемпион заносит вас к экономическому покупателю. Спонсор добавляет «почему сейчас», архитектор — критерии выбора.',
          'A warm champion carries you to the economic buyer. The sponsor adds the "why now", the architect the selection criteria.',
        ),
        focus: ['carry', 'why', 'crit', 'econ', 'sponsor', 'architect'],
        say: { econ: bi('«Зачем нам это менять именно сейчас?» — вопрос спонсора, отвечает чемпион.', '"Why change this right now?" — the sponsor\'s question, answered by the champion.') },
      },
      {
        id: 'close', label: bi('Риск и контракт', 'Risk and contract'),
        caption: bi(
          'Когда бизнес решил, подключаются CISO (риск, exit-ability) и procurement (контракт). Приходить к ним первым — застрять.',
          'Once the business has decided, the CISO (risk, exit-ability) and procurement (contract) join. Coming to them first means stalling.',
        ),
        focus: ['ciso', 'proc', 'risk'],
        say: { ciso: bi('«А если вы исчезнете?» — ответ: код открыт, exit-ability в архитектуре.', '"What if you disappear?" — the answer: the code is open, exit-ability is in the architecture.') },
      },
    ];
  },
  explainDelta() {
    return bi('Шаг показывает, чья очередь двигает сделку.', 'The step shows whose turn it is to move the deal.');
  },
});
