// TODO(prose): Russian UI strings to be rewritten by the prose owner.
import russianLangRules from '../../sims/lang-rules.ru.md?raw';
import { bi } from '../../core/i18n';

export const strings = {
  preset: bi('Готовая компания', 'Preset company'),
  custom: bi('Собрать свою', 'Build your own'),
  randomCompany: bi('Случайная компания', 'Random company'),
  customIntro: bi('Свойства компании, выбранные игроком:', 'Company properties chosen by the player:'),
  characters: bi('символов', 'characters'),
  tokens: bi('токенов примерно', 'approximate tokens'),
  longPrompt: bi('Некоторые бесплатные чаты обрезают длинные сообщения. Можно играть здесь со своей нейросетью.', 'Some free chat plans cut long messages. You can play here with your own AI.'),
  // TODO(en-prompts): Remove when English GM prose is available.
  russianPrompt: bi('', 'The game master prompt is in Russian for now; the model will answer in English'),
  company: bi('Компания', 'Company'),
  difficulty: bi('Сложность', 'Difficulty'),
  soft: bi('Мягко', 'Gentle'),
  'like-life': bi('Как в жизни', 'Like life'),
  hard: bi('Сложно', 'Hard'),
  turns: bi('Число ходов', 'Number of turns'),
  seed: bi('Seed (для повтора)', 'Seed (for replay)'),
  copy: bi('Скопировать промпт', 'Copy the prompt'),
  copied: bi('Промпт скопирован.', 'Prompt copied.'),
  show: bi('Показать промпт', 'Show the prompt'),
  fallback: bi('Скопируйте выделенный текст.', 'Copy the selected text.'),
  play: bi('Играть здесь', 'Play here'),
  settings: bi('Настройки → Ваша нейросеть', 'Settings → Your AI'),
  send: bi('Отправить', 'Send'),
  input: bi('Ваше решение', 'Your decision'),
  stop: bi('Остановить', 'Stop'),
  stopped: bi('Ответ остановлен.', 'Response stopped.'),
  newGame: bi('Новая игра', 'New game'),
  confirm: bi('Начать заново? Текущая переписка будет удалена.', 'Start again? The current transcript will be deleted.'),
  reset: bi('Начать заново', 'Start again'),
  cancel: bi('Отмена', 'Cancel'),
  export: bi('Экспорт игры', 'Export the game'),
  state: bi('Состояние компании', 'Company state'),
  assistant: bi('Ведущий', 'Game master'),
  user: bi('Вы', 'You'),
  start: bi('Начни игру: представь ситуацию и предложи первое решение.', 'Start the game: introduce the situation and ask for the first decision.'),
  error: bi('Не удалось получить ответ. Можно отправить сообщение ещё раз.', 'The response failed. You can send another message to try again.'),
  missing: bi('Сценарий не найден.', 'Scenario not found.'),
  note: bi('Это учебная модель. Реальные результаты зависят от контекста.', 'This is a learning model. Real outcomes depend on context.'),
  langRules: bi(russianLangRules, 'Respond in English. Keep the fence names state and debrief unchanged.'),
  diceRules: bi('Для каждого неопределённого исхода бери следующее число из таблицы по порядку и называй его. Не выбирай удобные числа и не бросай кубики сам. Заранее объявляй вероятность успеха: успех, если число не больше порога. Храни индекс следующего числа в state. Если таблица закончилась, остановись и сообщи об этом.', 'For each uncertain outcome, consume the next table number in order and name it. Never cherry-pick or roll your own dice. Declare the success threshold before resolving: succeed if the number is at most that threshold. Keep the next number index in state. If the table runs out, stop and say so.'),
  demoTitle: bi('Запуск инфраструктурного продукта', 'Launching an infrastructure product'),
  demoPremise: bi('Вы руководите маркетингом компании с открытым инфраструктурным продуктом. Выберите канал запуска при ограниченном бюджете.', 'You lead marketing for an open-source infrastructure company. Choose a launch channel with a limited budget.'),
  demoUnit: bi('две недели', 'two weeks'),
  demoPrompt: bi(
    'Ты ведущий деловой игры. Ученик — руководитель маркетинга. Компания: {{COMPANY}}\nSeed: {{SEED}}. Сложность: {{DIFFICULTY}}\nИгра длится {{TURNS}} ходов, каждый — {{TURN_UNIT}}. {{LANG_RULES}}\nНачальный бюджет 20000, команда 3 человека, 10 активных клиентов. Предложи выбор между работой с сообществом, партнёрским запуском и платной рекламой. Уточняй бюджет и ожидаемый результат решения. После каждого решения покажи затраты, последствия и следующий выбор. Не решай за ученика. В конце каждого хода печатай блок ```state с номером хода, бюджетом, клиентами, обязательствами и индексом следующего случайного числа. В последнем ходе добавь закрытый блок ```debrief с разбором решений и ограничений модели.\nТаблица случайных чисел:\n{{DICE}}',
    'You are the game master of a business simulation. The learner is head of marketing. Company: {{COMPANY}}\nSeed: {{SEED}}. Difficulty: {{DIFFICULTY}}\nRun {{TURNS}} turns of {{TURN_UNIT}} each. {{LANG_RULES}}\nStart with a budget of 20000, a team of 3 and 10 active customers. Offer a choice between community work, a partner launch and paid advertising. Ask for the decision budget and expected outcome. After each decision show costs, consequences and the next choice. Never decide for the learner. End every turn with a fenced block whose info string is state, containing turn, budget, customers, commitments and next dice index. On the final turn add a closed debrief fence reviewing decisions and model limitations.\nDice table:\n{{DICE}}',
  ),

};
export const difficultyTexts = {
  soft: bi('Давай запас ресурсов и ясные сигналы. Ошибки исправимы, но имеют цену.', 'Allow resource buffers and clear signals. Mistakes are recoverable but still have costs.'),
  'like-life': bi('Используй реалистичные ограничения, задержки и неполную информацию. Хорошие решения не гарантируют успеха.', 'Use realistic constraints, delays and incomplete information. Good decisions do not guarantee success.'),
  hard: bi('Ресурсов мало, конкуренты активны, последствия ошибок серьёзны. Не меняй правила задним числом.', 'Resources are scarce, competitors are active and mistakes have serious consequences. Never change rules retroactively.'),
};
