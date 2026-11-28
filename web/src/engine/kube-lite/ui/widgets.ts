// The Kubernetes widgets (registered by the engine module).

import type { WidgetReg } from '../../../core/types';
import { constructorWidget } from './constructor';
import { controllerLabWidget } from './controller-lab';
import { costWidget } from './cost';
import { outputCheckWidget } from './output-check';
import { realCheckWidget } from './real-check';
import { realClusterWidget } from './real-cluster';

export const KUBE_WIDGETS: WidgetReg[] = [constructorWidget, controllerLabWidget, realCheckWidget, costWidget, outputCheckWidget, realClusterWidget];
