import { describe, it, expect } from 'vitest';
import { bilingualLessons, markdownQuizItems, parseMarkdownLessons } from '../src/core/md-lessons';
import { runBudgetFunnel, runBudget, saturatedVisits, seeded, simulateBudget } from '../src/blocks/marketing/v2/budget';
import { dnsLabSetup, dnsSetup, dnsTask, validDmarc } from '../src/blocks/marketing/v2/dns-lab';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import { ALL_COMMANDS } from '../src/engine/terminal/module';
import { digCommand } from '../src/engine/sim-net/cmd-dns';
import { createSimMachine } from '../src/engine/terminal/shell';
import { getScenario } from '../src/engine/deptsim/registry';
import '../src/engine/deptsim/module';

const lesson = (body: string) => `<!-- lesson: events.one | One | 5 -->\n<!-- section: hook -->\nIntro.\n<!-- section: task | Try -->\nBefore.\n${body}\nAfter.\n<!-- section: sources -->\n- Example — https://example.com\n`;
const quiz = '<!-- quiz -->\n? Question\n+ Yes || Correct\n- No || Incorrect\n\n? Second\n- No || Incorrect\n+ Yes || Correct\n<!-- /quiz -->';
describe('shared Markdown embeds', () => {
  it('preserves order, props, block, bilingual options and stable quiz ids', () => {
    const raw = lesson('<!-- widget: deptsim {"scenario":"marketing.quarter"} -->\n'+quiz);
    const lessons = bilingualLessons(raw, raw.replace('Question', 'Translated'), 'events');
    expect(lessons[0]!.block).toBe('events');
    expect(lessons[0]!.sections.map(s => s.kind)).toEqual(['text', 'text', 'widget', 'quiz', 'text']);
    expect(lessons[0]!.sections[2]).toMatchObject({ step: 'practice', props: { scenario: 'marketing.quarter' } });
    expect(markdownQuizItems(lessons).map(q => q.id)).toEqual(['events.one.q1', 'events.one.q2']);
    expect(markdownQuizItems(lessons)[0]!.prompt.en).toBe('Translated');
    expect(getScenario('marketing.quarter')).toBeDefined();
  });
  it('ignores fenced marker examples and rejects malformed embeds and translation drift', () => {
    expect(parseMarkdownLessons(lesson('```md\n<!-- widget: example -->\n```'))[0]!.sections).toHaveLength(3);
    for (const body of ['<!-- widget: x nope -->', '<!-- quiz -->\n? Missing options', quiz.replace('+ Yes', '- Yes'), '<!-- /quiz -->']) expect(() => bilingualLessons(lesson(body), lesson(body))).toThrow();
    expect(() => bilingualLessons(lesson(quiz), lesson(quiz.replace('Second', 'Second\n- Extra || Reason')))).toThrow();
    expect(() => bilingualLessons(lesson('<!-- widget: a -->'), lesson('<!-- widget: b -->'))).toThrow();
  });
});
describe('budget model', () => {
  it('has monotone diminishing returns and a finite cap', () => {
    const v = [0, 1000, 2000, 3000].map(s => saturatedVisits(s, 4000, 10));
    expect(v[0]).toBe(0); expect(v[2]!).toBeGreaterThan(v[1]!);
    expect(v[3]! - v[2]!).toBeLessThan(v[2]! - v[1]!);
    expect(saturatedVisits(1e9, 4000, 10)).toBe(400);
  });
  it('respects lag, decay, retargeting audience and seeded reproducibility', () => {
    const creator = Array<number>(10).fill(0); creator[9] = 10000;
    const path = runBudget(creator, seeded(4));
    expect(path.slice(0, 2)).toEqual([0, 0]); expect(path[2]).toBeGreaterThan(0); expect(path[11]).toBeGreaterThan(0);
    const retarget = Array<number>(10).fill(0); retarget[8] = 10000;
    expect(runBudget(retarget, seeded(4))).toEqual(Array(12).fill(0));
    creator[8] = 1000;
    expect(runBudget(creator, seeded(4)).slice(3)).toEqual(path.slice(3));
    expect(simulateBudget(creator, 5)).toEqual(simulateBudget(creator, 5));
    expect(simulateBudget(creator, 6)).not.toEqual(simulateBudget(creator, 5));
  });
  const focused = [3000, 2500, 0, 2000, 0, 0, 0, 0, 0, 2500];
  it('calibrates a $30,000 even split to B2B opportunity ranges at month 12', () => {
    const [low, median, high] = simulateBudget(Array(10).fill(1000), 2026).totals[2]!;
    expect(median).toBeGreaterThanOrEqual(4); expect(median).toBeLessThanOrEqual(8);
    expect(low).toBeGreaterThanOrEqual(.5); expect(low).toBeLessThanOrEqual(2);
    expect(high).toBeGreaterThanOrEqual(12); expect(high).toBeLessThanOrEqual(18);
  });
  it('rewards fitting 3–4 channel mixes and penalizes every all-in allocation', () => {
    const mixes = [focused, [3500, 3500, 0, 0, 0, 0, 0, 0, 0, 3000]];
    const medians = mixes.map(spends => {
      expect(spends.reduce((a, b) => a + b, 0)).toBe(10000);
      const median = simulateBudget(spends, 2026).totals[2]![1]!;
      expect(median).toBeGreaterThanOrEqual(10); expect(median).toBeLessThanOrEqual(14);
      return median;
    });
    for (let i = 0; i < 10; i++) {
      const result = simulateBudget(Array.from({ length: 10 }, (_, j) => i === j ? 10000 : 0), 2026);
      expect(result.totals[2]![1]).toBeLessThan(Math.min(...medians) * .65);
      if (i === 8) expect(result.totals).toEqual(Array.from({ length: 3 }, () => [0, 0, 0]));
    }
  });
  it('exposes a narrowing cumulative funnel at months 3, 6 and 12', () => {
    const result = simulateBudget(focused, 2026);
    for (let i = 0; i < 3; i++) for (let q = 0; q < 3; q++) {
      expect(result.qualifiedVisits[i]![q]).toBeGreaterThan(result.activations[i]![q]!);
      expect(result.activations[i]![q]).toBeGreaterThan(result.totals[i]![q]!);
      if (i > 0) for (const series of [result.qualifiedVisits, result.activations, result.totals]) {
        expect(series[i]![q]).toBeGreaterThanOrEqual(series[i - 1]![q]!);
      }
    }
    const path = runBudgetFunnel(focused, seeded(2026));
    for (let m = 0; m < 12; m++) {
      expect(path.qualifiedVisits[m]).toBeGreaterThanOrEqual(path.activations[m]!);
      expect(path.activations[m]).toBeGreaterThanOrEqual(path.opportunities[m]!);
    }
    const empty = simulateBudget(Array(10).fill(0), 2026);
    for (const series of [empty.qualifiedVisits, empty.activations, empty.totals]) expect(series).toEqual(Array.from({ length: 3 }, () => [0, 0, 0]));
  });
  it('computes 300 paths promptly with ordered quantiles', () => {
    const start = performance.now(); const result = simulateBudget(Array(10).fill(1000));
    console.info(`Budget 300 runs: ${(performance.now() - start).toFixed(1)} ms`);
    for (const q of [...result.months, ...result.totals]) { expect(q[0]).toBeLessThanOrEqual(q[1]!); expect(q[1]).toBeLessThanOrEqual(q[2]!); }
  });
});
describe('email DNS lab', () => {
  it('uses real simulated dig and checks the saved file', async () => {
    const registry = createTerminalRegistry(); for (const c of ALL_COMMANDS) registry.commands.add(c); registry.commands.add(digCommand); registry.setup.push(dnsSetup);
    const machine = await createSimMachine(dnsLabSetup, { registry });
    expect((await machine.exec('dig TXT mail.example-cloud.test')).out).toContain('v=spf1 include:_spf.mailer.test ~all');
    expect((await machine.exec('dig +short TXT selector1._domainkey.mail.example-cloud.test')).out).toContain('v=DKIM1');
    expect((await machine.exec('dig TXT _dmarc.mail.example-cloud.test')).out).toContain('NXDOMAIN');
    expect((await machine.exec('dig +short TXT _dmarc.mail.example-cloud.test')).out.trim()).toBe('');
    const check = dnsTask.check.when as (facts: Awaited<ReturnType<typeof machine.facts>>) => boolean;
    expect(check(await machine.facts())).toBe(false);
    await machine.exec("echo 'v=DMARC1; p=none; rua=mailto:dmarc@example-cloud.test' > dmarc.txt");
    expect(check(await machine.facts())).toBe(true);
  });
  it('rejects missing, invalid and duplicate policies', () => {
    for (const p of ['none', 'quarantine', 'reject']) expect(validDmarc(`v=DMARC1; p=${p}`)).toBe(true);
    for (const record of ['', 'v=spf1; p=none', 'v=DMARC1; p=invalid', 'v=DMARC1; p=none; p=reject']) expect(validDmarc(record)).toBe(false);
  });
});
