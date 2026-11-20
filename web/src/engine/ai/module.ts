// BYO AI engine module (design 09 §4, 01 §16).
//   mentor     — the platform's "Ask" box answers through the learner's own AI
//   settings   — "Your AI": provider, key, model, check, what the AI sees
//   widgets    — `ai.tutor`: a button a lesson can place to open the tutor panel
//   launcher   — a tutor button on lesson and lab pages, hidden in exams

import { defineModule } from '../../core/define';
import { h, icon } from '../../core/dom';
import { bi, onLangChange, t } from '../../core/i18n';
import type { Mounted } from '../../core/types';
import { byoMentor } from './mentor';
import './ai.css';

const TITLE = bi('Ваша нейросеть', 'Your AI');
const ASK = bi('Спросить наставника', 'Ask the tutor');

function lazyMount(el: HTMLElement, load: () => Promise<(el: HTMLElement) => Mounted>): Mounted {
  let inner: Mounted | null = null;
  let gone = false;
  void load().then((mount) => {
    if (!gone) inner = mount(el);
  });
  return {
    dispose() {
      gone = true;
      inner?.dispose();
    },
  };
}

const browser = typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof document !== 'undefined';

/** The floating tutor button: lessons and labs only; never during an exam or a placement check. */
function installLauncher() {
  const btn = h('button.tutor-launch', { type: 'button', 'aria-label': t(ASK), title: t(ASK) }, icon('ask'), h('span', {}, t(ASK)));
  btn.addEventListener('click', async () => {
    const p = await import('./panel');
    if (p.isTutorOpen()) p.closeTutor();
    else p.openTutor();
  });
  document.body.append(btn);
  const sync = async () => {
    const { where } = await import('./context');
    const w = where();
    const route = location.hash.replace(/^#\/?/, '').split('/')[0];
    btn.hidden = w.exam || !['lesson', 'lab', 'explainer'].includes(route);
    btn.querySelector('span')!.textContent = t(ASK);
    const { ai } = await import('./service');
    void ai().lock(w.exam);
    if (w.exam) (await import('./panel')).closeTutor();
  };
  window.addEventListener('hashchange', () => void sync());
  onLangChange(() => void sync());
  void sync();
}

if (browser) {
  const start = () => {
    void import('./context').then((c) => c.listenTerminals());
    void import('./service').then(({ ai }) => ai().ready.catch(() => undefined));
    installLauncher();
    void import('./external-panel').then(m => m.installExternalCards());
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else setTimeout(start, 0);
}

export default defineModule({
  mentor: byoMentor,
  settings: [
    {
      id: 'ai',
      order: 30,
      title: TITLE,
      mount: (el) => lazyMount(el, async () => (await import('./settings-section')).mountAiSettings),
    },
  ],
  widgets: [
    {
      id: 'ai.tutor',
      mount(el, props, ctx) {
        const p = (props ?? {}) as { label?: { ru: string; en: string }; mode?: 'explain' | 'practice' | 'docs' | 'free'; question?: { ru: string; en: string } };
        const b = h('button.btn.ghost.small', { type: 'button' }, icon('ask'), t(p.label ?? ASK));
        b.addEventListener('click', async () => (await import('./panel')).openTutor({ mode: p.mode, question: p.question ? t(p.question) : undefined }));
        el.append(b);
        ctx.complete();
        return { dispose: () => b.remove() };
      },
    },
  ],
});
