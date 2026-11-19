// The resume builder's model and linter (10 §9.6). Each skill carries its
// evidence (a passed exam, a pet project, a repository), so the main rule of
// a junior CV — every claimed skill can be opened and checked — is a check,
// not advice. Export is JSON Resume (jsonresume.org) with an `x-trainer`
// extension, plus plain text for job-board forms.

import { bi, type Bi } from '../../core/i18n';

export interface ResumeSkill {
  name: string;
  /** Links or course evidence ids: 'exam:containers', 'pet:pet3', 'https://github.com/…'. */
  evidence: string[];
}

export interface ResumeProject {
  name: string;
  url: string;
  highlights: string[];
  pet?: string;
}

export interface ResumeWork {
  company: string;
  position: string;
  years: string;
  /** Rewritten as a bridge to DevOps (10 §9.6 table); otherwise kept to one line. */
  bridge: boolean;
  highlights: string[];
}

export interface Resume {
  lang: 'ru' | 'en';
  name: string;
  label: string;
  summary: string;
  email: string;
  github: string;
  skills: ResumeSkill[];
  projects: ResumeProject[];
  work: ResumeWork[];
  education: string;
  /** Personal data that the international market does not expect (CV8). */
  photo: boolean;
  age: boolean;
  family: boolean;
  /** The learner confirms a DevOps position in `work` was a real job (CV10). */
  devopsJobConfirmed: boolean;
}

export function emptyResume(lang: 'ru' | 'en' = 'ru'): Resume {
  return { lang, name: '', label: '', summary: '', email: '', github: '', skills: [], projects: [], work: [], education: '', photo: false, age: false, family: false, devopsJobConfirmed: false };
}

export interface CvIssue {
  id: string;
  level: 'error' | 'warn' | 'hint';
  ok: boolean;
  rule: Bi;
  /** What is wrong right now, when not ok. */
  say?: Bi;
}

const TARGET = /(devops|sre|site reliability|platform|инфраструктур|infrastructure|cloud engineer|системн[а-я]* администратор|system administrator)/i;
const DUTIES = /^(отвечал|отвечала|занимался|занималась|в мои обязанности|обязанности|участвовал[а]? в|responsible for|duties|in charge of|was involved)/i;
const EMPTY = [
  'уверенный пользователь пк',
  'уверенный пользователь компьютера',
  'стрессоустойчив',
  'быстро обучаюсь',
  'быстрообучаем',
  'коммуникабельн',
  'ответственный',
  'исполнительн',
  'целеустремл',
  'team player',
  'fast learner',
  'quick learner',
  'hard-working',
  'hardworking',
  'stress-resistant',
  'self-motivated',
  'detail-oriented',
  'pc literate',
];
const REPO = /(github\.com|gitlab\.com|codeberg\.org|bitbucket\.org)\//i;

function allText(r: Resume): string {
  return [r.label, r.summary, ...r.skills.map((s) => s.name), ...r.projects.flatMap((p) => [p.name, ...p.highlights]), ...r.work.flatMap((w) => [w.position, w.company, ...w.highlights]), r.education].join('\n');
}

export function wordCount(r: Resume): number {
  return allText(r).split(/\s+/).filter(Boolean).length;
}

