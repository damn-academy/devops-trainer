// Money in the learner's language: roubles in Russian, dollars in English (12 000 ₽ ≈ $150 an hour, 07 §7.1).

import { lang } from '../../core/i18n';

export const RUB_PER_USD = 80;

export const money = (rub: number): string => (lang() === 'ru' ? `${Math.round(rub).toLocaleString('ru-RU')} ₽` : `$${Math.round(rub / RUB_PER_USD).toLocaleString('en-US')}`);
