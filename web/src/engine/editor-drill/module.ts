// editor-drill: the key trainer of the Vim and Emacs courses (Vim §6.2
// item 7, Emacs §6.2 item 14). It registers the lesson widget
// `editor.drill` (props: `{ drill }`, `{ drills }` or `{ set: 'vim' | 'emacs' }`)
// and the dev page `#/lab/editor-keys` with the sample drills. CodeMirror and
// the Vim layer load only when one of them mounts.

import { defineModule } from '../../core/define';
import { lazyWidget } from '../v86/lazy';

export default defineModule({
  widgets: [
    lazyWidget('editor.drill', async () => (await import('./widget')).mountEditorDrill),
    lazyWidget('lab:editor-keys', async () => (await import('./widget')).mountDrillsPage),
  ],
});
