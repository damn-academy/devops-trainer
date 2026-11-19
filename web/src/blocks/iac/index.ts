// The IaC block (06 §4–5): ansim (Ansible against simulated hosts), tfsim
// (Terraform/OpenTofu against the Edu Cloud training cloud), the cloud console
// CLI, ansible-doc pages, explainers E-TF and E-ANS. The k8s-3 block ("a
// cluster from code") that this folder also owns is not delivered yet.

import { defineModule } from '../../core/define';
import { fromModel } from '../../engine/explainer/render';
import { ansibleCommands, ansFactsProvider, ansSetupHook } from './ans/command';
import { ANSIBLE_DOCS } from './ans/docs';
import { block, concepts, lessons, quiz } from './content';
import { ansModel, tfModel } from './explainers';
import { terraformCommand } from './tf/command';
import { eduCommand, tfFactsProvider, tfSetupHook } from './tf/edu';

export default defineModule({
  blocks: [block],
  lessons,
  concepts,
  quiz,
  explainers: [fromModel(tfModel), fromModel(ansModel)],
  commands: [terraformCommand, eduCommand, ...ansibleCommands],
  docs: ANSIBLE_DOCS,
  facts: [tfFactsProvider, ansFactsProvider],
  setup: [tfSetupHook, ansSetupHook],
});
