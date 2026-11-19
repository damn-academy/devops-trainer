// The Monitoring block (06 §7): the "Shop" metrics generator and TSDB (with
// the Kubernetes series of kube-state-metrics and cAdvisor), a PromQL engine,
// alert rules and Alertmanager routing, promtool and amtool; the Shop logs and
// traces, a LogQL engine and logcli; the PromQL workbench, the log explorer
// and the trace viewer; explainers E-MON, the log path, the trace path and
// container metrics; the block exam.

import { defineModule } from '../../core/define';
import { fromModel } from '../../engine/explainer/render';
import { block, concepts, lessons, quiz } from './content';
import { concepts2, k8sLesson, logsLesson, monitoringExam, placement2, quiz2, tracesLesson } from './content-2';
import { PROM_DOCS } from './docs';
import { OBS_WEB_DOCS } from './docs-2';
import { monModel } from './explainer';
import { cgModel, logModel, traceModel } from './explainers-2';
import { logcliCommand } from './logs/command';
import { logsWidget, tracesWidget } from './logs/widgets';
import { amtoolCommand, promSetupHook, promtoolCommand } from './prom/commands';
import { workbenchWidget } from './workbench';

const ordered = [...lessons, logsLesson, tracesLesson, k8sLesson];

export default defineModule({
  blocks: [{ ...block, lessons: ordered.map((l) => l.id), placement: [...block.placement, ...placement2], exam: monitoringExam.id, docSources: [...(block.docSources ?? []), 'grafana.com'] }],
  lessons: ordered,
  concepts: [...concepts, ...concepts2],
  quiz: [...quiz, ...quiz2],
  explainers: [fromModel(monModel), fromModel(logModel), fromModel(traceModel), fromModel(cgModel)],
  commands: [promtoolCommand, amtoolCommand, logcliCommand],
  docs: [...PROM_DOCS, ...OBS_WEB_DOCS],
  exams: [monitoringExam],
  widgets: [workbenchWidget, logsWidget, tracesWidget],
  setup: [promSetupHook],
});