/** CV1–CV10. Errors block "ready"; warnings may be dismissed knowingly; hints only suggest. */
export function lintResume(r: Resume, vacancyKeywords: string[] = []): CvIssue[] {
  const out: CvIssue[] = [];
  const push = (id: string, level: CvIssue['level'], ok: boolean, rule: Bi, say?: Bi) => out.push({ id, level, ok, rule, say: ok ? undefined : say });

  push('CV1', 'error', TARGET.test(r.label), bi('В заголовке стоит роль, на которую вы претендуете, а не прежняя профессия', 'The headline names the role you are applying for, not the previous profession'), bi('Напишите, кем хотите работать, например «Junior DevOps Engineer» или «DevOps-инженер (стажёр)».', 'Write the job you want, for example “Junior DevOps Engineer” or “DevOps intern”.'));

  const bare = r.skills.filter((s) => !s.evidence.some((e) => e.trim()));
  push('CV2', 'error', r.skills.length > 0 && bare.length === 0, bi('У каждого навыка есть подтверждение, будь то экзамен, пет-проект или ссылка', 'Every skill has evidence, be it an exam, a pet project or a link'), r.skills.length ? bi(`Подтверждения нет у этих навыков: ${bare.map((s) => s.name).join(', ')}. Перенесите их в раздел «Знаком» или удалите.`, `These skills have no evidence: ${bare.map((s) => s.name).join(', ')}. Move them to “Familiar with” or remove them.`) : bi('Добавьте навыки и у каждого укажите то, что можно открыть и проверить.', 'Add skills, and for each one give something that can be opened and checked.'));

  const repoProjects = r.projects.filter((p) => REPO.test(p.url));
  push('CV3', 'error', REPO.test(r.github) && repoProjects.length > 0, bi('В резюме есть ссылка на GitHub или GitLab и хотя бы один проект с репозиторием', 'The CV has a GitHub or GitLab link and at least one project with a repository'), bi('Нанимающий менеджер первым делом откроет репозиторий. Дайте ссылку на профиль и на проект.', 'A hiring manager opens the repository first. Link the profile and a project.'));

  const long = r.work.filter((w) => !w.bridge && w.highlights.filter(Boolean).length > 1);
  push('CV4', 'warn', long.length === 0, bi('Опыт, не связанный с DevOps, занимает одну строку или переведён в мост к DevOps', 'Unrelated experience takes one line or is rewritten as a bridge to DevOps'), bi(`Сожмите до одной строки или переведите в мост к DevOps эти места работы: ${long.map((w) => w.position || w.company).join(', ')}.`, `Shorten to one line or rewrite as a bridge to DevOps these jobs: ${long.map((w) => w.position || w.company).join(', ')}.`));

  const duties = [...r.projects.flatMap((p) => p.highlights), ...r.work.flatMap((w) => w.highlights)].filter((x) => DUTIES.test(x.trim()));
  push('CV5', 'warn', duties.length === 0, bi('Пункты описывают действие и результат, а не обязанности', 'Bullets are actions and results, not duties'), bi(`Перепишите этот пункт так, чтобы в нём были действие и его результат: «${duties[0] ?? ''}».`, `Rewrite this bullet so that it has an action and its result: “${duties[0] ?? ''}”.`));

  const low = allText(r).toLowerCase();
  const empty = EMPTY.filter((e) => low.includes(e));
  push('CV6', 'warn', empty.length === 0, bi('В резюме нет пустых формулировок', 'The CV has no empty phrases'), bi(`Уберите или замените фактом: ${empty.join(', ')}.`, `Remove or replace with a fact: ${empty.join(', ')}.`));

  const words = wordCount(r);
  push('CV7', 'warn', words <= 450, bi('Резюме джуна помещается на одну страницу A4', 'A junior’s CV fits on one A4 page'), bi(`Сейчас в резюме около ${words} слов, а на страницу помещается примерно 450.`, `The CV now has about ${words} words, and a page holds roughly 450.`));

  const personal = r.lang === 'en' && (r.photo || r.age || r.family);
  push('CV8', r.lang === 'en' ? 'error' : 'hint', !personal, bi('В английской версии нет фото, возраста и семейного положения', 'The English version has no photo, age or marital status'), bi('На международном рынке так принято, поэтому уберите фото, возраст и семейное положение.', 'This is the custom on the international market, so remove the photo, age and marital status.'));

  if (vacancyKeywords.length) {
    const missing = vacancyKeywords.filter((k) => !low.includes(k.toLowerCase()));
    push('CV9', 'hint', missing.length === 0, bi('Ключевые слова вакансии стоят там, где есть подтверждение, и только там', 'The vacancy’s keywords appear where you have evidence, and only there'), bi(`Эти слова есть в вакансии, но нет в резюме: ${missing.join(', ')}. Добавьте только то, что можете подтвердить.`, `These words are in the vacancy but not in the CV: ${missing.join(', ')}. Add only what you can back up.`));
  }

  const claimed = r.work.filter((w) => /devops|sre|site reliability/i.test(w.position));
  const petAsJob = r.work.filter((w) => /(пет|pet[- ]?project|личный проект|personal project|фриланс|freelance)/i.test(`${w.company} ${w.position}`));
  push('CV10', 'error', (claimed.length === 0 || r.devopsJobConfirmed) && petAsJob.length === 0, bi('В резюме нет ничего выдуманного, и пет-проект указан в разделе проектов, а не в опыте работы', 'Nothing in the CV is made up, and a pet project is listed under projects, not under work experience'), petAsJob.length ? bi('Перенесите пет-проекты в раздел «Проекты», потому что работой они не были.', 'Move pet projects to “Projects”, because they were not a job.') : bi('Должность DevOps указывают в опыте работы, только если она была. Отметьте, что это ваша настоящая должность, или уберите её.', 'A DevOps position goes under work experience only if you held it. Confirm that it was your real position, or remove it.'));
  return out;
}

export function resumeReady(issues: CvIssue[]): boolean {
  return issues.every((i) => i.ok || i.level !== 'error');
}

