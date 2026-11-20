// Discovery of content and engines. Every src/blocks/<folder>/index.ts and
// every src/engine/<name>/module.ts default-exports a BlockModule (via
// defineModule); the registry merges them, so builders never edit a shared
// list. Duplicate ids are collected in `errors` (the lint test fails on them).

import { corpus as globalCorpus, Corpus } from '../engine/docs/corpus';
import { createTerminalRegistry, terminalRegistry, type TerminalRegistry } from '../engine/terminal/registry';
import { fromManifest, type Manifest } from './manifest';
import { addClusterEvidence } from './placement-evidence';
import { ROUTE, type RouteEntry } from './route';
import type { Block, BlockModule, Concept, Exam, ExplainerReg, Lesson, Mentor, QuizItem, SettingsSectionReg, WidgetReg } from './types';

export interface Registry {
  blocks: Map<string, Block>;
  lessons: Map<string, Lesson>;
  concepts: Map<string, Concept>;
  quiz: Map<string, QuizItem>;
  explainers: Map<string, ExplainerReg>;
  exams: Map<string, Exam>;
  widgets: Map<string, WidgetReg>;
  settings: SettingsSectionReg[];
  mentor?: Mentor;
  /**
   * True once every engine and block module is loaded. While false the
   * registry holds only the manifest: blocks and lesson stubs without bodies.
   */
  complete: boolean;
  /** Number of placement tasks of a block (known from the manifest too). */
  placementCount(blockId: string): number;
  /** Which module file delivered each id, for error messages. */
  origin: Map<string, string>;
  errors: string[];
  terminal: TerminalRegistry;
  corpus: Corpus;
  /** Blocks in route order. Hidden blocks are included only when asked. */
  orderedBlocks(includeHidden?: boolean): Block[];
  /** All lessons in route order (block order, then the block's lesson list). */
  orderedLessons(): Lesson[];
  /** Position of a lesson on the route, -1 if unknown. */
  position(lessonId: string): number;
  blockOf(lessonId: string): Block | undefined;
  /** The route map: delivered blocks, and placeholders from ROUTE for blocks not delivered yet. */
  routeMap(): ({ kind: 'block'; block: Block; entry?: RouteEntry } | { kind: 'placeholder'; entry: RouteEntry })[];
}

type ModuleMap = Record<string, { default?: BlockModule } | BlockModule>;

