// The platform catalog: professions and courses are the two structural units
// of the site. A profession is the big track (theory, practice, exams) that
// can lead to changing careers; a course is a smaller standalone unit that
// does not imply entering a profession. Hidden products stay reachable by
// direct link but do not appear on the catalog page.

import { bi, type Bi } from './i18n';
import type { Route } from './router';

export interface Product {
  kind: 'profession' | 'course';
  id: string;
  title: Bi;
  summary: Bi;
  hidden?: boolean;
}

export const PRODUCTS: Product[] = [
  {
    kind: 'profession',
    id: 'devops',
    title: bi('DevOps-инженер', 'DevOps engineer'),
    summary: bi(
      'Профессия целиком: от первой команды в терминале до Kubernetes в облаке. Теория, практика на настоящих машинах, проверки уровня и экзамены.',
      'The whole profession: from your first command in the terminal to Kubernetes in the cloud. Theory, practice on real machines, level checks and exams.',
    ),
  },
  {
    kind: 'course',
    id: 'sales',
    title: bi('Продажи', 'Sales'),
    summary: bi(
      'Пилот курса: принципы продаж, роли в закупочном центре, симулятор воронки.',
      'Course pilot: sales principles, buying-centre roles, a funnel simulator.',
    ),
    hidden: true, // Owner reviews the pilot before it goes public; reachable at #/courses.
  },
];

export const visibleProducts = (kind: Product['kind']): Product[] => PRODUCTS.filter((p) => p.kind === kind && !p.hidden);

export function productRoute(p: Product): Route {
  return p.kind === 'profession' ? { name: 'profession', id: p.id } : { name: 'courses' };
}

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/** The first visible profession — pages that belong to a profession breadcrumb to it. */
export function defaultProfession(): Product | undefined {
  return visibleProducts('profession')[0];
}
