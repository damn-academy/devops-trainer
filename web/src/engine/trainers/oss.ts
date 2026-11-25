import source from '../../trainers/oss-trainers.ru.md?raw';
export type Option = 'A' | 'B';
export interface Governance {
  title: string; description: string;
  groups: { name: string; options: Record<Option, string> }[];
  facts: string[];
  checks: { group?: string; option?: Option; text: string }[];
}
export const checkGroups: Record<string, string> = {
  Роли: 'Роли', Номинация: 'Номинация мейнтейнера', Снятие: 'Снятие и почётный статус',
  Решения: 'Принятие решений', Безопасность: 'Безопасность', Кодекс: 'Кодекс поведения',
};
function block(input: string, id: string) {
  const match = [...input.matchAll(/<!-- data: ([^|]+)\| ([^>]+)-->\s*([\s\S]*?)(?=<!-- data:|$)/g)].find(m => m[1].trim() === id);
  if (!match) throw new Error(`Missing data: ${id}`);
  return { title: match[2].trim(), body: match[3].trim() };
}
export function parseGovernance(input: string): Governance {
  const { title, body } = block(input, 'oss.governance');
  const [intro, rest = ''] = body.split('Блоки для сборки (ученик выбирает по одному варианту в каждой группе):');
  const [groups, tail = ''] = rest.split('Факты репозитория, с которыми сверяется файл:');
  const [facts, checks = ''] = tail.split('Проверки (противоречие → объяснение):');
  return { title, description: intro.trim(),
    groups: [...groups.matchAll(/## ([^\n]+)\n- A: ([^\n]+)\n- B: ([^\n]+)/g)].map(m => ({ name: m[1].trim(), options: { A: m[2].trim(), B: m[3].trim() } })),
    facts: facts.split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2)),
    checks: checks.split('\n').flatMap(l => {
      const selected = l.match(/^- Выбрано «(.+) ([AB])» → (.+)$/);
      if (selected) {
        const group = checkGroups[selected[1]];
        if (!group) throw new Error(`Unknown check group: ${selected[1]}`);
        return [{ group, option: selected[2] as Option, text: selected[3] }];
      }
      return l.startsWith('- Всегда → ') ? [{ text: l.slice('- Всегда → '.length) }] : [];
    }),
  };
}
export const governanceRemedies = [
  'Снять права слияния у двух неактивных аккаунтов и записать их почётными',
  'Добавить второго читателя security@ из банка-пользователя и опубликовать список',
  'Провести и записать голосование о принятии GOVERNANCE.md',
];
export function applicableChecks(data: Governance, choices: Record<string, Option>, fixes: Record<string, boolean> = {}) {
  return data.checks.filter(c => {
    if (c.group && choices[c.group] !== c.option) return false;
    if (!c.group) return !fixes[2];
    if (c.group === checkGroups.Снятие && c.option === 'A') return !fixes[0];
    if (c.group === checkGroups.Безопасность && c.option === 'A') return !fixes[1];
    return true;
  }).map(c => c.text);
}
export function governanceMarkdown(data: Governance, choices: Record<string, Option>) {
  return ['# GOVERNANCE.md', data.description, ...data.groups.map(g => `## ${g.name}\n\n${g.options[choices[g.name]]}`)].join('\n\n');
}
export function parseHealth(input: string) {
  const { title, body } = block(input, 'oss.health');
  return { title, description: body.split('Показатели:')[0].trim(),
    metrics: body.split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2)),
    questions: [...body.matchAll(/^\d+\. (.+?) Ответ: (.+)$/gm)].map(m => ({ question: m[1], answer: m[2] })),
  };
}
export const governance = parseGovernance(source);
export const health = parseHealth(source);
