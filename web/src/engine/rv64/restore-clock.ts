export type RestoreClock = 'elapsed' | 'continuous';

/** CPU time consumes monotonic host deltas. Continuous restore excludes suspension,
 * but never scales runtime: subsequent TIME CSR reads advance at the normal rate. */
export function restoreTimeOffset(ticks: number, capturedAt: number | undefined,
  policy: RestoreClock, wallNow: number, monotonicNow: number): number {
  const suspendedMs = policy === 'continuous' || capturedAt === undefined ? 0 : Math.max(0, wallNow - capturedAt);
  return ticks + suspendedMs * 10000 - monotonicNow * 10000;
}
