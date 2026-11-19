// The bridge from CI jobs to the training cluster (06 §3.7, A7). A job runs
// on its own machine, but `kubectl` in its script talks to the cluster of
// the learner's machine, the same one `kubectl` in the learner's terminal
// sees; so a deployment started by a pipeline is a real change of kube-lite
// state, not a plausible log. An image a job pushes to the forge registry
// becomes runnable in that cluster and behaves like the base image of its
// Dockerfile (`FROM trainer/web:2.0` crashes, as trainer/web:2.0 does).

import type { SimMachineApi } from '../../../core/types';
import { IMAGES, imageRef, lookupImage } from '../../../engine/kube-lite/images';
import { k8sState } from '../../../engine/kube-lite/state';

/** Let the job machine `job` use the cluster of the learner's machine. */
export function shareCluster(job: SimMachineApi, learner: SimMachineApi): void {
  const st = k8sState(learner);
  job.ext('k8s', () => st);
}

/** Make `image:tag` from the forge registry runnable in kube-lite, behaving like `from`. */
export function registerBuiltImage(image: string, tag: string, from: string | undefined): void {
  const ref = imageRef(`${image}:${tag}`);
  const base = from ? lookupImage(from) : undefined;
  if (!base) {
    // A base the course registry does not know: the image exists but serves nothing useful.
    if (!IMAGES[ref]) IMAGES[ref] = { size: 3_145_728, ports: [], logs: [], tools: ['sh'] };
    return;
  }
  const body = base.body?.replace(/version [\w.]+$/, `version ${tag}`);
  IMAGES[ref] = { ...base, ...(body ? { body } : {}) };
}
