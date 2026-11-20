import { bi, type Bi } from '../../core/i18n';
import { bots, passLine } from './bots';
import { metrics } from './metrics';
import type { Scenario, State } from './types';

export interface GoalCondition { text: Bi; met: boolean }
/** The same numeric conditions are shown before play and checked in the debrief. */
export function goalConditions(sc: Scenario, s: State): GoalCondition[] {
  const m = metrics(s, sc);
  const b = bots(sc, s.seed).baseline;
  const line = passLine(sc, s.seed);
  const done = (n: number): GoalCondition => ({ text: bi(`К концу ${sc.days}-го дня покупатели получили не меньше ${n} готовых задач.`, `By day ${sc.days}, customers received at least ${n} completed tasks.`), met: m.doneCount >= n });
  if (sc.id === 's0' || sc.id === 'p5') return [done(6)];
  if (sc.id === 'p10') return [done(Math.ceil(line.doneCount))];
  if (sc.id === 's2') return [
    { text: bi('К 14-му дню покупатели получили все 3 промо-функции.', 'Customers received all 3 promo features by day 14.'), met: m.promoByDue >= 3 },
    { text: bi('Простой в дни распродажи составил 0 минут.', 'Sale downtime was 0 minutes.'), met: m.saleBadMinutes === 0 },
    { text: bi(`Итог по деньгам превышает ${b.moneyNet} ₽ команды без методологии.`, `Net money exceeds the baseline of ${b.moneyNet} RUB.`), met: m.moneyNet > b.moneyNet },
  ];
  return [
    { text: bi(`85-й процентиль времени цикла в днях меньше ${b.cycleP85}, результата команды без методологии.`, `Cycle time p85 is below the baseline of ${b.cycleP85} days.`), met: m.cycleP85 < b.cycleP85 },
    { text: bi(`Потери от задержки меньше ${b.codLost} ₽ команды без методологии.`, `Cost of delay is below the baseline of ${b.codLost} RUB.`), met: m.codLost < b.codLost },
  ];
}
