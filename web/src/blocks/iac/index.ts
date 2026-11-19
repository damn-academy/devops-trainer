// The IaC block (06 §4–5): ansim (Ansible against simulated hosts, roles and
// ansible-galaxy), tfsim (Terraform/OpenTofu against the Edu Cloud training
// cloud: modules, moved, import, refresh-only), the cloud console CLI,
// ansible-doc pages and offline reference pages, explainers E-TF, E-ANS,
// variable precedence and addresses, the block exam. The k8s-3 block ("a
// cluster from code") lives in src/blocks/k8s-code.

import { defineModule } from '../../core/define';
import { fromModel } from '../../engine/explainer/render';
import { ansibleCommands, ansFactsProvider, ansSetupHook } from './ans/command';
import { ANSIBLE_DOCS } from './ans/docs';
import { block, concepts, lessons, quiz } from './content';
import { concepts2, iacExam, lessons2, placement2, quiz2 } from './content-2';
import { IAC_WEB_DOCS } from './docs-2';
import { ansModel, tfModel } from './explainers';
import { addrModel, varModel } from './explainers-2';
import { terraformCommand } from './tf/command';
import { eduCommand, tfFactsProvider, tfSetupHook } from './tf/edu';

const [intro, playbook, terraform, state] = lessons;
const ordered = [intro, playbook, lessons2.rolesLesson, terraform, state, lessons2.modulesLesson, lessons2.importLesson];

export default defineModule({
  blocks: [{ ...block, lessons: ordered.map((l) => l.id), placement: [...block.placement, ...placement2], exam: iacExam.id }],
  lessons: ordered,
  concepts: [...concepts, ...concepts2],
  quiz: [...quiz, ...quiz2],
  explainers: [fromModel(tfModel), fromModel(ansModel), fromModel(varModel), fromModel(addrModel)],
  commands: [terraformCommand, eduCommand, ...ansibleCommands],
  docs: [...ANSIBLE_DOCS, ...IAC_WEB_DOCS],
  exams: [iacExam],
  facts: [tfFactsProvider, ansFactsProvider],
  setup: [tfSetupHook, ansSetupHook],
});
