import { collectBis, wordRe } from './lint';
import { plainText, conceptLinks } from './markdown';
import type { Registry } from './registry';
import type { Bi, Level, ModelChange, Step } from './types';
import { lintRuStyle } from '../../scripts/lint-ru-style.mjs';

const levels: Level[] = ['beginner', 'intermediate', 'experienced'];
const languages = ['ru', 'en'] as const;
type Language = typeof languages[number] | 'shared';
export interface ExplainerText {
  path: string;
  language: Language;
  text: string;
  step?: string;
}
export interface ExplainerFinding extends ExplainerText {
  kind: 'concept' | 'style' | 'reading-time' | 'coverage' | 'runtime';
  explainer: string;
  lesson?: string;
  section?: string;
  levels: Level[];
  scenarios: string[];
  message: string;
  concept?: string;
  introducedIn?: string;
  seconds?: number;
}
export interface ExplainerBlockReport {
  explainers: string[];
  runs: number;
  texts: number;
  counts: Record<ExplainerFinding['kind'], number>;
  findings: ExplainerFinding[];
}
export interface ExplainerReport {
  version: 1;
  policy: string;
  blocks: Record<string, ExplainerBlockReport>;
}

/** Explicit visible surfaces: never scan IDs, state names, icon names or function source. */
export function collectExplainerTexts(value: unknown, path = '', out: ExplainerText[] = []): ExplainerText[] {
  if (typeof value === 'string') out.push({ path, language: 'shared', text: value });
  else if (value && typeof value === 'object') {
    if ('ru' in value && 'en' in value) {
      for (const language of languages) out.push({ path, language, text: (value as Bi)[language] });
    } else for (const [key, child] of Object.entries(value)) {
      collectExplainerTexts(child, path ? `${path}.${key}` : key, out);
    }
  }
  return out;
}

/** Mirrors render.ts readingTime at 1×, BEFORE its 22 s cap. Guarded by a source-contract test. */
export function explainerReadingMs(step: Step, language: 'ru' | 'en'): number {
  return Math.max(4500, 3000 + 65 * (step.caption[language].length + Object.values(step.say ?? {}).reduce((n, bi) => n + bi[language].length, 0)));
}

