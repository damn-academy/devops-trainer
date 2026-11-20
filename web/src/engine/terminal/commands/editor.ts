import { bi } from '../../../core/i18n';
import type { ShellCommand } from '../../../core/types';
import type { SimMachine } from '../shell';

/** A small line editor: keep file writes subject to the invoking user's VFS permissions. */
export const editCommand: ShellCommand = {
  name: 'edit',
  summary: bi('редактировать файл построчно', 'edit a file line by line'),
  help: 'edit FILE\n:p print; :N TEXT replace line N; :d N delete line N; :w save; :wq save and quit; :q! discard. Other input appends a line.',
  run(ctx) {
    if (ctx.argv.length !== 2) { ctx.err('usage: edit FILE\n'); return 2; }
    const path = ctx.fs.resolve(ctx.argv[1]);
    let original = ctx.fs.exists(path) ? ctx.fs.readFile(path) : '';
    let lines = original ? original.replace(/\n$/, '').split('\n') : [];
    const print = () => lines.map((line, i) => `${i + 1}\t${line}\n`).join('');
    ctx.out(`${editCommand.help}\n${print()}`);
    (ctx.machine as SimMachine).attach({
      prompt: () => 'edit> ',
      async exec(line) {
        const result = (out = '', exit = 0, done = false) => ({ out, exit, done, effects: [] });
        if (line === ':q!') return result('', 0, true);
        if (line === ':p') return result(print());
        if (line === ':q') return lines.join('\n') + (lines.length ? '\n' : '') === original ? result('', 0, true) : result('Unsaved changes; use :wq or :q!\n', 1);
        if (line === ':w' || line === ':wq') {
          try {
            const text = lines.join('\n') + (lines.length ? '\n' : '');
            ctx.fs.writeFile(path, text);
            original = text;
            return result(`${lines.length} lines written\n`, 0, line === ':wq');
          } catch (error) { return result(`edit: ${(error as Error).message}\n`, 1); }
        }
        const replace = /^:(\d+) (.*)$/.exec(line);
        const remove = /^:d (\d+)$/.exec(line);
        if (replace || remove) {
          const index = Number((replace ?? remove)![1]) - 1;
          if (index < 0 || index >= lines.length) return result('Invalid line number\n', 1);
          if (replace) lines[index] = replace[2]; else lines.splice(index, 1);
        } else lines = [...lines, line];
        return result();
      },
    });
    return 0;
  },
};