export function buildRegistry(mods: ModuleMap, opts: { terminal?: TerminalRegistry; corpus?: Corpus } = {}): Registry {
  const errors: string[] = [];
  const origin = new Map<string, string>();
  const terminal = opts.terminal ?? terminalRegistry;
  const corpus = opts.corpus ?? globalCorpus;
  const blocks = new Map<string, Block>();
  const lessons = new Map<string, Lesson>();
  const concepts = new Map<string, Concept>();
  const quiz = new Map<string, QuizItem>();
  const explainers = new Map<string, ExplainerReg>();
  const exams = new Map<string, Exam>();
  const widgets = new Map<string, WidgetReg>();
  const settings: SettingsSectionReg[] = [];
  let mentor: Mentor | undefined;

  const put = <T extends { id: string }>(map: Map<string, T>, kind: string, item: T, file: string) => {
    const key = `${kind}:${item.id}`;
    if (map.has(item.id)) errors.push(`${kind} "${item.id}" is defined twice: ${origin.get(key)} and ${file}`);
    else {
      map.set(item.id, item);
      origin.set(key, file);
    }
  };

  // Engines first (they provide the basic commands blocks may override), then blocks; each group sorted by path.
  const files = Object.keys(mods).sort((a, b) => {
    const ea = a.includes('/engine/') ? 0 : 1;
    const eb = b.includes('/engine/') ? 0 : 1;
    return ea - eb || a.localeCompare(b);
  });

  for (const file of files) {
    const raw = mods[file] as { default?: BlockModule };
    const m: BlockModule | undefined = raw && 'default' in raw ? raw.default : (raw as BlockModule);
    if (!m) {
      errors.push(`${file} has no default export (use export default defineModule({...}))`);
      continue;
    }
    for (const b of m.blocks ?? []) put(blocks, 'block', b, file);
    for (const l of m.lessons ?? []) put(lessons, 'lesson', l, file);
    for (const c of m.concepts ?? []) put(concepts, 'concept', c, file);
    for (const q of m.quiz ?? []) put(quiz, 'quiz item', q, file);
    for (const e of m.explainers ?? []) put(explainers, 'explainer', e, file);
    for (const e of m.exams ?? []) put(exams, 'exam', e, file);
    for (const w of m.widgets ?? []) put(widgets, 'widget', w, file);
    for (const s of m.settings ?? []) settings.push(s);
    for (const c of m.commands ?? []) {
      try {
        terminal.commands.add(c);
      } catch (e) {
        errors.push(`${(e as Error).message} (${file})`);
      }
    }
    terminal.facts.push(...(m.facts ?? []));
    terminal.setup.push(...(m.setup ?? []));
    for (const p of m.docs ?? []) {
      try {
        corpus.add(p);
      } catch (e) {
        errors.push(`${(e as Error).message} (${file})`);
      }
    }
    if (m.mentor) {
      if (mentor) errors.push(`a second AI mentor is registered in ${file}`);
      else mentor = m.mentor;
    }
  }
  for (const c of terminal.commands.list()) {
    try {
      corpus.addCommand(c);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  for (const block of blocks.values()) {
    addClusterEvidence(block, exams);
    const minutes = [...lessons.values()].filter(l => l.block === block.id).reduce((sum, l) => sum + (l.minutes ?? 0), 0);
    const hours = minutes / 60;
    block.hours = { beginner: hours, intermediate: hours, experienced: hours };
  }
  settings.sort((a, b) => a.order - b.order);

  const orderedBlocks = (includeHidden = true) =>
    [...blocks.values()].filter((b) => includeHidden || !b.hidden).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  let orderCache: Lesson[] | null = null;
  const orderedLessons = () => {
    if (orderCache) return orderCache;
    const out: Lesson[] = [];
    for (const b of orderedBlocks(true)) for (const id of b.lessons) {
      const l = lessons.get(id);
      if (l) out.push(l);
    }
    orderCache = out;
    return out;
  };
  const posCache = new Map<string, number>();
  const position = (id: string) => {
    if (!posCache.size) orderedLessons().forEach((l, i) => posCache.set(l.id, i));
    return posCache.get(id) ?? -1;
  };
  const blockOf = (lessonId: string) => {
    const l = lessons.get(lessonId);
    return l ? blocks.get(l.block) : undefined;
  };
  const routeMap: Registry['routeMap'] = () => {
    const entries = new Map(ROUTE.map((e) => [e.id, e]));
    const items: ReturnType<Registry['routeMap']> = [];
    for (const b of orderedBlocks(false)) items.push({ kind: 'block', block: b, entry: entries.get(b.id) });
    for (const e of ROUTE) if (!blocks.has(e.id)) items.push({ kind: 'placeholder', entry: e });
    const order = (x: (typeof items)[number]) => (x.kind === 'block' ? x.block.order : x.entry.order);
    return items.sort((a, b) => order(a) - order(b));
  };

  const placementCount = (id: string) => blocks.get(id)?.placement.length ?? 0;

  return { blocks, lessons, concepts, quiz, explainers, exams, widgets, settings, mentor, complete: false, placementCount, origin, errors, terminal, corpus, orderedBlocks, orderedLessons, position, blockOf, routeMap };
}

/** A registry with only the manifest's blocks and lesson stubs. Touches no shared terminal or corpus. */
export function registryFromManifest(m: Manifest): Registry {
  const { blocks, lessons, placements } = fromManifest(m);
  const r = buildRegistry({ manifest: { blocks, lessons } }, { terminal: createTerminalRegistry(), corpus: new Corpus() });
  r.placementCount = (id) => placements.get(id) ?? 0;
  return r;
}

// Every engine and block module is its own chunk (dynamic import), so the
// entry chunk holds only the shell and the core; the chunks download in
// parallel and are cached one by one, and a change to one block re-downloads
// only that block. The registry object is created empty and filled in place,
// first from the manifest (useManifest, enough for the route map) and then by
// loadRegistry() with every module, so every import of `registry` sees the
// loaded content.
const engineLoaders = import.meta.glob<{ default: BlockModule }>('../engine/*/module.ts');
const blockLoaders = import.meta.glob<{ default: BlockModule }>('../blocks/*/index.ts');

/** The registry of this build. Empty until loadRegistry() resolves. */
export const registry: Registry = buildRegistry({});

let loading: Promise<Registry> | null = null;

/** Fill `registry` from the manifest until the full content is loaded. No-op once it is. */
export function useManifest(m: Manifest): Registry {
  if (!registry.complete && !loading) Object.assign(registry, registryFromManifest(m));
  return registry;
}

/** Load every engine and block module (in parallel) and fill `registry`. Idempotent. */
export function loadRegistry(): Promise<Registry> {
  loading ??= (async () => {
    const loaders = { ...engineLoaders, ...blockLoaders };
    const entries = await Promise.all(Object.entries(loaders).map(async ([file, load]) => [file, await load()] as const));
    Object.assign(registry, buildRegistry(Object.fromEntries(entries)), { complete: true });
    return registry;
  })().catch((e: unknown) => {
    loading = null; // a failed chunk download can be retried by the next call
    throw e;
  });
  return loading;
}
