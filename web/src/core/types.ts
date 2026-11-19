// ─────────────────────────────────────────────────────────────────────────────
// DevOps Trainer — platform contracts.
//
// This file is the single place where the shapes that blocks and engines plug
// into are defined. A block builder writes data in these shapes; an engine
// builder implements these interfaces. Nothing here imports runtime code, so a
// content file can import types without pulling in the platform.
//
// Design sources: design/00-DESIGN.ru.md (§1, §2.1, §6.2), 01-andragogy (§2,
// §6, §7, §11), 08-multimedia-engine (§3, §4, §6), 09-runtime (§1.5, §2),
// 10-assessment (§2, §3).
//
// Conventions (01 §0):
//  - ids are slugs. Concept ids are `<prefix>.<name>`, prefix one of
//    orient, method, linux, git, yaml, net, proto, docker, cicd, k8s, iac,
//    obs, pet, career. Lesson ids are `<block>.<slug>`.
//  - levels are 'beginner' | 'intermediate' | 'experienced' (never L0/L1/L2).
//  - every learner-facing string is a Bi { ru, en }; commands, terminal output
//    and documentation pages are plain English strings.
// ─────────────────────────────────────────────────────────────────────────────

import type { Bi, Lang } from './i18n';
export type { Bi, Lang };

export type Level = 'beginner' | 'intermediate' | 'experienced';
export const LEVELS: readonly Level[] = ['beginner', 'intermediate', 'experienced'];

/** Content tier (01 §3.2): core is the same for everyone; plus and pro are on top. */
export type Tier = 'core' | 'plus' | 'pro';

export type ConceptId = string;
export type BlockId = string;
export type LessonId = string;

// ── Sources ────────────────────────────────────────────────────────────────

/** A real, stable URL. `title` is written in the language of the source itself. */
export interface SourceLink {
  title: string;
  url: string;
  note?: Bi;
}

/** Every lesson and block cites sources in both languages (00 §6.9). */
export interface Sources {
  en: SourceLink[];
  ru: SourceLink[];
}

// ── Concepts (the textbook order) ──────────────────────────────────────────

/**
 * A node of the concept graph (01 §6). A term may appear on screen only in or
 * after the lesson that introduces it; the concept-order linter enforces it
 * through `Lesson.introduces/uses`, `[[concept]]` links and a scan of the
 * text for `term` and `forms`.
 */
export interface Concept {
  id: ConceptId;
  /** The dictionary word, as it appears in the text: { ru: 'процесс', en: 'process' }. */
  term: Bi;
  /** One sentence for the glossary card. */
  short: Bi;
  /** The lesson whose `introduces` lists this concept. */
  introducedIn: LessonId;
  /**
   * Extra word forms the linter scans for (Russian declension, plurals).
   * Matching is whole-word and case-insensitive.
   */
  forms?: { ru?: string[]; en?: string[] };
  /**
   * Whether the glossary scan looks for the term in plain text. Set false for
   * everyday words that are also terms ("file", "server"), so the scan does not
   * flag ordinary usage; links and introduces/uses are still checked.
   */
  scan?: boolean;
  tier?: Tier;
  /** Where the concept is documented, shown on the glossary card (DL1 flicker). */
  docRef?: DocRef;
}

// ── Blocks and lessons ─────────────────────────────────────────────────────

/**
 * A block of the course route (00 §2.1). One block module (folder) may export
 * several blocks — the git-cicd folder exports `git-yaml` and `cicd`, the
 * kubernetes folder the three stages.
 */
export interface Block {
  id: BlockId;
  /** Position on the route. Use the numbers of ROUTE in core/route.ts. */
  order: number;
  title: Bi;
  summary: Bi;
  /** Step of the source checklist this block covers ('01'…'11'), or null. */
  checklistStep: string | null;
  /** What each level means in this block (00 §3.2). */
  levels: Record<Level, Bi>;
  /** Hours per level (00 §2.2); shown on the route map. */
  hours?: Record<Level, number>;
  /** The "show what you already know" check (01 §4). */
  placement: PlacementTask[];
  /** Lesson ids in route order. */
  lessons: LessonId[];
  sources: Sources;
  /** Blocks that must be passed first (Kubernetes requires containers). */
  requires?: BlockId[];
  /** Shown only to learners who chose Beginner (the Orientation segment). */
  beginnerOnly?: boolean;
  /** Not shown on the route map (demo and showcase blocks). Still linted. */
  hidden?: boolean;
  /** Documentation sources whose ladder step this block moves (01 §11). */
  docSources?: DocSource[];
  /** Id of the block exam (see Exam). */
  exam?: string;
}

/** Lesson step of the anatomy (01 §7.2). */
export type LessonStep = 'hook' | 'look' | 'try' | 'explain' | 'practice' | 'exit' | 'review';

/**
 * A lesson: 15–40 minutes, one core concept and at most three helpers.
 * `introduces` lists what this lesson defines; `uses` lists what it relies on
 * and must have been introduced earlier on the route.
 */
export interface Lesson {
  id: LessonId;
  block: BlockId;
  title: Bi;
  summary?: Bi;
  introduces: ConceptId[];
  uses: ConceptId[];
  tier: Tier;
  minutes?: number;
  sections: Section[];
  sources: Sources;
  /** Override of the documentation ladder step for this lesson (08 §4.3). */
  docStep?: DocStep;
}

interface SectionBase {
  /** Unique inside the lesson. Progress is stored per section id. */
  id: string;
  /** Levels this section is shown for; all levels when absent. */
  levels?: Level[];
  /** Which step of the lesson anatomy this section is. */
  step?: LessonStep;
}

/**
 * Textbook prose in markdown-lite: paragraphs, `code`, **bold**, *em*,
 * [link](https://…), lists, ``` fences, ### headings, and glossary links
 * [[concept.id]] or [[concept.id|shown words]].
 */
