import type { SimMachine, SimSnapshot } from './shell';
/** Export facts and changed inodes, including snapshotable kube, network and Docker extensions. */
export async function snapshotForFeedback(machine: SimMachine, baseline: unknown) {
  const current = await machine.snapshot();
  const before = (baseline as SimSnapshot | null)?.fs.inodes ?? [];
  const old = new Map(before.map(n => [n.ino, JSON.stringify(n)]));
  return {
    facts: machine.factsSync(), history: current.history, transcript: current.term,
    filesystem: { changed: current.fs.inodes.filter(n => old.get(n.ino) !== JSON.stringify(n)), deleted: before.filter(n => !current.fs.inodes.some(c => c.ino === n.ino)).map(n => n.ino) },
    extensions: current.ext,
  };
}
