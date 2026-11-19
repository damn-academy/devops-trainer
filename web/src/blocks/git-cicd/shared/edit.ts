// `edit <file>`: a plain text editor for the simulated machine. The terminal
// has no full-screen editor, so the command opens an editor panel over the
// page, waits until the learner saves or closes it and writes the file with
// the learner's permissions — like nano, but in a dialog. Ctrl+S saves,
// Esc closes without saving. Tab inserts two spaces (YAML never uses tabs).

import type { ShellCommand } from '../../../core/types';
import { bi, t } from '../../../core/i18n';
import './edit.css';

const L = {
  save: bi('Сохранить', 'Save'),
  close: bi('Закрыть', 'Close'),
  hint: bi('Сочетание Ctrl+S сохраняет файл, клавиша Esc закрывает редактор без сохранения, а клавиша Tab вставляет два пробела.', 'Ctrl+S saves, Esc closes without saving. Tab inserts two spaces.'),
  newFile: bi('новый файл', 'new file'),
};

function openEditor(path: string, text: string, isNew: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const back = document.createElement('div');
    back.className = 'dt-edit-back';
    const box = document.createElement('div');
    box.className = 'dt-edit';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', `edit ${path}`);
    const head = document.createElement('div');
    head.className = 'dt-edit-head';
    const title = document.createElement('span');
    title.className = 'dt-edit-path';
    title.textContent = path + (isNew ? `  (${t(L.newFile)})` : '');
    const pos = document.createElement('span');
    pos.className = 'dt-edit-pos';
    head.append(title, pos);
    const body = document.createElement('div');
    body.className = 'dt-edit-body';
    const gutter = document.createElement('pre');
    gutter.className = 'dt-edit-gutter';
    gutter.setAttribute('aria-hidden', 'true');
    const ta = document.createElement('textarea');
    ta.className = 'dt-edit-area';
    ta.spellcheck = false;
    ta.value = text;
    ta.setAttribute('autocapitalize', 'off');
    ta.setAttribute('autocomplete', 'off');
    body.append(gutter, ta);
    const foot = document.createElement('div');
    foot.className = 'dt-edit-foot';
    const hint = document.createElement('span');
    hint.className = 'dt-edit-hint';
    hint.textContent = t(L.hint);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn ghost small';
    close.textContent = t(L.close);
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'btn primary small';
    save.textContent = t(L.save);
    foot.append(hint, close, save);
    box.append(head, body, foot);
    back.append(box);
    document.body.append(back);

    const sync = () => {
      const n = ta.value.split('\n').length;
      gutter.textContent = Array.from({ length: n }, (_, i) => String(i + 1)).join('\n');
      gutter.scrollTop = ta.scrollTop;
      const before = ta.value.slice(0, ta.selectionStart);
      const line = before.split('\n').length;
      const col = before.length - before.lastIndexOf('\n');
      pos.textContent = `${line}:${col}`;
    };
    const done = (v: string | null) => {
      back.remove();
      prevFocus?.focus?.();
      resolve(v);
    };
    ta.addEventListener('input', sync);
    ta.addEventListener('scroll', () => (gutter.scrollTop = ta.scrollTop));
    ta.addEventListener('keyup', sync);
    ta.addEventListener('click', sync);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = ta.selectionStart;
        ta.setRangeText('  ', s, ta.selectionEnd, 'end');
        sync();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        done(null);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        done(ta.value);
      }
    });
    close.addEventListener('click', () => done(null));
    save.addEventListener('click', () => done(ta.value));
    sync();
    ta.focus();
    ta.setSelectionRange(0, 0);
  });
}

export const editCommand: ShellCommand = {
  name: 'edit',
  summary: bi('Открывает файл в редакторе, а сочетание Ctrl+S сохраняет его.', 'Open a file in the editor (Ctrl+S saves).'),
  help: 'Usage: edit FILE\nOpen FILE in a text editor panel. Ctrl+S saves and closes, Esc closes without saving.\nA missing FILE is created on save.\n',
  async run(ctx) {
    const file = ctx.argv[1];
    if (!file) {
      ctx.err('edit: missing file operand\nTry \'edit --help\' for more information.\n');
      return 2;
    }
    const abs = ctx.fs.resolve(file);
    const st = ctx.fs.stat(abs);
    if (st?.type === 'd') {
      ctx.err(`edit: ${file}: Is a directory\n`);
      return 1;
    }
    const text = st ? ctx.fs.readFile(abs) : '';
    if (st && !ctx.fs.access(abs, 'w')) ctx.err(`edit: ${file}: read-only (you cannot save it)\n`);
    if (typeof document === 'undefined') {
      ctx.err('edit: no display: the editor needs the browser page\n');
      return 1;
    }
    const result = await openEditor(abs, text, !st);
    if (result === null) return 0;
    const out = result.length && !result.endsWith('\n') ? result + '\n' : result;
    ctx.fs.writeFile(abs, out);
    const lines = out ? out.split('\n').length - 1 : 0;
    ctx.out(`"${file}" ${lines}L, ${new TextEncoder().encode(out).length}B written\n`);
    return 0;
  },
};
