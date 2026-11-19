// The Git + YAML block and the CI/CD block (06 §2–3): simulated git with a
// training forge, yamllint and the YAML parser view, the pipeline simulator
// with glab, the pipeline page widget, explainers E-GIT and E-CI.

import { defineModule } from '../../core/define';
import { fromModel } from '../../engine/explainer/render';
import { boardWidget } from './ci/board';
import { GITLAB_DOCS } from './ci/docs';
import { ciFactsProvider } from './ci/facts';
import { glabCommand } from './ci/glab';
import './ci/run';
import * as cicd from './content/cicd';
import * as gy from './content/git-yaml';
import { ciModel, gitModel } from './explainers';
import { gitCommand } from './git/cli';
import { GIT_MAN } from './git/man';
import { gitFactsProvider, gitSetupHook } from './git/setup';
import { editCommand } from './shared/edit';
import { yamllintCommand, yamlWidget } from './yaml';

export default defineModule({
  blocks: [gy.block, cicd.block],
  lessons: [...gy.lessons, ...cicd.lessons],
  concepts: [...gy.concepts, ...cicd.concepts],
  quiz: [...gy.quiz, ...cicd.quiz],
  explainers: [fromModel(gitModel), fromModel(ciModel)],
  commands: [gitCommand, glabCommand, yamllintCommand, editCommand],
  docs: [...GIT_MAN, ...GITLAB_DOCS],
  widgets: [yamlWidget, boardWidget],
  facts: [gitFactsProvider, ciFactsProvider],
  setup: [gitSetupHook],
});
