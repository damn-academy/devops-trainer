// The Mentor the platform's "Ask" box calls (core types: Mentor, MentorRequest).
// It answers through the same tutor turn as the side panel: layered prompt,
// masking, the white list of concepts, and the rephrase-on-leak guard.

import { registry } from '../../core/registry';
import type { Mentor, MentorRequest } from '../../core/types';
import { terminalTail } from './context';
import { ERRORS, ai } from './service';
import { AiError } from './client';
import { t } from '../../core/i18n';
import type { TutorContext, VocabEntry } from './prompt';
import { turn } from './tutor';

export function contextFromRequest(req: MentorRequest): TutorContext {
  const lesson = req.lessonId ? registry.lessons.get(req.lessonId) : undefined;
  const introduced: VocabEntry[] = [];
  for (const id of new Set([...req.introduced, ...(lesson?.introduces ?? [])])) {
    const c = registry.concepts.get(id);
    if (c) introduced.push({ id, term: c.term, forms: c.forms, short: c.short });
  }
  return {
    lang: req.lang,
    level: req.level,
    mode: req.mode,
    lesson: lesson ? { id: lesson.id, title: t(lesson.title, req.lang), block: lesson.block } : undefined,
    screen: req.screen,
    task: req.task ? { id: req.task.id, prompt: req.task.prompt, hintsUsed: 0, docStep: req.mode === 'docs' ? 4 : undefined, hintStep: req.mode === 'practice' ? 'H1' : undefined } : undefined,
    introduced,
    terminal: terminalTail(),
    docTrail: req.docTrail,
  };
}

export const byoMentor: Mentor = {
  id: 'byo-ai',
  ready: () => ai().status.configured && !ai().status.locked,
  async ask(req) {
    try {
      const r = await turn(ai(), contextFromRequest(req), req.question, { solutionTokens: req.task?.solutionTokens }).done;
      return r.text;
    } catch (e) {
      if (e instanceof AiError) throw new Error(t(ERRORS[e.code], req.lang));
      throw e;
    }
  },
};
