// flowlab engine module: the board widget, the `flow` terminal command with
// its facts (facts.flow) and setup hook (TerminalSetup.ext.flow), and the
// man page of `flow` in the documentation corpus (generated from the command).

import { defineModule } from '../../core/define';
import { mountBoard } from './board';
import { flowCommand, flowFacts, flowSetup } from './cli';

export default defineModule({
  widgets: [{ id: 'flowlab.board', mount: mountBoard }],
  commands: [flowCommand],
  facts: [flowFacts],
  setup: [flowSetup],
});
