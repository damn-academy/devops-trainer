import { defineModule } from '../../core/define';
import { bi } from '../../core/i18n';
import { markdownQuizItems } from '../../core/md-lessons';
import { productById } from '../../core/products';
import type { Block } from '../../core/types';
import { OSS_LESSONS } from './content';
import { OSS_MODULES, OSS_SUMMARIES } from './structure';

const product = productById('oss')!;
const lessons = OSS_LESSONS.map(lesson => ({ ...lesson, summary: OSS_SUMMARIES[lesson.id] }));
const block: Block = {
  id: 'oss', order: 995, hidden: true,
  title: product.title, summary: product.summary,
  checklistStep: null,
  levels: {
    beginner: bi('Начинаете открытый проект', 'Starting an open project'),
    intermediate: bi('Развиваете проект и сообщество', 'Growing a project and community'),
    experienced: bi('Отвечаете за управление и устойчивость', 'Responsible for governance and sustainability'),
  },
  hours: { beginner: 0, intermediate: 0, experienced: 0 },
  modules: OSS_MODULES,
  lessons: OSS_MODULES.flatMap(module => module.lessons),
  sources: { ru: [], en: [] }, placement: [],
};

export default defineModule({ blocks: [block], lessons, quiz: markdownQuizItems(lessons) });
