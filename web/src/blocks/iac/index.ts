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
import { concepts2, iacExam, lessons2, quiz2 } from './content-2';
import { IAC_WEB_DOCS } from './docs-2';
import { cloudExam, concepts3, lessons3, quiz3 } from './content-3';
import { iacPlacement } from './placement';
import { IAC_LAB_DOCS } from './docs-3';
import { lazyWidget } from '../../engine/v86/lazy';
import { bi } from '../../core/i18n';
import { ansModel, tfModel } from './explainers';
import { addrModel, importModel, varModel } from './explainers-2';
import { terraformCommand } from './tf/command';
import { eduCommand, tfFactsProvider, tfSetupHook } from './tf/edu';

const [intro, playbook, terraform, state] = lessons;
const ordered = [
  intro,
  playbook,
  lessons2.rolesLesson,
  terraform,
  state,
  lessons2.modulesLesson,
  lessons2.importLesson,
  // On real machines in the tab (00 §6.13).
  lessons3.apiLesson,
  lessons3.tofuLesson,
  lessons3.stateLesson,
  lessons3.moduleLesson,
  lessons3.ciLesson,
];

const cloudLabWidget = lazyWidget('iac.cloudlab', async () => (await import('./cloudlab/widget')).mountCloudLab as never);
// #/lab/cloud: the in-tab cloud without tasks, with CI on git.lab.
const cloudSandbox = lazyWidget('lab:cloud', async () => {
  const { mountCloudLab } = await import('./cloudlab/widget');
  return (el, _props, ctx) =>
    mountCloudLab(
      el,
      {
        intro: bi(
          '### Облако во вкладке\n\nЭто песочница без заданий. В ней работают рабочая станция с curl, git и OpenTofu, облако `api.cloud.lab`, хранилище `s3.cloud.lab`, Git-сервер `git.lab` и CI `ci.lab`. Каждая ВМ, которую вы создаёте через API, запускается как настоящая машина в этой вкладке.',
          '### The cloud in the tab\n\nA sandbox without tasks: a workstation with curl, git and OpenTofu, the cloud `api.cloud.lab`, storage `s3.cloud.lab`, the Git server `git.lab` and CI `ci.lab`. Every VM created through the API is a real machine in this tab.',
        ),
        ci: true,
        rows: 20,
      },
      ctx,
    );
});

export default defineModule({
  blocks: [{ ...block, lessons: ordered.map((l) => l.id), placement: iacPlacement, exam: iacExam.id }],
  lessons: ordered,
  concepts: [...concepts, ...concepts2, ...concepts3],
  quiz: [...quiz, ...quiz2, ...quiz3],
  explainers: [fromModel(tfModel), fromModel(ansModel), fromModel(varModel), fromModel(addrModel), fromModel(importModel)],
  commands: [terraformCommand, eduCommand, ...ansibleCommands],
  docs: [...ANSIBLE_DOCS, ...IAC_WEB_DOCS, ...IAC_LAB_DOCS],
  exams: [iacExam, cloudExam],
  widgets: [cloudLabWidget, cloudSandbox],
  facts: [tfFactsProvider, ansFactsProvider],
  setup: [tfSetupHook, ansSetupHook],
});