/** JSON Resume with the x-trainer extension (10 §9.6). */
export function toJsonResume(r: Resume): Record<string, unknown> {
  return {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: { name: r.name, label: r.label, email: r.email || undefined, summary: r.summary, profiles: r.github ? [{ network: /gitlab/i.test(r.github) ? 'GitLab' : 'GitHub', url: r.github }] : [] },
    skills: r.skills.map((s) => ({ name: s.name, 'x-trainer': { evidence: s.evidence.filter(Boolean) } })),
    projects: r.projects.map((p) => ({ name: p.name, url: p.url || undefined, highlights: p.highlights.filter(Boolean), 'x-trainer': p.pet ? { pet: p.pet } : undefined })),
    work: r.work.map((w) => ({ name: w.company, position: w.position, summary: w.years, highlights: w.highlights.filter(Boolean), 'x-trainer': { relevance: w.bridge ? 'bridge' : 'other' } })),
    education: r.education ? [{ institution: r.education }] : [],
    meta: { language: r.lang },
  };
}

/** Plain text for job-board forms. */
export function toText(r: Resume): string {
  const L = r.lang === 'ru' ? { skills: 'Навыки', projects: 'Проекты', work: 'Опыт работы', edu: 'Образование' } : { skills: 'Skills', projects: 'Projects', work: 'Experience', edu: 'Education' };
  const lines: string[] = [r.name, r.label, [r.email, r.github].filter(Boolean).join(' · '), '', r.summary, ''];
  if (r.skills.length) lines.push(L.skills, ...r.skills.map((s) => `• ${s.name}${s.evidence.filter(Boolean).length ? ` — ${s.evidence.filter(Boolean).join(', ')}` : ''}`), '');
  if (r.projects.length) for (const p of r.projects) lines.push(p.name + (p.url ? ` — ${p.url}` : ''), ...p.highlights.filter(Boolean).map((x) => `  • ${x}`));
  if (r.projects.length) lines.push('');
  if (r.work.length) lines.push(L.work, ...r.work.flatMap((w) => [`${w.position}, ${w.company} (${w.years})`, ...(w.bridge ? w.highlights.filter(Boolean).map((x) => `  • ${x}`) : [])]), '');
  if (r.education) lines.push(L.edu, r.education);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Honest translations of earlier experience (10 §9.6): the learner picks only what they really did. */
export const BRIDGES: { from: Bi; to: Bi; why: Bi }[] = [
  {
    from: bi('Работа с возражениями, переговоры', 'Handling objections, negotiation'),
    to: bi('Собирал требования клиентов и переводил их в задачи для технической команды', 'Gathered customer requirements and turned them into tasks for the technical team'),
    why: bi('DevOps-инженер половину рабочего времени договаривается с разработчиками и бизнесом.', 'A DevOps engineer spends half of the working time coming to agreements with developers and the business.'),
  },
  {
    from: bi('Вёл CRM, строил отчёты в Excel', 'Ran the CRM, built reports in Excel'),
    to: bi('Автоматизировал отчётность с помощью выгрузок, формул и макросов и сократил ручную работу с N до M часов в неделю', 'Automated reporting with exports, formulas and macros and cut manual work from N to M hours a week'),
    why: bi('Привычка автоматизировать рутину служит DevOps-инженеру главным инструментом.', 'The habit of automating routine work is a DevOps engineer’s main tool.'),
  },
  {
    from: bi('Первая линия поддержки', 'First-line support'),
    to: bi('Разбирал до N обращений в день, локализовал проблемы по журналам и шагам воспроизведения, эскалировал с описанием', 'Handled up to N tickets a day, located problems from logs and reproduction steps, escalated with a write-up'),
    why: bi('Это опыт разбора инцидентов и чтения журналов, и в DevOps он даёт преимущество.', 'This is experience of incident work and reading logs, and in DevOps it gives you an advantage.'),
  },
  {
    from: bi('Писал инструкции для коллег', 'Wrote instructions for colleagues'),
    to: bi('Писал документацию и инструкции для команды из N человек', 'Wrote documentation and how-tos for a team of N'),
    why: bi('Документацию и инструкции для дежурных (runbook) в эксплуатации пишут и читают каждый день.', 'In operations, documentation and runbooks are written and read every day.'),
  },
  {
    from: bi('Руководил сменой, распределял задачи', 'Led a shift, assigned tasks'),
    to: bi('Планировал работу смены, следил за сроками и загрузкой', 'Planned the shift’s work, tracked deadlines and load'),
    why: bi('Умение управлять потоком работ пригодится и на канбан-доске, и на дежурствах.', 'Understanding the flow of work is the same logic as in kanban and on-call.'),
  },
  {
    from: bi('Тестировщик', 'QA engineer'),
    to: bi('Автоматизировал тесты и встроил их в CI', 'Automated tests and wired them into CI'),
    why: bi('Непрерывная интеграция лежит в основе профессии.', 'CI is the core of the profession.'),
  },
  {
    from: bi('Программист', 'Software developer'),
    to: bi('Писал Dockerfile и конвейеры для своих сервисов, участвовал в разборе инцидентов (пишите, только если это было)', 'Wrote Dockerfiles and pipelines for my services, took part in incident reviews — only if you did'),
    why: bi('Это путь в DevOps со стороны разработки.', 'This is the way into DevOps from development.'),
  },
];
