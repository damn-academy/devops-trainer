// Concepts of the pet-projects block. Both terms are everyday words as well,
// so the glossary scan is off; links and introduces/uses are still checked.

import { bi } from '../../core/i18n';
import type { Concept } from '../../core/types';

export const PET_CONCEPTS: Concept[] = [
  {
    id: 'pet.algorithm',
    term: bi('последовательный алгоритм', 'sequential algorithm'),
    short: bi(
      'Порядок работы над проектом, в котором каждый следующий шаг опирается на результат предыдущего: сначала машина, потом сервис, потом проверка.',
      'The order of work on a project in which every next step builds on the result of the previous one: the machine first, then the service, then the check.',
    ),
    introducedIn: 'pet-projects.site',
    scan: false,
  },
  {
    id: 'pet.acceptance',
    term: bi('критерий приёмки', 'acceptance criterion'),
    short: bi(
      'Проверяемое условие, при выполнении которого проект считается готовым: например, сайт открывается по HTTPS с телефона через мобильную сеть.',
      'A checkable condition under which the project counts as done: for example, the site opens over HTTPS from a phone on a mobile network.',
    ),
    introducedIn: 'pet-projects.site',
    scan: false,
  },
];
