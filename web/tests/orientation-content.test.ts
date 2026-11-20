// The Orientation block: structure, every terminal task solvable on the
// simulated machine (and known mistakes explained), quiz items graded by
// running them, placement solvable, and the explainer models behave.

import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { registry } from '../src/core/registry';
import type { DocsSection, FillCommandItem, Lesson, PredictOutputItem, ProcessModel, Step, Task, TerminalSection, TerminalSetup } from '../src/core/types';
import { gradeFill, normalizeOutput, runPredict } from '../src/engine/quiz/grade';
import { createSimMachine, stripAnsi, type SimMachine } from '../src/engine/terminal/shell';
import { bill } from '../src/blocks/orientation/explainers/rent';
import { nextVersion } from '../src/blocks/orientation/explainers/release';
import { reqNumbers } from '../src/blocks/orientation/explainers/request';
import { runNumbers } from '../src/blocks/orientation/explainers/run';
import { share } from '../src/blocks/orientation/explainers/system';

const B = registry.blocks.get('orient')!;

function lab(lessonId: string, sectionId = 'try'): { setup: TerminalSetup; tasks: Task[] } {
  const l = registry.lessons.get(lessonId) as Lesson;
  const s = l.sections.find((x) => x.id === sectionId)!;
  if (s.kind === 'terminal') return { setup: (s as TerminalSection).setup, tasks: (s as TerminalSection).tasks };
  const d = s as DocsSection;
  return { setup: d.terminal!.setup, tasks: [d.terminal!.task] };
}

async function sh(m: SimMachine, ...lines: string[]): Promise<string> {
  let out = '';
  for (const l of lines) out += stripAnsi((await m.exec(l)).out);
  return out;
}

async function solve(lesson: string, section: string, i: number, lines: string[], m?: SimMachine): Promise<SimMachine> {
  const { setup, tasks } = lab(lesson, section);
  const mm = m ?? (await createSimMachine(setup));
  const out = await sh(mm, ...lines);
  if (!evaluateCheck(tasks[i].check, await mm.facts()).pass) throw new Error(`${lesson}/${section}/${tasks[i].id} did not pass. Output:\n${out}`);
  return mm;
}

describe('orientation block structure', () => {
  it('is the beginner-only first block with ten lessons, sixteen concepts and seven explainers', () => {
    expect(B.beginnerOnly).toBe(true);
    expect(B.order).toBe(5);
    expect(B.lessons).toHaveLength(10);
    expect([...registry.concepts.keys()].filter((k) => k.startsWith('orient.'))).toHaveLength(16);
    for (const id of ['orient.run', 'orient.system', 'orient.request', 'orient.rent', 'orient.release', 'orient.places', 'orient.together']) expect(registry.explainers.has(id), id).toBe(true);
    expect(registry.orderedLessons()[0].id).toBe('orient.inside');
  });

  it('every lesson has prose, a quiz from the bank and sources in both languages', () => {
    for (const id of B.lessons) {
      const l = registry.lessons.get(id)!;
      expect(l.sections.some((s) => s.kind === 'text'), id).toBe(true);
      const quiz = l.sections.filter((s) => s.kind === 'quiz');
      expect(quiz.length, id).toBeGreaterThan(0);
      for (const q of quiz) for (const it of q.kind === 'quiz' ? q.items : []) if (typeof it === 'string') expect(registry.quiz.has(it), it).toBe(true);
      expect(l.sources.en.length && l.sources.ru.length, id).toBeTruthy();
    }
  });

  it('Intermediate and Experienced close the block with three key questions that cover every concept', () => {
    for (const level of ['intermediate', 'experienced'] as const) {
      const tasks = B.placement.filter((p) => p.level === level);
      expect(tasks).toHaveLength(3);
      expect(tasks.every((t) => t.key)).toBe(true);
      const covered = new Set(tasks.flatMap((t) => t.concepts));
      for (const c of registry.concepts.keys()) if (c.startsWith('orient.')) expect(covered.has(c), `${level}: ${c}`).toBe(true);
    }
  });
});