export function lintExplainers(reg: Registry): ExplainerReport {
  const report: ExplainerReport = {
    version: 1,
    policy: 'Warnings only. Each placement and exposed level; defaults + placement overrides; each choice, toggle and range endpoint; one break at a time; forward/reverse deltas. No Cartesian product. Same-lesson introduction requires a term or glossary link in an earlier visible section. Findings deduplicated across levels/scenarios.',
    blocks: {},
  };
  const concepts = [...reg.concepts.values()].filter(c => c.scan !== false).map(c => ({
    c, at: reg.position(c.introducedIn),
    ru: wordRe([c.term.ru, ...(c.forms?.ru ?? [])]),
    en: wordRe([c.term.en, ...(c.forms?.en ?? [])]),
  }));
  for (const e of reg.explainers.values()) {
    const folder = reg.origin.get(`explainer:${e.id}`)?.match(/blocks\/([^/]+)\//)?.[1] ?? e.block;
    const block = report.blocks[folder] ??= { explainers: [], runs: 0, texts: 0, counts: { concept: 0, style: 0, 'reading-time': 0, coverage: 0, runtime: 0 }, findings: [] };
    block.explainers.push(e.id);
    const placements = [...reg.lessons.values()].flatMap(lesson => lesson.sections.flatMap((section, index) =>
      section.kind === 'explainer' && section.explainer === e.id ? [{ lesson, section, index }] : []));
    const dedup = new Map<string, ExplainerFinding>();
    for (const placement of placements.length ? placements : [undefined]) {
      const section = placement?.section;
      for (const level of section?.levels ?? levels) {
        const add = (finding: Omit<ExplainerFinding, 'explainer' | 'lesson' | 'section' | 'levels' | 'scenarios'>, scenario = 'static') => {
          const key = JSON.stringify([placement?.lesson.id, section?.id, finding]);
          const old = dedup.get(key);
          if (old) {
            if (!old.levels.includes(level)) old.levels.push(level);
            if (!old.scenarios.includes(scenario)) old.scenarios.push(scenario);
          } else {
            const item = { ...finding, explainer: e.id, lesson: placement?.lesson.id, section: section?.id, levels: [level], scenarios: [scenario] };
            dedup.set(key, item); block.findings.push(item); block.counts[item.kind]++;
          }
        };
        const prior = placement?.lesson.sections.slice(0, placement.index).filter(s => !s.levels || s.levels.includes(level)) ?? [];
        const priorTexts = collectBis(prior.flatMap<unknown>(s => s.kind === 'quiz' ? [s, ...s.items.map(q => typeof q === 'string' ? reg.quiz.get(q) : q)] : [s]));
        const known = new Set(concepts.filter(({ c, at, ru, en }) => {
          if (!placement) return false;
          if (at >= 0 && at < reg.position(placement.lesson.id)) return true;
          return c.introducedIn === placement.lesson.id && placement.lesson.introduces.includes(c.id) && priorTexts.some(({ bi }) =>
            languages.some(lang => conceptLinks(bi[lang]).some(link => link.id === c.id) || (lang === 'ru' ? ru : en)?.test(plainText(bi[lang]))));
        }).map(({ c }) => c.id));
        const scan = (texts: ExplainerText[], scenario = 'static') => {
          block.texts += texts.length;
          for (const text of texts) {
            if (placement) for (const { c, ru, en } of concepts) {
              if (known.has(c.id)) continue;
              const clean = plainText(text.text);
              const hit = (text.language !== 'en' ? ru?.exec(clean)?.[0] : undefined) ?? (text.language !== 'ru' ? en?.exec(clean)?.[0] : undefined);
              if (hit) add({ ...text, kind: 'concept', concept: c.id, introducedIn: c.introducedIn,
                message: `term "${hit}" appears in explainer ${e.id} step ${text.step ?? '(static)'} before lesson ${c.introducedIn} introduces it` }, scenario);
            }
            if (text.language !== 'en') for (const style of lintRuStyle(text.text)) add({ ...text, kind: 'style', message: `[${style.rules.join(', ')}] ${style.sentence}` }, scenario);
          }
        };
        if (!placement) add({ kind: 'coverage', path: '', language: 'shared', text: '', message: 'No lesson placement: concept order cannot be checked.' });
        const m = e.model;
        scan(collectExplainerTexts({ title: e.title, summary: e.summary, caption: section?.caption, howto: section?.howto }));
        if (!m) {
          add({ kind: 'coverage', path: '', language: 'shared', text: '', message: 'Custom mount has no model: runtime texts cannot be enumerated.' });
          continue;
        }
        const params = m.params.filter(p => !p.levels || p.levels.includes(level));
        const breaks = m.breaks.filter(b => !b.levels || b.levels.includes(level));
        scan(collectExplainerTexts({ title: m.title, summary: m.summary, intro: m.intro, stopLabel: m.stopLabel,
          legend: m.legend?.map(l => l.text),
          diagram: [...m.diagram.nodes, ...m.diagram.edges, ...(m.diagram.groups ?? [])].map(n => ({ label: n.label, sub: 'sub' in n ? n.sub : undefined, card: { what: n.card.what, who: n.card.who, see: n.card.see, docLabel: n.card.doc?.label, docGloss: n.card.doc?.gloss } })),
          metrics: m.metrics?.map(v => ({ label: v.label, unit: v.unit })),
          params: params.map(p => ({ label: p.label, unit: p.unit, group: p.group, options: p.options?.map(o => o.label), predict: p.predict && { prompt: p.predict.prompt, options: p.predict.options.map(o => o.text) } })),
          breaks: breaks.map(b => ({ label: b.label, layer: b.layer, prompt: b.predict.prompt, options: b.predict.options.map(o => o.text) })),
        }));
        const defaults = Object.fromEntries(m.params.map(p => [p.id, p.default]));
        const bases = [{ name: 'defaults', params: defaults }];
        if (section?.params) bases.push({ name: 'placement', params: { ...defaults, ...section.params } });
        const scanSteps = (steps: Step[], scenario: string) => {
          for (const st of steps) {
            scan(collectExplainerTexts({ label: st.label, caption: st.caption, say: st.say, values: st.values,
              tokens: st.tokens?.map(t => t.label), metricText: st.metricText,
              metricLabels: Object.keys(st.metrics ?? {}).filter(id => !m.metrics?.some(spec => spec.id === id)),
              broken: st.broken && { message: st.broken.message, caption: st.broken.caption },
            }).map(t => ({ ...t, path: `steps.${st.id}.${t.path}`, step: st.id })), scenario);
            for (const language of languages) {
              const ms = explainerReadingMs(st, language);
              if (ms > 22000) add({ kind: 'reading-time', path: `steps.${st.id}`, step: st.id, language,
                text: [st.caption[language], ...Object.values(st.say ?? {}).map(b => b[language])].join(' '),
                seconds: ms / 1000, message: `Needs ${(ms / 1000).toFixed(2)} s at 1×; playback caps at 22 s. Split this step.` }, scenario);
            }
          }
        };
        for (const base of bases) {
          const run = (p: Record<string, unknown>, broken: Set<string>, scenario: string) => {
            block.runs++;
            try { const steps = m.run(p, broken); scanSteps(steps, scenario); return steps; }
            catch (err) { add({ kind: 'runtime', path: 'run', language: 'shared', text: '', message: String(err) }, scenario); return undefined; }
          };
          const prev = run({ ...base.params }, new Set(), base.name);
          if (!prev) continue;
          const changes: { name: string; params: Record<string, unknown>; broken: Set<string>; change: ModelChange }[] = [];
          for (const p of params) {
            const values = p.kind === 'choice' ? p.options?.map(o => o.id) ?? [] : p.kind === 'toggle' ? [false, true] : [p.min ?? 0, p.max ?? 100];
            for (const value of values) changes.push({ name: `${base.name}:param:${p.id}=${value}`, params: { ...base.params, [p.id]: value }, broken: new Set(), change: { kind: 'param', id: p.id, from: base.params[p.id], to: value } });
          }
          for (const b of breaks) changes.push({ name: `${base.name}:break:${b.id}`, params: { ...base.params }, broken: new Set([b.id]), change: { kind: 'break', id: b.id, on: true } });
          for (const change of changes) {
            const next = run(change.params, change.broken, change.name);
            if (!next) continue;
            const reverse: ModelChange = change.change.kind === 'break' ? { ...change.change, on: false } : { ...change.change, from: change.change.to, to: change.change.from };
            for (const backwards of [false, true]) {
              const scenario = change.name + (backwards ? ':reverse' : '');
              try {
                scan(collectExplainerTexts(m.explainDelta(backwards ? next : prev, backwards ? prev : next,
                  backwards ? reverse : change.change, backwards ? change.params : base.params, backwards ? base.params : change.params), 'explainDelta'), scenario);
              } catch (err) { add({ kind: 'runtime', path: 'explainDelta', language: 'shared', text: '', message: String(err) }, scenario); }
            }
          }
        }
      }
    }
  }
  return report;
}

export function worstExplainerFindings(report: ExplainerReport, limit = 15): ExplainerFinding[] {
  const rank = { runtime: 5, coverage: 4, 'reading-time': 3, concept: 2, style: 1 };
  const seen = new Set<string>();
  return Object.values(report.blocks).flatMap(b => b.findings).sort((a, b) =>
    rank[b.kind] - rank[a.kind] || (b.seconds ?? 0) - (a.seconds ?? 0) || b.text.length - a.text.length).filter(f => {
      const key = JSON.stringify([f.kind, f.explainer, f.lesson, f.section, f.path, f.language]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);
}
