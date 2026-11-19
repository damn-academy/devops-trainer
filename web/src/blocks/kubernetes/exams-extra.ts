// The exams added after the block exam of stage 1: the CKA-style practical
// (k8s-1), the CI deployment exam (cicd-k8s) and the real-VM exam of stage 2
// (k8s-2). index.ts loads this file with a dynamic import, so they travel in
// their own chunk and the block's chunk stays within the size budget.

import { cicdExam } from './exam-cicd';
import { ckaExam } from './exam-cka';
import { stage2Exam } from './exam-real';

export const EXTRA_EXAMS = [ckaExam, cicdExam, stage2Exam];
