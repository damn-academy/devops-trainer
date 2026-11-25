import { defineModule } from '../../core/define';
import { deptsimWidget } from './widget';
export { registerScenarios } from './registry';
export default defineModule({ widgets: [deptsimWidget] });