export interface TextSection extends SectionBase {
  kind: 'text';
  title?: Bi;
  body: Bi;
  /** 'howto' renders the text as an instruction panel (how to use a widget or run a test), not as theory prose. */
  role?: 'theory' | 'howto';
}

/** A process explainer registered by id (see ExplainerReg). */
export interface ExplainerSection extends SectionBase {
  kind: 'explainer';
  explainer: string;
  /** How to use the diagram: rendered as an instruction panel attached above it, in UI type, distinct from theory prose. */
  howto?: Bi;
  /** Initial parameter values for this placement of the explainer. */
  params?: Record<string, number | boolean | string>;
  caption?: Bi;
}

/** A sandbox terminal on a simulated machine with goals checked by state. */
export interface TerminalSection extends SectionBase {
  kind: 'terminal';
  machine: 'sim';
  setup: TerminalSetup;
  tasks: Task[];
  intro?: Bi;
}

/** Quiz items inline, or ids of items from the bank (BlockModule.quiz). */
export interface QuizSection extends SectionBase {
  kind: 'quiz';
  title?: Bi;
  items: (QuizItem | string)[];
}

/**
 * A documentation-ladder task (01 §11).
 *  - 'anatomy': the page opens and the learner clicks the section that answers
 *    the question (the answer is `answer`, a section id).
 *  - 'find': a terminal task whose solution is on the page; hints follow the
 *    ladder step (DL2 fragment, DL3 page link only, DL4 nothing — the mentor
 *    asks "where did you look?").
 */
export interface DocsSection extends SectionBase {
  kind: 'docs';
  mode: 'anatomy' | 'find';
  prompt: Bi;
  ref: DocRef;
  answer?: string;
  terminal?: { setup: TerminalSetup; task: Task };
}

/** A side note. 'cost' and 'cleanup' are the screens of paid-resource lessons (01 §7.4). */
export interface CalloutSection extends SectionBase {
  kind: 'callout';
  tone: 'note' | 'warn' | 'why' | 'cost' | 'cleanup';
  title?: Bi;
  body: Bi;
}

/** An engine-specific widget registered by a module (flowlab board, cluster view…). */
export interface WidgetSection extends SectionBase {
  kind: 'widget';
  widget: string;
  props?: unknown;
}

export type Section = TextSection | ExplainerSection | TerminalSection | QuizSection | DocsSection | CalloutSection | WidgetSection;

// ── Documentation ladder (01 §11, 08 §4) ───────────────────────────────────

/** DL1 flicker · DL2 page fragment · DL3 find the flag · DL4 forcing · DL5 exam. */
export type DocStep = 1 | 2 | 3 | 4 | 5;

/** A documentation source. The ladder step is stored per source, not per concept. */
export type DocSource =
  | 'man'
  | 'help'
  | 'kubectl-explain'
  | 'kubernetes.io'
  | 'docs.docker.com'
  | 'git-help'
  | 'docs.gitlab.com'
  | 'docs.github.com'
  | 'ansible-doc'
  | 'terraform'
  | 'prometheus.io'
  | 'grafana.com'
  | 'kanban-guide'
  | 'dora.dev'
  | 'sre-book'
  | 'rfc'
  | 'mdn'
  | (string & {});

/**
 * A pointer into the offline corpus: page id + section anchor + the line to
 * highlight (a substring). `url` is used for sources not yet in the corpus.
 */
export interface DocRef {
  page?: string;
  anchor?: string;
  line?: string;
  url?: string;
  /** Short label for the chip: 'tail(1) · OPTIONS · -n'. Built from page/anchor/line if absent. */
  label?: string;
}

/** A page of the offline corpus (09 §2.6): man page, --help output, explain output or web snapshot. */
export interface DocPage {
  /** 'man/ls.1', 'help/ls', 'explain/pod.spec', 'web/kubernetes.io/concepts/workloads/pods'. */
  id: string;
  source: DocSource;
  title: string;
  /** The official page this text corresponds to. */
  url?: string;
  license?: string;
  version?: string;
  sections: DocPageSection[];
}

export interface DocPageSection {
  /** Anchor: 'NAME', 'SYNOPSIS', 'OPTIONS', 'EXAMPLES', 'SEE ALSO', 'FIELDS', or a slug. */
  id: string;
  title?: string;
  /** Plain English text, lines separated by \n. */
  body: string;
}

/** A man page carried by a shell command; becomes the corpus page `man/<name>.<section>`. */
export interface ManPage {
  section: number | string;
  sections: DocPageSection[];
  url?: string;
  license?: string;
  version?: string;
}

// ── Tasks and checks (09 §2) ───────────────────────────────────────────────

export type HintLevel = 'H1' | 'H2' | 'H3' | 'H4' | 'H5';

/**
 * A practical goal. It passes when `check` holds on the machine's facts — the
 * state, not the typed text: `mkdir -p a/b` and `mkdir a; mkdir a/b` pass the
 * same goal.
 */
export interface Task {
  id: string;
  prompt: Bi;
  check: Check;
  /**
   * The hint ladder H1–H5 (01 §16.2). The doc ladder reshapes it: at DL2 the
   * H3 hint is the page fragment of `docRef`, at DL3 only a link to the page,
   * at DL4–DL5 there are no hints (the linter enforces it).
   */
  hints?: Partial<Record<HintLevel, Bi>>;
  docRef?: DocRef;
  /** Forces a ladder step for this task (4 = forcing, requires `beyond`). */
  docStep?: DocStep;
  /** The task needs a flag or command not taught in the theory (DL4, 08 §4.1). */
  beyond?: boolean;
  /** The expected command, shown as chips under the prompt at DL1–DL2 (name only at DL3). */
  chips?: string;
  /** Tokens the AI mentor must never say for this task (09 §4.5). */
  solutionTokens?: string[];
  concepts?: ConceptId[];
}

