import { bi } from './i18n';
import type { Block, Exam, PlacementTask } from './types';

/** Reuse the tested real-cluster rubric without coupling the placement page to block code. */
export function addClusterEvidence(block: Block, exams: Map<string, Exam>): void {
  if (block.id !== 'k8s-2') return;
  const exam = exams.get('k8s-2.exam');
  const task = exam?.tasks.find(t => t.id === 'static');
  if (!exam?.real || task?.kind !== 'real') return;
  for (const level of ['intermediate', 'experienced'] as const) {
    const id = `k8s-2.${level}.real-evidence`;
    if (block.placement.some(t => t.id === id)) continue;
    const evidence: PlacementTask = {
      id, level, key: true, concepts: task.real.concepts ?? [], kind: 'task', setup: {},
      task: { id, prompt: bi('Подтвердите по данным узла cp-1, что управляющие компоненты Kubernetes и kubelet работают.', 'Use facts from cp-1 to demonstrate that the Kubernetes control-plane components and kubelet are running.'), check: { when: () => false } },
      realEvidence: { exam: exam.id, task: task.id },
    };
    block.placement = [...block.placement, evidence];
  }
}
