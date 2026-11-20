// The Orientation block (route id `orient`, design 00 §2.1, 01 §3.4): the
// beginner-from-zero entry — computer, program, operating system, files,
// commands, networks and the internet, servers and requests, the cloud,
// source code and versions, environments and configuration, working on code
// together and the roles of a team. Ten lessons, seven process explainers,
// quizzes, first steps on the training machine and the three-question check.

import { defineModule } from '../../core/define';
import { fromModel } from '../../engine/explainer/render';
import { block } from './block';
import { concepts } from './concepts';
import { placesModel } from './explainers/places';
import { releaseModel } from './explainers/release';
import { rentModel } from './explainers/rent';
import { requestModel } from './explainers/request';
import { runModel } from './explainers/run';
import { systemModel } from './explainers/system';
import { togetherModel } from './explainers/together';
import { insideLesson, insideQuiz, netLesson, netQuiz, requestsLesson, requestsQuiz, systemLesson, systemQuiz, textLesson, textQuiz } from './lessons-1';
import { placesLesson, placesQuiz, releaseLesson, releaseQuiz, rentLesson, rentQuiz, reviewQuiz, teamLesson, teamQuiz, togetherLesson, togetherQuiz } from './lessons-2';

export const LESSONS = [insideLesson, systemLesson, textLesson, netLesson, requestsLesson, rentLesson, releaseLesson, placesLesson, togetherLesson, teamLesson];
export const QUIZ = [...insideQuiz, ...systemQuiz, ...textQuiz, ...netQuiz, ...requestsQuiz, ...rentQuiz, ...releaseQuiz, ...placesQuiz, ...togetherQuiz, ...teamQuiz, ...reviewQuiz];

export default defineModule({
  blocks: [block],
  lessons: LESSONS,
  concepts,
  quiz: QUIZ,
  explainers: [fromModel(runModel), fromModel(systemModel), fromModel(requestModel), fromModel(rentModel), fromModel(releaseModel), fromModel(placesModel), fromModel(togetherModel)],
});