/**
 * A check over facts. `when` is a predicate in the language of 09 §2.3
 * (see core/predicate.ts) or a function. Typed text (`term.*.line`) may be
 * looked at only in `fail[].if`, never in `when`.
 */
export interface Check {
  when?: string | ((facts: Facts, start?: Facts) => boolean);
  /** Optional match on the output of the last command (substring or RegExp). */
  stdout?: string | RegExp;
  /** Targeted explanations of expected mistakes; the first that holds is shown. */
  fail?: { if: string | ((facts: Facts) => boolean); say: Bi; concept?: ConceptId }[];
}

export interface CheckResult {
  pass: boolean;
  /** The failing explanation, when one of `fail` matched. */
  say?: Bi;
  failIndex?: number;
  matched: string[];
}

// ── Facts (dt.facts/v1, the subset tier A produces) ────────────────────────

export interface ProcFact {
  pid: number;
  ppid: number;
  uid: number;
  user?: string;
  state: 'R' | 'S' | 'D' | 'T' | 'Z' | 'I';
  cmd: string;
  argv: string[];
  [k: string]: unknown;
}

export interface FileFact {
  exists: boolean;
  type?: 'f' | 'd' | 'l' | 'c';
  /** Octal permission bits as a string: '0755'. */
  mode?: string;
  uid?: number;
  gid?: number;
  owner?: string;
  group?: string;
  size?: number;
  ino?: number;
  nlink?: number;
  mtime?: string;
  text?: string;
  target?: string;
}

export interface TermRecord {
  line: string;
  exit: number;
  /** Output with ANSI colours stripped. */
  out: string;
}

/**
 * What a machine reports about itself. Engines add their own scopes through
 * FactsProvider (containers, k8s, net, units…), using the field names of
 * 09 §2.2 so the same predicates work later on v86 and real VMs.
 */
export interface Facts {
  schema: 'dt.facts/v1';
  env: { kind: MachineKind; machine: string; kernel: string; at: string };
  user: { name: string; uid: number; gid: number };
  cwd: string;
  hostname: string;
  vars: Record<string, string>;
  procs: ProcFact[];
  /** Every path on a simulated machine, keyed by absolute path. */
  files: Record<string, FileFact>;
  /** Last 20 commands per tty: term['main']. */
  term: Record<string, TermRecord[]>;
  [scope: string]: unknown;
}

// ── Machines (09 §1.5, tier A subset) ──────────────────────────────────────

export type MachineKind = 'sim' | 'v86' | 'vm';

export type TermEffect =
  | { kind: 'clear' }
  | { kind: 'pager'; title: string; text: string }
  | { kind: 'doc'; ref: DocRef };

export interface ExecResult {
  /** Everything the command printed to the terminal (stdout and stderr in order), with \n line ends. */
  out: string;
  exit: number;
  effects?: TermEffect[];
}

/** A bus event (08 §3.0). Engines may emit their own `t` values. */
export interface SimEvent {
  t: string;
  at: number;
  machine: string;
  [k: string]: unknown;
}

/**
 * The machine interface every environment implements: the simulator now, v86
 * and real VMs later. Lessons and widgets talk only to this.
 */
export interface Machine {
  readonly kind: MachineKind;
  readonly id: string;
  /** Run one command line as if typed at the prompt. */
  exec(line: string): Promise<ExecResult>;
  /** The prompt, with ANSI colours: 'learner@trainer:~$ '. */
  prompt(): string;
  /** Tab-completion candidates for the word under the cursor. */
  complete?(line: string): string[];
  facts(scope?: string[]): Promise<Facts>;
  /** A JSON-serialisable snapshot; restore() returns the machine to it. */
  snapshot(): Promise<unknown>;
  restore(snapshot: unknown): Promise<void>;
  /** Subscribe to the event bus; returns the unsubscribe function. */
  on(fn: (ev: SimEvent) => void): () => void;
  dispose(): void;
}

/** How a simulated machine starts for a terminal section. */
export interface TerminalSetup {
  hostname?: string;
  /** Login user; created if missing. Default 'learner' (uid 1000), home /home/learner. */
  user?: string;
  cwd?: string;
  users?: { name: string; uid?: number; groups?: string[]; home?: string }[];
  files?: { path: string; content?: string; mode?: string; owner?: string; group?: string; type?: 'f' | 'd' | 'l'; target?: string }[];
  env?: Record<string, string>;
  /** Commands run as root before the learner gets the prompt. */
  script?: string[];
  /** Engine-specific setup, consumed by SetupHook with the same key. */
  ext?: Record<string, unknown>;
}

// ── The simulated machine's API for commands and engines ───────────────────

export interface UserAccount {
  name: string;
  uid: number;
  gid: number;
  home: string;
  shell: string;
  /** Supplementary group ids. */
  groups: number[];
}

export interface GroupEntry {
  name: string;
  gid: number;
}

export interface Cred {
  uid: number;
  gid: number;
  groups: number[];
}

export type FileType = 'f' | 'd' | 'l' | 'c';

export interface Stat {
  ino: number;
  type: FileType;
  /** Permission bits incl. setuid/setgid/sticky (0o7777). */
  mode: number;
  uid: number;
  gid: number;
  size: number;
  nlink: number;
  mtime: number;
  target?: string;
}

export type FsErrorCode = 'ENOENT' | 'EACCES' | 'EPERM' | 'ENOTDIR' | 'EISDIR' | 'EEXIST' | 'ENOTEMPTY' | 'EINVAL' | 'ELOOP' | 'EBUSY';

/**
 * The file system as a command sees it: relative paths resolve against the
 * shell's cwd and permissions are those of the user running the command.
 * Every method throws an FsError (engine/terminal/vfs.ts) with `code`.
 */
