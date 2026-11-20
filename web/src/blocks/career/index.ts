// Career (route id `career`) and the final segment (route id `final`):
// interview preparation, the mock interviewer, self-presentation, the CV,
// pet projects, the job search; the on-call shift and the capstone outline.
// Design: design/10-assessment-career.md §5.2, §6.4–6.5, §9–10.

import { defineModule } from '../../core/define';
import { bi } from '../../core/i18n';
import type { Block, Sources } from '../../core/types';
import { fromModel } from '../../engine/explainer/render';
import { CONCEPTS } from './concepts';
import { BLOCK_EXAMS } from './exams';
import { CAPSTONE_EXAM, FINAL_EXAMS } from './final-exam';
import { fsrsModel } from './explainers/fsrs';
import { funnelModel } from './explainers/funnel';
import { quoteModel } from './explainers/quote';
import { symptomModel } from './explainers/symptom';
import { L_CAPSTONE, L_ONCALL } from './lessons-final';
import { L_ANSWER, L_CLASSICS, L_INTERVIEWS, L_MOCK, L_SITUATIONAL } from './lessons-interview';
import { L_PETS, L_PITCH, L_RESUME, L_SEARCH } from './lessons-job';
import { CAREER_PLACEMENT } from './placement';
import { QUIZ } from './quiz';
import { checklistWidget } from './widgets/checklist';
import { drillWidget } from './widgets/drill';
import { mockWidget } from './widgets/mock';
import { oncallWidget } from './widgets/oncall';
import { pitchWidget } from './widgets/pitch';
import { resumeWidget } from './widgets/resume';
import { translatorWidget } from './widgets/translator';
import { vacancyWidget } from './widgets/vacancy';
import './career.css';

const careerSources: Sources = {
  en: [
    { title: 'roadmap.sh — DevOps interview questions', url: 'https://roadmap.sh/questions/devops' },
    { title: 'Google SRE Book — Managing Incidents', url: 'https://sre.google/sre-book/managing-incidents/' },
    { title: 'JSON Resume — schema', url: 'https://jsonresume.org/schema/' },
  ],
  ru: [
    { title: 'Хабр Карьера — профессия DevOps', url: 'https://career.habr.com/professions/devops' },
    { title: 'KTS: как мы перевели собеседования DevOps на тренажёр (Хабр)', url: 'https://habr.com/ru/companies/kts/articles/795277/' },
  ],
};

const finalSources: Sources = {
  en: [
    { title: 'Google SRE Workbook — On-Call', url: 'https://sre.google/workbook/on-call/' },
    { title: 'Google SRE Book — Postmortem Culture', url: 'https://sre.google/sre-book/postmortem-culture/' },
    { title: 'Kubernetes — Creating a cluster with kubeadm', url: 'https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/' },
  ],
  ru: [
    { title: 'Установка Kubernetes — kubernetes.io', url: 'https://kubernetes.io/ru/docs/setup/' },
    { title: 'ITIL — Википедия', url: 'https://ru.wikipedia.org/wiki/ITIL' },
  ],
};

const FINAL: Block = {
  id: 'final',
  order: 110,
  title: bi('Смена дежурного и итоговый экзамен', 'On-call shift and final exam'),
  summary: bi('Сначала смена дежурного с тремя инцидентами, которые наслаиваются друг на друга, а затем итоговый экзамен на трёх настоящих машинах, где нужно построить систему, починить её и защитить.', 'Three overlapping incidents, then the final exam on three real machines: build, fix, defend.'),
  checklistStep: '08',
  levels: {
    beginner: bi('Экзамен на стендах одинаков для всех уровней, и кластер в нём собирается через kubeadm. На настоящих машинах кластер можно собрать на k3s', 'One stand exam for every level, with a kubeadm cluster; on real machines the cluster may be k3s'),
    intermediate: bi('Экзамен на стендах одинаков для всех уровней, и кластер в нём собирается через kubeadm. На настоящих машинах кластер можно собрать на k3s или через kubeadm', 'One stand exam for every level, with a kubeadm cluster; on real machines k3s or kubeadm'),
    experienced: bi('Вдобавок к общему экзамену вы обслуживаете кластер kubeadm: снимки etcd, обновление и сертификаты', 'Plus kubeadm operations: etcd, upgrades, certificates'),
  },
  hours: { beginner: 40, intermediate: 35, experienced: 30 },
  placement: [],
  lessons: ['final.oncall', 'final.capstone'],
  sources: finalSources,
  docSources: ['help', 'ansible-doc', 'terraform', 'kubernetes.io', 'argo-cd'],
  exam: CAPSTONE_EXAM.id,
};

const CAREER: Block = {
  id: 'career',
  order: 120,
  title: bi('Карьера', 'Career'),
  summary: bi(
    'В маршруте блок стоит последним, но открыть его можно в любой момент, и начать полезно рано, примерно после блока о сетях: первые два урока опираются в основном на Linux и сети, а учебное интервью спрашивает только о блоках, которые вы уже прошли. В блоке вы узнаете, как устроено собеседование и как построить ответ, потренируетесь отвечать на ситуационные вопросы в песочнице, пройдёте учебные интервью, подготовите самопрезентацию, резюме и пет-проекты и научитесь искать работу по правилу 60 %.',
    'Last on the route, but it can be opened at any time, and it pays to start early, roughly after the networks block: the first two lessons rely mostly on Linux and networks, and the mock interview asks only about blocks you have done. How an interview works, a structured answer, situational questions in a sandbox, mock interviews, self-presentation, the CV, pet projects and searching by the 60% rule.',
  ),
  checklistStep: '09–11',
  levels: {
    beginner: bi('Вы ещё не проходили собеседований в IT', 'Never had an IT interview'),
    intermediate: bi('Вы проходили нетехнические собеседования в IT или технические собеседования в другой области', 'Had non-technical IT interviews or technical ones in another field'),
    experienced: bi('Вы проходили технические собеседования на должность разработчика или администратора', 'Had technical interviews as a developer or an admin'),
  },
  hours: { beginner: 25, intermediate: 22, experienced: 18 },
  placement: CAREER_PLACEMENT,
  lessons: ['career.interviews', 'career.answer', 'career.classics', 'career.situational', 'career.mock', 'career.pitch', 'career.resume', 'career.pets', 'career.search'],
  sources: careerSources,
};

export default defineModule({
  blocks: [FINAL, CAREER],
  lessons: [L_ONCALL, L_CAPSTONE, L_INTERVIEWS, L_ANSWER, L_CLASSICS, L_SITUATIONAL, L_MOCK, L_PITCH, L_RESUME, L_PETS, L_SEARCH],
  concepts: CONCEPTS,
  quiz: QUIZ,
  explainers: [fromModel(symptomModel), fromModel(quoteModel), fromModel(funnelModel), fromModel(fsrsModel)],
  widgets: [translatorWidget, drillWidget, mockWidget, pitchWidget, resumeWidget, vacancyWidget, checklistWidget, oncallWidget],
  exams: [...BLOCK_EXAMS, ...FINAL_EXAMS],
});