describe('orientation labs are solvable', () => {
  it('inside a computer', async () => {
    await solve('orient.inside', 'try-cpu', 0, ['nproc']);
    const m = await solve('orient.inside', 'try', 0, ['free -h']);
    await solve('orient.inside', 'try', 1, ['df -h'], m);
  });

  it('the operating system and files', async () => {
    const m = await solve('orient.system', 'try', 0, ['pwd']);
    await solve('orient.system', 'try', 1, ['ls', 'ls notes'], m);
    await solve('orient.system', 'try', 2, ['cat notes/todo.txt'], m);
    await solve('orient.system', 'try', 3, ['mkdir docs', 'ls'], m);
  });

  it('commands', async () => {
    const m = await solve('orient.text', 'try', 0, ['whoami']);
    await solve('orient.text', 'try', 1, ['ls -l notes'], m);
    await solve('orient.text', 'try', 2, ['echo "buy milk" > notes/shopping.txt', 'cat notes/shopping.txt'], m);
  });

  it('networks', async () => {
    const m = await solve('orient.net', 'try', 0, ['ping -c 3 shop.example']);
    await solve('orient.net', 'try', 1, ['echo 198.51.100.20 > shop-address.txt'], m);
    // the placeholder typed literally, with angle brackets, is explained in words
    const { setup, tasks } = lab('orient.net');
    const m2 = await createSimMachine(setup);
    await sh(m2, 'echo <198.51.100.20> > shop-address.txt');
    const r = evaluateCheck(tasks[1].check, await m2.facts());
    expect(r.pass).toBe(false);
    expect(r.say?.en).toMatch(/need not be typed/);
  });

  it('requests', async () => {
    const m = await solve('orient.requests', 'try', 0, ['curl https://shop.example/']);
    await solve('orient.requests', 'try', 1, ['curl -I https://shop.example/'], m);
    await solve('orient.requests', 'try', 2, ['curl https://shop.exmaple/'], m);
  });

  it('source code, build and version — and a wrong version is explained', async () => {
    const m = await solve('orient.release', 'try', 0, ['cat src/greet.sh']);
    await solve('orient.release', 'try', 1, ['bash build.sh'], m);
    await solve('orient.release', 'try', 2, ['bash dist/greet-1.4.2.sh'], m);
    await solve('orient.release', 'try', 3, ['echo 1.4.3 > VERSION', 'bash build.sh'], m);
    const { setup, tasks } = lab('orient.release');
    const m2 = await createSimMachine(setup);
    await sh(m2, 'bash build.sh', 'echo 1.5.0 > VERSION', 'bash build.sh');
    const r = evaluateCheck(tasks[3].check, await m2.facts());
    expect(r.pass).toBe(false);
    expect(r.say?.en).toMatch(/new feature/);
  });

  it('environments and settings — and the two classic mistakes are explained', async () => {
    const m = await solve('orient.places', 'try', 0, ['bash app.sh config/test.conf']);
    await solve('orient.places', 'try', 1, ['bash app.sh config/prod.conf'], m);
    await solve('orient.places', 'try', 2, ['echo color=green >> config/prod.conf', 'bash app.sh config/prod.conf'], m);
    // rewriting the file with > and >> also works
    await solve('orient.places', 'try', 2, ['echo greeting=Welcome to the tea shop > config/prod.conf', 'echo color=green >> config/prod.conf']);
    const { setup, tasks } = lab('orient.places');
    const m2 = await createSimMachine(setup);
    await sh(m2, 'echo color=green > config/prod.conf');
    expect(evaluateCheck(tasks[2].check, await m2.facts()).say?.en).toMatch(/replaced the whole file/);
    const m3 = await createSimMachine(setup);
    await sh(m3, 'echo echo hi > app.sh');
    expect(evaluateCheck(tasks[2].check, await m3.facts()).say?.en).toMatch(/touch the code/);
    const m4 = await createSimMachine(setup);
    await sh(m4, 'echo green >> config/prod.conf');
    expect(evaluateCheck(tasks[2].check, await m4.facts()).say?.en).toMatch(/starts with `color=`/);
  });

  it('working together, including the doc-ladder find task', async () => {
    const m = await solve('orient.together', 'try', 0, ['diff menu-anna.txt menu-boris.txt']);
    await solve('orient.together', 'try', 1, ['cp menu-boris.txt menu.txt'], m);
    await solve('orient.together', 'find', 0, ['diff -u menu-anna.txt menu-boris.txt']);
    const doc = registry.corpus.get('man/diff.1')!;
    expect(doc.sections.find((s) => s.id === 'OPTIONS')?.body).toMatch(/unified/);
  });
});

describe('orientation quiz items grade by running', () => {
  it('fill-command items accept a working line and explain the usual mistake', async () => {
    const it = registry.quiz.get('orient.q.fill-echo') as FillCommandItem;
    expect((await gradeFill(it, 'echo hello > hello.txt')).correct).toBe(true);
    const wrong = await gradeFill(it, 'echo hello');
    expect(wrong.correct).toBe(false);
    expect(wrong.feedback.some((f) => /`>`/.test(f.en))).toBe(true);
    const place = B.placement.find((p) => p.id === 'orient.place.exp.files')!;
    expect(place.kind === 'quiz' && (await gradeFill(place.item as FillCommandItem, 'echo ready > ~/notes/plan.txt')).correct).toBe(true);
  });

  it('the predict-output item’s right option is what the simulator prints', async () => {
    const it = registry.quiz.get('orient.q.predict-curl') as PredictOutputItem;
    const actual = await runPredict(it);
    const right = it.options!.find((o) => o.correct)!;
    expect(normalizeOutput(actual)).toBe(normalizeOutput(right.text as string));
  });
});