export interface FsApi {
  resolve(path: string): string;
  exists(path: string): boolean;
  stat(path: string): Stat | null;
  lstat(path: string): Stat | null;
  readFile(path: string): string;
  writeFile(path: string, data: string, opts?: { append?: boolean; mode?: number }): void;
  mkdir(path: string, opts?: { parents?: boolean; mode?: number }): void;
  readdir(path: string): string[];
  unlink(path: string): void;
  rmdir(path: string): void;
  rename(from: string, to: string): void;
  symlink(target: string, path: string): void;
  link(existing: string, path: string): void;
  readlink(path: string): string;
  chmod(path: string, mode: number): void;
  chown(path: string, uid: number, gid: number): void;
  utimes(path: string, mtime: number): void;
  access(path: string, mode: 'r' | 'w' | 'x'): boolean;
}

export interface ProcTable {
  list(): ProcFact[];
  get(pid: number): ProcFact | undefined;
  spawn(p: { cmd: string; argv?: string[]; uid?: number; ppid?: number; state?: ProcFact['state']; [k: string]: unknown }): number;
  /** Deliver a signal; the default action of TERM/KILL/INT is to end the process. Returns false if no such pid. */
  kill(pid: number, sig?: string): boolean;
}

/** Engine state attached to a machine may implement this to be included in snapshots. */
export interface Snapshotable {
  snapshot(): unknown;
  restore(s: unknown): void;
}

/** What commands, fact providers and setup hooks see of a simulated machine. */
export interface SimMachineApi extends Machine {
  /** The file system with root credentials and absolute paths. */
  readonly rootFs: FsApi;
  readonly hostname: string;
  users: UserAccount[];
  groups: GroupEntry[];
  user(): UserAccount;
  cwd(): string;
  /** Change user (su/login); returns false if there is no such user. */
  switchUser(name: string): boolean;
  readonly procs: ProcTable;
  /** Shell variables (exported and not), including HOME, USER, PWD, ?. */
  vars: Record<string, string>;
  /** Engine state keyed by engine name, created on first use and kept in snapshots if Snapshotable. */
  ext<T>(key: string, init: () => T): T;
  emit(ev: { t: string; [k: string]: unknown }): void;
  lookup(name: string): ShellCommand | undefined;
  /** Rewrite /etc/passwd and /etc/group from `users` and `groups`. */
  syncEtc(): void;
  /**
   * Extension (containers builder): hand the terminal to a foreground program
   * that reads lines itself — `docker exec -it web sh`, `unshare … sh`. Lines
   * typed at the prompt go to the top session until it reports `done`.
   */
  attach?(session: TerminalSession): void;
  /** Extension (containers builder): a command known only to this machine; it wins over the global registry. */
  addLocalCommand?(cmd: ShellCommand): void;
}

/** A foreground program attached to a machine's terminal (SimMachineApi.attach). */
export interface TerminalSession {
  prompt(): string;
  exec(line: string): Promise<ExecResult & { done?: boolean }>;
  complete?(line: string): string[];
}

/** What a running command receives. */
export interface CmdContext {
  /** argv[0] is the command name as typed. */
  argv: string[];
  stdin: string;
  /** True when stdout goes straight to the terminal (ls prints columns, colours). */
  isatty: boolean;
  /** Terminal width in columns. */
  cols: number;
  out(s: string): void;
  err(s: string): void;
  /** Environment of this command (shell vars + per-command assignments). */
  env: Record<string, string>;
  cwd: string;
  user: UserAccount;
  cred: Cred;
  /** File system bound to this user's credentials and cwd. */
  fs: FsApi;
  machine: SimMachineApi;
  /** Ask the terminal for a side effect: clear, pager, open a doc page. */
  effect(e: TermEffect): void;
  /** Built-ins only: change the shell's cwd / variables. */
  shell: {
    chdir(path: string): void;
    setVar(name: string, value: string | undefined, exported?: boolean): void;
    /** Run a command line in this shell (scripts, `sh -c`). */
    run(line: string, ctx?: { stdin?: string; args?: string[] }): Promise<{ out: string; err: string; exit: number }>;
    history(): string[];
  };
}

/**
 * A command of the simulated shell. Engines register theirs (docker, kubectl,
 * terraform, ansible, git, promtool…) through BlockModule.commands. The `help`
 * and `man` texts become pages of the offline documentation corpus, so the
 * doc ladder (DL3–DL5) works on every command.
 */
export interface ShellCommand {
  name: string;
  aliases?: string[];
  summary: Bi;
  /** English `--help` output. Printed automatically for `<name> --help` unless handlesHelp. */
  help?: string;
  man?: ManPage;
  handlesHelp?: boolean;
  /** A shell built-in: may call ctx.shell.chdir / setVar. Not given a /usr/bin stub. */
  builtin?: boolean;
  /** Replace an already registered command with the same name (Linux builder extending a core basic). */
  override?: boolean;
  run(ctx: CmdContext): number | Promise<number>;
  /** Extra completion words for arguments (subcommands, resource kinds). */
  complete?(args: string[]): string[];
}

/** Contributes facts[scope] for a simulated machine (containers, k8s, units…). */
export interface FactsProvider {
  scope: string;
  collect(m: SimMachineApi): unknown;
}

/** Applies TerminalSetup.ext[key] to a fresh machine (create containers, a cluster…). */
export interface SetupHook {
  key: string;
  apply(m: SimMachineApi, value: unknown): void | Promise<void>;
}

// ── Quiz items (08 §3.10, 10 §2) ───────────────────────────────────────────

/** Text of an option: Bi for prose, plain string for code/commands (shown in mono). */
export type QText = Bi | string;

export interface QuizOption {
  id: string;
  text: QText;
  correct?: boolean;
  /** Why this option is right or wrong. Required for every wrong option (each distractor is a recorded misconception). */
  why?: Bi;
}

