// Tier B engine module: real Linux machines in the browser (design 09 §1.4–1.7).
//
// Widgets (code loads on first mount):
//   v86.linux      — one real machine with goals checked by state (RealLinuxProps)
//   v86.editor     — a lab-editors machine with a terminal for fullscreen editors and
//                    goals checked by the editor's state (EditorLabProps)
//   lab:editors    — the demo of v86.editor, page #/lab/editors
//   lab:multinode  — 2–3 machines on dt-switch, page #/lab/multinode
//   lab:linux      — a sandbox on one real machine, page #/lab/linux
// Settings: the list of saved machine states in this browser, with sizes.

import { defineModule } from '../../core/define';
import { h } from '../../core/dom';
import { bi, t } from '../../core/i18n';
import { lazyWidget } from './lazy';

export default defineModule({
  widgets: [
    lazyWidget('v86.linux', async () => (await import('./component')).mountRealLinux as never),
    lazyWidget('lab:multinode', async () => (await import('./multinode')).mountMultiNode),
    lazyWidget('v86.editor', async () => (await import('./editor-widget')).mountEditorLab),
    lazyWidget('lab:editors', async () => {
      const [{ mountEditorLab }, { EDITOR_DEMO }] = await Promise.all([import('./editor-widget'), import('./editor-demo')]);
      return (el, _props, ctx) => mountEditorLab(el, EDITOR_DEMO, ctx);
    }),
    // #/lab/linux: a free sandbox on one real machine, outside any lesson.
    lazyWidget('lab:linux', async () => {
      const { mountRealLinux } = await import('./component');
      return (el) =>
        mountRealLinux(el, {
          intro: bi(
            '### Настоящий Linux\n\nПесочница без заданий: ядро Linux 5.6 и BusyBox в эмуляторе процессора прямо в этой вкладке. Здесь можно смело ломать — кнопка «Сбросить машину» вернёт всё как было.',
            '### Real Linux\n\nA sandbox without tasks: a Linux 5.6 kernel and BusyBox in a processor emulator right in this tab. Break things freely — “Reset the machine” brings everything back.',
          ),
          rows: 20,
          autostart: false,
        });
    }),
  ],
  settings: [
    {
      id: 'v86',
      order: 60,
      title: bi('Настоящие машины', 'Real machines'),
      mount(el) {
        const list = h('ul.v86-states');
        const total = h('p.small.muted');
        const clearBtn = h('button.btn.ghost.small', { type: 'button' }, t(bi('Удалить сохранённые машины', 'Delete saved machines')));
        const draw = async () => {
          const { listStates } = await import('./state-cache');
          const states = await listStates();
          list.replaceChildren(...states.map((s) => h('li.small', {}, h('code', {}, s.name), ` — ${(s.bytes / 1024 / 1024).toFixed(1)} MB`)));
          const sum = states.reduce((n, s) => n + s.bytes, 0);
          total.textContent = states.length
            ? t(bi(`Всего ${(sum / 1024 / 1024).toFixed(1)} МБ в хранилище браузера (OPFS).`, `${(sum / 1024 / 1024).toFixed(1)} MB in the browser storage (OPFS) in total.`))
            : t(bi('Сохранённых машин нет: первая машина загрузит ядро и сохранит своё состояние, следующие запуски займут доли секунды.', 'No saved machines: the first machine boots the kernel and saves its state, later starts take a fraction of a second.'));
          clearBtn.toggleAttribute('disabled', !states.length);
        };
        clearBtn.addEventListener('click', async () => {
          const { clearStates } = await import('./state-cache');
          await clearStates();
          await draw();
        });
        el.append(
          h(
            'p',
            {},
            t(
              bi(
                'Уроки с настоящим Linux запускают ядро прямо во вкладке (эмулятор v86). Состояние каждой машины сохраняется в этом браузере: вернувшись, вы продолжите с того же места. Прогресс уроков хранится отдельно и от удаления машин не пострадает.',
                'Lessons with real Linux run a kernel right in the tab (the v86 emulator). Each machine’s state is saved in this browser, so you continue where you left off. Lesson progress is stored separately and is not affected when machines are deleted.',
              ),
            ),
          ),
          list,
          total,
          h('div.row', {}, clearBtn, h('a.btn.ghost.small', { href: '#/lab/multinode' }, t(bi('Лаборатория из нескольких машин', 'The multi-machine lab')))),
        );
        void draw();
        return { dispose() {} };
      },
    },
  ],
});
