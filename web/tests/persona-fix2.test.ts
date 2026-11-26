import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { regionsProject } from '../src/blocks/marketing/regions';
import { funnelProject } from '../src/blocks/sales/funnel';
import { SALES_SCHOOL, SALES_SCHOOL_EN } from '../src/blocks/sales/school';
import { SALES_LESSONS } from '../src/blocks/sales/content';

it('makes content compete with immediate reach and mature over time', () => {
  const base = { budget: 20, content: 0, localized: 0.3, months: 3, us: .5, dach: .3, asia: .2 };
  expect(regionsProject({ ...base, content: 1 }).totalDeals).toBe(0);
  expect(regionsProject(base).totalDeals).toBeGreaterThan(0);
  const outcomes = [0, .5, 1].map(content => regionsProject({ ...base, months: 24, content }).totalDeals);
  expect(outcomes[1]).toBeGreaterThan(outcomes[0]);
  expect(outcomes[1]).toBeGreaterThan(outcomes[2]);
});
it('charges over-contacting through negative replies and shrinking reachable accounts', () => {
  const base = { accounts: 30, touches: 3, respond: .15, meeting: .3, poc: .4, close: .35, weeks: 12 };
  const normal = funnelProject(base).totals;
  const high = funnelProject({ ...base, touches: 8 }).totals;
  expect(normal.negativeReplies).toBe(0); expect(normal.unsubscribes).toBe(0);
  expect(high.negativeReplies).toBeGreaterThan(0); expect(high.unsubscribes).toBeGreaterThan(0);
  expect(high.unsubscribes).toBeLessThan(base.accounts);
  expect(high.touches).toBeLessThan(30 * 8 * 12);
  expect(high.meetings).toBeLessThan(normal.meetings);
});
it('renders all 46 English principles rather than the pending-translation notice', () => {
  expect(SALES_SCHOOL_EN.flatMap(m => m.items).map(i => i.n)).toEqual(SALES_SCHOOL.flatMap(m => m.items).map(i => i.n));
  for (const [index, lesson] of SALES_LESSONS.entries()) {
    const section = lesson.sections.find(s => s.id === 'principles');
    expect(section?.kind).toBe('text');
    if (section?.kind === 'text') {
      expect(section.body.en).not.toMatch(/being prepared|[а-яА-Я]/);
      const practice = lesson.sections.find(s => s.id === 'practice');
      expect(practice).toMatchObject({ kind: 'text', step: 'practice' });
      if (practice?.kind === 'text') {
        expect(practice.body.en).not.toMatch(/[а-яё]/i);
        for (const item of SALES_SCHOOL_EN[index].items) expect(practice.body.en).toContain(item.today);
      }
    }
  }
});
it('ships linked workbook examples with consistent IDs and localized sheets', async () => {
  for (const suffix of ['', '-en']) {
    const read = async (name: string) => { const w = new ExcelJS.Workbook(); await w.xlsx.readFile(`public/templates/${name}${suffix}.xlsx`); return w; };
    const dream = await read('dream100'); expect(dream.worksheets).toHaveLength(8);
    // Opportunities stays empty: the example buyer has not confirmed an initiative yet.
    for (const ws of dream.worksheets) expect(ws.getRow(2).actualCellCount > 0).toBe(ws !== dream.worksheets[6]);
    expect(dream.worksheets[0].getCell('K2').value).toBe(suffix ? 'engaged' : 'вовлечены');
    // The stage is backed by a two-way activity, the signal is assessed by our own seller, the do-not-contact entry is outside the deal.
    expect(String(dream.worksheets[5].getCell('G3').value)).toMatch(/в обе стороны|two-way/);
    expect(dream.worksheets[4].getCell('M2').value).toBe(dream.worksheets[0].getCell('G2').value);
    const banned = String(dream.worksheets[7].getCell('A2').value);
    for (const ws of dream.worksheets.slice(1, 6)) expect(JSON.stringify(ws.getSheetValues())).not.toContain(banned);
    for (const row of [2, 3, 4]) expect(dream.worksheets[1].getCell(`B${row}`).value).not.toMatch(/^P\d+$/);
    expect(dream.worksheets[1].getColumn(1).values.slice(2,5)).toEqual(['P001','P002','P003']);
    expect(dream.worksheets[2].getColumn(2).values.slice(2,5)).toEqual(['A001','A001','A001']);
    expect(dream.worksheets[3].getColumn(1).values.slice(2,5)).toEqual(['A001','A001','A001']);
    const events = await read('event-map'); expect(events.worksheets).toHaveLength(2);
    expect(events.worksheets[0].getCell('A2').value).toBe(events.worksheets[1].getCell('B2').value);
    expect(events.worksheets[0].getCell('I2').value).toMatch(/^2026-/);
    expect(events.worksheets[1].getCell('L2').value).toMatch(/^2026-/);
    const signals = (await read('signals-week')).worksheets[0]; expect(signals.actualRowCount).toBe(6);
    expect(new Set(signals.getColumn(1).values.slice(2)).size).toBe(5);
    for (const name of ['pr-briefing','pr-news','pr-founder']) expect((await read(name)).worksheets[0].actualRowCount).toBe(2);
    const briefing = (await read('pr-briefing')).worksheets[0];
    expect(String(briefing.getCell('I1').value)).toMatch(/согласие|consent/);
    expect(String(briefing.getCell('I2').value)).toMatch(/^(да|yes)/);
    const founder = await read('pr-founder');
    expect(founder.worksheets).toHaveLength(2);
    expect(founder.worksheets[1].actualRowCount).toBe(2);
  }
});