interface QuizBase {
  id: string;
  prompt: Bi;
  concepts?: ConceptId[];
  /** Shown after any answer: the model, not just the fact. */
  explain?: Bi;
  /** Where this is explained, for the "go back" link in the feedback. */
  refs?: { lesson?: LessonId; explainer?: string; doc?: DocRef };
  /** A key item of a placement check or exit ticket. */
  key?: boolean;
}

export interface McqItem extends QuizBase {
  kind: 'mcq';
  options: QuizOption[];
}

export interface MultiItem extends QuizBase {
  kind: 'multi';
  options: QuizOption[];
}

/** Put the steps in order. `steps` are listed in the correct order; they are shuffled on screen. */
export interface OrderItem extends QuizBase {
  kind: 'order';
  steps: { id: string; text: QText; why?: Bi }[];
}

/** Match left to right. `pairs` are the correct pairs; the right column is shuffled. */
export interface MatchItem extends QuizBase {
  kind: 'match';
  pairs: { id: string; left: QText; right: QText; why?: Bi }[];
}

/**
 * Complete a command. Accepted by effect when `check` is given (the line runs on
 * a fresh simulated machine built from `setup`), otherwise by normalised match
 * against `answers`. `misconceptions` explain known wrong answers.
 */
export interface FillCommandItem extends QuizBase {
  kind: 'fill-command';
  /** Shown around the input: 'ls ___ /etc'. The learner types the whole line when absent. */
  template?: string;
  answers?: string[];
  setup?: TerminalSetup;
  check?: Check;
  misconceptions?: { match: string; why: Bi }[];
}

/**
 * "What will this print?" The reference output is produced by running
 * `command` on a simulated machine, so it never drifts from what the learner
 * sees. With `options` it is a choice; without, free text compared after
 * normalising whitespace.
 */
export interface PredictOutputItem extends QuizBase {
  kind: 'predict-output';
  command: string;
  setup?: TerminalSetup;
  options?: QuizOption[];
}

/** Click the line with the bug. `why` explains lines that are tempting but fine. */
export interface BugfindItem extends QuizBase {
  kind: 'bugfind';
  code: string;
  lang?: string;
  /** 1-based numbers of the buggy lines (any one of them counts). */
  bug: number[];
  /** Explanation per line number: for the bug and for the distractor lines. */
  why: Record<number, Bi>;
}

/** Put labels on a schematic. Slots are boxes in a small SVG; each slot has one right label. */
export interface LabelItem extends QuizBase {
  kind: 'label';
  diagram: {
    width: number;
    height: number;
    slots: { id: string; x: number; y: number; w: number; h: number; answer: string; family?: ColorFamily }[];
    /** Unlabelled connections between slots, for context. */
    edges?: { from: string; to: string }[];
  };
  labels: { id: string; text: QText; why?: Bi }[];
}

export type QuizItem = McqItem | MultiItem | OrderItem | MatchItem | FillCommandItem | PredictOutputItem | BugfindItem | LabelItem;

export interface QuizGrade {
  correct: boolean;
  /** 0..1, partial credit for order/match/label. */
  score: number;
  /** Explanations for what the learner chose (distractor whys), then the item's explain. */
  feedback: Bi[];
}

/** Confidence before the answer (01 §14.1): guessing / think so / know. */
export type Confidence = 1 | 2 | 3;

// ── Placement (01 §4) ──────────────────────────────────────────────────────

export type PlacementTask = {
  id: string;
  /** The claimed level this task belongs to. */
  level: Level;
  /** Key task: must pass regardless of the score. */
  key: boolean;
  concepts: ConceptId[];
  /**
   * Variant of the check (1, 2, …). A retake after 72 hours takes the next
   * variant; tasks without a variant are part of every variant (01 §4.1).
   */
  variant?: number;
} & ({ kind: 'quiz'; item: QuizItem } | { kind: 'task'; setup: TerminalSetup; task: Task });

// ── Exams (10 §6) ──────────────────────────────────────────────────────────

export interface Exam {
  id: string;
  block: BlockId;
  title: Bi;
  intro: Bi;
  /** Soft timer in minutes. */
  minutes?: number;
  /** Pass threshold 0..1 (plus all critical tasks). */
  pass: number;
  /** Doc sources open in the DL5 viewer; nothing else is reachable. */
  allowedDocs: DocSource[];
  tasks: ExamTask[];
  /** The situation in business words, as cards from a tracker (10 §6.1). */
  story?: Bi;
  /** 'block' (default); 'oncall' — the on-call shift; 'capstone' — the final exam. */
  kind?: 'block' | 'oncall' | 'capstone';
  /** Hard timer: the exam is submitted when time is up. Soft (default): time only goes into the protocol. */
  hardTimer?: boolean;
  /** Hours before a retake with a new variant (default 24, 10 §6.1). */
  retakeHours?: number;
  /** "Explain" questions at the end: weight 0, they give the interview-readiness mark (10 §6.1). */
  explain?: ExamExplain[];
  /** Extension: the exam runs on the learner's own VMs (tasks of kind 'real'). */
  real?: RealLab;
  /**
   * Extension (00 §6.13): the exam runs on real machines in this tab. The page
   * mounts this widget once above the tasks; it reports the facts of its
   * machines through `WidgetCtx.reportFacts`, and tasks of kind 'real' are
   * judged on them as on pasted collector blocks.
   */
  inTab?: { widget: string; props?: unknown };
}

/** An interview-style question at the end of an exam, self-checked against its key points. */
export interface ExamExplain {
  id: string;
  prompt: Bi;
  keyPoints: Bi[];
}

/**
 * A task of an exam. Tasks that share a `pool` are alternatives: the variant
 * seed picks one of them (names, ports, which fault is planted).
 */
