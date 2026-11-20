// The chapters of the containers block in route order, and their quiz bank.

import type { Lesson, QuizItem } from '../../../core/types';
import { anatomyLesson, anatomyQuiz } from './anatomy';
import { boundariesLesson, boundaryQuiz } from './boundaries';
import { byHandLesson, byHandQuiz } from './by-hand';
import { composeLesson, composeQuiz } from './compose';
import { dockerfileLesson, dockerfileQuiz, runCmdQuiz } from './dockerfile';
import { firstQuiz, firstStepsLesson } from './first-steps';
import { imageLesson, imageQuiz } from './image';
import { interviewLesson, interviewQuiz } from './interview';
import { securityLesson, securityQuiz } from './security';
import { storageNetLesson, storageQuiz } from './storage-net';
import { whyLesson, whyQuiz } from './why';

export const LESSONS: Lesson[] = [whyLesson, firstStepsLesson, anatomyLesson, byHandLesson, imageLesson, dockerfileLesson, storageNetLesson, boundariesLesson, composeLesson, securityLesson, interviewLesson];

export const QUIZ: QuizItem[] = [...whyQuiz, ...firstQuiz, ...anatomyQuiz, ...byHandQuiz, ...imageQuiz, ...runCmdQuiz, ...dockerfileQuiz, ...storageQuiz, ...boundaryQuiz, ...composeQuiz, ...securityQuiz, ...interviewQuiz];
