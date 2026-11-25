import { registerDepartmentScenarios } from '../../sims/scenarios';
import { defineModule } from '../../core/define';
import { deptsimWidget } from './widget';
export { registerScenarios } from './registry';
registerDepartmentScenarios();
export default defineModule({ widgets: [deptsimWidget] });
