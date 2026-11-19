// Block 9 "A cluster from code" (route id k8s-3, design 06 §6, 05 §11.4):
// Terraform orders the nodes, Ansible prepares them, kubeadm runs from roles
// with creates, the cluster is rebuilt from scratch, the application comes
// from Git through a GitOps controller. The stand glues the existing
// simulators (Edu Cloud + tfsim, ansim, kube-lite, the forge); the real-VM
// track is a self-check by pasted output and the trainer-check snapshot.

import { defineModule } from '../../core/define';
import { fromModel } from '../../engine/explainer/render';
import { block, EXAM, LESSONS } from './content/block';
import { CONCEPTS } from './content/concepts';
import { QUIZ } from './content/quiz';
import { KCODE_DOCS } from './docs';
import { codeModel, gitopsModel } from './explainers';
import { gitopsSetupHook } from './gitops';
import { ciliumCommand, kubeadmCommand, kubeadmHelpPages } from './kubeadm';
import { kcodeFactsProvider, kcodeSetupHook } from './stand';

export default defineModule({
  blocks: [block],
  lessons: LESSONS,
  concepts: CONCEPTS,
  quiz: QUIZ,
  explainers: [fromModel(codeModel), fromModel(gitopsModel)],
  commands: [kubeadmCommand, ciliumCommand],
  docs: [...kubeadmHelpPages(), ...KCODE_DOCS],
  exams: [EXAM],
  facts: [kcodeFactsProvider],
  setup: [kcodeSetupHook, gitopsSetupHook],
});