export type ExamTask = { id: string; weight: number; critical?: boolean; beyond?: boolean; pool?: string } & (
  | { kind: 'task'; setup: TerminalSetup; task: Task }
  | { kind: 'quiz'; item: QuizItem }
  | { kind: 'real'; real: RealTask }
);

/**
 * Extension (real-machine exams, 00 §6.6, tier C): the learner's own VMs.
 * The trainer runs nothing there. The learner runs the read-only collector
 * `trainer-check-host.sh` on each machine with the arguments the exam page
 * builds from `RealMachine`, pastes the printed block, and the page judges
 * `RealTask.goals` on the facts with the same predicates as the simulator.
 */
export interface RealLab {
  /** The `dt-track` label of the VMs and the track name in the protocol. */
  track: string;
  /** What to order and how (sizes, OS, the labels `trainer=devops`, `dt-track=<track>`), in prose. */
  order: Bi;
  machines: RealMachine[];
  /** Scripts the learner reads and runs before the tasks: they install stubs and plant the faults. */
  prepare?: RealScript[];
  /**
   * Another read-only collector instead of trainer-check-host.sh, printing the
   * same dt.host-check/v1 block (Kubernetes: public/check/trainer-check.sh
   * with --machine, which adds the cluster's objects and the node's probes).
   */
  collector?: { name: string; text: string };
}

export interface RealMachine {
  /** Machine id used in goals (`on`) and in `{id}` placeholders: 'vm1', 'server'. */
  id: string;
  role: Bi;
  /**
   * Collector arguments, one per element, `{otherId}` replaced by the address
   * the learner typed for that machine: '--scope net', '--file /etc/fstab',
   * '--tcp ssh,{vm1},22', '--http portal,https://www.corp.lab/,resolve=www.corp.lab:443:{vm1}'.
   */
  collect: string[];
}

export interface RealScript {
  /** File name on the machine: 'net-b-app.sh'. */
  name: string;
  /** Machine id it runs on. */
  on: string;
  /** What it does, in one or two sentences. */
  note: Bi;
  /** The whole script (bash). */
  text: string;
}

export interface RealTask {
  prompt: Bi;
  concepts?: ConceptId[];
  /**
   * Goals judged on the pasted facts. With `on`, `check` sees that machine's
   * facts; without, it sees `{ machines: { <id>: Facts } }` for checks that
   * compare machines. The task's result is the share of goals that hold.
   */
  goals?: RealGoal[];
  /** Instead of facts: the learner pastes the output of a command (the cleanup), matched by any of `accept`. */
  paste?: { label: Bi; accept: RegExp[] };
  /** The task needs something the course never showed (DL5): tokens the mentor must never say. */
  solutionTokens?: string[];
}

export interface RealGoal {
  id: string;
  label: Bi;
  on?: string;
  check: Check;
}

// ── Process explainers (08 §3.1–3.7, §6) ───────────────────────────────────

/**
 * Colour families of the visual language (08 §6.3). Colour encodes the family,
 * never importance; state colours (ok/warn/err) are separate and always come
 * with an icon.
 */
export type ColorFamily =
  | 'kernel'
  | 'user'
  | 'process'
  | 'ns'
  | 'gauge'
  | 'l1'
  | 'l2'
  | 'l3'
  | 'l4'
  | 'tls'
  | 'l7'
  | 'cp'
  | 'node'
  | 'obj'
  | 'flow'
  | 'ci-source'
  | 'ci-build'
  | 'ci-test'
  | 'ci-deploy'
  | 'store'
  | 'neutral';

/** The card every element opens on click: what it is, who creates it, how to look at it, where it is written. */
export interface ElementCard {
  what: Bi;
  who: Bi;
  /** A command to look at it: 'ls -l /proc/$$/fd'. */
  see?: string;
  doc?: DocRef;
}

/**
 * Built-in pictograms drawn inside a node (engine/explainer/icons.ts): what
 * the block is at a glance — a browser, a server, a folder.
 */
export type NodeIcon =
  | 'browser'
  | 'server'
  | 'dns'
  | 'router'
  | 'switch'
  | 'disk'
  | 'process'
  | 'file'
  | 'folder'
  | 'user'
  | 'lock'
  | 'cloud'
  | 'container'
  | 'terminal'
  | 'database';

/** How a working node shows that it is busy: a breathing halo, a spinner (searching), typing dots (writing). */
export type NodeWork = 'pulse' | 'spin' | 'dots';

export interface DiagramNode {
  id: string;
  label: QText;
  /** A pictogram drawn in the node (or on its corner when the node is small). */
  icon?: NodeIcon;
  /** The "busy" animation while the node acts (it has a `say` at the step); by default it follows the icon. */
  work?: NodeWork;
  /** A mono value under the label, may change per step (Step.values). */
  sub?: QText;
  family: ColorFamily;
  /** bar = the kernel strip; hex = control plane; doc = API object; rack = node; buffer = queue with a fill gauge. */
  shape?: 'box' | 'bar' | 'hex' | 'doc' | 'rack' | 'pill' | 'buffer';
  x: number;
  y: number;
  w: number;
  h: number;
  card: ElementCard;
}

export interface DiagramEdge {
  undirected?: boolean;
  id: string;
  from: string;
  to: string;
  /** Every edge is labelled on the line itself (the linter fails otherwise). */
  label: QText;
  card: ElementCard;
  /** Intermediate points for an orthogonal route. */
  via?: [number, number][];
  dashed?: boolean;
  /** Where to put the label along the path, 0..1 (default 0.5). */
  labelAt?: number;
}

export interface DiagramGroup {
  id: string;
  label: QText;
  around: string[];
  family: ColorFamily;
  dash?: 'solid' | 'dash' | 'dot' | 'double';
  pad?: number;
  card: ElementCard;
}

