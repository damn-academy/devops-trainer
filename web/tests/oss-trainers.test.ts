import { expect, it } from 'vitest';
import source from '../src/trainers/oss-trainers.ru.md?raw';
import { parseGovernance, parseHealth, applicableChecks, governanceMarkdown, checkGroups } from '../src/engine/trainers/oss';
it('parses the authored blocks without leaking sections across boundaries', () => {
  const g = parseGovernance(source), h = parseHealth(source);
  expect(g.groups.map(g => g.name)).toEqual(Object.values(checkGroups));
  expect(g.facts).toHaveLength(4); expect(g.checks).toHaveLength(9);
  g.groups.forEach(group => { expect(group.options.A).toBeTruthy(); expect(group.options.B).toBeTruthy(); });
  expect(h.metrics).toHaveLength(9); expect(h.questions).toHaveLength(5);
  expect(h.questions[0].question).toContain('наименьшее число людей');
  expect(h.questions[0].answer).toContain('одному: половину ревью делает Анна');
  expect(h.questions[0].answer).toContain('81 %');
  expect(() => parseGovernance('')).toThrow('Missing data');
});
it('maps every short check name for all 64 selections and always includes the unconditional check', () => {
  const g = parseGovernance(source);
  const checks = [...source.matchAll(/^- Выбрано «(.+) ([AB])» → (.+)$/gm)];
  for (let mask = 0; mask < 64; mask++) {
    const choices = Object.fromEntries(g.groups.map((group, i) => [group.name, mask & (1 << i) ? 'B' as const : 'A' as const]));
    const result = applicableChecks(g, choices);
    checks.forEach(m => expect(result.includes(m[3])).toBe(choices[checkGroups[m[1]]] === m[2]));
    expect(result).toContain(g.checks.at(-1)!.text);
    const markdown = governanceMarkdown(g, choices);
    g.groups.forEach(group => { expect(markdown).toContain(group.options[choices[group.name]]); expect(markdown).not.toContain(group.options[choices[group.name] === 'A' ? 'B' : 'A']); });
  }
});
