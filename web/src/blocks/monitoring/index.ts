// The Monitoring block (06 §7): the "Shop" metrics generator and TSDB, a
// PromQL engine, alert rules and Alertmanager routing, promtool and amtool,
// the PromQL workbench widget with the incident drill, explainer E-MON.

import { defineModule } from '../../core/define';
import { fromModel } from '../../engine/explainer/render';
import { block, concepts, lessons, quiz } from './content';
import { PROM_DOCS } from './docs';
import { monModel } from './explainer';
import { amtoolCommand, promSetupHook, promtoolCommand } from './prom/commands';
import { workbenchWidget } from './workbench';

export default defineModule({
  blocks: [block],
  lessons,
  concepts,
  quiz,
  explainers: [fromModel(monModel)],
  commands: [promtoolCommand, amtoolCommand],
  docs: PROM_DOCS,
  widgets: [workbenchWidget],
  setup: [promSetupHook],
});
