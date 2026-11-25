import { bi } from '../../core/i18n';
// TODO(prose): Russian UI drafts; content files belong to the prose owner.
export const strings = {
  // TODO(en-trainers): Replace notice once translated content is available.
  notice: bi('Содержание тренажёра на русском языке.', "This trainer's content is in Russian for now"),
  missing: bi('Тренажёр не найден.', 'Trainer not found.'),
  caveat: bi('Это один из способов оценки; результат зависит от контекста.', 'This is one approach to assessment; results depend on context.'),
  input: bi('Ваш текст', 'Your text'), check: bi('Проверить здесь', 'Check here'), send: bi('Отправить', 'Send'),
  debrief: bi('Разбор', 'Debrief'), copy: bi('Скопировать промпт', 'Copy prompt'), copied: bi('Промпт скопирован.', 'Prompt copied.'),
  fallback: bi('Скопируйте выделенный промпт сочетанием клавиш.', 'Copy the selected prompt using your keyboard.'),
  settings: bi('Подключите нейросеть в настройках или скопируйте промпт.', 'Connect AI in settings or copy the prompt.'),
  busy: bi('Ожидаем ответ…', 'Waiting for a response…'), error: bi('Не удалось получить ответ. Попробуйте ещё раз.', 'The response failed. Please try again.'),
  history: bi('История попыток', 'Attempt history'), user: bi('Вы', 'You'), assistant: bi('Нейросеть', 'AI'),
  signal: bi('Сигнал', 'Signal'), noise: bi('Шум', 'Noise'), verify: bi('Зависит от проверки', 'Needs verification'),
  action: bi('Ваше действие (необязательно)', 'Your action (optional)'), reveal: bi('Показать ответ', 'Reveal answer'), next: bi('Дальше', 'Next'),
  score: bi('Верных ответов', 'Correct answers'), misses: bi('Ошибки', 'Misses'), chosen: bi('Ваш выбор', 'Your choice'),
  open: bi('Открытая', 'Open'), paid: bi('Платная', 'Paid'), reaction: bi('Показать реакцию', 'Show reaction'),
  expected: bi('Ожидаемая версия', 'Expected version'), protests: bi('Протесты', 'Protests'), disputed: bi('Спорные', 'Disputed'), fine: bi('Без протеста', 'Fine'),
  roi: bi('Окупаемость стенда', 'Booth ROI'), cost: bi('Все затраты, USD', 'All-in cost, USD'), profit: bi('Валовая прибыль с победы, USD', 'Gross profit per win, USD'),
  winRate: bi('Историческая доля побед', 'Historical win rate'), target: bi('Доля целевых людей среди сканов', 'Target share of scans'), scans: bi('Число сканов', 'Number of scans'),
  contacted: bi('Доля контактов за два рабочих дня', 'Share contacted within two business days'), meeting: bi('Доля контактов со встречей', 'Share of contacted people who meet'), opportunity: bi('Доля встреч со сделкой в работе', 'Share of meetings becoming opportunities'),
  wins: bi('Побед для окупаемости', 'Break-even wins'), opportunities: bi('Сделок в работе для окупаемости', 'Break-even opportunities'), median: bi('Медиана сделок в работе', 'Median opportunities'), probability: bi('Вероятность окупаемости', 'Break-even probability'),
  payoff: bi('Стенд окупается примерно в {n} прогонах из 100.', 'The booth breaks even in about {n} runs out of 100.'),
  assumptions: bi('500 прогонов, seed 42. Доли независимо меняются по beta-распределению с концентрацией 50; каждый переход и победы — биномиальные. Это модель, не прогноз.', '500 runs, seed 42. Shares vary independently with beta concentration 50; transitions and wins are binomial. This is a model, not a forecast.'),
  invalid: bi('Введите неотрицательные затраты, положительную прибыль, целое число сканов от 0 до 100 000 и доли от 0 до 1.', 'Enter nonnegative cost, positive profit, an integer scan count from 0 to 100,000 and shares from 0 to 1.'),
};
