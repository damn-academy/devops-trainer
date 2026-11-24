// Pet projects (route id `pet-projects`): ten independent projects on real
// machines, one lesson per project. The learner picks any project and does it
// alone — the course gives only a sequential algorithm, pointers back to its
// own lessons and the honest note that this is one way, not a law. No level
// choice and no placement: beginnerOnly is unset, placement is empty.
// Design: web/STYLE-RU.md; the honest note follows web/src/blocks/sales/content.ts.

import { defineModule } from '../../core/define';
import { bi } from '../../core/i18n';
import type { Block } from '../../core/types';
import { PET_CONCEPTS } from './concepts';
import { PET_LESSONS_1 } from './lessons-1';
import { PET_LESSONS_2 } from './lessons-2';

export const PET_PROJECTS: Block = {
  id: 'pet-projects',
  order: 130,
  title: bi('Пет-проекты', 'Pet projects'),
  summary: bi(
    'В этом блоке вы делаете собственные проекты на настоящих машинах: личный сайт с TLS, конвейер для маленького приложения, мониторинг, сервис из контейнеров, одноузловой кластер, машина из кода, резервное копирование, сетевая лаборатория, собственный сервер Git и разбор учебного инцидента. Проекты не зависят друг от друга, и уровень здесь не выбирается: берите любой проект, выполняйте его самостоятельно по последовательному алгоритму и переходите к следующему. Курс не даёт готовых рецептов, зато каждый проект снабжён списком уроков, где можно вспомнить материал, и честной оговоркой: это один из способов, а не закон.',
    'In this block you do your own projects on real machines: a personal site with TLS, a pipeline for a tiny app, monitoring, a service of containers, a single-node cluster, a machine from code, backups, a network lab, your own Git server and a practice incident review. The projects are independent and there is no level to choose: take any project, complete it on your own following a sequential algorithm, and move to the next one. The course gives no ready recipes, but every project carries a list of lessons where you can recall the material and an honest note: this is one way, not a law.',
  ),
  checklistStep: null,
  levels: {
    beginner: bi('Проекты одинаковы для всех уровней; начинайте с любого', 'The projects are the same for every level; start with any one'),
    intermediate: bi('Проекты одинаковы для всех уровней; начинайте с любого', 'The projects are the same for every level; start with any one'),
    experienced: bi('Проекты одинаковы для всех уровней; начинайте с любого', 'The projects are the same for every level; start with any one'),
  },
  placement: [],
  lessons: [...PET_LESSONS_1, ...PET_LESSONS_2].map((l) => l.id),
  sources: {
    en: [
      { title: 'Make a README', url: 'https://www.makeareadme.com/' },
      { title: 'GitHub Docs — About READMEs', url: 'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes' },
    ],
    ru: [{ title: 'Хабр Карьера — профессия DevOps', url: 'https://career.habr.com/professions/devops' }],
  },
};

export default defineModule({
  blocks: [PET_PROJECTS],
  lessons: [...PET_LESSONS_1, ...PET_LESSONS_2],
  concepts: PET_CONCEPTS,
});
