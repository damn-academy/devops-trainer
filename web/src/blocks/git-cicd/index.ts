// The Git + YAML block, the CI/CD block and the block "Deploying to
// Kubernetes from CI" (06 §2–3, §3.7): simulated git with a training forge,
// yamllint and the YAML parser view, the pipeline simulator with glab whose
// jobs reach the kube-lite cluster, the pipeline page widget, the explainers
// and the block exams.

import { defineModule } from '../../core/define';
import { fromModel } from '../../engine/explainer/render';
import { boardWidget } from './ci/board';
import { GITLAB_DOCS } from './ci/docs';
import { ciFactsProvider } from './ci/facts';
import { glabCommand } from './ci/glab';
import './ci/run';
import * as cicd from './content/cicd';
import * as cicdK8s from './content/cicd-k8s';
import { CICD_EXAM, GIT_YAML_EXAM } from './content/exams';
import { CICD_TAB_EXAM } from './content/exam-tab';
import * as gy from './content/git-yaml';
import { ciModel, gitModel } from './explainers';
import { artifactsModel, dagModel, kubeDeployModel, mergeModel } from './explainers-flow';
import { gitCommand } from './git/cli';
import { GIT_MAN } from './git/man';
import { gitFactsProvider, gitSetupHook } from './git/setup';
import { editCommand } from './shared/edit';
import { yamllintCommand, yamlWidget } from './yaml';

export default defineModule({
  blocks: [gy.block, cicd.block, cicdK8s.block],
  lessons: [...gy.lessons, ...cicd.lessons, ...cicdK8s.lessons],
  concepts: [...gy.concepts, ...cicd.concepts, ...cicdK8s.concepts],
  quiz: [...gy.quiz, ...cicd.quiz, ...cicdK8s.quiz],
  explainers: [fromModel(gitModel), fromModel(mergeModel), fromModel(ciModel), fromModel(artifactsModel), fromModel(dagModel), fromModel(kubeDeployModel)],
  exams: [GIT_YAML_EXAM, CICD_EXAM, CICD_TAB_EXAM],
  commands: [gitCommand, glabCommand, yamllintCommand, editCommand],
  docs: [...GIT_MAN, ...GITLAB_DOCS],
  widgets: [yamlWidget, boardWidget],
  facts: [gitFactsProvider, ciFactsProvider],
  setup: [gitSetupHook],
});
