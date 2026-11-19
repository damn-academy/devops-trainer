// The Kubernetes widgets (registered by the engine module).

import type { WidgetReg } from '../../../core/types';
import { constructorWidget } from './constructor';
import { controllerLabWidget } from './controller-lab';
import { costWidget } from './cost';
import { realCheckWidget } from './real-check';

export const KUBE_WIDGETS: WidgetReg[] = [constructorWidget, controllerLabWidget, realCheckWidget, costWidget];