describe('orientation explainer models', () => {
  const models = ['orient.run', 'orient.system', 'orient.request', 'orient.rent', 'orient.release', 'orient.places', 'orient.together'].map((id) => registry.explainers.get(id)!.model as ProcessModel<Record<string, unknown>>);

  it('every knob value and every break gives steps on known elements, and predictions resolve to their options', () => {
    for (const m of models) {
      const ids = new Set([...m.diagram.nodes.map((n) => n.id), ...m.diagram.edges.map((e) => e.id), ...(m.diagram.groups ?? []).map((g) => g.id)]);
      const defaults = Object.fromEntries(m.params.map((p) => [p.id, p.default]));
      const base = m.run(defaults, new Set());
      const check = (steps: Step[]) => {
        expect(steps.length, m.id).toBeGreaterThan(0);
        for (const s of steps) for (const f of s.focus) expect(ids.has(f), `${m.id}.${s.id}: ${f}`).toBe(true);
      };
      for (const p of m.params) {
        const values = p.kind === 'choice' ? p.options!.map((o) => o.id) : p.kind === 'toggle' ? [true, false] : [p.min!, p.max!];
        for (const v of values) {
          const next = m.run({ ...defaults, [p.id]: v }, new Set());
          check(next);
          if (p.predict) expect(p.predict.options.map((o) => o.id), `${m.id}.${p.id}`).toContain(p.predict.resolve(base, next));
          expect(m.explainDelta(base, next, { kind: 'param', id: p.id, from: p.default, to: v }, defaults, { ...defaults, [p.id]: v }).ru.length).toBeGreaterThan(0);
        }
      }
      for (const b of m.breaks) {
        const next = m.run(defaults, new Set([b.id]));
        check(next);
        expect(next.some((s) => s.broken), `${m.id} break ${b.id}`).toBe(true);
        expect(b.predict.options.map((o) => o.id)).toContain(b.predict.resolve(base, next));
      }
    }
  });

  it('the numbers behind the explainers', () => {
    expect(runNumbers({ size: 300, disk: 'hdd', open: 2 }).ms).toBeGreaterThan(runNumbers({ size: 300, disk: 'ssd', open: 2 }).ms);
    expect(runNumbers({ size: 300, disk: 'ssd', open: 12 }).swap).toBe(true);
    expect(share({ programs: 8, cores: '1' })).toEqual({ share: 13, switches: 100 });
    expect(share({ programs: 2, cores: '4' }).switches).toBe(0);
    expect(reqNumbers({ clients: 100, distance: 'city', servers: 1 }).wait).toBe(5);
    expect(reqNumbers({ clients: 190, distance: 'city', servers: 1 }).wait).toBe(95);
    expect(reqNumbers({ clients: 250, distance: 'city', servers: 1 }).overload).toBe(true);
    expect(reqNumbers({ clients: 250, distance: 'city', servers: 2 }).overload).toBe(false);
    expect(nextVersion('fix')).toBe('1.4.3');
    expect(nextVersion('feature')).toBe('1.5.0');
    expect(nextVersion('breaking')).toBe('2.0.0');
    expect(bill('small', 1, 720)).toBe(14.4);
    expect(bill('large', 2, 10)).toBe(12);
  });

  it('captions follow the numbers at the extremes', () => {
    const get = (id: string) => registry.explainers.get(id)!.model as ProcessModel<Record<string, unknown>>;
    const last = (s: Step[]) => s[s.length - 1];
    // a machine forgotten after a month-long project still costs another month
    const rent = get('orient.rent');
    const month = { size: 'small', count: 1, hours: 720 };
    const forgot = rent.run(month, new Set(['forget']));
    expect(last(forgot).metrics?.cost).toBeGreaterThan(last(rent.run(month, new Set())).metrics!.cost);
    // the last step of a request names the longest bar: the queue near full load, the road at low load
    const req = get('orient.request');
    expect(last(req.run({ clients: 199, distance: 'country', servers: 1 }, new Set())).caption.ru).toMatch(/ожидание в очереди/);
    expect(last(req.run({ clients: 50, distance: 'country', servers: 1 }, new Set())).caption.ru).toMatch(/дорогу туда и обратно/);
    // fewer servers never says the load falls
    const a = { clients: 150, distance: 'country', servers: 2 };
    const b = { ...a, servers: 1 };
    expect(req.explainDelta(req.run(a, new Set()), req.run(b, new Set()), { kind: 'param', id: 'servers', from: 2, to: 1 }, a, b).ru).toMatch(/растёт/);
    // one program on one core does not run slower
    const sys = get('orient.system');
    const s3 = { programs: 3, cores: '1' };
    const s1 = { programs: 1, cores: '1' };
    expect(sys.explainDelta(sys.run(s3, new Set()), sys.run(s1, new Set()), { kind: 'param', id: 'programs', from: 3, to: 1 }, s3, s1).ru).not.toMatch(/медленнее/);
  });
});