/** Hand-laid diagram on an 8 px grid; positions are stable across steps. At most 12 nodes per screen. */
export interface Diagram {
  /** Extra space above the drawing, in diagram units. */
  topPadding?: number;
  width: number;
  height: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups?: DiagramGroup[];
}

/** A knob of the model (08 §3.1). */
export interface ParamSpec {
  id: string;
  label: Bi;
  kind: 'range' | 'toggle' | 'choice';
  min?: number;
  max?: number;
  step?: number;
  unit?: QText;
  options?: { id: string; label: Bi }[];
  default: number | boolean | string;
  /** Levels this knob is open for (beginners get them one at a time). */
  levels?: Level[];
  /**
   * The part of the system this knob changes ("What is already cached",
   * "The connection"). Knobs with the same group are shown together under it,
   * groups in the order of their first knob.
   */
  group?: Bi;
  /** Node or edge id the delta line is placed next to. */
  near?: string;
  /** The "what will happen?" question asked before the first change of this knob. */
  predict?: Prediction;
}

/** "Break it": removes or spoils one component (08 §3.7). */
export interface BreakSpec {
  id: string;
  label: Bi;
  /** Node and edge ids that stop working. */
  remove: string[];
  /** Asked before the break is switched on. */
  predict: Prediction;
  layer?: 'L1' | 'L2' | 'L3' | 'L4' | 'TLS' | 'L7';
  boundary?: 'kernel' | 'network' | 'storage' | 'process' | 'io' | 'identity';
  /** Levels this break is offered at (like ParamSpec.levels); all levels when absent. */
  levels?: Level[];
}

/** A "what will happen?" question; `resolve` reads the recomputed run and returns the right option id. */
export interface Prediction {
  prompt: Bi;
  options: { id: string; text: Bi }[];
  resolve(prev: Step[], next: Step[]): string;
}

/**
 * 'hidden' keeps an element out of the picture until a later step reveals it
 * (state 'on' or Step.reveal), so a diagram is built from zero step by step.
 */
export type ElementState = 'on' | 'off' | 'ok' | 'warn' | 'err' | 'wait' | 'hidden';

/**
 * A token moving along an edge during the transition into this step. With a
 * label it is drawn as a small card (the thing handed over: `A? shop.example`,
 * `r--`, `Permission denied`), without one as a dot.
 */
export interface Token {
  edge: string;
  label?: QText;
  reverse?: boolean;
}

/** A mark in the legend next to the diagram; `icon:<name>` shows a node pictogram. */
export type LegendMark = 'active' | 'ok' | 'err' | 'warn' | 'wait' | 'pale' | 'token' | 'say' | 'line' | 'dashed' | `icon:${NodeIcon}`;

export interface Step {
  id: string;
  /** Short label on the scrub bar: 'SYN', 'fork'. */
  label: QText;
  /** One sentence: what happened at this step. */
  caption: Bi;
  /** Node/edge ids highlighted at this step. */
  focus: string[];
  tokens?: Token[];
  /**
   * What the acting node does right now, in one full sentence, drawn as a
   * speech callout at that node: { resolver: 'The resolver looks for the address of shop.example' }.
   */
  say?: Record<string, Bi>;
  /** Element states, folded over steps 0..n (later steps override). */
  states?: Record<string, ElementState>;
  /** Hidden elements that appear from this step on (sugar for states: { id: 'on' }). */
  reveal?: string[];
  /** Node sub-values, folded over steps 0..n: { pipe: '12 KiB / 64 KiB' }. */
  values?: Record<string, string>;
  /** Fill level 0..1 of 'buffer' nodes, folded. */
  fill?: Record<string, number>;
  /** Counters shown under the diagram at this step (not folded: each step gives the full set it wants). */
  metrics?: Record<string, number>;
  /** The process stops here because of a break: where, the real tool message, why. */
  broken?: { at: string; message: string; caption: Bi };
}

export type ModelChange = { kind: 'param'; id: string; from: unknown; to: unknown } | { kind: 'break'; id: string; on: boolean };

/**
 * A process explainer is a small deterministic model that builds steps from
 * parameters (08 §3.1). `run` must be pure and fast (≤ 16 ms); `explainDelta`
 * says in one sentence what changed and why.
 */
export interface ProcessModel<P extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  title: Bi;
  block: BlockId;
  summary?: Bi;
  /** "How to use": shown above the diagram before the first step, naming the first control to press. */
  intro?: Bi;
  /** What the colours, shapes, pictograms and moving cards mean; drawn next to the diagram. */
  legend?: { mark: LegendMark; text: Bi }[];
  /** Says where the process stopped after a break ("The check stopped"); neutral "Stopped" when absent. */
  stopLabel?: Bi;
  concepts?: ConceptId[];
  diagram: Diagram;
  params: ParamSpec[];
  breaks: BreakSpec[];
  /** Fit the camera to visible elements without moving their coordinates. */
  frame?: 'fixed' | 'visible';
  /** Labels of the metrics steps report. */
  metrics?: { id: string; label: Bi; unit?: QText }[];
  /**
   * Id of a metric that holds the elapsed time. The explainer then draws a
   * DevTools-style waterfall next to the diagram: one bar per step that took time.
   */
  waterfall?: string;
  run(p: P, broken: ReadonlySet<string>): Step[];
  explainDelta(prev: Step[], next: Step[], change: ModelChange, prevParams: P, nextParams: P): Bi;
}

// ── Registrations ──────────────────────────────────────────────────────────

/** What a mounted widget returns. */
export interface Mounted {
  dispose(): void;
  /** What is on screen in words, for screen readers and the AI mentor. */
  describe?(): string;
}

export interface ExplainerCtx {
  level: Level;
  params?: Record<string, number | boolean | string>;
  /** Called once when every step has been seen (marks the section done). */
  onComplete(): void;
  record(ev: NewEvent): void;
  openDoc(ref: DocRef): void;
  /** Set by exam pages with `Exam.inTab`: a lab widget reports the facts of its machines by id. */
  reportFacts?(machines: Record<string, Facts>): void;
}

