// The containers block (route id `containers`, 04-containers.md): the
// textbook chapters m01–m10 and m14, their process explainers, quizzes,
// placement and doc-ladder tasks. The Docker simulator lives in
// src/engine/dsim.

import { defineModule } from '../../core/define';
import { fromModel } from '../../engine/explainer/render';
import { block, exams } from './block';
import { concepts } from './concepts';
import { boundariesModel } from './explainers/boundaries';
import { buildModel } from './explainers/build';
import { chainModel } from './explainers/chain';
import { imageModel } from './explainers/image';
import { nestingModel } from './explainers/nesting';
import { stackModel } from './explainers/stack';
import { stopModel } from './explainers/stop';
import { LESSONS, QUIZ } from './lessons';

export default defineModule({
  blocks: [block],
  lessons: LESSONS,
  concepts,
  quiz: QUIZ,
  exams,
  explainers: [fromModel(stackModel), fromModel(nestingModel), fromModel(chainModel), fromModel(imageModel), fromModel(buildModel), fromModel(stopModel), fromModel(boundariesModel)],
});