/**
 * An explainer registered by id. Most are built from a ProcessModel with
 * `fromModel(model)` (engine/explainer); a block may also mount anything custom.
 */
export interface ExplainerReg {
  id: string;
  title: Bi;
  block: BlockId;
  summary?: Bi;
  concepts?: ConceptId[];
  /** The model, when built with fromModel — the linter checks its diagram. */
  model?: ProcessModel<any>;
  mount(el: HTMLElement, ctx: ExplainerCtx): Mounted;
}

export interface WidgetCtx {
  lessonId?: LessonId;
  sectionId?: string;
  level: Level;
  /** Mark the section done. */
  complete(): void;
  record(ev: NewEvent): void;
  openDoc(ref: DocRef): void;
  /** Set by exam pages with `Exam.inTab`: a lab widget reports the facts of its machines by id. */
  reportFacts?(machines: Record<string, Facts>): void;
}

/** An engine-specific section kind (`{ kind: 'widget', widget: id }`). */
export interface WidgetReg {
  id: string;
  mount(el: HTMLElement, props: unknown, ctx: WidgetCtx): Mounted;
}

/** A section of the settings page (the AI builder adds "Your AI"). */
export interface SettingsSectionReg {
  id: string;
  order: number;
  title: Bi;
  mount(el: HTMLElement): Mounted;
}

/** The AI mentor hook (01 §16, 09 §4). The engine never calls it in exam mode. */
export type MentorMode = 'explain' | 'practice' | 'docs' | 'free' | 'review';

export interface MentorRequest {
  mode: MentorMode;
  question: string;
  lang: Lang;
  level: Level;
  lessonId?: LessonId;
  task?: { id: string; prompt: string; solutionTokens?: string[] };
  /** Concepts introduced so far: the mentor must not use others. */
  introduced: ConceptId[];
  /** Documentation opened during this task (for the DL4 "where did you look?" mode). */
  docTrail: { page: string; anchor?: string }[];
  /** What is on screen now, from Mounted.describe(). */
  screen?: string;
}

export interface Mentor {
  id: string;
  ready(): boolean;
  ask(req: MentorRequest): Promise<string>;
  /**
   * Optional raw chat with the learner's model, for trainers that bring their
   * own system prompt (the mock interviewer, rubric grading, 10 §9.3).
   * Without it the career block packs the conversation into one ask().
   */
  chat?(messages: ChatMessage[], opts?: { temperature?: number; json?: boolean }): Promise<string>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * What a block or engine module exports as default (via defineModule).
 * Block modules live in src/blocks/<folder>/index.ts, engine modules in
 * src/engine/<name>/module.ts; both are discovered automatically.
 */
export interface BlockModule {
  blocks?: Block[];
  lessons?: Lesson[];
  concepts?: Concept[];
  /** Bank items, referenced by id from QuizSection.items and the review queue. */
  quiz?: QuizItem[];
  explainers?: ExplainerReg[];
  commands?: ShellCommand[];
  docs?: DocPage[];
  exams?: Exam[];
  widgets?: WidgetReg[];
  facts?: FactsProvider[];
  setup?: SetupHook[];
  settings?: SettingsSectionReg[];
  mentor?: Mentor;
}

// ── Progress store events (09 §3, 01 §2.3) ─────────────────────────────────

export type ConceptState = 'unseen' | 'placed' | 'introduced' | 'practicing' | 'mastered' | 'lapsed';

/**
 * The append-only event log. Every state of progress is recomputed from it.
 * Events are self-contained (they carry the concept ids they affect), so the
 * reducer does not depend on the content registry. Engines may log their own
 * events with kinds starting with 'x.'.
 */
export type NewEvent =
  | { kind: 'level.set'; block: BlockId; level: Level; via: 'choice' | 'placement' }
  | { kind: 'placement.result'; block: BlockId; claimed: Level; passed: boolean; score: number; failed: string[]; concepts: ConceptId[]; gaps: ConceptId[] }
  | { kind: 'lesson.open'; lesson: LessonId }
  | { kind: 'section.done'; lesson: LessonId; section: string }
  | { kind: 'lesson.done'; lesson: LessonId; concepts: ConceptId[] }
  | { kind: 'quiz.answer'; item: string; correct: boolean; score: number; confidence: Confidence; first: boolean; concepts: ConceptId[]; context: 'lesson' | 'review' | 'placement' | 'exam' }
  | { kind: 'task.pass'; task: string; lesson?: LessonId; hintLevel: number; docStep: DocStep; docOpened: boolean; concepts: ConceptId[]; source?: DocSource }
  | { kind: 'hint.open'; task: string; hint: HintLevel }
  | { kind: 'doc.open'; page: string; source: DocSource; anchor?: string; via: 'terminal' | 'docref' | 'search' | 'hint' | 'exam' | 'glossary' }
  | { kind: 'doc.step'; source: DocSource; step: DocStep; block: BlockId }
  | { kind: 'explainer.step'; explainer: string; step: number; total: number }
  | { kind: 'explainer.predict'; explainer: string; about: string; choice: string; correct: boolean }
  | { kind: 'explainer.done'; explainer: string }
  | { kind: 'exam.result'; exam: string; mode: 'exam' | 'training'; score: number; passed: boolean }
  | { kind: 'mentor.ask'; mode: MentorMode; task?: string }
  | { kind: 'progress.export' }
  | { kind: 'progress.import'; added: number }
  | { kind: 'reminder.shown' }
  | { kind: 'reminder.dismissed' }
  | { kind: `x.${string}`; [k: string]: unknown };

export type StoreEvent = NewEvent & { id: string; t: string };
