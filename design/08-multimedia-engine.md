# 08. The interactive textbook engine: primitives, visual language, process explanations and the documentation ladder

Design document for the role "multimedia and explorable explanations designer, frontend architect". Version 2, 18.11.2026. Rewritten after reviews by roles 01 (andragogy) and 09 (runtimes and AI) and after the owner's additional requirements R1–R12. Builds on the checklist `source/checklist.txt`, on the code of the Sankofa special-projects engine (`sankofa-int/web/src/features`, `.../mechanics`), on the concept graph and lesson anatomy from 01, and on the runtime and checks contract from 09.

The document answers six questions. What the shared engine is built from and what we take from Sankofa. Which primitives are needed so that a process explanation can be turned, broken and rewound rather than watched like a video. How the engine trains the habit of reading documentation: from a blinking link to an exam where only the official documentation is open. What the visual language looks like. Which process explanations exist in each block and how they are laid out by screen. In what format all of this lives in the content and how the build checks it.

The order of priorities is set by the owner (R1) and determines how the engine is built. The core of the product is three things: a coherent textbook with a strict order of introducing concepts, multimedia storytelling (process explanations), and the need to dig into documentation. Practice rests on these three. That is why the engine has no screen where knowledge is available only through an action: the main text reads without a single click, and interactivity checks and deepens.

What is not described here and where it lives. Lesson content, module order and screen texts belong to the block documents: 02 (Linux), 03 (networks), 04 (containers), 05 (Kubernetes), 06 (Git, CI/CD, IaC, monitoring), 07 (methodology). The concept graph, lesson anatomy, the support ladder and the AI mentor rules are in 01. Simulators (Stand, netlab, dsim, kube-lite), v86, facts and predicates, storage, the neural network key, the `trainer-check` agent and real VMs are in 09. The question bank and exams are in 10. This document fixes the contract between them and the engine.

---

## 0. Decisions in brief

| Question | Decision | Why |
|---|---|---|
| Architecture | TypeScript without a UI framework, Vite, DOM through `h()`, each widget is a separate on-demand chunk (like `MODULES` in Sankofa's `host.ts`) | Matches Sankofa and 09; a virtual DOM gives nothing to live SVG diagrams |
| Style | One: the engineering drawing. No ink, characters, plot or decoration (R4, R5) | A metaphor is allowed as one sentence of text; the drawing always shows the mechanism |
| Animation | Three kinds of motion (movement along an edge, appearance and disappearance, change of a value) plus highlighting; 180–320 ms; autoplay no longer than 5 s | R4 and rule R8 from 01 §8 |
| Basis of an explanation | `ProcessModel`: a pure function `run(params, broken) → steps` and `explainDelta` | Changing a parameter recomputes the process immediately, with a "what changed" text next to it (R4) |
| Catalog | Process explanations exist in every block, full list in §7; at least one mechanism explanation per module, otherwise a build warning | R3 |
| Ownership | The content of explanations belongs to the block documents; 08 owns the primitives, process models (parameters, steps, breakages), the visual language, the format and engine acceptance | One thing in two places guarantees divergence |
| Documentation ladder | Five rungs per block: `docref` → `docview` with highlighting → `findflag` → enforcement with the AI asking "where did you look?" → `docexam`. Offline corpus of man, `--help`, `kubectl explain` and snapshots of official sites | R2 |
| Content format | The lesson format of 01 §7 (`concepts.yaml`, `screens`, `L0/L1/L2`, `introduces` ≤ 1, `uses`, `forward`); 08 adds the `widgets` field and ladder data | One graph, one validator |
| Checks | The predicate language and goal format of 09 §2.3–2.4; `bind` on diagrams is the same language | One implementation of `evaluate`, one set of vectors |
| Default environment | As decided in 09 §1: tier A (simulators) for instant start, tier B (v86) where a real kernel is needed, tier C (real VMs) at real stages | The engine works over the `Machine` interface and the bus without knowing what is behind it |
| Multiple machines | 3–4 v86 instances in Web Workers, our JS switch with real L2, visible to the learner (`fabric`); hybrid Kubernetes: kube-lite control plane, a real kubelet agent through crun on v86 nodes (`cluster`) | R11 |
| Real stage | `realstage`: the trainer guides and checks but does not execute; a cost counter; cleanup is mandatory | R12 |
| Fonts | Literata (text), Inter (interface and diagram labels), IBM Plex Mono (code, values, terminal) | Sankofa's magazine presentation (R5); all three have full Cyrillic |
| Second screen via QR | "Continue reading on the phone" — right away, without a server. "Diagram on a second screen" — in v2 through `dt-api /api/pair` | SDP does not fit into a QR code, the camera on the laptop is closed by the policy of 09 §6.4 |
| Sound | Not in the MVP | A decorative layer with no learning payoff |

---

## 1. What we take from other people's experience

The explanations we model ourselves on fall into three kinds, and each gives one rule.

**An explanation you can touch.** Bret Victor in the essay "Explorable Explanations" (2011) formulated the main point: the reader must be able to change the author's assumption and immediately see the consequence. Bartosz Ciechanowski (ciechanow.ski: "Mechanical Watch", "GPS", "Internal Combustion Engine") takes this to the limit: every illustration is a small live model with one or two sliders, and the text never describes what the reader can turn by themselves. Josh Comeau (joshwcomeau.com) shows how to make such a model part of a coherent text: calm typography, soft transitions, not a single superfluous element. Red Blob Games (Amit Patel) links diagram and code: hover over a line and part of the picture is highlighted. Hence the first rule: **every diagram has at least one handle, its effect is visible within 100 ms, and next to it, in words, is what changed**.

**An explanation that leads.** Scrollytelling at NYT and The Pudding, and in our case Sankofa scenes: a sticky scene, text floating alongside, the picture changing with scroll progress. This works well for sequential processes: the path of a packet, building an image, the path of `kubectl apply`. Hohman and co-authors in "Communicating with Interactive Articles" (Distill, 2020) brought research and practice together: interactivity helps retention when it lowers cognitive load and does not hide the main text behind an action. Hence the second rule: **the main knowledge reads without a single click; interactivity checks and deepens**.

**An explanation that trains.** Learn Git Branching (fully client-side): you type a command and the commit graph is redrawn next to it. Flexbox Froggy: a short task, instant check. Killercoda and iximiuz Labs: real machines, a scenario text alongside and a check script; Ivan Velichko has exactly our genre — "How Container Networking Works: Building a Bridge Network From Scratch". Hence the third rule: **every mechanism screen ends with an action with a check**, and complex topics have a "do it yourself by hand" mode.

What we do not take. Hand drawings, characters and lines of dialogue (including "the server says: I don't know, ask .com"), comics, coffee shops and rooms. Julia Evans's comics and DNSimple's "How DNS Works" are good as a genre, but they are the opposite of our style (R4). A metaphor is allowed as one sentence of text ("a port is a door number in a house"); it is not in the drawing. There is no game wrapper either: no points, no lives, no character mentors. Progress means checks marked as passed and exams completed.

---

## 2. What we reuse from the Sankofa engine

The Sankofa engine is written in plain TypeScript without a framework, built with Vite, the DOM is built with the `h()` helper, and each special project and its mechanics are loaded as a separate on-demand module (`MODULES` in `host.ts`). This is the architecture the trainer needs: the shell is small, and each explanation and each simulator arrives as a separate chunk.

| Sankofa piece | What it does there | How we use it | Changes |
|---|---|---|---|
| `model.ts`: `Bi`, `Block`, `Scene`, `validateFeature`, `publishFeature` | Bilingual scenes in YAML, build-time validation, dropping `hold` blocks | The bilingual `Bi` type, `draft`/`hold`, the build-time validator. The lesson unit is the screen of 01 §7, not a Sankofa scene | The lesson format is 01; we add `widgets`, `doc_step`, `doc`, `beyond`, `model` (§9) |
| `draft` / `hold` + the two-source rule | Text does not ship without an editor's pass; a fact without a second source does not ship | A technical fact with `hold: true` does not ship without two confirmations: primary documentation (man, specification, project docs) **and** a check on the stated version (a golden recording from 09 §1.3 or a stand) | In `check:` we write what is missing |
| `scroll.ts`: `Scroller`, `sceneProgress`, `sceneAt`, lazy `img[data-src]` | Scene progress as `--p`, current scene by the reading line | Long processes per rule R15 from 01 §8: one scroll scene is one transition between components | `scrub` mode: scrolling sets the stepper step, handles take over control (§3.2) |
| `layers.ts` + `ArtLayer` (`depth`, `state`, `open`) | A layered drawing, a layer per state | Image layers, overlay lower/upper/merged, "hardware → VM → containers" towers | Layers are SVG drawing plates, not raster tracings; parallax is off |
| `ink.ts` | An ink drawing draws itself as you scroll | **Not used.** We take only `data-fade` (element appearance) and `data-develop` as a smooth diagram state transition, plus a deterministic seeded random for layout tests | No hand drawing anywhere |
| `calm.ts`: `isCalm`, `onCalm` from `prefers-reduced-motion` | Calm mode | The same source of truth plus an explicit "step by step" switch in the lesson panel | Stepping is a way of learning, not only reduced motion; the system setting turns it on by default |
| `FlashGate` (≤ 3 flashes per second, WCAG 2.3.1) | Flash limiter | Flashes on a packet drop, RST, OOM, 5xx | None |
| `qr.ts`: own QR encoder (byte mode, level M, versions 1–10, up to 213 bytes), `isPhone` | Open the mode on a phone | "Continue reading on the phone" (§3.20) | Scene snapshot: step, lens, handle values |
| `forever-changes/lenses.ts`: a radiogroup with arrow keys, an empty lens | One scene through the eyes of different witnesses | One event through the eyes of Dev / Ops / manager / user / security; the empty lens is the one that did not report (no monitoring) | `lensPane` moves to `engine/lenses.ts` |
| `decay.ts` (`decayAt`: level by progress with a smooth transition) | Page decay by chapter | As a pure "value by progress" function for gauges (cgroup memory, request queue) | Arithmetic only; no kinetic decay effects |
| `mechanics/checks` (ledger of checks, statuses) | "How we checked" | "How we know this" at the end of a lesson: sources and the version it was checked on | Agents are replaced with `doc` and `lab` |
| `host.ts` / `index.ts` | A stub in the main bundle, the host on first visit, the module on open | The lesson catalog in the main bundle, the lesson host and every widget on demand | None |
| Glossary links `[[id\|words]]` + an overlay card with return | Terms lead to cards | Concept cards of the 01 graph (`concepts.yaml`); the lesson, terminal and simulator do not lose state | A link to a concept not introduced on every allowed learner path is a build error |
| `clap.ts` + `lib/sound` | WebAudio sound synthesis | Not in the MVP | Possibly in v2 as the single "check passed" signal |

We also do not take the kinetic decay effects (`decay-fx`, `trip-fx`, viscous scrolling, doubled text), the camera pulse and the vibro-bass: in a textbook they get in the way of reading.

---

## 3. Primitives

All primitives live in `web/src/engine/` and are registered as widget kinds that a lesson screen names in YAML (`widget: stepper`, `widget: terminal` …). Each is a module with its own dynamic `import()` that exports `mount(ctx, spec): WidgetInstance`.

```ts
interface WidgetInstance {
  /** State for progress and for QR: small and serializable. */
  snapshot(): unknown;
  restore(s: unknown): void;
  /** What is on the screen right now, in words: for the screen reader and the AI mentor (§3.21). */
  describe(): string;
  dispose(): void;
}
```

### 3.0. Event bus

Diagrams do not poll the environment, they subscribe to its events. All environments expose the bus through the `Machine` interface (09 §1.5): tier A simulators, the v86 service agent of tier B (`watch` mode, 09 §1.4), the JS switch (§3.17) and the hybrid node agent (§3.18). The type below replaces version 1; 09 §1.3 refers to it.

```ts
type NsKind = 'mnt' | 'pid' | 'net' | 'ipc' | 'uts' | 'user' | 'cgroup' | 'time';
type Base = { at: number; machine: string };      // at — monotonic environment time, ms; machine: 'host', 'node-1', 'sim'
type SimEvent = Base & (
  | { t: 'proc.spawn'; pid: number; ppid: number; tid?: number; cmd: string; nspid: number[]; ns: Partial<Record<NsKind, string>>; cgroup: string; uid: number }
  | { t: 'proc.exec'; pid: number; path: string }
  | { t: 'proc.signal'; pid: number; sig: string; from: number; handled: boolean }
  | { t: 'proc.exit'; pid: number; code: number; reason?: 'oom' | 'signal' | 'normal' }
  | { t: 'ns.create'; kind: NsKind; id: string; by: number }
  | { t: 'ns.enter'; pid: number; kinds: NsKind[]; target: number }
  | { t: 'cgroup.set'; path: string; key: string; value: string }
  | { t: 'cgroup.usage'; path: string; memory: number; cpu: number; pids: number }
  | { t: 'cgroup.event'; path: string; key: 'oom' | 'oom_kill' | 'max' | 'nr_throttled'; count: number }
  | { t: 'fs.mount'; type: string; target: string; lower?: string[]; upper?: string; ns: string }
  | { t: 'fs.copyup'; path: string; fromLayer: string }
  | { t: 'net.link'; op: 'add' | 'del' | 'up' | 'down' | 'move'; name: string; kind: 'veth' | 'bridge' | 'vxlan' | 'wireguard' | 'eth'; peer?: string; ns?: string; master?: string }
  | { t: 'l2.frame'; port: string; src: string; dst: string; ethertype: number; vlan?: number; summary: string }
  | { t: 'net.arp'; op: 'request' | 'reply'; ip: string; mac?: string }
  | { t: 'net.packet'; id: string; from: string; to: string; via?: string; layers: PacketLayers; verdict?: 'ok' | 'drop' | 'rst' | 'nat' | 'reject' }
  | { t: 'net.rule'; table: 'nat' | 'filter' | 'mangle' | 'raw' | 'ebpf'; chain: string; rule: string; verdict: 'jump' | 'dnat' | 'snat' | 'accept' | 'drop' | 'reject' | 'return'; packet: string }
  | { t: 'net.conntrack'; op: 'new' | 'update' | 'destroy'; orig: string; reply: string }
  | { t: 'dns.query'; id: string; name: string; type: string; server: string; answer?: string[]; ttl?: number; cached?: boolean; rcode?: string }
  | { t: 'img.layer'; digest: string; size: number; instruction: string; cached: boolean }
  | { t: 'log.line'; source: string; stream: 'stdout' | 'stderr' | 'journal'; text: string }
  | { t: 'k8s.object'; verb: 'create' | 'update' | 'delete' | 'bind'; kind: string; name: string; ns?: string; by: string; rv: string }
  | { t: 'k8s.watch'; component: string; kind: string; name: string }
  | { t: 'k8s.reconcile'; controller: string; key: string; desired: unknown; actual: unknown; action: string; iteration: number }
  | { t: 'k8s.status'; kind: string; name: string; phase: string; reason?: string }
  | { t: 'k8s.lease'; node: string; renewed: boolean }
  | { t: 'node.agent'; node: string; state: 'up' | 'down'; pods: string[] }
  | { t: 'doc.open'; source: string; anchor?: string; via: 'terminal' | 'docref' | 'search' | 'hint' }
  | { t: 'cmd.done'; tty: string; line: string; exit: number }
);
```

Switch frames are thinned out for the diagram to 20 events per second; per-port counters are not thinned. Any live session can be recorded (`op: 'record'`, 09 §1.3) and played back in the stepper as a debrief.

### 3.1. Process model (`ProcessModel`)

This is the main primitive of the document. A process explanation is not a recorded tape of events but a small deterministic model that builds steps from parameters. Only this way will changing TTL to 0 add queries to the root, and "remove the scheduler" stop the trace at the right place (R4).

```ts
// web/src/engine/process-model.ts
export interface ParamSpec {
  id: string;                         // 'ttl', 'replicas', 'memory.max', 'tcp.window'
  label: Bi;
  kind: 'range' | 'toggle' | 'choice';
  min?: number; max?: number; step?: number; unit?: string;
  options?: { id: string; label: Bi }[];
  default: number | boolean | string;
  levels?: Level[];                   // at which levels the handle is open (L0 — one at a time)
}
export interface BreakSpec {
  id: string; label: Bi;
  remove: string[];                   // which nodes and edges are switched off
  layer?: 'L1' | 'L2' | 'L3' | 'L4' | 'TLS' | 'L7';   // for network breakages (§3.7)
  boundary?: 'kernel' | 'network' | 'storage' | 'process' | 'io' | 'identity';   // for container breakages
  predict: QuizSpec;                  // question before switching on
}
export interface Step {
  id: string; label: Bi;              // short label on the timeline: 'SYN'
  at: number;                         // model time, ms
  events: SimEvent[];                 // what changes on the diagram
  caption: Bi;                        // one sentence "what happened"
  focus: string[];                    // ids of nodes and edges to highlight
  metrics?: Record<string, number>;   // counters: rtt, memory, queries, ready
}
export interface ProcessModel<P = Record<string, unknown>> {
  id: string;
  params: ParamSpec[];
  breaks: BreakSpec[];
  run(p: P, broken: ReadonlySet<string>): Step[];                 // pure function; Vitest
  explainDelta(prev: Step[], next: Step[], changed: string): Bi;   // "what changed and why" text
}
```

Rules.

1. The stepper timeline is the result of `run(params, broken)`. Recomputation and redraw fit into 100 ms (the model itself into 16 ms). The stepper stays on the step with the same `id`; if that step no longer exists, on the nearest one by `at`.
2. Under the diagram (on a wide screen, to the right, in the margin) is the **"What changed"** plate: the `explainDelta` text and the difference in metrics. Example: "TTL 300 s → 0 s: the answer is no longer cached, every query again goes to the root, `.com` and the authoritative server: +3 queries, +84 ms".
3. "Break it" is also a model input: `broken` removes nodes and edges, the model builds the process without them, and the break is drawn in place with a label and the tool's real message.
4. The model must match the environment. CI runs `run(defaults)` and a simulator recording (or a golden recording of the real tool, 09 §1.3) on the same scenario and compares the event sequences. A mismatch is a red build.
5. Where behavior is more complex than arithmetic (kube-lite, netlab), `run` runs the scenario in a copy of the simulator with the parameters rather than duplicating the logic.
6. Numbers the model takes from the world (VM start time, memory overhead, intercontinental link latencies) live in data with a source and `hold`, not in code.

In the screen YAML, parameters are listed, not programmed:

```yaml
- widget: stepper
  model: dns-resolve                 # web/src/models/dns-resolve.ts
  params: { ttl: { default: 300, min: 0, max: 86400 }, cache: { default: true } }
  breaks: [authoritative-down, wrong-a-record]
```

### 3.2. Stepper (`stepper`)

A process stretched out in time is shown as a sequence of steps with a timeline at the bottom. The timeline can be dragged like a video; the steps are marked and labeled on it ("SYN", "SYN-ACK", "ACK"). The "back/forward" buttons and ←/→ move one step, space pauses or plays at 0.25× / 1× / 4×. Continuous playback stops after 5 seconds and waits for a key press (01 §8 R8).

The diagram state at step `n` is a fold of the events of steps `0..n` (`reduce(steps.slice(0, n+1).flatMap(s => s.events), apply, initial)`), so rewinding does not roll anything back by hand but recomputes the picture. There are two sources: `model` (the main one, with handles) and `recording` (a recording of the learner's live session; handles are inactive in this mode and labeled: "this is a recording of your session; to change parameters, open the model").

In a scroll scene the stepper is tied to `--p`; if the learner grabs the timeline or a handle, the link to scrolling is released until they leave the scene. In calm mode transitions are instant. One stepper per screen.

### 3.3. Sequence diagram (`seq`)

Participants as columns, time from top to bottom, messages as arrows with a label **on the line** (`SYN seq=0 win=64240`, `Q A shop.example.com RD=1`). Latency is visible as the slope of an arrow: RTT is a handle. Some arrows can be marked "encrypted" (a lock on the arrow, content hidden until click); this is how TLS 1.3 is shown. `seq` works on top of the same `ProcessModel` as `packets`: above the diagram is a "topology / sequence" switch, and clicking an arrow opens the same envelope with fields as in the packet animator. Needed for TCP, TLS, DNS, DHCP, ARP, SSH and for every protocol card (§3.14).

### 3.4. Live diagram (`diagram`)

A diagram is described declaratively: nodes, edges, groups and bindings. Rendering is SVG, the layout is set by the author by hand on an 8 px grid: a teaching diagram needs positional stability (a node that was on the left stays on the left), and automatic layout makes diagrams unrecognizable from step to step.

```yaml
diagram:
  id: ns-pid
  viewBox: "0 0 960 540"
  nodes:
    - { id: kernel, kind: kernel, at: [0, 440, 960, 100], label: { ru: "Ядро Linux", en: "Linux kernel" },
        explain: { ru: "Одно на всю машину. Посмотреть: uname -r", en: "..." } }
    - { id: sh, kind: process, at: [80, 120], bind: "procs[cmd=sh][ns.pid!=@host.ns.pid]",
        label: { ru: "sh", en: "sh" }, explain: { ru: "...", en: "..." } }
  groups:
    - { id: pidns, kind: ns.pid, around: [sh], bind: "ns[kind=pid][id=@ns(sh,pid)]" }
  edges:
    - { from: sh, to: kernel, kind: syscall, label: { ru: "clone(CLONE_NEWPID)", en: "clone(CLONE_NEWPID)" } }
```

`bind` is the predicate language of 09 §2.3 over `dt.facts/v1` facts and bus state; one `evaluate` evaluator for checks and for diagrams. A node with no match is shown dashed as "does not exist"; appearance and disappearance use `data-fade`. Under every diagram a text description is generated automatically for the screen reader and the AI: "Process sh: PID 1 inside the PID namespace, PID 4127 on the host".

The build checks the style rules (R4, "one screen, one idea"): no more than 12 nodes; every edge has a `label`, otherwise the build fails; every node has an `explain` card ("what it is, who creates it, which command shows it"); there are no `kind: character | illustration` elements and no links to raster drawings.

### 3.5. Terminal and diagram side by side (`split`)

The main working view of practice. On the left (or at the bottom on a phone) the terminal, on the right a diagram bound to the same machine. Type `unshare --pid --fork --mount-proc sh` and a PID namespace frame appears around the new process, and the number label shows `1 | 4127`: inside and from the host. Above the diagram is an "inside / from the host" viewpoint switch.

On a `lab` screen the diagram is passive: it reacts to the terminal but is not controlled itself. Handles and "break it" live on the neighboring `diagram` screen (01 §8 R12, one interaction mode per screen). For screens without L0, combining is allowed with the `combine: true` flag; the build checks that `levels` contains no L0.

Layout: CSS grid, `grid-template-columns: minmax(28rem, 1fr) 1fr` from 1024 px; below that, "Terminal / Diagram" tabs with a "changes on the diagram" dot. The divider can be dragged and controlled with keys (`role="separator"`, `aria-valuenow`).

### 3.6. Terminal (`terminal`)

Rendering is xterm.js 6.0.0 (`@xterm/xterm`, the `fit` and `web-links` addons), loaded only with the first terminal. Behind it is `Machine.tty()` (09 §1.5): the Stand or v86. The engine adds four things.

1. **Chips** under the input line: the next expected command split into tokens. On a phone this is the main input method. Chips are governed by the documentation rung (§4): rungs 1–2 — the full command; rung 3 — only the command name; rungs 4–5 — no chips. A command suggested by the AI becomes an "insert" chip; the learner presses Enter (09 §4.5).
2. **Output line breakdown**: clicking a line of `ps`, `ip a`, `docker history`, `kubectl get pods` opens a popover with a breakdown of the columns from the lesson dictionary and a `docref` to the man section where the column is described. For output that is not broken down, "Ask" in `explain-output` mode.
3. **Screen goals** on the right above the terminal. An item is checked off when the goal predicate (09 §2.4) passes on facts, not on the command text: `docker run -d --name web nginx` and `docker run --name=web -d nginx` count the same.
4. **Rollback**: "Reset screen" returns the machine to the snapshot taken at the start of the screen. Nothing done on one screen breaks the next.

The commands `man X`, `X --help` and `kubectl explain` work in the terminal as real ones and at the same time open the same page in the `docview` panel (§4.1). The terminal theme is in §6.5.

### 3.7. "Break it" and the "where did it break" question (`breakit`, `layerq`)

A row of toggles above the diagram, each switching off one part of the mechanism (the model's `BreakSpec`). The consequence is shown in three places at once: on the diagram (the broken node outlined in the error color, a ⨯ mark and a label), in the terminal or output panel (the tool's real message: `curl: (60) SSL certificate problem: certificate has expired`, `0/3 nodes are available: 3 Insufficient memory.`) and in the "What changed" plate.

Before switching on, the learner must answer a prediction question ("the pods will stay Pending / will crash / nothing will change"). The prediction counts as a mini comprehension check and carries no penalty.

**`layerq`** is the mandatory first step of any "break it" and any troubleshooting task in networks, container networking and Kubernetes networking (R8: "first ask which layer broke"). The learner picks a layer: L1, L2, L3, L4, TLS, L7; at L0, in words: "wire and neighbors / address and route / port and connection / encryption / the request itself". Only after that do the terminal and hints open. The answer is recorded separately (metacognition, 01 §12.1). The debrief shows at which layer the cause was and which command proves it. The same form for containers asks for the boundary ("kernel / network / storage / process and signals / input-output / configuration and identity", §7.4.4), and for Kubernetes networking, the link in the DNS → Service → EndpointSlice → pod → NetworkPolicy chain.

### 3.8. Packet animator (`packets`)

A packet is drawn as a stack of nested envelopes: Ethernet outside, IP inside it, TCP or UDP inside that, TLS inside that, HTTP inside that. At each device the envelope opens up to the layer that device reads. A switch looks only at the MAC. A router opens IP, decrements TTL by 1, recomputes the checksum and **puts on a new Ethernet envelope** (the old MACs are crossed out, the new ones written in); without this the learner will decide that the destination MAC is the server's MAC. NAT rewrites the source address and port (the old value crossed out, the new one next to it) and adds a row to the translation table. A load balancer has an "L4 / L7" toggle: L4 sees only IP and port and does not open TLS; L7 terminates TLS and reads HTTP. This way the TCP/IP model becomes a question of "who reads which layer", and the "L4 load balancer / L7 load balancer" vocabulary acquires meaning.

Trajectories follow the diagram edges, with no more than 6 envelopes in flight. Clicking an envelope stops the animation and expands the headers with real fields (`src 192.0.2.23:51544 → dst 203.0.113.10:443, flags S, seq 0, win 64240, ttl 64`) in two views with synchronized highlighting: a field tree and hex. The panel at the bottom shows the same packet as a line, like `tcpdump -n`. For tunnels (VXLAN, WireGuard, IPsec) the envelope is double: the outer header of the nodes and the inner header of the pods, both visible at once. Flashes on drops and RSTs go through `FlashGate`.

### 3.9. Block constructor (`constructor`)

A palette on the left, a field on the right, a check on the "Run" button. Used in "Kubernetes from blocks", in assembling a CI/CD pipeline and in assembling a Dockerfile. A block is a component with inputs and outputs (the scheduler has the input "pods without a node" from the API and the output "binding to a node" into the API). A connection is made by dragging from an output to an input; incompatible ports do not connect and explain why ("the scheduler does not write to etcd directly: everything stored goes through the API server"). A block becomes available in the palette only after the screen where its concept is introduced; before that it is visible as a silhouette.

Dragging uses Pointer Events without a third-party library; a keyboard method (Tab to the block, space to "pick up", arrows, space to "drop", announcement via `aria-live`) and a "tap-tap" method for phones are mandatory (WCAG 2.5.7). Trap blocks are set per level: `traps: { L0: 0, L1: 2, L2: 4 }`.

"Run" runs a scenario through the same model: the request travels along the edges, and on each block what it did is highlighted. If a block is missing, the trace stops at the gap with an explanation of which component is responsible for this.

### 3.10. Check widgets (`quiz`)

Question content belongs to the block documents and 10; here are the appearance and the check.

| Type | What it looks like | How it is checked |
|---|---|---|
| `choice` | One or several options | Exact set match; each wrong option has its own explanation |
| `order` | Drag steps into order | Partial credit for the longest correct subsequence; explanation of the first divergence |
| `match` | Connect left and right | Set of pairs |
| `hotspot` | Click a place on the diagram | Hit on a node by `id` |
| `predict` | "What will the command print?" before running, then run | Comparison with the environment's output after normalizing whitespace, PIDs and time |
| `fill` | Complete a command or a YAML line | By effect: executed in a copy of the environment, a predicate is checked |
| `findflag` | "Find the flag that does X", with only a link to the documentation page next to it (§4) | By effect in a copy of the environment; whether the learner opened the page (`doc.open`) is logged separately |
| `explain` | Explain in your own words | Outside exams, by the learner's neural network against a rubric or by self-check against the rubric checklist. In `exit` and `exam` modes, self-check only; neural network grading is available after completion, in the debrief |
| `task` | A practical task in the terminal | Goals per 09 §2.4 |

Feedback refers to the screen where this is explained ("go back to screen 3, step 4"). Retrying is allowed; the first attempt is recorded in progress.

### 3.11. Role lenses (`lenses`)

`lensPane` from Forever Changes. Lenses are roles around one event: developer, operations, manager, user, sometimes security. The empty lens (`empty: true`) is "monitoring: nobody saw this failure, there is no alert". The main tool of the methodology block: one event means different tasks for different roles. Lenses show text and highlight different nodes on the same diagram; they have no separate drawings. The switch is a radiogroup with arrow keys.

### 3.12. Layer towers (`towers`)

Two or three vertical stacks of layers on a shared "hardware" axis at the bottom. A layer is a drawing plate with a label and a memory counter. The "number of applications" handle adds copies (in the VM stack each copy carries its own "guest kernel" layer, in the container stack only a frame above the shared kernel). Under the stacks are counters: memory used, start time, hardware load; the numbers come from data with a source and from the learner's own measurements (§7.4.5). The "kernel vulnerability" toggle highlights in the error color the part of the stack it affects. Nesting presets are switched with a toggle, and clicking a layer opens a card "who manages this layer and how to look at it".

### 3.13. Zoomable diagram (`zoommap`)

Nodes with a level of detail `zoom: 1..5`; when zooming in, a node expands into a nested diagram (semantic zoom, without a map underlay: submarine cables are schematic lines with latency labels, not a world map). Wheel, pinch, buttons and the `+`/`−` keys, breadcrumbs "Internet › Provider › Home". Each level is a separate diagram following the rules of §3.4 (no more than 12 nodes). The packet path is preserved when zooming: at a large scale it goes along the backbone, at a small scale through the provider's routers.

### 3.14. Protocol card (`protocard`)

A single form for the protocol catalog (R8): why, layer, a sequence diagram of the exchange, how to observe, how it breaks. The diagram is an embedded `seq` on top of the protocol model with its handles (for TCP, window and RTT; for QUIC, 0-RTT; for DNS, TTL and cache). The "how it breaks" section is a set of `BreakSpec` entries with the layer and the command that proves it. The catalog overview is a "course level × stack layer" grid; a card above the learner's current level is visible as a silhouette labeled "will open at level…". The validator checks that all five sections are filled in. The data format is in §9.6, the list of cards in §7.3.8.

### 3.15. Rule trace (`ruletrace`)

A vertical strip of the netfilter or eBPF chains the packet went through: `PREROUTING → KUBE-SERVICES → KUBE-SVC-… → KUBE-SEP-… → DNAT`. The rule that fired is highlighted (`net.rule` events), and clicking opens the whole rule as `iptables -t nat -S` prints it. The "number of replicas" handle recomputes the rules with `--probability` (with three: 0.333…, then 0.5, then unconditional) with a "why it is like this" label. A mode switch: iptables / nftables / IPVS / Cilium eBPF; for eBPF, instead of chains there is a service map with the selected entry. Used in networks (NAT, firewall), in Docker (`-p` as DNAT in the `DOCKER` chain) and in Kubernetes (ClusterIP, NodePort).

### 3.16. Reconciliation loop and code editor (`reconcile`, `code`)

**`reconcile`.** Three fixed-width columns: "Desired" (YAML from etcd under the key `/registry/deployments/default/web`, changed fields highlighted) — "Controller" (a ring of three labeled arcs `observe → diff → act`, the iteration number and a diff line `want 3 · have 2 → create 1 pod`) — "Actual" (pods as cards). Intervention buttons: delete a pod, kill a node, change `replicas`, change `image`, pause the controller. Each intervention is a `k8s.object` event, and the reaction is a `k8s.reconcile` with an iteration number, so you can see which iteration noticed it. The "chain" mode repeats the ring horizontally for several controllers; the actual state of one link is the desired state of the next, and the arrow between rings is labeled with the object that connects them. The "watch delay" handle shows that the loops are independent and converge in any order. The model is kube-lite.

**`code`.** A CodeMirror 6 editor with highlighting for TS, YAML, HCL, PromQL and Dockerfile (one module for the whole course: 06 needs it too). The user's TS runs in a separate Worker without network or DOM; transpilation is `sucrase` on demand. An iteration of the learner's controller that runs longer than 2 s gets a `timeout`. The API client is a proxy to kube-lite with the controller's ServiceAccount permissions, as in 05.

### 3.17. Network of machines (`vswitch`, `fabric`)

**`vswitch`** is our JS switch (the engine's side; the kernel, images and machine Workers are 09). Each v86 machine hands the frames of its network card (`net0-send` / `net0-receive` on the v86 bus) not directly to a BroadcastChannel but to a shared `vswitch` module in a separate Worker. It keeps a MAC → port table (learning, aging 300 s), floods broadcast and unknown frames, supports 802.1Q tags, a "hub" mode and "N% loss". netlab nodes (tier A) connect to the same switch, so on a phone one real machine works in the same network as the models of the others. The switch sees every frame and itself emits `l2.frame`, `net.arp` and `net.packet` with the `machine` field onto the bus. This is real L2: ARP, ping, tcpdump, routing between machines, iptables, NAT and WireGuard work in the guest kernels as on hardware.

**`fabric`** is the widget for this network. Machines are rectangles, the switch is a strip with ports, and each port is labeled `eth0 · 52:54:00:00:00:11 · 10.0.0.11/24`. Frames travel along wires; the MAC table under the switch fills up before your eyes and ages on a timer. A probe on a port is `tcpdump` without entering the machine, with `.pcap` download. Terminal tabs per machine. The "hub / switch" toggle explains ARP and switch learning with one handle. "Break it": pull a cable (port down), a VLAN on a port, 5% loss, a loop (in the model only, with storm limiting). A memory indicator before start: "3 machines × 96 MB guest ≈ 1.2 GB in the tab". A fourth machine is offered only when `navigator.deviceMemory ≥ 8`; on a phone, one machine, the other nodes are models labeled "model".

### 3.18. Hybrid Kubernetes (`cluster`)

At the top is the kube-lite control plane (the same blocks and the same layout as in "Kubernetes from blocks"), outlined with a dashed line and labeled "simulator". At the bottom are v86 nodes, with a solid line and labeled "real kernel". Each node runs the `dt-kubelet` agent (09 builds it on top of the `ttyS1` service agent): it holds a Lease, receives assigned pods from kube-lite, assembles an OCI bundle from the course registry layers, starts containers through `crun` in real namespaces and cgroups and reports status. `kubectl apply` spawns real processes; clicking a pod expands its real namespaces and cgroup from the agent's facts (`procs`, `ns`, `cgroups`, 09 §2.2). `kubectl exec` opens a terminal tab with `nsenter` into the real container. "Kill a node" stops the v86 Worker: the Lease stops being renewed (`k8s.lease renewed=false`), after `node-monitor-grace-period` (50 s since v1.32, sped up with the ×10 button) the node becomes `NotReady`, after `tolerationSeconds: 300` the pods are evicted, the ReplicaSet creates new pods on live nodes, and the old ones hang in `Terminating` until the node comes back. We do not run real k3s or kubeadm inside v86: 32-bit emulation and memory cannot handle it (R11).

### 3.19. Real stage (`realstage`)

A checklist screen instead of a lab for Kubernetes stages 2 and 3 and for other tracks on real machines (R12). The trainer executes nothing on the learner's machine: it guides, shows commands and checks.

- **Track steps on the left.** Each has: what to do, a command with a "copy" button (not "run"), a `docref` or link according to the documentation rung (at stage 3, rungs 3–4, §4), the expected result, and how to check it.
- **Check status on the right.** Without a server: a field "paste the output of `trainer-check run --track r3 --step join --nonce …`" (09 §5.4). With a server (proctored exams, where `trainer-exam` runs on the learner's machine): live agent status, time of the last check, `CheckResult` per goal with `failId`.
- **A cost counter at the top.** Provider, number and type of machines (from the agent's facts or from the learner's own words), the hourly price from `providers.yaml` with the check date, the amount accumulated since the first step: "running 2 h 14 min ≈ 61 ₽". A reminder every 2 hours. Prices are data with `hold` and a date, not numbers in code.
- **Cleanup is mandatory.** The last step cannot be skipped: a command (`terraform destroy`; for local VMs, `vagrant destroy` or `multipass delete --purge`), a check `trainer-check run --step cleanup` or pasting the output of `terraform state list` (empty). The track does not count until cleanup is marked. If the learner closed the tab in the middle of a track, on the next visit the first screen is "you may have machines running: ~N ₽ per hour" with the cleanup command.

There is no built-in terminal to the learner's VM at the real stage: the learner works in their own ssh, and the course does not hand out machines, so the trainer has no terminal to a remote machine either.

### 3.20. Handoff to a phone via QR (`handoff`)

We take `qrSvg` from Sankofa. A link of the form `#l=<lesson>&s=<screen>&st=<snapshot>`, where the snapshot is the compressed (deflate + base64url) step number, the selected lens and the handle values; the encoder limit is 213 bytes. If it does not fit, we pass it without a snapshot and the screen opens from the beginning.

- **"Continue reading on the phone"** — right away: the phone opens the same screen in reading, stepper and quiz mode, without a terminal. A long lab on a phone offers a handoff back to the computer.
- **"Diagram on a second screen"** — in v2 and only when `dt-api` is available: the laptop opens a `wss://<domain>/api/pair` channel and shows a QR with a one-time room code; the phone joins the same room, SDP is exchanged through it, and then bus events go directly over a WebRTC data channel (our own STUN, no TURN; on failure the room itself relays events up to 50 KB/s, for no longer than 2 hours). The server sees only the bus events of this scene, without the terminal and keys. Without `dt-api` the mode is unavailable.

### 3.21. Asking your own neural network (`ask`)

The "Ask" button exists on a diagram, an output line, an error and a question after answering. It is absent in `exit` and `exam` modes; at documentation rungs 4–5 it is called "Where to look?" and works in `docs-coach` mode (§4.4). Connection, key storage (IndexedDB, a non-extractable `CryptoKey`, a "do not remember" mode), prompt assembly, truncation and secret masking are in 09 §4.1–4.5. The engine passes the following context to `ask(context): AsyncIterable<string>` (the format of 01 §14.4 plus engine fields):

```json
{
  "mode": "practice",                     // explain | practice | explain-output | docs | free | review | exam (names — 01 §16.1)
  "locale": "ru",
  "level": "L0",
  "doc_step": 2,
  "hint_step_used": "H2",
  "known_concepts": ["L17", "L27", "L33", "L35"],
  "glossary": { "L35": { "ru": "Пространство имён — отдельная картина мира для процесса" } },
  "screen": { "lesson": "linux.isolation", "id": "s3a", "describe": ["Схема: sh в своём пространстве имён PID, 1 | 4127"] },
  "goals": [ { "id": "g-own-pid1", "say": "Запусти sh, который будет PID 1", "pass": false } ],
  "doc_trail": [ { "source": "man-unshare", "anchor": "OPTIONS", "via": "terminal" } ],
  "question": "почему ps показывает только два процесса?"
}
```

What is passed is a whitelist of introduced concepts (`known_concepts`), not a blacklist of forbidden words: a list of a hundred future terms is a spoiler in itself. The reference solution is never passed. The terminal is collected and masked by 09 (the last 40 lines). The answer is shown in a side panel marked "answer from your neural network, the engine did not check it".

---
## 4. The documentation ladder

The habit of reading documentation is the third pillar of the course (R1). A beginner cannot be sent into documentation from scratch: they do not know how a man page is structured and will get lost. But by the end of each block the course must force them to search on their own, and in exams only the official documentation is open, as in the CKA. The engine provides five rungs for this, and each is a separate primitive with a check, not a wish in the text.

### 4.1. Primitives

**`docref` — rung 1, "the blink".** A small source label next to a command, flag, YAML field or output line: `man 1 ps · STANDARD FORMAT SPECIFIERS`, `kubernetes.io › Pods`, `docs.docker.com › docker run › --rm`. Optional and checks nothing. On hover it shows one line of the source ("this is from here"), a click opens `docview` at the right place. At L0 the label is gray and does not distract from the diagram.

**`docview` — rungs 2–5.** A side reader panel that works offline. Formats: a man page (pre-rendered from roff to HTML at build time, the version is the same as in the v86 image or in the golden recording), `--help` output, `kubectl explain <path>` (from the OpenAPI schemas of the same version as kube-lite), snapshots of pages from docs.docker.com, kubernetes.io, developer.hashicorp.com, docs.ansible.com, prometheus.io with the snapshot date. In the left margin is the anatomy of the page: NAME, SYNOPSIS, DESCRIPTION, OPTIONS, EXAMPLES, SEE ALSO for man; FIELDS and DESCRIPTION for `kubectl explain`; headings for sites. There is search within the page. Three modes:

- `peek` (rung 2): a **fragment** is shown — the needed section, with the needed line highlighted and the rest dimmed; a margin label explains the anatomy: "this is the OPTIONS section: flags here are listed alphabetically, the short and long form separated by a comma". A "whole page" button.
- `page` (rungs 3–4): the whole page, without highlighting or an anchor.
- `exam` (rung 5): only the exam corpus, without outbound links.

Every opening writes a `doc.open {source, anchor, via}` event; these make up the `doc_trail` for the AI and for the post-exam debrief.

**`findflag` — rung 3.** A check type (§3.10): "find the flag that does X", with only a link to the page next to it. The answer is checked by its effect in a copy of the environment.

**Enforcement — rung 4.** The task requires commands or flags that were not in the theory: it has `beyond: true`, and these flags are not in `introduces` and `uses`. There are no hints (`hints` is empty, the validator checks this), chips are hidden, and the "Ask" button becomes "Where to look?" and turns on `docs-coach` mode (§4.4).

**`docexam` — rung 5.** Exam mode: only `docview` in `exam` mode is available, with the list of the block's allowed sources; the AI is off (01 §14.1, 09 §4.7). 10–25% of the exam weight (at least 10/15/20% for beginner, intermediate and experienced; in the `pro` part of Kubernetes modeled on the CKA, up to 30%) is tasks on flags and fields outside the course (`beyond: true`). Documentation openings are logged — not as a penalty but as material for the debrief: "you spent 6 minutes looking for `ndots`; here is where it is written and how to find it in 30 seconds". For the Kubernetes block the list of allowed sites mirrors the current CKA rules on the Linux Foundation page; it is checked before every release (`sources.yaml: checked`).

### 4.2. Offline corpus

`content/docs/` — excerpts and full pages: man pages for the course commands (about 150), `--help` of the tools, `kubectl explain` (generated from the kube-lite OpenAPI), fragments of sites. Each page is split into sections with anchors (`docs/man/ps.1.json`), and each keeps a header with the license and attribution. Licenses in the rights registry: the Linux man-pages project uses different free licenses page by page (the one in the page header is taken); GNU coreutils man pages are GFDL; kubernetes.io is CC BY 4.0 (attribution required); docs.docker.com is Apache-2.0 (the docker/docs repository); Terraform, Ansible and Prometheus documentation follows the licenses of their repositories, checked at the research stage, and until checked the page is marked `hold`. The budget is up to 2 MB per block, the chunk is loaded on demand.

### 4.3. How the rung is computed

The rung lives in the block data and is not computed by a formula on the fly: each module in `block.yaml` has a ladder rung (`doc_ladder`), and a screen or task can override it with the `doc_step` field. The learner's effective rung is `max(module rung, level starting rung)`, where the starting rung for L0 = 1, L1 = 2, L2 = 3 (an experienced learner starts at the third, R2).

Build rules:

- in the first third of a block, rungs 1–2; in the second third, 2–3; in the last third, 3–4;
- rung 4 is mandatory for all levels: **at least two tasks with `beyond: true` in the last third of each block**;
- rung 5 occurs only in block exams;
- for L0, `docref` is not shown before the lesson that introduces L08 "Help: `man`, `--help`"; in the Linux block these are the first lessons, and before them the beginner does not see documentation at all;
- the H3 hint level from 01 §14.2 at rung 2 **is** a `docview peek` with a highlighted line, not a retelling;
- there is no ready solution at any rung: the `reveals` field from version 1 has been removed. `CheckResult.hintLevel` (09 §2.4) is 0–5 for rungs H0–H5.

| Rung | What the engine draws | Hints | Chips | AI mentor |
|---|---|---|---|---|
| 1 | `docref` next to a new flag or field | H1–H5 from 01 §14.2 | full command | the usual ladder |
| 2 | `docview peek` with a highlighted line and a section label | H1, H2, **H3 = documentation fragment**, H4 | full command | explains how the page is structured, does not read the line for the learner |
| 3 | only a `docview page` link without an anchor; `findflag` | H1, H2, H3 = link to the page | command name | may name which page to open, but not the section |
| 4 | nothing | none | none | `docs` mode |
| 5 | `docexam` | none | none | off |

### 4.4. AI `docs` mode

Added to the mode table of 09 §4.5. System instruction: "Do not name the command or the flag. The first answer is always: 'Where have you already looked? Which help commands did you run?' If `doc_trail` is empty, name the tool (`man <cmd>`, `<cmd> --help`, `kubectl explain <resource>.<field>`, docs.docker.com › reference) and the section where such things are usually described, but not the whole page. If `doc_trail` is not empty, say in which section of the open page to look. If the learner quoted the right line, confirm it and explain it." The engine compares the AI's answer with the goal's reference command and folds it under a button if it does appear anyway (the same mechanism as in `lab` mode of 09 §4.5).

### 4.5. Tasks by rung for each block

Below is the minimum set that must exist in each block. Tasks are inserted into the block documents; checks follow 09 §2.3–2.4. Rung 1 in every block is the `docref` on every new flag; it has no separate tasks.

| Block | Rung | Task | Documentation | Check |
|---|---|---|---|---|
| Methodology | 2 | "According to the Kanban Guide, what counts as the starting point of cycle time?" Hint H3 opens a fragment of the Kanban Guide with the definition highlighted | Kanban Guide (kanban.university) | `choice` |
| Methodology | 3 | "Find in the Google SRE Book chapter on error budgets what the team does when the budget is exhausted" | link to the "Embracing Risk" chapter | `choice` with a supporting quote |
| Methodology | 4 | "Using the board export, compute the median lead time and the 85th percentile" (percentile formulas were not in the course) | — | `output` equals the reference |
| Linux | 2 | "Show processes sorted by memory". H3 opens `ps(1)` with the `--sort spec` line highlighted | man ps | the first output line is the `hog` process |
| Linux | 3 | "Find the `ps` flag that shows threads, and print the threads of the `threads` process" | link `ps(1)` | `history` contains `ps` with `-L`, output contains 4 `threads` lines |
| Linux | 4 | "Find files in `/var` larger than 50 MB modified in the last 2 days and write the paths to `/tmp/big.txt`" (`-size`, `-mtime` were not covered) | — | `files['/tmp/big.txt'].sha256=<reference>` |
| Linux | 4 | "Make `backup.service` restart no more than 3 times in 5 minutes" (`StartLimitBurst`, `StartLimitIntervalSec` were not covered) | — | `units[backup.service]` and `files[unit].text=~'StartLimitBurst=3'` |
| Linux | 4 | "Find the process that keeps a deleted file open and prevents the space from being freed" (`lsof +L1`) | — | `files['/tmp/pid.txt'].text=@pid(logger)` |
| Linux | 5 | "Limit a service to 200 MB of memory using systemd" (`MemoryMax=` from `systemd.resource-control(5)`) | `docexam` | `units[app.service].props.MemoryMax=200M` |
| Networks | 2 | "Ask the server `@198.51.100.53` for the MX record only". H3 opens `dig(1)` with the SYNOPSIS `[@server] [name] [type]` highlighted | man dig | `history` contains `dig`, output contains `MX` |
| Networks | 3 | "Find the `dig` option that prints only the address" | link `dig(1)` | output is one line with the address |
| Networks | 4 | "Find the path MTU to 203.0.113.80 without sending fragmented packets" (`ping -M do -s` was not covered) | — | `files['/tmp/mtu.txt'].text=1400` |
| Networks | 4 | "Show the retransmission timers of TCP sockets" (`ss -o`) | — | `history` contains `ss` with `-o`, `files['/tmp/timer.txt']` contains `timer:(on` |
| Networks | 5 | "Limit SSH to three new connections per minute from one address" (`nft` limit or `iptables -m recent`) | `docexam` | the 4th connection within a minute is dropped (`probe`) |
| Containers | 2 | "Limit a container to half a CPU". H3 is a fragment of `docker run --help` with the `--cpus` line highlighted | docs.docker.com › docker run | `containers[name=c].hostConfig.nanoCpus=500000000` |
| Containers | 3 | "Find the `docker run` flag that removes the container after it exits" | link to the `docker run` page | `containers[name=t]` is absent after exit, `history` contains the run |
| Containers | 4 | "Run a container so that its filesystem is read-only except `/tmp`" (`--read-only`, `--tmpfs`) | — | `containers[name=ro].hostConfig.readonlyRootfs=true && containers[name=ro].mounts[type=tmpfs][destination=/tmp]` |
| Containers | 4 | "Limit a container to 50 processes" (`--pids-limit`) | — | `containers[name=p].hostConfig.pidsLimit=50` |
| Containers | 5 | "Build an image for arm64 on an amd64 machine" (`buildx --platform`) | `docexam` | `images[ref=app:arm].platform=linux/arm64` |
| CI/CD | 3 | "Find how to run a job only for tags" | link to the `.gitlab-ci.yml` reference › `rules` | `yaml_path` + a run on `tag v1.2.0` and `push main` |
| CI/CD | 4 | "Make the `deploy` job run only on a tag of the form `v*`" (`rules: if: $CI_COMMIT_TAG =~ /^v/`) | — | run: present on `v1.2.0`, absent on `1.2.0` and `main` |
| CI/CD | 4 | "Cancel outdated runs in a branch when a new commit arrives" (`interruptible` / `concurrency`) | — | the second push cancels the first run |
| IaC | 3 | "Show the plan for a single resource only" (`-target`) | link to `terraform plan` | `plan_expect` for one address |
| IaC | 4 | "Do not let Terraform recreate a VM if only `user_data` changed" (`lifecycle { ignore_changes }`) | — | `plan_expect: no-replace` |
| IaC | 4 | "Move a resource into a module without recreating it" (the `moved` block) | — | `plan_expect: 0 to add, 0 to destroy` |
| Kubernetes | 2 | "Add a strategy under which there are never fewer than 3 ready pods during an update". H3 is `kubectl explain deployment.spec.strategy.rollingUpdate` with `maxUnavailable` highlighted | kubectl explain | `k8s.objects[kind=Deployment][metadata.name=web].spec.strategy.rollingUpdate.maxUnavailable=0` |
| Kubernetes | 3 | "Which field limits the time for a pod to shut down gracefully? Set it to 5 seconds" | `kubectl explain pod.spec` | `...spec.template.spec.terminationGracePeriodSeconds=5` |
| Kubernetes | 4 | "Spread 3 replicas across different nodes so that with 2 nodes the third waits" (`topologySpreadConstraints` or anti-affinity) | — | pod 3 is `Pending` with `FailedScheduling`, ≤ 1 pod on each node |
| Kubernetes | 4 | "Make sure the pod does not land on a node labeled `disk=hdd`" (nodeAffinity `NotIn`) | — | `k8s.objects[kind=Pod][metadata.labels.app=db].spec.nodeName!=@node(disk=hdd)` |
| Kubernetes | 5 | "Back up etcd" (`etcdctl snapshot save` per kubernetes.io) | `docexam` | `files['/backup/etcd.db'].exists` and `probe` `etcdutl snapshot status` |
| Monitoring | 3 | "Find the PromQL function for the 95th percentile over a histogram" | link to prometheus.io › Functions | `promql_equiv` |
| Monitoring | 4 | "Compute the 95th percentile of latency by route over 5 minutes" (`histogram_quantile` + `sum by (le, route)`) | — | `promql_equiv` |
| Monitoring | 4 | "Silence the `HighLatency` alert for the duration of maintenance" (`amtool silence add`) | — | `alertmanager.silences[matchers~HighLatency]` |

---

## 5. The lesson screen and levels

### 5.1. Screen structure

A lesson is a vertical strip of screens (the format of 01 §7) with three permanent elements.

- **Top bar**: block and lesson, level (labels "Beginner / Intermediate / Experienced", keys `L0/L1/L2`; changing the level without an entry check does not change the status of concepts), language RU/EN, "step by step" (calm mode).
- **Side bar (≥ 1280 px) / bottom sheet (phone)**: a table of contents of screens with check marks, cards for the concepts introduced up to this point (introduced ones only), the `docview` documentation panel, the neural network answer panel.
- **Screen**: a sticky part (diagram, stepper, split) and a flow of text beside or under it; at the end, an action with a check.

Screen kinds come from 01 (`diagram`, `example`, `predict`, `sandbox`, `theory`, `task`, `exit`) plus three engine kinds: `mechanism` (a stepper or process model), `lab` (a split with goals), `breakit` (a breakage with a prediction). The lesson anatomy step (`step: hook | look | try | explain | practice | exit | review`) is a separate field. A `theory` screen is coherent text with sources, mandatory for every core concept; the "reads without a single click" requirement applies precisely to it. The hook (`hook`) is a work situation in text (a message from the team lead, a ticket, an error line, 01 §7), not a picture.

### 5.2. Levels change the order, not only visibility

```yaml
order:
  L0: [hook, look, try, explain, practice, exit]
  L1: [hook, look, try, explain, practice, exit]           # look screens with levels: [L0] are collapsed into a "Basics — expand" line
  L2: [hook, practice:challenge, explain, look, practice, exit]   # the challenge task comes first
```

- **L0**: a worked example before the task; the stepper on a button press; a prediction before every "break it"; model handles open one at a time (`ParamSpec.levels`); documentation rung from 1.
- **L1**: all handles are open, "break it" with a prediction, "basics" screens are collapsed; documentation rung from 2.
- **L2**: the lesson starts with a challenge task ("here is a symptom, find it"), and the diagram opens as a debrief: the `look` screen shows the stepper steps where the learner made a mistake (by `failId` from 09 §2.4), not the whole mechanism. Theory is not hidden but compressed into a summary paragraph with a "full text" button: an experienced developer may not know cgroups. Documentation rung from 3.

Concepts of a collapsed screen count as introduced only in the `placed` state or higher (01 §2.2). If an experienced learner opened a lesson without the entry check, the collapsed screens expand into "check yourself" cards with two questions each, and only after them does the concept get `placed`.

### 5.3. Rules checked by the build

From 01 §8 and from this document: `introduces` ≤ 1 per screen and ≤ 4 per lesson (in a stepper the rule counts by steps: a step that introduces a concept is a separate screen); screen text up to 120 words at L0 and up to 180 at L1/L2; no reference phrases like "see the figure above"; one interaction mode per screen (`combine: true` only without L0); an animation has a static frame; a diagram has ≤ 12 nodes, labels on all edges, `explain` on all nodes; no raster drawings and no character elements; no more than one `forward` per lesson; at rungs 4–5 `hints` is empty.

---

## 6. Visual language

### 6.1. One style — the drawing

Everything on the screen corresponds to a real mechanism: blocks, arrows, labels on lines, values in a monospace font. Line 1.5 px, corner radius 6 px, grid 8 px. There are no raster drawings, characters, faces, hands, plot or decorative backgrounds, neither in hooks nor in introductions. No shadows, gradients, parallax, "boiling" line or jitter.

There are three kinds of motion, plus highlighting:

1. **Movement**: a packet, request, signal or object moves along an edge.
2. **Appearance and disappearance**: a layer, a namespace frame, a pod, an iptables rule (`data-fade`).
3. **Change of a value**: a counter, a gauge, a queue length.

Highlighting is a change of line weight and tone on the element being discussed (the step's `focus`). A transition between steps is 180–320 ms, 240 ms by default, `cubic-bezier(.2,.7,.2,1)`; 0 ms in calm mode. The camera does not move, except for an explicit `zoommap` zoom on the learner's action.

### 6.2. Illustration rules

1. **The kernel is always at the bottom, user space above it.** The constant axis of all diagrams about Linux and containers. A container is not a box with its own kernel but frames around processes above a shared kernel.
2. **The network is drawn left to right from the client to the server**, layers vertically, L7 at the top.
3. **In Kubernetes the control plane is at the top, nodes at the bottom, and the API server is the only point the arrows lead to.** An arrow to the API is labeled with a verb (`watch`, `create`, `bind`).
4. **Every arrow is labeled on the line, every element is clickable** and opens a card "what it is, who creates it, which command shows it" (checked by the build).
5. **Real values**: IP addresses from RFC 5737 (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24), internal ones 10.0.0.0/8, CGNAT 100.64.0.0/10 (RFC 6598), AS numbers 64496–64511 (RFC 5398); real sha256 digests, real image names (`nginx:1.27-alpine`, `alpine:3.22`), real command output from golden recordings.
6. **Every network breakage is labeled with its layer** (L2…L7), every container breakage with its boundary.
7. **The model and the real thing are always distinguishable**: what is computed by a simulator is outlined with a dashed line labeled "simulator"; what came from a real kernel or a real VM, with a solid line.
8. **Screenshots of real tools** (Grafana, Docker Desktop, Lens) only where the learner will later see that interface, and only taken from our stand.
9. **CNCF project logos** according to the `cncf/artwork` rules, as an identifying mark, not as decoration.

### 6.3. Color

Color encodes the **family**, not importance; subtypes within a family differ by stroke, shape and label, not by hue. Green, red and amber are reserved for state, and no family uses them. Saturation is muted (OKLCH, C ≤ 0.10 for fills, ≤ 0.14 for lines), the background is warm paper. No more than five meaningful colors on one screen.

| Family | Token, light theme (OKLCH) | Where | Subtypes differ by |
|---|---|---|---|
| Kernel | `--c-kernel: oklch(0.40 0.09 275)` indigo | Linux, containers | — (a solid strip at the bottom of the diagram) |
| User space | `--c-user: oklch(0.97 0.01 85)`, outline `oklch(0.45 0.02 85)` | Linux, containers | — (a rectangle with rounded corners) |
| Isolation (namespaces) | `--c-ns: oklch(0.50 0.10 340)` plum | frames around processes | 8 kinds — by stroke (solid, dashed, dotted, double, dash-dot…) and a tab label `pid`, `net`… |
| Limits (cgroups) | gauge `--c-gauge: oklch(0.55 0.01 260)` graphite, the limit mark is a dark tick | gauges | exceeding paints the gauge `--c-err`: that is already a state |
| Network | `--c-net-2…7`: one blue scale `oklch(0.30…0.72 0.08 230)`, L2 darkest, L7 lightest | envelopes, edges | by lightness and the layer label on the flap |
| Control plane | `--c-cp: oklch(0.45 0.08 200)` deep teal | Kubernetes | shape: hexagon |
| Node and agents | `--c-node: oklch(0.45 0.03 60)` stone | Kubernetes, `fabric` | shape: a wide rack rectangle |
| API objects | `--c-obj: oklch(0.52 0.06 55)` muted ochre | Kubernetes, IaC | shape: a document with a folded corner |
| Request flow | `--c-flow: oklch(0.25 0.01 260)` | arrows | arrowhead, animated dash |
| State | `--c-ok: oklch(0.55 0.13 150)`, `--c-warn: oklch(0.72 0.14 85)`, `--c-err: oklch(0.55 0.17 25)` | statuses only | always with a ✓ ! ⨯ mark |

The values are starting points; the final ones are chosen by a test in CI, which is also the arbiter: family tokens are distinguishable from each other and from the state tokens by ΔE2000 ≥ 15 in both themes; text-to-background contrast ≥ 4.5:1, lines to background ≥ 3:1. The dark theme has separate lightness values chosen by the same test, not "25% lighter".

### 6.4. Typography

The text presentation comes from Sankofa. Body text is Literata (full Cyrillic), 18–19 px, line height 1.55, measure 62–70 characters. Interface, node and edge labels use Inter, node labels 14 px semibold. Code, values on diagrams and the terminal use IBM Plex Mono (12–13 px on diagrams, 14 px in the terminal). Headings use Literata, scale 1.25. Hanging punctuation (`hanging-punctuation: first`), non-breaking spaces after one-letter prepositions and before dashes (at build time), «guillemets» in RU, “curly quotes” in EN. A diagram caption sits to the right of it in the margin on a wide screen (as in magazine layout), under the diagram on a narrow one. Fonts are subset to Cyrillic and Latin, `font-display: swap`.

### 6.5. Terminal

Our own xterm theme on the same tokens: background `--c-term-bg` (deep graphite in both site themes), ANSI colors muted to the same palette, no neon green on black. There are four meaningful colors: the prompt (`user@host:path$`, the user name in the "user space" tone, root's `#` in the kernel tone), paths, errors (`--c-err`), and the highlighted key line of an error (01 §8 R14). Block cursor, Plex Mono 14 px, line-height 1.35. A line that can be clicked for a breakdown gets a thin underline on hover.

---
## 7. Catalog of process explanations

### 7.0. Who owns what and the storyboard form

Process explanations exist in every block (R3). Screen texts, module order, `introduces` and exam checks belong to the block documents. 08 owns the **process model** of each explanation: what is in the drawing, what moves, which handles and breakages there are, what is recomputed and what text appears in the "What changed" plate, which bus events and which environment are needed. If a block's storyboard diverges from this catalog in substance, the block document wins and 08 corrects the model. Below, storyboards are given by screen in the R4 style; concept references follow the 01 graph.

Common to all explanations, so as not to repeat it in every table: every diagram element is clickable and opens an `explain` card; steps can be rewound forward and back and paused; at L0 handles open one at a time, at L1–L2 all at once; before every "break it" there is a prediction, before a network or container one, `layerq`; every new flag has a `docref`.

| Block | Explanation | Handles | "Break it" | Primitives | Environment | Storyboard location |
|---|---|---|---|---|---|---|
| Methodology | A task from idea to production | WIP limit, batch size, automated tests, review time | remove automated tests; remove review | `stepper`, `diagram`, counters | model | §7.1.1; text — 07 E5 |
| Methodology | Incident: alert → postmortem | alert threshold, on-call, runbook | no alert (empty lens) | `stepper`, `lenses`, `order` | model | §7.1.2; 07 E11 |
| Methodology | Flow bottleneck | station throughput, WIP limit | — | `diagram`, gauges | model | §7.1.3; 07 E4 |
| Linux | Machine boot | default target, `initramfs` | broken `fstab` | `stepper` | `lab-debian` recording | §7.2.1; 02 §6.7 |
| Linux | Pipeline `a \| b` | writer and reader speed, buffer | reader exited → SIGPIPE | `stepper`, gauge | A, B | §7.2.2; 02 §6.5 |
| Linux | systemd restarts a crashed service | `Restart=`, `RestartSec`, `StartLimitBurst` | `Restart=no` | `stepper`, counter | B `lab-debian` | §7.2.3 |
| Linux | How the kernel isolates and limits (including fork/exec/PATH) | per screen | per screen | `split`, `stepper`, `breakit`, gauges | B `lab-alpine` | §7.2.4 |
| Networks | How the internet works | scale, CDN cache, CGNAT, IXP/transit | BGP prefix withdrawal, cable cut | `zoommap`, `packets` | model + `lab-net` | §7.3.1 |
| Networks | TCP/IP envelopes with real fields | MTU, tunnel | DF + ICMP filter | `packets` | A | §7.3.2; 03 §7.2 |
| Networks | ARP, DHCP, router | hub/switch, number of hops | no gateway, no DHCP | `fabric`, `seq`, `packets` | B, several machines | §7.3.3 |
| Networks | DNS resolution | TTL, resolver cache | NXDOMAIN, SERVFAIL, 53/udp closed | `seq`, `stepper` | A, `lab-net` | §7.3.4 |
| Networks | TCP + TLS 1.3 | RTT, window, loss, resumption | RST, DROP, certificate | `seq`, `packets` | A | §7.3.5 |
| Networks | A packet through NAT and a router | route table, SNAT | no route | `packets`, `ruletrace` | A, B | §7.3.6; 03 §7.2 |
| Networks | Where a 504 comes from | `proxy_read_timeout`, DB time, pool | slow DB, application crashed | `stepper`, `lenses` | A | §7.3.7 |
| Networks | What happens when you type a URL (synthesis) | cache, keep-alive, HSTS | a random one of nine | everything network-related | A | §7.3.8; 03 §7.1 |
| Containers | `docker run`: from CLI to process | `--rm`, `-d`, runc/crun, `live-restore` | kill the shim, restart dockerd | `stepper`, `lenses` | B + model | §7.4.1 |
| Containers | `docker build` layer by layer with the cache | instruction order, editing a file | `COPY . .` above `npm ci` | `stepper`, layers | A | §7.4.2; 04 §5 |
| Containers | `docker pull` by manifest | platform, layer already present | tag repointed; no platform | `stepper` | A | §7.4.3 |
| Containers | The six boundaries of a container | per boundary | one breakage per boundary | `diagram`, `split`, `layerq` | A, B | §7.4.4 |
| Containers | Hardware → VM → containers → nesting | number of applications, kernel vulnerability | — | `towers` | model + B | §7.4.5 |
| Kubernetes | `kubectl apply` through all components | — | remove a component | `constructor`, `stepper` | kube-lite | §7.5.1; 05 §6.1 |
| Kubernetes | Pod scheduling | requests, taints, number of nodes | no room | `diagram`, gauges | kube-lite | §7.5.2 |
| Kubernetes | Rolling update | `replicas`, `maxSurge`, `maxUnavailable`, readiness | the image fails readiness | `stepper` | kube-lite | §7.5.3 |
| Kubernetes | Node failure | grace period, `tolerationSeconds` | switch off a node | `stepper`, `cluster` | kube-lite, hybrid | §7.5.4 |
| Kubernetes | Reconciliation loop → chain → your own controller | `replicas`, `image`, pause, watch delay | delete a pod, kill a node | `reconcile`, `code` | kube-lite | §7.5.5; 05 §6.2 |
| Kubernetes | Networking: K-N1…K-N8 | per screen | per screen | `packets`, `ruletrace`, `fabric` | kube-lite + netlab, hybrid | §7.5.6; 05 §6.4 |
| CI/CD | `git push` → deploy | runner cache, manual gate | a test fails, a secret is empty | `stepper`, `constructor` | model | §7.6.1 |
| IaC | `terraform plan/apply` and state | code, state, cloud | drift, loss of state | three-column `diagram` | tfsim | §7.6.2 |
| IaC | Idempotent Ansible run | module versus `shell`, `changed_when` | the second run changes a file | `diagram`, grid of runs | ansim | §7.6.3 |
| Monitoring | scrape → TSDB → PromQL → alert → notification | `scrape_interval`, `for`, `group_wait` | target down, `for: 0` | `stepper`, time axis | model | §7.6.4 |

Build rule: every module of a block has at least one `mechanism` screen, otherwise a warning in the editorial report. Every catalog row has a Russian-language source or a `ru_missing` mark (§9.4).

### 7.1. Methodology

#### 7.1.1. A task from idea to production

| # | In the drawing and what moves | Handles and "break it" → what is recomputed | Hands-on and check |
|---|---|---|---|
| 1 | A horizontal strip of stations: "idea → analysis → development → review → test → release → production". Task cards — small numbered rectangles — move between stations; each station has two parts: "in progress" and "waiting". Above the strip are two counters: lead time (from entry to production) and cycle time (from start of work to production) | — | `hotspot`: where a card spends the most time (at the start, in "waiting for review") |
| 2 | The same strip, each station labeled "work N h · waiting M h" | A "WIP limit" slider 1–10: with a limit of 3, cards stop piling up before review and lead time drops. Plate: "WIP 8 → 3: cards waiting for review went from 6 to 2; lead time 9.5 → 5 days, the amount of work is the same" | `predict`: what happens to lead time if WIP is raised to 10 |
| 3 | The same strip, with two "test" stations: manual and automated | A "batch size" slider (tasks per release, 1–20); an "automated tests" toggle. "Break it: remove automated tests" — the "defects in production" counter grows, and some cards return from production to development along a red arrow labeled "return" | `explain`: why small batches and automated tests reduce time without making people faster |

The model is a discrete queue with a deterministic generator; default numbers come from 07. Concepts: M04, M08, M07, M11 (one per screen, order per 07).

#### 7.1.2. Incident: from alert to postmortem

| # | In the drawing and what moves | Handles and "break it" | Hands-on and check |
|---|---|---|---|
| 1 | A time axis from left to right: "release 14:02 → errors grow → alert 14:09 → acknowledgement 14:12 → rollback 14:20 → recovery 14:23". Above the axis is a curve of the error rate (the gauge rises and falls); the segments are labeled TTD (to detection), TTA (to acknowledgement), TTR (to recovery) | An "alert threshold" slider (1–20% errors): the alert shifts, TTD and the spent error budget are recomputed. Plate: "threshold 5% → 15%: the alert fires 6 minutes later, the monthly error budget −11%" | `predict` TTD at a 2% threshold |
| 2 | The same timeline | A "runbook exists / does not" toggle: with "does not", a segment "looking for what to do" 8 minutes long appears. An "on-call assigned / not" toggle: TTA grows until morning. "Break it: no alert" — the "Monitoring" lens is empty, and the first to report the error is a user (the "User" lens) after 40 minutes | `lenses`: Dev, Ops, manager, user, monitoring |
| 3 | An empty timeline and a stack of fact cards | — | `order`: arrange the facts in time; `explain`: "what to change in the system, not in the people" against a blameless postmortem rubric (M12) |

#### 7.1.3. Flow bottleneck

| # | In the drawing and what moves | Handles | Check |
|---|---|---|---|
| 1 | Five stations in a row, each labeled "throughput N tasks per day" with a queue gauge in front of it. Tasks flow from left to right, and the queue in front of the slowest station grows | A throughput slider for each station. Speeding up a non-bottleneck station does not change the output; plate: "sped up development 5 → 8 per day: the output is still 3, the queue in front of testing grew by 3 per day" | `hotspot`: where the bottleneck is |
| 2 | The same diagram | A "system-wide WIP limit" slider: queues do not grow without bound, and work is "pulled" by the bottleneck | `predict`: system output when the bottleneck is sped up by 1 |

### 7.2. Linux

#### 7.2.1. Machine boot

| # | In the drawing and what moves | Handles and "break it" | Hands-on and check |
|---|---|---|---|
| 1 | A vertical ladder of stages: firmware (BIOS in v86, UEFI on real machines — a label on the edge) → bootloader → kernel + initramfs → mounting the root → `systemd` as PID 1 → targets (`sysinit.target` → `basic.target` → `multi-user.target`). A "you are here" marker climbs the ladder, and each stage has a time from the `journalctl -b -o short-monotonic` recording | A "default target" switch: `multi-user.target` / `rescue.target`; the model shows which units do not start | `systemd-analyze`, `systemd-analyze blame \| head`, `journalctl -b \| head` (a `lab-debian` recording; at L1+ a real machine reboot) |
| 2 | The same ladder | "Break it: a wrong UUID in `/etc/fstab`" — the marker stops at mounting, and an `emergency.target` branch appears with the real line `Timed out waiting for device` | A tier B goal: fix `fstab` and boot to `multi-user.target` (`units[multi-user.target].active=active`) |

#### 7.2.2. Pipeline `a | b`

| # | In the drawing and what moves | Handles and "break it" | Hands-on and check |
|---|---|---|---|
| 1 | Two process rectangles side by side, between them a pipe buffer with a fill gauge (64 KiB by default); the arrows stdout of the first → buffer → stdin of the second are labeled with descriptors `1` and `0`. Data are short strips that drive into the buffer and out of it | "Writer speed" and "reader speed" sliders. If the writer is faster, the buffer fills and the writer sleeps (label "waiting: buffer full"). Plate: "the reader is 4 times slower: the buffer is full after 0.2 s, after that the writer runs at the reader's speed" | `predict`: what the writer does when the buffer is full |
| 2 | The same diagram | "Break it: the reader exited" (`head -n 3`) — the second rectangle goes dark, and the writer's next write gets SIGPIPE; label "code 141 = 128 + 13" | `yes \| head -n 3; echo "${PIPESTATUS[@]}"` → `141 0` |

#### 7.2.3. systemd restarts a crashed service

| # | In the drawing and what moves | Handles and "break it" | Hands-on and check |
|---|---|---|---|
| 1 | A unit state machine: `inactive → activating → active → failed`, the `failed → activating` edge is labeled `Restart=on-failure`, `RestartSec=2s`. A teaching service crashes with code 1 every 3 s; a marker goes around the ring; the `NRestarts` counter grows | A `Restart=` switch: `no` / `on-failure` / `always`. With `no` the return edge disappears and the service stays in `failed`. A `RestartSec` slider | `systemctl status demo`, `systemctl show -p NRestarts demo` |
| 2 | The same state machine, next to it a `StartLimitIntervalSec` window (10 s by default) with restart tick marks | A `StartLimitBurst` slider (5 by default): after the fifth restart within 10 s the state is `failed (Result: start-limit-hit)`. Plate: "RestartSec 2 s → 1 s: five restarts fit into 10 s, systemd stopped trying" | A tier B goal: `units[demo.service].restarts>=2 && units[demo.service].active=active` after editing with `systemctl edit demo` |

#### 7.2.4. Module "How the kernel isolates and limits" (R6)

The foundation of the containers block. It comes in the Linux block after `/proc` (L26) and the kernel (L27), for all levels; an experienced learner starts from screen 3 after the entry check. The environment is tier B `lab-alpine` (09 §1.4): the topic needs a real kernel; on a phone, recorded mode. Concepts are new ids in the 01 graph: L33 thread, L34 fork/exec, L35 namespaces (formerly D03), L36 cgroups v2 (formerly D04), L37 capabilities, L38 process root: mount namespace, `chroot`, `pivot_root` (formerly D05), L39 overlayfs by hand (part of D09), L40 seccomp as an idea. Everything the containers block relies on is introduced here; in the Docker block these screens are repeated as one "recall" screen with links to the cards.

| # | In the drawing and what moves | Handles and "break it" → what is recomputed | Hands-on (v86) and check | Introduces |
|---|---|---|---|---|
| 1 | **Process and thread.** A rectangle "process 4127" with shared memory; inside, thread strips labeled LWP 4127, 4128, 4129 | A "threads" slider 1–8 for the teaching program `/opt/lab/threads N`: the number of strips and of `/proc/4127/task` entries grows, the PID does not change, `NLWP` grows. "Break it": `kill -9` on one thread's LWP — the whole process goes dark; plate: "the KILL signal is addressed to the whole process: threads share one fate" | `ps -eLf \| grep threads` (the LWP and NLWP column labels on lines to the strips), `ls /proc/$(pidof threads)/task`; `predict`: how many lines `ps -eLf` will show with 4 threads | L33 |
| 2 | **fork, exec and PATH lookup.** Steps: bash reads the line `ls` → goes through the `PATH` directories left to right (directories light up in turn, the one found gets ✓) → `fork()`: a copy of bash appears with a new PID → `execve("/bin/ls")`: the contents of the copy are replaced, the PID is the same → `exit(0)` → `wait()`: the parent gets the exit code in `$?` | Dragging the order of `PATH` directories: if `/tmp/evil` is put first, a fake `ls` is called, and the output of `which -a ls` changes at once. A "without exec" toggle (`exec ls` in the current shell — the shell disappears). "Break it": remove `/usr/bin` from `PATH` → `sh: ls: not found`, while `/usr/bin/ls` by its full path works | `strace -f -e trace=clone,execve,wait4 sh -c ls`; `order`: clone → execve → exit → wait | L34 |
| 3 | **PID namespace.** Host processes above the kernel line; `unshare` draws a frame around the new `sh`, the number label is `1 \| 4127` | An "inside / from the host" viewpoint switch. "Break it: without `--fork`" — the first process started inside becomes PID 1 and exits, and the next `fork` gets `Cannot allocate memory`; the plate explains why `--fork` is mandatory | `unshare --pid --fork --mount-proc sh`, `ps`, from the host `grep NSpid /proc/<pid>/status`; `predict`: what `ps` will show inside | L35 |
| 4 | **Other kinds.** A stepper of seven steps, each adding a frame with its own stroke: mnt, uts, net, ipc, user, cgroup, time. Each changes one visible thing: uts — `hostname`; net — inside there is only `lo`, and it is DOWN; mnt — its own `mount`; user (L1+) — inside `uid=0(root)`, and outside the learner's uid | A toggle per kind. For user: `unshare --user --map-root-user id` → 0 inside, 1000 outside, `cat /proc/<pid>/uid_map` → `0 1000 1`; label: "in rootless engines the inner root is mapped to a range from `/etc/subuid`, for example 100000 — that is a different case" | `ls -l /proc/$$/ns`: **10 links** on kernel 6.12 (cgroup, ipc, mnt, net, pid, pid_for_children, time, time_for_children, user, uts); the numbers in `[...]` match the frame labels; the two `*_for_children` links show where children will end up. `lsns -p $$`. `match`: kind ↔ what it isolates (8 kinds) | — (the kinds are parts of L35) |
| 5 | **Entering someone else's namespace.** An `nsenter` arrow from the host shell into the frame | A choice of flags `-p -m -n -u`: the frames entered are highlighted | `nsenter -t <pid> -a sh`, `nsenter -t <pid> -n ip a`; `task`: run `hostname` in the uts namespace of process X | — |
| 6 | **cgroup v2: the tree and the memory limit.** The `/sys/fs/cgroup` tree; the `demo` group has a `memory.current` gauge with a `memory.max` tick | A `memory.max` slider 8–128 MB, a "how much the process asks for" slider. Plate: "limit 32 MB, the process asks for 40 MB: the kernel will first reclaim page cache, then kill the process" | Setup (at L0, as a worked example): `mkdir /sys/fs/cgroup/demo`, `echo +memory +pids +cpu > /sys/fs/cgroup/cgroup.subtree_control`, `echo 32M > demo/memory.max`, `echo 0 > demo/memory.swap.max`, `echo $$ > demo/cgroup.procs`. `predict`: will the process be killed at 40 MB | L36 |
| 7 | **OOM kill (drill).** The gauge reaches the tick, turns the error color, the process goes dark with a ⨯ OOM mark; the `oom_kill` counter in `memory.events` grows | A "swap allowed" toggle (`memory.swap.max`): the process is not killed but slowly goes into swap — if the image has swap | `head -c 64m /dev/zero \| tail` (tail keeps everything it has read in memory), `cat demo/memory.events`, `dmesg \| tail -3` → `Memory cgroup out of memory: Killed process … (tail)`. Drill S5: a service crashes every 2 minutes with code 137 — find the cause from `memory.events` and `dmesg`, raise the limit. Goal: `cgroups[path=/demo].memory.events.oom_kill>=1` | — |
| 8 | **cpu.max and pids.max.** Two gauges: the CPU share per 100 ms window and the number of processes | A quota slider 10–200%: the `nr_throttled` counter in `cpu.stat` grows, `top` shows ~50% at "50000 100000". "Break it": a fork bomb in a teaching wrapper hits `pids.max=20`, the 21st `fork` → `Resource temporarily unavailable`, the host is alive | `echo "50000 100000" > demo/cpu.max`, `echo 20 > demo/pids.max`; `fill`: limit the group to two cores → `cpu.max = "200000 100000"` | — |
| 9 | **Capabilities.** The process has a list of privilege strings (`CAP_NET_BIND_SERVICE`, `CAP_SYS_ADMIN`, `CAP_CHOWN`…), some removed; a check on the `bind(:80)` arrow | Remove or restore a capability — which actions are allowed is recomputed. The teaching `/opt/lab/bindport 80` as a regular user → `Permission denied` | `sudo setcap cap_net_bind_service=+ep /opt/lab/bindport`, `getcap /opt/lab/bindport`, `capsh --print` for root and for the user; `predict`: is root needed to listen on port 80. Goal: the process listens on 80 and `procs[cmd=bindport].uid!=0` | L37 |
| 10 | **Your own root.** A filesystem tree; `chroot` moves the process root to the `/srv/rootfs` branch | L1+: "break it" — root inside the chroot escapes (a nested `chroot` and `..`), because it has `CAP_SYS_CHROOT`. The `pivot_root` screen: in a new mount namespace the root of the whole namespace changes, the old root is unmounted; the new root must be a mount point (`mount --bind rootfs rootfs`) | `chroot /srv/rootfs /bin/sh`, `ls /`; at L0, without mandatory `pivot_root` practice | L38 |
| 11 | **overlayfs by hand.** Three sheets: lower (read-only), upper, merged — the view from above | Editing a file from lower → a copy-up animation: the file rises into upper and is edited there. Deletion → a whiteout appears in upper, lower is untouched | `mount -t overlay overlay -o lowerdir=/l/top:/l/base,upperdir=/u,workdir=/w /merged` (label: "in `lowerdir` the leftmost is the top one"); `ls -l /u` shows the whiteout as `c 0, 0`; `predict`: where the changed file will end up | L39 |
| 12 | **seccomp as an idea.** There is a filter on the "system call" arrow; a forbidden call is bounced with `EPERM` | A filter toggle on `mkdir` (in the model) | `grep Seccomp /proc/self/status` → `0`; in the Docker block it will come back as `2`. `choice` | L40 |
| 13 | **Exit ticket.** All frames, gauges and sheets on one drawing labeled "this is what a container will be made of" (`forward: [D06]`) | — | "Start an `sh` that cannot see host processes, has its own hostname and cannot use more than 64 MB": `procs[cmd=sh][ns.pid!=@host.ns.pid][nspid~1] && procs[cmd=sh].ns.uts!=@host.ns.uts && cgroups[procs~@pid(sh)].memory.max<=64M` | — |

The bus that the v86 service agent must provide for this module: `proc.spawn` with `tid` and `nspid`, `proc.exec`, `proc.signal`, `ns.create`, `ns.enter`, `cgroup.set`, `cgroup.usage`, `cgroup.event`, `fs.mount`, `fs.copyup` (from the upper diff), `net.link`.

### 7.3. Networks

The order of the block goes from the big picture to the packet (R8): the map of the internet → TCP/IP envelopes as a vocabulary → each layer by hand → end-to-end processes (DNS, TCP+TLS, NAT, 504) → the "typed a URL" synthesis. Every network task starts with `layerq`.

A note on the 01 graph. N07 currently requires N03, N05, N06, while per R8 envelopes as a vocabulary come at the start of the block. Decision: the overview screen §7.3.2 introduces N07 as a vocabulary of layers with names and example fields, requiring only N01; the fields of each layer are opened up in their own module (N03, N05, N06). The prerequisites of N07 in 01 need to be reduced to N01; the new map concepts are N22 "autonomous system and BGP" and N23 "IXP and CDN".

#### 7.3.1. How the internet works (`zoommap`)

| Zoom | In the drawing and what moves | Handles and "break it" → what is recomputed | Hands-on and check |
|---|---|---|---|
| 1 | A laptop and a home router; labels on the lines "Wi-Fi", "Ethernet". A packet dot goes from the laptop to the router | — | `ip a`, `ip route` on your own machine |
| 2 | The provider's access network: the line to the node (fiber or DSL), the provider's node; the router is labeled with its external address | A "public address / CGNAT" toggle: with CGNAT the router has an address from `100.64.0.0/10`, and a second NAT appears at the provider. Plate: "behind CGNAT, nobody can connect to you from outside without a port forward at the provider" | `predict`: which address the site will see |
| 3 | The provider as an autonomous system: a frame with the number `AS64500`; interconnections: transit (label "we pay") and peering at an IXP (label "we exchange directly"). BGP announcements on the edges: `203.0.113.0/24 AS_PATH 64500 64510` | A "via IXP / via transit" toggle: the path changes and the latency counter is recomputed | `hotspot`: where two ASes exchange traffic without transit (N22, N23) |
| 4 | The backbone and submarine cables between regions — schematic lines labeled with latency; a data center with racks, a load balancer and a CDN node | A "where the user is" handle (region) → the nearest CDN node, RTT is recomputed. A "CDN cache" toggle: on a miss the path extends to the origin server. "Break it: cable cut" — traffic takes a detour and latency grows | `order`: the path of a request to the CDN node |
| 5 | Root DNS servers: 13 names `a`–`m.root-servers.net`, each labeled "anycast, N instances" (the number is from root-servers.org as of the check date, `hold`) | "Break it: an AS withdraws its BGP routes" — paths to its addresses disappear from all arrows, together with its DNS servers. Label: "this is what major outages looked like when a company's network vanished from BGP; an example is the Facebook outage of October 4, 2021" (source in `sources.yaml`). Prediction before switching on: "will this company's DNS work?" | `predict` |

Practice: `traceroute` and `tracepath` in the `lab-net` "mini internet" (09 §1.4: root, TLD and authoritative DNS, a resolver and a web server at different addresses of one machine) and on several `fabric` machines. A real `traceroute` to the internet from v86 does not work: only TCP streams go through the Wisp relay (09 §1.6); the real path is shown as a recording or on your own machine. A `docref` to bgp.tools and RIPEstat is rung 1.

#### 7.3.2. TCP/IP envelopes with real fields

| # | In the drawing and what moves | Handles and "break it" | Check |
|---|---|---|---|
| 1 | One HTTP request nested in envelopes: HTTP → TCP → IP → Ethernet. The envelopes fold into each other one by one (appearance), each with a TCP/IP layer label and an OSI layer number on its flap. Next to them are the seven OSI layers, and lines show which ones collapsed | A "7 / 4 layer model" toggle | `match`: OSI layers ↔ TCP/IP |
| 2 | Clicking an envelope reveals the real fields: Ethernet (`dst`, `src`, `type 0x0800`), IP (`ttl`, `proto 6`, `src`, `dst`), TCP (`sport`, `dport`, `flags`, `seq`, `win`), HTTP (`GET /cart HTTP/1.1`, `Host:`); hex on the right with synchronized highlighting | An MTU slider 576–9000: when the size exceeds the MTU the packet is cut into fragments or (with DF) does not get through. Plate: "MTU 1500 → 1400 with a tunnel: the payload is 100 bytes smaller" | nesting `order` |
| 3 | The label under each envelope is a vocabulary entry: "L3 — when people say 'a problem at layer three', they mean the address and the route" | "Break it: DF=1 and an ICMP filter" — large packets disappear silently (PMTU black hole), small ones get through | `layerq` + `predict` |

#### 7.3.3. ARP, DHCP and a router on several machines

| # | In the drawing and what moves | Handles and "break it" | Hands-on and check |
|---|---|---|---|
| 1 | `fabric`: three v86 machines and a switch. An ARP request "who has 10.0.0.1?" goes out as a broadcast on all ports, the reply goes to one; the switch's MAC table fills up | A "hub / switch" toggle: in hub mode all frames are visible on all ports. Plate: "the switch learned the MAC of machine 2 on port 2; the next frame to it goes only there" | `ip neigh`, `tcpdump -e -n arp` on machine 3; `predict`: will machine 3 see the ARP reply |
| 2 | A `seq` of the DHCP exchange: DISCOVER → OFFER → REQUEST → ACK; the machine gets an address, mask, gateway, DNS | "Break it: the DHCP server is stopped" — the interface has a `169.254.x.x` address or no address | `tcpdump -n port 67 or port 68`; goal: the machine got an address (`net.addrs[dev=eth0]~10.0.0.`) |
| 3 | Two subnets with a router machine in the middle. A packet goes through it: the outer Ethernet envelope is replaced (the old MACs crossed out), TTL −1 | A `net.ipv4.ip_forward` 0/1 toggle. "Break it: machine 1 has no default route" → `Network is unreachable` | `ip route add default via …`, `sysctl -w net.ipv4.ip_forward=1`; goal: `ping` from subnet A to subnet B gets through |

#### 7.3.4. DNS resolution

Two tracks, not one: how a recursive resolver asks, and how `dig +trace` repeats the same thing. `dig +trace` performs the iterative walk **itself**, from the learner's machine: from the root to the TLD and the authoritative server; the provider's resolver does not take part in it (only the list of root servers is taken from it), so the resolver cache is not visible in the trace.

| # | In the drawing and what moves | Handles and "break it" → what is recomputed | Hands-on and check |
|---|---|---|---|
| 1 | `seq`: columns "laptop", "resolver", "root", ".com", "example.com". Arrows with protocol labels: `Q A shop.example.com RD=1` → `Q A shop.example.com` → `referral NS a.gtld-servers.net` → … → `A 203.0.113.10 TTL 300 AA` → the answer to the laptop. Under each label at L0 there is a line in plain words ("the root server does not know the address, but it knows who is responsible for .com") | A "time since the previous query" slider and a TTL slider 0–86400: while the TTL is alive, the arrows to the root go dark, the answer is "from cache", and the TTL in the answer decreases. Plate: "320 s passed with TTL 300: the cache expired, the resolver walks the three servers again, +84 ms" | `dig shop.example.com` twice in a row: in the second answer TTL is smaller and `Query time` is almost 0 (`lab-net`) |
| 2 | The second track: the same servers, but the laptop starts the walk | — | `dig +trace shop.example.com`; each section of the output highlights its arrow; `predict`: does the provider's resolver take part |
| 3 | Records: A, AAAA, CNAME (a CNAME → A chain), NS | "Break it": NXDOMAIN (`Could not resolve host`), the authoritative server is unreachable → SERVFAIL after a wait, 53/udp is closed → `dig` is silent, `dig +tcp` answers | `layerq` (L7 or L4), `order` of the query path |

#### 7.3.5. TCP and TLS 1.3

| # | In the drawing and what moves | Handles and "break it" → what is recomputed | Hands-on and check |
|---|---|---|---|
| 1 | `seq`: SYN → SYN-ACK → ACK, with seq/ack and `win` alongside. The slope of the arrows is RTT | An RTT slider 1–300 ms; a "time to first byte" counter. TCP window and loss sliders: the "throughput ≈ window / RTT" counter is recomputed. Plate: "a 64 KiB window at RTT 100 ms: no more than ~5 Mbit/s, however wide the link is" | `curl -v` → `Connected to …`; `ss -ti` (`rtt`, `cwnd`) |
| 2 | The same diagram | "Break it: the port is closed" → RST, `Connection refused` immediately. "Break it: a firewall silently drops" → SYN retries on the ladder 1, 2, 4, 8, 16, 32 s (`tcp_syn_retries=6`, about 127 s in total), curl's default connect timeout is 300 s; the hint is `--connect-timeout` | `predict`: refused or timeout? `layerq` → L4 |
| 3 | TLS 1.3: ClientHello (`supported_versions`, `key_share`, SNI, ALPN) → ServerHello (`key_share`) — **from this step the shared secret already exists**, and everything after it goes under a lock: EncryptedExtensions, Certificate, CertificateVerify, the server's Finished → the client verifies the certificate chain up to a root from the OS store (the chain is drawn as links) and the signature → the client's Finished → HTTP | A "resumption" toggle: on reconnecting with a PSK the certificate is not sent. A vocabulary label: "in TLS 1.3 the certificate is encrypted on the wire; the provider sees only the SNI" | `openssl s_client -connect shop.example.com:443 -servername shop.example.com -tls1_3`, `curl -vI` |
| 4 | The same chain of links | "Break it": the certificate has expired (`certificate has expired`), the name does not match (`no alternative certificate subject name matches`), the intermediate link is missing (`unable to get local issuer certificate`) — each has its own real curl error (code 60) | `layerq` → TLS; a goal on `lab-net`: fix the chain in nginx (`http.shop.status=200`) |

HSTS is introduced here, after TLS, not at the start of the URL path.

#### 7.3.6. A packet through NAT and a router

| # | In the drawing and what moves | Handles and "break it" | Hands-on and check |
|---|---|---|---|
| 1 | Laptop `192.168.1.23` → home router → provider. At the router the source address and port `192.168.1.23:51544` are crossed out and `203.0.113.7:40001` is written in; on the right the translation table (conntrack) gets a new row; the return packet is rewritten back | A "number of devices at home" slider: the table grows, the source ports differ | `hotspot`: where the client's address is last visible as `192.168.1.23` |
| 2 | `ruletrace`: the `POSTROUTING` chain with a `MASQUERADE` rule | "Break it: delete the SNAT rule" — the packet leaves with a private address and does not come back | `iptables -t nat -L POSTROUTING -n -v` (the rule counter grows), `conntrack -L` |
| 3 | The route table as a list; the packet picks a row by the longest prefix | "Break it: no default route" → `Network is unreachable` | `ip route get 203.0.113.10`; `layerq` → L3 |

#### 7.3.7. Where a 504 comes from

| # | In the drawing and what moves | Handles and "break it" → what is recomputed | Hands-on and check |
|---|---|---|---|
| 1 | Left to right: client → load balancer → nginx (reverse proxy) → application → database. The request goes right, the response comes back; each edge is labeled with a timeout | Sliders `proxy_read_timeout` 5–120 s (60 s by default in nginx) and "DB response time" 1–120 s. A 504 appears exactly when "DB > timeout". Plate: "the DB answers in 75 s, nginx waits 60 s: after 60 s the client gets 504 Gateway Timeout, and the application works for another 15 s in vain" | `predict`: which code the client gets with DB 40 s and timeout 30 s |
| 2 | The same diagram | "Break it: the application crashed" → nginx cannot connect → 502 Bad Gateway. A "DB connection pool size" slider: when it is exhausted, requests queue up and also hit the timeout | `layerq` → L7; `curl -w '%{http_code} %{time_total}\n'`, `tail /var/log/nginx/error.log` → `upstream timed out (110: Connection timed out) while reading response header from upstream` |
| 3 | Lenses: developer (slow SQL), Ops (upstream timeout and pool), manager (a failed mailing), user (error page); the empty lens "monitoring: no alert" | — | `task`: find and fix the cause of the 504 in the simulator |

#### 7.3.8. The "typed an address into the browser" synthesis and the protocol catalog

The synthesis comes at the end of the block, after N15, and builds on the completed modules (03 §7.1: fourteen stages, the waterfall, CDN). The engine assembles it from ready models: `zoommap` (the path on the map), `seq` (DNS, TCP, TLS), `packets` (envelopes along the path), §7.3.7 (what is behind the server's door). The synthesis exam: an `order` of the whole path, three "break it" with predictions and no hints, and a `task` "find why the site does not open" with a random breakage out of nine (DNS, route, firewall, certificate and others from 03), always with `layerq`.

The protocol catalog (R8) is `protocard` cards (§3.14). 03 writes the content; below is the minimum the validator checks: why, stack layer, sequence, how to observe, how it breaks.

| Protocol | Course level | Stack layer | Sequence (`seq`) | How to observe | How it breaks |
|---|---|---|---|---|---|
| DHCP | L0 | L7 over UDP 67/68 | DISCOVER → OFFER → REQUEST → ACK | `tcpdump -n port 67 or port 68` | no server → `169.254.x.x` |
| ARP | L0 | L2 | request to all → reply to one | `ip neigh`, `tcpdump -e arp` | wrong gateway → `incomplete` in `ip neigh` |
| ICMP | L0 | L3 | echo request → echo reply; time exceeded for traceroute | `ping`, `tracepath` | an ICMP filter breaks PMTU |
| TCP | L0 | L4 | SYN → SYN-ACK → ACK; FIN/ACK | `ss -tan`, `tcpdump 'tcp[tcpflags] & tcp-syn != 0'` | RST (refused), DROP (timeout) |
| UDP | L0 | L4 | a datagram without a handshake | `ss -uan` | loss without an error; ICMP port unreachable |
| DNS | L0 | L7 over UDP/TCP 53 | see §7.3.4 | `dig`, `dig +trace` | NXDOMAIN, SERVFAIL, 53/udp closed |
| HTTP | L0 | L7 | request → response, keep-alive | `curl -v` | 4xx, 5xx, upstream timeout |
| HTTPS/TLS | L0 | between L4 and L7 | §7.3.5 | `openssl s_client` | expired, name, chain |
| SSH | L0 | L7 over TCP 22 | version exchange → key exchange → host key verification → authentication | `ssh -v` | `Host key verification failed`, `Permission denied (publickey)` |
| NTP | L1 | L7 over UDP 123 | request → response with four timestamps | `chronyc tracking` | clock skew breaks TLS and Kerberos |
| SMTP | L1 | L7 over TCP 25/587 | EHLO → MAIL FROM → RCPT TO → DATA | `swaks` on a teaching server | rejection by SPF, port 25 blocked by the provider |
| FTP / SFTP | L1 | L7 | FTP: a control connection and a separate data connection; SFTP: an SSH subsystem | `sftp -v` | FTP behind NAT without passive mode |
| HTTP/2 | L1 | L7 | one connection, stream multiplexing | `curl --http2 -v` | head-of-line blocking at the TCP level |
| HTTP/3 (QUIC) | L1 | L7 over UDP 443 | a QUIC handshake with TLS 1.3 inside, 0-RTT on a toggle | `curl --http3 -v` | UDP 443 closed → fallback to HTTP/2 |
| WebSocket | L1 | L7 | HTTP Upgrade → 101 → frames in both directions | `curl -i -H 'Upgrade: websocket'` | a proxy strips Upgrade |
| gRPC | L1 | L7 over HTTP/2 | call → stream of messages → trailers with status | `grpcurl` | an L4 load balancer pins one connection to one backend |
| VLAN (802.1Q) | L1 | L2 | a tag in the frame on a trunk | `ip -d link`, `tcpdump -e vlan` | tag mismatch on ports |
| NAT/PAT | L1 | L3/L4 | §7.3.6 | `conntrack -L` | no SNAT, port exhaustion |
| BGP | L2 | L7 over TCP 179 | OPEN → KEEPALIVE → UPDATE (announcement, withdrawal) | bgp.tools, a teaching `bird` | prefix withdrawal, route leak |
| VXLAN / Geneve | L2 | L2 over UDP | a frame in the nodes' UDP envelope | `ip -d link show type vxlan`, `tcpdump udp port 8472` | MTU, closed UDP port |
| IPsec | L2 | L3 | IKE: key exchange → ESP | `ip xfrm state` | proposal mismatch, NAT without NAT-T |
| WireGuard | L2 | L3 over UDP | handshake initiation → response → data | `wg show` between `fabric` machines | wrong key — silence with no error |
| mTLS | L2 | between L4 and L7 | TLS 1.3 with a CertificateRequest from the server | `openssl s_client -cert` | client certificate from the wrong CA |
| OSPF | L2 (idea) | L3 | hello → link-state database exchange → shortest path computation | model only | — |

### 7.4. Containers

The block starts with D06 "container = process + namespaces + cgroups + rootfs" and recognizes the familiar from module §7.2.4 rather than introducing it. Environments: v86 `lab-alpine` by default where a real kernel is needed (09 §1.4 and 04), dsim where Docker as a whole is needed.

#### 7.4.1. Anatomy: the OCI bundle, the runtime chain, states (R7a)

| # | In the drawing and what moves | Handles and "break it" → what is recomputed | Hands-on and check | Introduces |
|---|---|---|---|---|
| 1 | A `bundle/` directory of two parts: `rootfs/` and `config.json`. Clicking a `config.json` field (`process.args`, `process.user`, `root.path`, `linux.namespaces`, `linux.resources.memory.limit`, `mounts`) highlights the frame or gauge from module §7.2.4 that this field will turn on | Editing a field in the `code` editor → the corresponding frame appears or disappears on the drawing | `mkdir -p demo/rootfs && tar -xf alpine-minirootfs.tar.gz -C demo/rootfs && cd demo && crun spec`, edit `args`, `crun run demo` | D06 |
| 2 | The OCI state diagram: `creating → created → running → stopped`; the marker moves with the commands | — | `crun create`, `crun start`, `crun state demo`, `crun list`; `order` of states | — |
| 3 | The `docker run nginx` chain: docker CLI → (REST, `/var/run/docker.sock`, label `POST /containers/create`) → dockerd (image, network, volumes) → (gRPC, `Tasks.Create`) → containerd → containerd-shim-runc-v2 → (`runc create --bundle`) → runc or crun: creates namespaces and the cgroup, does `execve` and **exits** → the nginx process, whose parent is the shim | A runc / crun switch. "Break it: restart dockerd" — with `live-restore: true` the container is alive, without it, stopped. "Break it: kill the shim" — the container loses its parent and stdio. Lenses: what each component sees | `ps -ef --forest` in v86 (the chain is cut down to crun), the full chain is a model checked against a golden recording of Docker Engine 29.x; `hotspot`: who remains the parent of the process | D10 |
| 4 | Docker states: created, running, paused, restarting, exited, dead; each transition has a command and what changes in the kernel (`pause` — the cgroup freezer) | A `--restart` switch: `no` / `on-failure:3` / `always`; a "the process crashed with code 1" button: the diagram shows that dockerd restarts it, not the kernel | `docker run`, `docker ps -a`, `docker inspect -f '{{.State.Status}}'` (dsim) | D11 |

#### 7.4.2. `docker build` layer by layer with the cache

| # | In the drawing and what moves | Handles and "break it" → what is recomputed | Hands-on and check |
|---|---|---|---|
| 1 | On the left a five-line Dockerfile: `FROM nginx:1.27-alpine`, `RUN apk add --no-cache curl`, `COPY site/ /usr/share/nginx/html`, `EXPOSE 80`, `CMD ["nginx", "-g", "daemon off;"]`. On the right a stack of layer plates: the `RUN` and `COPY` lines produce a plate with a size, `EXPOSE` and `CMD` add a line to the image config and are visible in `docker history` as a `0B` line | Clicking a Dockerfile line highlights its plate and its `history` line | `docker build -t site .`, `docker history site`; `choice`: which lines produce a layer |
| 2 | Two Dockerfiles side by side: `COPY . .` before `RUN npm ci`, and the order `COPY package*.json` → `RUN npm ci` → `COPY . .` | A "change a line in the source" button → both are rebuilt: layers from the cache are gray with a CACHED label, rebuilt ones have a stopwatch. Plate: "the cache breaks from the first changed instruction downward: on the left 3 layers were rebuilt (48 s), on the right 1 (0.4 s)" | `docker build --progress=plain`; `order`: arrange the instructions so that a code change does not reinstall dependencies |
| 3 | Two stacks: the build one (the Go compiler, hundreds of MB) and the final one (`FROM scratch` or distroless, a few MB); the `COPY --from=build` arrow carries over one file | A "multi-stage" toggle: a final image size counter | `fill`: add the second stage; `task`: shrink the image to < 30 MB without changing the application (by `img.layer`) |
| 4 | A stack; `RUN rm` in the top layer | "Break it: delete a file in the top layer" — the image did not get smaller, the lower layer with the file is still there | `docker history` shows the size; `predict` |

#### 7.4.3. `docker pull` by manifest

| # | In the drawing and what moves | Handles and "break it" | Hands-on and check |
|---|---|---|---|
| 1 | A registry, and a tag as a label on a document; `docker pull nginx:1.27-alpine` goes after it | — | `docker pull`, `docker images --digests` (D18) |
| 2 | Three OCI documents: index (a list of platforms linux/amd64, linux/arm64) → manifest (config + a list of layers by digest) → config (variables, CMD, history, `rootfs.diff_ids`). Clicking a digest highlights the blob | A "client platform" switch: amd64 / arm64 / riscv64. "Break it: no platform" → `no matching manifest for linux/riscv64 in the manifest list entries` | `docker manifest inspect nginx:1.27-alpine`; `hotspot`: where it says which command to run by default (D19) |
| 3 | Blobs travel one at a time; before each, the question "do you already have this digest?" — layers shared with alpine do not travel | A "layer X is already present locally" toggle: the downloaded counter is recomputed | Label: "the layer digest in the registry is of the compressed archive, the `diff_id` in the config is of the uncompressed one, so they differ" |
| 4 | The same tag | "Break it: repoint the `latest` tag to another image" — a deploy by tag gets different code, a deploy by digest does not. Lenses: developer (tag convenience), Ops (reproducibility), security (signing and scanning by digest) | `predict` |
| 5 | A `docker save` archive: `index.json` → manifest digest → `blobs/sha256/<digest>` | — | `docker save site -o site.tar`, `tar -xf site.tar`, `jq . index.json`, `jq . blobs/sha256/<digest>`, `tar -tf blobs/sha256/<layer> \| head` (`tar -tf` without `-z`: layers may or may not be compressed, tar detects it itself); `sha256sum blobs/sha256/<layer>` gives the file name. The `manifest.json` file in the archive is a legacy Docker format, not an OCI manifest |

#### 7.4.4. The six boundaries of a container (R7b)

One diagram for the whole module: a container in the center, with six sides-boundaries numbered. Each boundary is its own screen with a mechanism and a "the container does not work" drill whose cause lies exactly on that boundary. Before each drill there is `layerq` in its container version: "on which boundary is the cause?". The "on-call" exam (04) takes a random boundary.

| Boundary | In the drawing and what moves | Handles | "The container does not work" drill | Check |
|---|---|---|---|---|
| 1. Host kernel | The shared kernel at the bottom; `uname -r` inside and outside is the same line | A "namespaced / global sysctl" toggle | The application fails with `Operation not permitted` on `sysctl -w`: a global parameter cannot be changed from a container | Run with the allowed `--sysctl net.core.somaxconn=1024` (a net namespace parameter): `containers[name=app][state=running]` + `explain`: why it cannot be fixed from inside |
| 2. Network | A veth pair → the `docker0` bridge → NAT outward (`MASQUERADE`); `-p 8080:80` as a DNAT rule in the `DOCKER` chain (`ruletrace`); the built-in DNS `127.0.0.11` in a user-defined network; `host` and `none` modes | A `-p` toggle; an "own network / default bridge" toggle; a `--network` switch | (a) `curl app` from a neighboring container → `Could not resolve host`: both are in the default bridge, where there are no names. (b) The service listens on `127.0.0.1:80` inside → from the host `curl localhost:8080` → `Connection reset by peer` | `containers[name=web].networks~'appnet' && http.web.status=200` |
| 3. Storage | Lower layers, the upper layer (disappears with `docker rm`), a volume, bind, tmpfs | A `docker rm` button → upper is gone, the volume remains | "The DB data disappeared after the container was recreated" | `containers[name=db].mounts[type=volume][destination=/var/lib/postgresql/data]` |
| 4. Process and signals | PID 1 in the container; `docker stop` → SIGTERM → 10 s → SIGKILL (a stopwatch); zombies; `--init` (tini) | A `--stop-timeout` slider; a shell form / exec form `CMD` switch | `CMD node app.js` in shell form: `sh` does not pass on SIGTERM, stop hangs for 10 s, code 137 | `containers[name=app].exitCode=0` after `docker stop` in under 3 s (`proc.exit reason=signal`) |
| 5. I/O and logs | The process's stdout/stderr → the `json-file` logging driver → `docker logs` | A "writes to a file / to stdout" toggle | The application writes to `/var/log/app.log`, `docker logs` is empty | `docker logs app` contains a `listening` line after the configuration is fixed |
| 6. Configuration and identity | env, secrets (as a file, not a variable), UID inside and outside, userns-remap, permissions on a bind mount | `--user 1000:1000`, `:ro` | A container with `USER 1000` cannot write to a `root:root 0755` bind directory → `Permission denied` | `files['/srv/data/out.txt'].exists && containers[name=app][state=running]`, without `--privileged` (`forbid`) |

#### 7.4.5. Hardware → VM → containers → nesting (R7c)

| # | In the drawing (`towers`) and what moves | Handles → what is recomputed | Hands-on and check | Introduces |
|---|---|---|---|---|
| 1 | One tower: hardware → kernel → three applications. Counters: "hardware load", "start time", "memory used" | A "number of applications" slider 1–50. Plate: "one application per server: hardware load around 10%; the rest sits idle" | — | — |
| 2 | Two towers side by side on a shared axis: on the left "on hardware", on the right "VM": hardware → hypervisor → N × (guest kernel → libraries → application) | The same slider: on the right, a "guest kernel" plate with its own memory is added for each copy. The numbers come from data with a source (`hold` until checked on a stand) and from the measurement on screen 6 | — | D02 |
| 3 | The right tower changes to "containers": hardware → kernel → runtime → N frames | The start counter drops to fractions of a second, memory barely grows (shared layers once). Plate: "50 copies: VMs +N × hundreds of MB per guest, containers +N × application memory" | `predict` | D07 |
| 4 | Both towers | A "kernel vulnerability" toggle: in containers the **shared** kernel is highlighted in the error color with a ⨯ on all frames; in VMs, one guest kernel, the neighbors are intact, and the hypervisor remains exposed (a thin strip labeled "the attack surface is smaller, but it exists"). Label on the boundary: "escaping a container = code in the host kernel" | `predict` before switching on | — |
| 5 | Nesting today, three presets on one toggle: (a) containers in a cloud VM: hardware → hypervisor → guest kernel → containerd → pods (typical managed Kubernetes); (b) Kubernetes on bare metal; (c) a VM inside Kubernetes through KubeVirt, as in Cozystack: hardware → kernel → kubelet → `virt-launcher` pod → QEMU/KVM → guest kernel → application | Clicking a layer: who manages it and how to look at it | `explain` against a rubric: "why in the cloud containers run inside VMs" (tenant isolation, shared kernel, the VM as a security boundary, density) | — |
| 6 | "You are inside a VM right now": a split screen with v86 | The learner's measurement goes into the counters of screens 2–3 | `dmesg \| head -30` and `cat /proc/cpuinfo \| head`: signs of emulated hardware (BIOS lines, network card model, disk; the exact lines are fixed by the `dt-kernel` golden recording, until then the screen is `hold`). `uname -r` and `ps` outside and inside `crun run demo`: one kernel, different processes. Measurement: `time crun run demo true` against a "boot a second v86 machine" button (cold boot to the `TRAINER_READY` marker); a table of the two numbers is built on the screen. Goal: `containers[name=demo][state=running] && env.kind=v86` | — |

### 7.5. Kubernetes

Three stages (R12): **1** — the browser: kube-lite and the hybrid (§3.18), architecture, objects, `kubectl`, the reconciliation loop, networking; **2** — a single-node real cluster on your own machine or one VPS (k3s, minikube or kind): Helm, Gateway API, images from a real registry; **3** — kubeadm on 3+ VMs. The explanations below belong to stage 1; stages 2–3 are `realstage`, §7.5.7. The main entry from outside is Gateway API; Ingress is a footnote as legacy (05 §0).

#### 7.5.1. `kubectl apply` through all components ("Kubernetes from blocks")

Components appear when something stops working without them; the order follows the 01 graph.

| # | In the drawing and what moves | Handles and "break it" | Hands-on and check | Introduces |
|---|---|---|---|---|
| 1 | A node with a runtime and a `web` container on it. The node goes dark (shutdown) — `web` disappears, and nobody brings it back up | — | `choice`: who will bring `web` back up | K01 |
| 2 | The "observe → compare with desired → act" loop — the ring drawing from §3.16 without the columns | — | `choice`: what a controller does if desired = actual | K02, then K03 as a separate screen |
| 3 | One door: all arrows go to the API server; the constructor does not allow direct connections | — | `kubectl get nodes`, `kubectl api-resources \| head` | K04 |
| 4 | Where the API stores things: behind the API server is etcd with three members, labeled "quorum 2 of 3" | "Break it: kill 2 of the 3 etcd nodes" — writes stop, reads from the API still answer | `predict` | K06 |
| 5 | Who decides where: the scheduler watches (`watch`) for units of work without a node and writes in a node (`bind`); the arrows are labeled with verbs | "Break it: remove the scheduler" → `Pending`, and the pod has **no events** at all (nobody to write them) | `kubectl describe` → `Events: <none>` | K07 |
| 6 | Who starts things on a node: the kubelet sees the assignment → asks the runtime via CRI → reports status | "Break it: stop the kubelet" — see §7.5.4 | `crictl ps` on the node | K08 (the runtime is already D10, here it is `uses`) |
| 7 | A pod: a group of containers that are scheduled and started together | — | `kubectl get pod -o yaml` with `nodeName` and `status` highlighted | K09 |
| 8 | Labels and selectors: tags on pods, and a selection by them highlights the cards | A "selector" slider: which pods are selected | `kubectl get pods -l app=web` | K10 |
| 9 | Who keeps three copies: Deployment → ReplicaSet → pods; a chain of documents labeled `ownerReferences` | `kubectl delete pod` — the controller notices "2 of 3" and creates a new one | `kubectl apply -f deploy.yaml`, `kubectl get deploy,rs,pods`; `order`: API → etcd → Deployment controller → ReplicaSet → pod → scheduler → kubelet → runtime | K11, K12 |
| 10 | **Build the cluster yourself**: an empty field, the whole palette | Trap blocks by level (`traps`): a Docker daemon on the node, a "configuration database" instead of etcd, a direct scheduler → kubelet connection | Task: `kubectl apply -f app.yaml` (a Deployment with 3 replicas + Service + Gateway + HTTPRoute) gives a 200 response; L2: "a single control plane — what dies first when the node with etcd goes down" | — |

Service, kube-proxy, DNS and entry from outside are in the networking section §7.5.6, one concept per screen.

#### 7.5.2. Pod scheduling

| # | In the drawing and what moves | Handles and "break it" → what is recomputed | Check |
|---|---|---|---|
| 1 | Three nodes with CPU and memory bars (`allocatable`, requests taken), a pod with a `requests` card | Sliders: the pod's requests, the number of replicas, a taint on node 2. The model runs the filters (NodeResourcesFit, TaintToleration, NodeAffinity) — the filtered-out nodes go dark with a reason label — and shows the scores of the remaining ones | `predict`: which node the pod will land on |
| 2 | The same nodes | "Break it: requests larger than any node" → the real event `0/3 nodes are available: 3 Insufficient cpu. preemption: 0/3 nodes are available: 3 No preemption victims found for incoming pod.` | `predict` the event text; `kubectl describe pod` |

#### 7.5.3. Rolling update

| # | In the drawing and what moves | Handles and "break it" | Check |
|---|---|---|---|
| 1 | Two bars: the old ReplicaSet (v1) and the new one (v2), pods as squares; an "available / desired" counter | Sliders `replicas` 1–10, `maxSurge` 0–100%, `maxUnavailable` 0–100%, a readiness toggle. The model shows step by step how many pods of each version are ready. `maxSurge=0` and `maxUnavailable=0` together is a real validation error | `predict` the number of pods at step 2 with surge 1 / unavailable 0 |
| 2 | The same bars | "Break it: v2 fails readiness" → the rollout stops, after `progressDeadlineSeconds` (600 s) the condition is `ProgressDeadlineExceeded`, v1 keeps serving; a `kubectl rollout undo` button | `kubectl rollout status`, `kubectl rollout undo` |

#### 7.5.4. Node failure

| # | In the drawing and what moves | Handles | Check |
|---|---|---|---|
| 1 | A timeline with the real defaults: the kubelet stops renewing its Lease (the renewal counter on the node freezes) → after `node-monitor-grace-period` (50 s since v1.32) the Ready condition = Unknown, `kubectl get nodes` shows `NotReady`, the node gets the taint `node.kubernetes.io/unreachable:NoExecute` → the pods tolerate it for `tolerationSeconds: 300` → eviction → the ReplicaSet creates **new** pods on other nodes. The old ones stay `Terminating` until the node comes back or they are force-deleted | Sliders for the grace period and `tolerationSeconds` in the pod template; speed-up ×10 / ×60 | `order` of the timeline; `predict`: when the pod from node 2 gets a replacement. A label for StatefulSet: "a new pod with the same name is not created until the old one is deleted" |
| 2 | On the hybrid (§3.18): "kill a node" stops a real v86 machine | — | `kubectl get pods -o wide -w` |

#### 7.5.5. Reconciliation loop (R10)

| # | In the drawing (`reconcile`) and what moves | Interventions and handles → what is recomputed | Hands-on and check |
|---|---|---|---|
| 1 | On the left "Desired" (YAML from etcd, `spec.replicas: 3`), on the right "Actual" (pods as cards), in the middle the `observe → diff → act` ring with an iteration counter and the line `want 3 · have 2 → create 1 pod` | Delete a pod, kill a node, `replicas` 0–10 with a slider, change the image. After each action the ring makes one iteration and the difference collapses. "Pause the controller": three changes in a row — after the pause is lifted, one action. Plate: "the controller compares state, not the history of events: missed changes are not lost" | `kubectl delete pod`, `kubectl scale deploy web --replicas 5`; `predict` |
| 2 | A chain: the same ring four times horizontally — the Deployment controller (desired: a ReplicaSet with the template hash) → the ReplicaSet controller (N pods) → the scheduler (the pod has a `nodeName`) → the kubelet (containers started). The actual state of one link is the desired state of the next; the object is labeled on the arrow | Changing the image sends a wave along the chain, and you can see which ring is working now. A "watch delay" handle on each link: the loops are independent and converge in any order | `order` of the links |
| 3 | Your own controller: in the "Desired" column a `Website` object (CRD), in the middle the learner's code in `code`, on the right the Deployment and Service it created. A fifth ring "your code" appears in the chain | Start, stop, "delete the Deployment by hand" | Checks from 05: a deleted Deployment comes back; deleting the Website removes everything. Label: "Kubernetes does not distinguish your controller from its own: the same watch, the same loop; an operator is such a loop for its own resource". A "the same in Go" button shows the equivalent `Reconcile(ctx, req)` on controller-runtime alongside (read-only) — a bridge to the operator pet project |

#### 7.5.6. Kubernetes networking (R9)

A separate large section of the block. The environment is kube-lite + netlab (tier A); on the hybrid (§3.18), the real iptables, veths and bridges of the v86 nodes.

| # | In the drawing and what moves | Handles and "break it" → what is recomputed | Hands-on and check | Introduces |
|---|---|---|---|---|
| K-N1 | **The network model.** Nodes, each pod has its own IP from the node's `podCIDR`; three rule labels: pod ↔ pod without NAT, node ↔ pod without NAT, a pod sees its own IP the same way others see it; a frame "this promise is fulfilled by the CNI" | A "CNI not installed" toggle → the node is `NotReady`, `container runtime network not ready: … cni plugin not initialized` | `choice`: who gives a pod its IP | K26 |
| K-N2 | **Pod ↔ pod on one node.** Pod A's netns → veth → the `cni0` bridge → veth → pod B; the packet travels along this line | A "number of pods" slider: the number of veths on the bridge grows | `ip link` on the node, `hotspot`: where the packet passes from the pod's netns into the node's netns | — |
| K-N3 | **Pod ↔ pod across nodes.** Three modes of one diagram: routing (`10.42.1.0/24 via 192.0.2.11`), VXLAN (a double envelope: the outer UDP 8472 with node IPs, the inner one with pod IPs), Cilium eBPF (no bridge, a program on the veth) | A mode switch (L1+); an MTU slider: 1450 inside VXLAN with 1500 outside | `predict`: which source IP `tcpdump` will see on the physical interface | — |
| K-N4 | **Service: an address that is on no interface.** The ClusterIP is drawn as a dashed node without an interface that "appears" only at the moment of DNAT; EndpointSlice → kube-proxy rules (`ruletrace`) | A kube-proxy mode switch: iptables / nftables / IPVS / Cilium eBPF; a "replicas" slider 1–5 recomputes `--probability` | **Drill:** `iptables -t nat -L KUBE-SERVICES -n \| grep 10.43.12.7` → the `KUBE-SVC-…` chain → `KUBE-SEP-…` → `DNAT to 10.42.1.15:8080`; the learner writes the address and port for the **second** entry to `/tmp/ep.txt`. Check: `files['/tmp/ep.txt'].text=<IP:port of the second EndpointSlice entry>` (addresses are parameterized per attempt). Documentation rung 3: a link to kubernetes.io › Virtual IPs and Service Proxies. `ip a` on the node confirms that the ClusterIP is on no interface | K14, then K15 as a separate screen |
| K-N5 | **Cluster DNS.** The pod's `/etc/resolv.conf`: `nameserver 10.43.0.10`, `search default.svc.cluster.local svc.cluster.local cluster.local`, `options ndots:5` | An `ndots` slider 1–5: the number of queries for `api.example.com` is recomputed (at 5, first three searches through the search domains with NXDOMAIN, for each record type). Plate: "ndots 5 → 1: the external name resolves on the first query instead of the fourth" | `nslookup web`, `nslookup web.default.svc.cluster.local` from a pod; `predict` the number of queries | K16 |
| K-N6 | **Entry from outside.** NodePort (the `KUBE-NODEPORTS` chain), LoadBalancer (external IP → NodePort), Gateway API (Gateway → HTTPRoute → Service), Ingress as a footnote | `externalTrafficPolicy: Local / Cluster`: whether the client IP is preserved, whether a node without a pod answers | `order` of the path | K17, Gateway API (replaces K18 in 01, reported to 05) |
| K-N7 | **NetworkPolicy.** By default everything is open; with a default-deny policy the packet is dropped at the receiver's node (⨯ on the edge) | A "the CNI does not support NetworkPolicy" toggle (for example, flannel without add-ons) → the policy is created but changes nothing | `predict`; goal: allow only `app=frontend` → `app=api` | NetworkPolicy (new concept K34 for 01) |
| K-N8 | **"The pod cannot reach the service".** A ladder algorithm: DNS (`nslookup web` from the pod, `ndots`) → Service (`kubectl get svc web`, `port` and `targetPort`) → EndpointSlice (`kubectl get endpointslices -l kubernetes.io/service-name=web`: are there addresses, `ready`) → pod (`kubectl get pod -o wide`, readiness, is it listening on the port) → NetworkPolicy (`kubectl get netpol`; first, does the CNI support policies) | Exactly one link out of five is broken, at random | The learner first points to the link (`layerq` for Kubernetes), then fixes it. Check: `http.web-from-client.status=200`, and "the diagnosis is correct" counts separately (`failId` equals the chosen link) | — |

We do not teach `kubectl get endpoints`: the `v1 Endpoints` API has been deprecated since v1.33, and kubectl prints a warning; `endpointslices` everywhere.

#### 7.5.7. The hybrid and the three stages (R11, R12)

**The stage 1 hybrid lab.** Three v86 nodes of 96 MB each (on a phone, one, the others are models), the control plane is kube-lite. Scenario: `kubectl apply -f web.yaml` → on the `cluster` diagram pods appear in real nodes, and clicking a pod shows its real namespaces and cgroup; `kubectl exec -it web-… -- sh` and inside `ps`, `cat /proc/1/cgroup`; from the node `crun list` and `lsns`; "kill node 2" → the §7.5.4 timeline on real machines; `iptables -t nat -S` on a node shows the rules kube-lite set up for the Service. Goals: the pod on node 3 exists as a process (`procs[cmd=nginx][machine=node-3]`), and after node 2 is stopped, three replicas are ready again.

**Stage 2 (`realstage`, your own machine or one VPS).** Steps: install k3s (or minikube, kind) → `kubectl get nodes` → Helm: install a chart → Gateway API: Gateway + HTTPRoute → an image from a real registry → cleanup, if it is a VPS. Checks are `trainer-check run --track r2`. The cost counter is only for a VPS.

**Stage 3 (`realstage`, kubeadm on 3+ VMs).** The learner takes machines from a cheap Russian or international cloud of their choice or brings up local VMs on their own computer (09 §5.2–5.3). Track steps and checks:

| # | Step | What the learner does | Documentation (rung 3–4) | Check (`trainer-check`) |
|---|---|---|---|---|
| 1 | Order machines | `terraform apply` from the course template with the learner's provider | developer.hashicorp.com › provider | `facts.vms#>=3`, the cost counter is running |
| 2 | Configure machines | `ansible-playbook prepare.yml`: swap, kernel modules, sysctl, containerd | docs.ansible.com, kubernetes.io › Container Runtimes | `sysctl net.ipv4.ip_forward=1`, `units[containerd.service].active=active` on all |
| 3 | Control plane | `kubeadm init` | kubernetes.io › Creating a cluster with kubeadm | static pods in `kube-system` are ready |
| 4 | Workers | `kubeadm join` | the same | `k8s.nodes#=3` |
| 5 | CNI | Cilium via Helm | docs.cilium.io | all nodes `Ready`, `cilium status` OK |
| 6 | Storage | a CSI driver or local-path, a default StorageClass | kubernetes.io › Storage Classes | PVC `Bound` |
| 7 | Certificates | `kubeadm certs check-expiration`, renewal | kubernetes.io › Certificate Management with kubeadm | the certificate validity is extended |
| 8 | Version upgrade | `kubeadm upgrade plan/apply` one minor version up | kubernetes.io › Upgrading kubeadm clusters | the control plane and kubelet versions went up |
| 9 | etcd backup | `etcdctl snapshot save`, then restore on a teaching breakage | kubernetes.io › Operating etcd clusters | the snapshot exists, the deleted object came back |
| 10 | Break and fix a node | the agent introduces a breakage (kubelet stopped, certificate expired, disk full) | — (rung 4) | the node is `Ready` again |
| 11 | **Cleanup** | `terraform destroy` (for local VMs, `vagrant destroy`) | — | `terraform state list` is empty / `trainer-check run --step cleanup` |

### 7.6. CI/CD, IaC, monitoring

#### 7.6.1. `git push` → deploy

| # | In the drawing and what moves | Handles and "break it" → what is recomputed | Check |
|---|---|---|---|
| 1 | Left to right: `git push` → webhook → queue → runner → stages lint → test → build → push image → deploy → registry → server or cluster. A commit card travels through the stages, each with a time and an artifact | A "dependency cache" toggle: the test stage gets shorter, the total time counter is recomputed. A "manual gate before prod" toggle: a button appears before deploy | `order` of the stages |
| 2 | The same pipeline | "Break it: a test fails with code 1" — the following stages are gray, the commit is red. "Break it: the `REGISTRY_TOKEN` secret is empty" — on push `unauthorized: authentication required` | `predict`; then a `task` in the pipeline constructor (06) |

#### 7.6.2. `terraform plan/apply` and state

| # | In the drawing and what moves | Handles and "break it" | Check |
|---|---|---|---|
| 1 | Three columns: "code (.tf)", "state", "cloud". `plan` is a comparison of the code with the state refreshed from the cloud; resources carry the marks `+ ~ - -/+` | Editing an attribute in the code (a regular one — `~` in place, ForceNew — `-/+` replacement), removing a resource from the code (`-`) | `predict` the line `Plan: 1 to add, 0 to change, 1 to destroy.` |
| 2 | The same columns | "Break it: a manual change in the cloud" (drift) — `plan` proposes to revert it. "Break it: state lost" — `plan` wants to create everything anew, although the resources exist in the cloud (a transition to `import`) | `terraform plan` in tfsim; `task`: restore the state via `import` |

#### 7.6.3. Idempotent Ansible run

| # | In the drawing and what moves | Handles and "break it" | Check |
|---|---|---|---|
| 1 | A grid: rows are playbook tasks, columns are runs 1, 2, 3; cells fill with the statuses `ok`, `changed`, `failed`; on the right the contents of the file on the machine | A task switch: `lineinfile` / `shell: echo … >> file`; a `changed_when` field. Plate: "second run: with `lineinfile` everything is ok, with `shell` changed again and the file has two identical lines" | the `idempotent` goal from 06 |

#### 7.6.4. From scrape to notification

| # | In the drawing and what moves | Handles and "break it" → what is recomputed | Check |
|---|---|---|---|
| 1 | target `/metrics` → scrape (every `scrape_interval`) → TSDB (points appear on the time axis one by one) → rule (`expr`, `for`) → states `inactive → pending → firing` → Alertmanager (`group_wait`, `group_interval`, `repeat_interval`) → receiver | Sliders `scrape_interval` (1 min by default), `for`, `group_wait` (30 s by default). Plate: "from the start of the failure to the chat message — 1 min 45 s; reducing `for` to 0 shortens it to 45 s, but the alert will start flapping" | `predict` the time to notification |
| 2 | The same path | "Break it: target down" — the `up` metric becomes 0 (rather than disappearing); "Break it: `for: 0`" — the alert fires and clears on every spike | `promql_equiv` for the alert rule |

---
## 8. Engine acceptance on the flagships

The version 1 flagships have turned into acceptance scenarios: the engine is considered ready for a block when it passes that block's flagship in full (Playwright e2e: every goal of every screen is completed by a script, screenshots of both themes and two widths, a run in calm mode).

| Flagship | Storyboard location | Primitives | Bus events | Environment | Commands that must work |
|---|---|---|---|---|---|
| "How the kernel isolates and limits" | §7.2.4, text — 02 | `split`, `stepper` on a model, `breakit`, gauges, `docview peek` on `man 7 namespaces` | `proc.*`, `ns.*`, `cgroup.*`, `fs.mount`, `fs.copyup`, `net.link` from `trainer-agent watch` | B `lab-alpine`; a recording for phones | `ps -eLf`, `ls /proc/<pid>/task`, `strace -f`, `unshare` (`--pid --fork --mount-proc --mount --uts --net --ipc --user --map-root-user`), `nsenter -t -a`, `lsns`, `readlink`, `id`, `hostname`, `ip a`, `mkdir`/`echo >` in `/sys/fs/cgroup`, `head -c … /dev/zero \| tail`, `dmesg \| tail`, `capsh --print`, `setcap`, `getcap`, `chroot`, `mount --bind`, `pivot_root`, `mount -t overlay` |
| "Container: anatomy and six boundaries" | §7.4.1, §7.4.4–7.4.5, text — 04 | `towers`, `stepper`, `lenses`, `ruletrace`, `layerq`, `code` | the same + `net.rule`, `log.line`, `proc.signal` | B for crun and measurements, dsim for Docker | `crun spec/create/start/run/state/list`, `docker run` (`--rm -d -p --network --user --init --stop-timeout --sysctl`), `docker stop`, `docker logs`, `docker inspect`, `iptables -t nat -L DOCKER -n`, `time` |
| "How an image is packaged" | §7.4.2–7.4.3, text — 04 §5 | `stepper`, layers, `code` (Dockerfile) | `img.layer`, `fs.copyup` | A (dsim + the course registry) | `docker build` (`-t --no-cache --target --progress=plain`), `docker history`, `docker image inspect`, `docker save/load`, `docker manifest inspect`, `docker push/pull/tag`, `tar -tf/-xf`, `sha256sum`, `jq`, `du -sh` |
| "Networks: from the map to the packet" | §7.3, text — 03 | `zoommap`, `seq`, `packets`, `fabric`, `ruletrace`, `protocard`, `layerq` | `net.*`, `l2.frame`, `dns.query` | A (netlab), B (`lab-net`, several machines) | `ip a/route/neigh/link`, `ping` (`-M do -s`), `tracepath`, `traceroute`, `dig` (`+trace +short +tcp @server`), `ss -tlnp/-ti/-o`, `curl` (`-v -I -H -w --resolve --connect-timeout --http2`), `openssl s_client`, `tcpdump -n -e`, `iptables -t nat -L -n -v`, `conntrack -L`, `sysctl`, `wg show` |
| "Kubernetes: blocks, loop, networking, hybrid" | §7.5, text — 05 | `constructor`, `reconcile`, `code`, `cluster`, `ruletrace`, `packets` | `k8s.*`, `node.agent`, `net.rule` | kube-lite, hybrid with v86 | `kubectl get` (`nodes`, `pods -o wide`, `deploy,rs,pods`, `svc`, `endpointslices -l`, `events --sort-by=.lastTimestamp`, `-n kube-system`), `describe`, `apply`, `delete`, `scale`, `rollout status/undo`, `logs`, `exec`, `explain`, `api-resources`, `get -o yaml`, `crictl ps`, `systemctl stop kubelet`, `iptables -t nat -L KUBE-SERVICES -n`, `nslookup`, `etcdctl get /registry/pods --prefix --keys-only` (L2) |

Acceptance budget: a transition between steps ≤ 100 ms from handle to frame; the first screen of a lesson ≤ 2 s on a cold cache at 50 Mbit/s (without v86); a three-node hybrid ≤ 900 MB of tab memory (the budget of 05 §5.9 and 09 §1.7; 1.5 GB is the emergency ceiling at which the lab itself switches to `sim` nodes).

---

## 9. Content format

### 9.1. Where it lives

```
content/
  concepts.yaml                    concept graph of 01 §6.1 + card fields (short, card)
  sources.yaml                     registry of sources with anchors and local copies
  docs/                            offline documentation corpus (§4.2)
  protocols/<id>.yaml              protocol cards (§9.6)
  providers.yaml                   VM prices with check date (`realstage`)
  blocks/<block>/block.yaml        modules, order, entry check, doc_ladder
  lessons/<lesson>/lesson.yaml     lesson in the format of 01 §7 + widgets
  lessons/<lesson>/diagrams/*.yaml
  lessons/<lesson>/sims/*.yaml     initial states and recordings
web/src/models/*.ts                process models (`ProcessModel`, §3.1)
```

The build (`scripts/build-data.sh`, modeled on Sankofa) validates everything and writes `data/lessons/<id>.json` and `data/index.json`. A validation error fails the build.

### 9.2. Mapping from version 1 and the unified format

| Was in 08 v1 | Now |
|---|---|
| `glossary.yaml`, string ids (`pid-namespace`), `stems` | `concepts.yaml`, graph ids (`L35`), `forms` (RU/EN regular expressions); `short` and `card` are concept fields |
| `scenes[]` with `kind: story/mechanism/lab/check` | `screens[]` with `kind` from 01 plus `mechanism`, `lab`, `breakit`; the `step` field is the lesson anatomy step |
| `level: [beginner, intermediate, experienced]` | `levels: [L0, L1, L2]` |
| the lesson's `requires` | the screen's `uses`; a lesson does not declare prerequisites, the build derives them |
| several `introduces` per scene | `introduces` ≤ 1 per screen; in a stepper, per step |
| `allow_early` | `forward` with a "for now it is enough to know…" card, no more than one per lesson |
| "for experienced learners, collapsed terms count as introduced" | introduced if the screen has been completed or the concept is `placed` by the entry check (§5.2) |
| `checks` / `goals` with `proc[...]`, `cgroup[...]` | goals of 09 §2.4 (`needs`, `when`, `keep`, `envs`, `fail`, `probe`), the predicate language of 09 §2.3 |
| `hints` with `reveals: true` | `hints` H1–H5 with an allowed documentation rung; no `reveals` |
| `ai_context` with a list of forbidden words | `ai_context` is what is important to explain here; term discipline is set by `known_concepts` (§3.21) |

### 9.3. Lesson screen

```yaml
id: linux.isolation
block: linux
core: L35
levels: [L0, L1, L2]
hook: { ru: "Тимлид: «Почему в контейнере ps показывает два процесса, а на хосте сорок?»", en: "..." }
order:
  L2: [hook, practice:challenge, explain, look, practice, exit]
screens:
  - id: s3
    kind: mechanism
    step: look
    levels: [L0, L1, L2]
    introduces: [L35]
    uses: [L17, L26, L27]
    doc_step: 2                                     # overrides the module rung
    doc: { ref: man-pid-namespaces, anchor: DESCRIPTION }
    widgets:
      - widget: split
        machine: { env: v86, image: lab-alpine, snapshot: isolation-s3 }
        diagram: diagrams/ns-pid.yaml
      - widget: stepper
        model: ns-pid
        params: { viewpoint: { default: inside } }
        breaks: [no-fork]
    text:
      ru: "Команда [[L35|unshare]] просит ядро ..."
      en: "..."
      draft: true
    claims:
      - text: { ru: "Без --fork первый потомок становится PID 1 и после его выхода fork в этом пространстве невозможен", en: "..." }
        sources: [man-unshare, man-pid-namespaces]
        hold: true
        check: "verify error text on dt-kernel 6.12 in lab-alpine"
    goals:
      - id: g-own-pid1
        say: { ru: "Запусти sh, который будет PID 1 в своём пространстве имён PID", en: "..." }
        needs: [procs, ns]
        when: "procs[cmd=sh][ns.pid!=@host.ns.pid][nspid~1]"
        envs: [v86]
        fail:
          - if: "procs[cmd=sh][ns.pid!=@host.ns.pid] && !procs[cmd=sh][nspid~1]"
            say: { ru: "Пространство создано, но sh в нём не первый: нужен --fork", en: "..." }
            term: L35
    hints:
      - { id: H1, ru: "Что должно стать другим для нового sh — номер или список процессов?", en: "...", max_doc_step: 3 }
      - { id: H2, ru: "Посмотри на команду, которая создаёт новые пространства имён", en: "...", max_doc_step: 3 }
      - { id: H3, docview: { ref: man-unshare, anchor: OPTIONS, highlight: "--fork" }, max_doc_step: 2 }
    ai_context: { ru: "Ученик впервые видит пространство имён PID; важно различать номер внутри и снаружи.", en: "..." }
```

### 9.4. Sources

```yaml
- id: man-pid-namespaces
  url: https://man7.org/linux/man-pages/man7/pid_namespaces.7.html
  lang: en
  kind: doc                 # doc | spec | article | video | book | lab
  local: docs/man/pid_namespaces.7.json
  anchors: { DESCRIPTION: "DESCRIPTION", init: "The namespace init process" }
  license: "man-pages (see page header)"
  checked: 2026-11-18
  version: "Linux 6.12"
```

Rules: every theory claim has at least one `doc` or `spec` source in English; every `mechanism` screen has a Russian-language source, and if there is no good one, `ru_missing: true` (visible in the editorial report). The two-confirmation rule for `hold`: `doc` + `lab` (a golden recording or a check on a stand of the stated version). The "How we know this" block at the end of a lesson is built automatically. A source referenced by a `docref` or `docview` must have `local` and an anchor.

### 9.5. Model and recording

```yaml
# sims/unshare-pid.recording.yaml — a recording of a live session for a debrief (source: recording)
steps:
  - id: s1
    label: { ru: "unshare", en: "unshare" }
    cmd: "unshare --pid --fork --mount-proc sh"
    events:
      - { t: ns.create, at: 91234, machine: host, kind: pid, id: "pid:4026532201", by: 4126 }
      - { t: proc.spawn, at: 91240, machine: host, pid: 4127, ppid: 4126, cmd: sh, nspid: [4127, 1], ns: { pid: "pid:4026532201" }, cgroup: "/", uid: 0 }
    caption: { ru: "Ядро создало новое пространство имён и первым поселило в нём sh.", en: "..." }
```

The process model lives in `web/src/models/<id>.ts` and is only named in YAML (§3.1). CI runs each model with default parameters and compares its events with the environment's recording; recordings are obtained from the environment (`op: 'record'`), and the author adds the captions.

### 9.6. Protocol card

```yaml
# content/protocols/dns.yaml
id: dns
level: L0                       # when it opens in the catalog
concept: N08
name: { ru: "DNS", en: "DNS" }
why:  { ru: "Превращает имя в адрес, чтобы людям не помнить IP", en: "..." }
layer: L7
transport: ["udp/53", "tcp/53", "tls/853 (DoT)", "https/443 (DoH)"]
model: dns-resolve              # seq is built from the model
observe:
  - { cmd: "dig shop.example.com", note: { ru: "ответ резолвера: смотри ANSWER и Query time", en: "..." } }
  - { cmd: "dig +trace shop.example.com", note: { ru: "обход делает сам dig, а не резолвер", en: "..." } }
  - { cmd: "tcpdump -n -i eth0 port 53" }
breaks:
  - { id: nxdomain, layer: L7, symptom: "Could not resolve host", cause: { ru: "имени нет", en: "..." }, proof: "dig → status: NXDOMAIN" }
  - { id: servfail, layer: L7, symptom: "долгое ожидание, затем ошибка", cause: { ru: "авторитетный сервер недоступен или ошибка DNSSEC", en: "..." }, proof: "dig → status: SERVFAIL" }
  - { id: udp-blocked, layer: L4, symptom: "timeout", cause: { ru: "межсетевой экран режет 53/udp", en: "..." }, proof: "dig +tcp отвечает, dig — нет" }
docs: [rfc1034, rfc1035, man-dig]
```

### 9.7. Block data

```yaml
# blocks/linux/block.yaml (fragment)
id: linux
modules:
  - { id: linux.shell, doc_ladder: 1 }
  - { id: linux.help, doc_ladder: 1, introduces_help: L08 }   # from this module on, docref appears for L0
  - { id: linux.files, doc_ladder: 2 }
  - { id: linux.processes, doc_ladder: 2 }
  - { id: linux.services, doc_ladder: 3 }
  - { id: linux.isolation, doc_ladder: 3 }
  - { id: linux.ops-drills, doc_ladder: 4 }                  # ≥ 2 tasks with beyond: true
exam: { doc_ladder: 5, beyond_share: 0.25, docs: [man, systemd-docs] }
```

---

## 10. Accessibility

WCAG 2.2 AA requirements, plus what Sankofa already complies with.

- **Text without interactivity.** Every screen reads without interaction: a diagram has a text description, a stepper has a list of steps as text (expandable under the diagram and always available to the screen reader), and the "What changed" plate has `aria-live="polite"`.
- **Diagrams.** SVG with `role="img"` and `aria-labelledby` pointing to the title and the description from `describe()`. Interactive nodes have `tabindex="0"`, `role="button"`, a visible focus (a 2 px `--c-flow` outline + a 2 px gap). Changes are announced in one sentence ("Process tail killed: memory limit of 64 MB exceeded").
- **Handles.** Sliders are a native `input type=range` with styling, a label and units; toggles are `role="switch"`.
- **Terminal.** xterm.js with `screenReaderMode` when a screen reader is selected in the settings (we do not guess). A duplicate output feed is a plain `<pre>`.
- **Documentation.** `docview` is plain HTML with section headings, and search is keyboard-accessible.
- **Dragging.** Every drag has a keyboard method and a "tap-tap" method (WCAG 2.5.7).
- **Motion.** `prefers-reduced-motion` turns on "step by step" by default; continuous animation does not start by itself; flashes go through `FlashGate`.
- **Color.** Never the only carrier of meaning (stroke, shape, mark, label — §6.3). Both themes are checked by a contrast and ΔE test in CI.
- **Language.** `lang="ru"` / `lang="en"` on the root and on fragments in another language (commands and output are `lang="en"`, `translate="no"`).
- **Target sizes.** ≥ 24×24 CSS px (WCAG 2.5.8); on a phone, chips, toggles and sliders are ≥ 44 px.

## 11. Phone

The phone is a full platform for reading, steppers, models with handles, "break it", the constructor, the protocol catalog and quizzes; tier A terminal labs work, and the main input method is chips. Layout: the sticky part at the top no higher than 45% of the screen, the text under it; a split becomes tabs with a changes dot. When the input line has focus, the diagram collapses into a strip with the last event ("+ net frame"). Landscape orientation gives a side-by-side split. v86 on a phone is on a button press and only one machine (R11); with `deviceMemory < 4`, recorded mode (09 §1.4); in `fabric` and `cluster` the other nodes are models with a label. A long lab offers a QR handoff to the computer. `docview` on a phone is a full-height bottom sheet.

## 12. Size and lazy loading

Budgets (gzip, size-limit in CI on every PR; exceeding one is a red build):

| Chunk | Budget | What is inside |
|---|---|---|
| Shell | 60 KB | Router, catalog, `h()`, i18n, progress, loader stubs |
| Lesson host | 40 KB | `Scroller`, screens, concept cards, lenses |
| Each widget (`stepper`, `seq`, `diagram`, `packets`, `constructor`, `quiz`, `towers`, `zoommap`, `ruletrace`, `reconcile`, `fabric`, `cluster`, `realstage`) | 15–30 KB | Its own module; loaded when a screen with it approaches (`rootMargin: 25%`) |
| Process models | 2–10 KB each | Per screen |
| Terminal (xterm.js + addons + wiring) | 120 KB | With the first `terminal`/`split` |
| `code` editor (CodeMirror 6) | ≤ 150 KB | On demand; the `sucrase` transpiler separately |
| `docview` + documentation corpus | 20 KB + up to 2 MB per block | The corpus per block, on demand |
| Simulators | per 09 §1.3 | Stand core 120 KB, netlab 80 KB, dsim 100 KB, kube-lite 300 KB |
| Lesson data (JSON) | 80 KB | Texts in both languages, diagrams, recordings |
| Illustrations | 150 KB per lesson | Only SVG drawings and screenshots from the stand |
| v86 | per 09 §1.4 | Engine ≤ 0.5 MB, snapshot ≤ 40 MB, on a button press, cached in Cache Storage |
| Several machines | node snapshot ≤ 25 MB | Guest 64–128 MB (96 by default); tab ≤ 900 MB with three nodes (09 §1.7); a fourth with `deviceMemory ≥ 8`; phone — one |

Rules: no heavy diagram libraries (Mermaid, Cytoscape, D3 as a whole) — our own SVG primitives; from D3, if needed, only `d3-shape` and `d3-interpolate`. Fonts are subsets of Literata, Inter and IBM Plex Mono. The Service Worker (one per scope, 09 §3.2) caches the shell, completed lessons and the documentation corpus, so reading, models and simulators work offline.

## 13. Order of work

The same pipeline as for Sankofa special projects: research (EN+RU sources into the registry, a check on the stated version) → a storyboard in the block document following the §7 form → the owner → the process model and its Vitest → recordings from the environment and checking the model against them → texts with `draft: true` → the editor removes `draft` → the validator (graph, sources, `hold`, style rules, the ladder) → Playwright e2e → critics (beginner, practicing engineer, editor) → rollout.

Order:

1. **"How the kernel isolates and limits"** (§7.2.4, v86 `lab-alpine`). It exercises `ProcessModel`, `split`, `breakit`, gauges, `docview peek` and tests the platform's main risk — a live diagram driven by a real kernel through `trainer-agent watch` (09, phase 0).
2. **Reconciliation loop** (§7.5.5, kube-lite, without v86): `reconcile`, `code`, running the learner's code in a Worker.
3. **`fabric` with two machines** (§3.17, §7.3.3): the JS switch, ARP and hub/switch — risk R11.
4. **`docview` and the man corpus for the Linux block** (§4): all subsequent lessons need them.
5. The remaining catalog explanations, in the order of the roadmap blocks; `cluster` and `realstage` for the Kubernetes block.

---

## 14. Sources

**Genre and graphics**
- Bret Victor, "Explorable Explanations" — https://worrydream.com/ExplorableExplanations/
- Bartosz Ciechanowski — https://ciechanow.ski/ (a model for graphics and live models)
- Josh W. Comeau — https://www.joshwcomeau.com/ (a model for presentation and transitions)
- Red Blob Games (Amit Patel) — https://www.redblobgames.com/ (the "text ↔ diagram" link)
- Hohman, Conlen, Heer, Chau, "Communicating with Interactive Articles", Distill 2020 — https://distill.pub/2020/communicating-with-interactive-articles/
- Nicky Case, explorables — https://ncase.me/ ; catalog https://explorabl.es/
- Learn Git Branching — https://github.com/pcottle/learnGitBranching
- Flexbox Froggy — https://flexboxfroggy.com/
- iximiuz Labs — https://labs.iximiuz.com/tutorials ; "How Container Networking Works" — https://labs.iximiuz.com/tutorials/container-networking-from-scratch
- Killercoda, Kubernetes scenarios — https://github.com/killercoda/scenarios-kubernetes
- Scrollama — https://github.com/russellsamora/scrollama (the principle; we have our own `Scroller`)
- Not as a style but as the opposite genre: Julia Evans's zines — https://wizardzines.com/ ; the DNSimple comic "How DNS Works" — https://dnsimple.com/comics/how-dns-works/

**Browser environments**
- xterm.js — https://xtermjs.org/ ; `@xterm/xterm` — https://www.npmjs.com/package/@xterm/xterm ; screen reader mode — https://xtermjs.org/docs/api/terminal/interfaces/iterminaloptions/
- v86 — https://github.com/copy/v86 ; networking — https://github.com/copy/v86/blob/master/docs/networking.md
- CodeMirror 6 — https://codemirror.net/ ; sucrase — https://github.com/alangpierce/sucrase

**Linux: isolation and limits**
- man namespaces(7), pid_namespaces(7), user_namespaces(7), time_namespaces(7), cgroups(7), unshare(1), nsenter(1), lsns(8), pivot_root(2), chroot(2), capabilities(7), seccomp(2) — https://man7.org/linux/man-pages/man7/namespaces.7.html and neighboring pages
- cgroup v2 — https://docs.kernel.org/admin-guide/cgroup-v2.html
- overlayfs — https://docs.kernel.org/filesystems/overlayfs.html
- systemd.service(5) (`Restart=`), systemd.unit(5) (`StartLimitBurst`), systemd.resource-control(5) — https://www.freedesktop.org/software/systemd/man/
- pipe(7) (pipe capacity) — https://man7.org/linux/man-pages/man7/pipe.7.html
- Liz Rice, "Containers From Scratch" — https://github.com/lizrice/containers-from-scratch ; bocker — https://github.com/p8952/bocker (for the idea; it uses btrfs and cgroups v1, the course commands are cgroup v2)
- RU: to be selected at the research stage (candidates are translations of Mahmud Ridwan's "Linux Namespaces" series, Selectel and Slurm articles on cgroups); until checked, `ru_missing`

**Containers**
- OCI Runtime Spec — https://github.com/opencontainers/runtime-spec ; OCI Image Spec — https://github.com/opencontainers/image-spec
- Docker: build cache, multi-stage, `docker run`, live restore, logging drivers — https://docs.docker.com/build/cache/ , https://docs.docker.com/build/building/multi-stage/ , https://docs.docker.com/reference/cli/docker/container/run/ , https://docs.docker.com/engine/daemon/live-restore/ , https://docs.docker.com/engine/logging/
- KubeVirt — https://kubevirt.io/ ; Cozystack — https://cozystack.io/

**Networks**
- RFC 1034/1035 (DNS), RFC 9293 (TCP), RFC 8446 §2 (TLS 1.3 message order), RFC 9110 (HTTP), RFC 9000 (QUIC), RFC 2131 (DHCP), RFC 5737 (documentation addresses), RFC 5398 (documentation AS numbers), RFC 6598 (CGNAT)
- nginx `proxy_read_timeout` — https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_read_timeout
- tcp(7) (`tcp_syn_retries`) — https://man7.org/linux/man-pages/man7/tcp.7.html
- Root servers — https://root-servers.org/
- Analysis of the Facebook outage of 4.10.2021 — https://blog.cloudflare.com/october-2021-facebook-outage/
- alex/what-happens-when — https://github.com/alex/what-happens-when ; RU: HTML Academy on Habr — https://habr.com/ru/companies/htmlacademy/articles/254825/
- miminet.ru — a network simulator from the checklist resources (RU)

**Kubernetes**
- Components — https://kubernetes.io/docs/concepts/overview/components/ ; RU — https://kubernetes.io/ru/docs/concepts/overview/components/
- Controllers — https://kubernetes.io/docs/concepts/architecture/controller/
- Node status and `node-monitor-grace-period` — https://kubernetes.io/docs/reference/node/node-status/
- Taints and tolerations (`tolerationSeconds`) — https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/
- Services, networking model, Virtual IPs — https://kubernetes.io/docs/concepts/services-networking/ , https://kubernetes.io/docs/reference/networking/virtual-ips/
- DNS for Services and Pods — https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/
- Endpoints deprecation — https://kubernetes.io/blog/2025/04/24/endpoints-deprecation/
- Gateway API — https://gateway-api.sigs.k8s.io/
- kubeadm, certificates, upgrade, etcd — https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/ , https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/
- Kubernetes The Hard Way — https://github.com/kelseyhightower/kubernetes-the-hard-way
- CNCF artwork — https://github.com/cncf/artwork

**Documentation as a subject**
- CKA: allowed resources — the Linux Foundation exam page (checked before release)
- Corpus licenses: kubernetes.io — CC BY 4.0; docs.docker.com — Apache-2.0 (github.com/docker/docs); man-pages — https://www.kernel.org/doc/man-pages/licenses.html

**Accessibility**
- WCAG 2.2 — https://www.w3.org/TR/WCAG22/ (2.3.1 flashes, 2.5.7 dragging, 2.5.8 target size)

---

## Changes after review

Reviews: `reviews/08-multimedia-engine--by-01-andragogy.md` (26 comments) and `reviews/08-multimedia-engine--by-09-runtime-ai-architecture.md` (28 findings). Below, the numbers in parentheses: "A" is the 01 review, "R" is the 09 review.

### Accepted and done

1. **Ink, metaphors and characters removed** (A1, R1). The "draws by hand" paragraph is deleted; `ink.ts` is not used except for `data-fade`, `data-develop` and the seeded random; §6.1 "One style — the drawing", three kinds of motion plus highlighting, durations 180–320 ms; the item about neural-network art is deleted; the build forbids raster drawings and character elements (§3.4, §5.3). Metaphor scenes ("room", "tracings", "DNS lines of dialogue", "thermostat") are replaced with drawings and text hooks. The 07 reviewer needs to remove E1, E2 and E8 with characters.
2. **The flagships no longer duplicate the blocks** (A2, R5). The ownership rule is §7.0: the content belongs to the block documents, 08 has the process model and acceptance. Section 6 of version 1 has become §8 "Engine acceptance on the flagships". Contradictions resolved: v86 by default for isolation, the URL as a synthesis at the end of the networks block, Gateway API as the main one.
3. **The content model is the 01 format** (A3, R3): `concepts.yaml`, graph ids, `screens`, `L0/L1/L2`, `introduces` ≤ 1, `uses`, `forward`, `placed` instead of "the experienced learner knows"; the mapping table is §9.2, the example is §9.3.
4. **The documentation ladder** (A4, R9): the whole of §4 — `docref`, `docview` (modes `peek`/`page`/`exam`), `findflag`, enforcement with `beyond: true` and the `docs-coach` mode, `docexam`; an offline corpus with licenses; the rung comes from `block.yaml` with a per-level minimum; a table of rung 2–5 tasks for each block; `reveals` removed, `hintLevel` 0–5; chips depend on the rung.
5. **Kernel isolation moved to Linux** (A5, R4): module §7.2.4 of 13 screens with ids L33–L40, v86 `lab-alpine`, an OOM drill, an exit ticket; the containers block starts with D06 and repeats the module as one screen.
6. **Network order from the map to the packet** (A6, R8, R15.7): `zoommap` and the map of the internet (§7.3.1), envelopes as a vocabulary (§7.3.2), layers by hand, end-to-end processes, the URL as a synthesis; `layerq` is the mandatory first step of network breakages (§3.7).
7. **A catalog of explanations for every block** (A7, R6): §7 — a table of 30 explanations and screen-by-screen storyboards for methodology, Linux, networks, containers, Kubernetes, CI/CD, IaC and monitoring; the build rule "a mechanism per module".
8. **`ProcessModel` and process recomputation** (A8, R2): §3.1 — parameters, breakages, a pure `run`, `explainDelta`, the "What changed" plate, checking the model against a recording in CI; the stepper is built on the model, a recording is a separate source without handles (§3.2); autoplay no longer than 5 s; style rules in the build.
9. **Palette and fonts** (A9, R20): color encodes the family, subtypes by stroke and shape; green, red and amber only for state; the limit is a graphite tick, not red; OKLCH tokens with a ΔE2000 ≥ 15 test in CI; the dark theme is chosen by the test. Fonts are Literata, Inter, IBM Plex Mono; a terminal theme of four meaningful colors (§6.3–6.5).
10. **Order of terms** (A10, R16.6): in "Kubernetes from blocks" API → etcd → scheduler → kubelet → pod → labels → ReplicaSet/Deployment; Service, kube-proxy and DNS one screen each in the networking section; HSTS after TLS; registry and tag before the manifest; tar and hash are `uses` from Linux; the runtime is introduced once (D10).
11. **Factual errors** (A11, R14, R15, R16, R25), all verified: the TLS 1.3 order per RFC 8446 §2 (the certificate is already encrypted); `dig +trace` walks by itself, the resolver does not take part — two tracks; `proxy_read_timeout` is 60 s by default and a handle; `node-monitor-grace-period` is 50 s since v1.32, eviction after `tolerationSeconds: 300`, old pods stay `Terminating`; eight namespace kinds and 10 links in `/proc/$$/ns`; user ns: outside, the uid of the one who started it (`0 1000 1`), 100000 is the subuid case; the cgroup sequence with `subtree_control` and `memory.swap.max`; `head -c … /dev/zero | tail` instead of `stress`; escaping a chroot only with `CAP_SYS_CHROOT`, `pivot_root` requires a mount point; `tar -tf` without `-z`; `manifest.json` is not an OCI manifest, the path goes through `index.json`; a five-line Dockerfile on `nginx:1.27-alpine`, `EXPOSE`/`CMD` are visible in history as `0B`; `kubectl get endpointslices` instead of the deprecated Endpoints; without a scheduler there are no events, `0/3 nodes are available` comes from a working scheduler; SYN retries ~127 s and the curl timeout 300 s; at every router new MACs and TTL −1; an L4/L7 toggle on the load balancer; addresses only from RFC 5737; bocker "for the idea", commands on cgroup v2; `docker run` in 6.1/9 is honestly marked as dsim.
12. **R7 in full** (A12, R7): the OCI bundle, the CLI → dockerd → containerd → shim → runc/crun chain with `live-restore` and states (§7.4.1); six boundaries with drills and predicates (§7.4.4); "hardware → VM → containers → nesting" towers with a kernel vulnerability, KubeVirt/Cozystack presets and a measurement on v86 (§7.4.5, the `towers` primitive).
13. **Protocol catalog** (A13, R8): `protocard` (§3.14), the format (§9.6), 24 protocols by level with a sequence, observation and breakage (§7.3.8); `seq` (R21, §3.3).
14. **Kubernetes networking R9** (A14, R17): `net.rule`, `ruletrace`, the ClusterIP ghost, an iptables drill with parameterized addresses, `ndots` as a handle, NetworkPolicy and CNI support, the K-N8 debugging ladder (§7.5.6); CNI for all levels, modes for L1+.
15. **Reconciliation loop R10** (A15, R19): `reconcile` and `code` (§3.16), three parts — the loop, the chain, your own controller with a bridge to controller-runtime (§7.5.5); the thermostat is removed.
16. **Neural network** (A16, R13): a `known_concepts` whitelist, modes with `docs-coach`, no button in `exit`/`exam`, `doc_step`, `hint_step_used`, `doc_trail`; the key and the terminal per 09 §4 (IndexedDB, 40 lines with masking) — §3.21.
17. **Levels change the order** (A17, R23, R24): L2 starts with a challenge task and sees a debrief of its own mistakes; theory for the experienced learner is compressed, not hidden; documentation starting rungs 1/2/3; the `theory` kind (§5).
18. **Several machines and the hybrid R11** (A18, R18): `vswitch` and `fabric` (§3.17), `cluster` (§3.18), memory budgets (§12), the phone gets one machine and models; a message for 09: `CONFIG_WIREGUARD` and `wireguard-tools` in the image, the `dt-kubelet` agent.
19. **Real stage R12** (A19, R18): `realstage` (§3.19) with a cost counter and mandatory cleanup; three Kubernetes stages and an 11-step stage 3 track with checks (§7.5.7); no built-in terminal to the learner's VM.
20. **QR and WebRTC** (A20, R12): the "second screen" moved to v2 through `dt-api /api/pair`.
21. **Predicates and goals** (A21, R11): `bind` and `when` are the language of 09 §2.3, goals are 09 §2.4; examples rewritten.
22. **The bus** (R10, A14, A18): the type replaced — `at` and `machine` on all events, `nspid` as an array, `time` in `NsKind`, events for links, frames, ARP, rules, conntrack, signals, logs, reconciliation, Lease, the node agent and `doc.open` (§3.0).
23. **One interaction mode per screen** (A22): the diagram on `lab` is passive, `combine: true` only without L0 (§3.5).
24. **Text limits and reference phrases** (A23) — in the build rules of §5.3.
25. **`explain` in exams** (A24) — self-check only, the neural network after completion (§3.10).
26. **Traps in the constructor by level** (A25) — `traps` (§3.9).
27. **Sound** (A26) — not in the MVP.
28. **Budgets** (R26): rows for the documentation corpus, the editor, several machines, a reference to the 09 numbers (§12).
29. **Sources** (A11, R27): howdns.works is the DNSimple comic, separated from Julia Evans's zines, both marked "not as a style"; the Medium link about container2wasm is removed together with its paragraph; added the OCI Runtime Spec, Node Status, Endpoints deprecation, Gateway API, RFC 8446 §2, `time_namespaces(7)`, `user_namespaces(7)`, systemd, RFC 5398, RFC 6598; `ru_missing` extended to the whole catalog (§9.4, §14).
30. **Order of work** (R28): first the isolation module in Linux, then the reconciliation loop, then `fabric` (§13).

### Rejected or accepted with changes

1. **IBM Plex Serif / Plex Sans fonts for text** (R22) — rejected. R5 directly requires taking Sankofa's text presentation, and Sankofa sets Literata and Inter (checked against `sankofa-int/web/src`). The monospace IBM Plex Mono from the same finding is accepted; the rest of R22 (measure, line height, hanging punctuation, margin captions, terminal theme) is accepted.
2. **Green-teal for namespaces and ochre for cgroups** (R20) — rejected as to the hues: green is too close to `--c-ok`, ochre to `--c-warn`, and both reviews require reserving these hues for state. Plum is taken for isolation and a graphite gauge for limits (A9). The principle of R20 (OKLCH, muted saturation, subtypes by stroke) is accepted.
3. **Module number "L17 How the kernel isolates"** (R4) — rejected: in the 01 graph L17 is "Process". New concept ids L33–L40 from the 01 review are used, and the module is called `linux.isolation`.
4. **The formula `doc_step = clamp(level_start + position_in_block)`** (A4) — accepted with changes: the rung is set by the module data in `block.yaml`, and the formula has become a build rule by thirds of the block. Reason: the block author knows better where flags outside the course begin; the formula would put enforcement in the middle of a module. The module ranges from R9 ("L0–L3: 1; L4–L8: 2…") were not carried over as is: module numbering belongs to the block documents.
5. **Five kinds of animation** (A1) and **three kinds** (R1) — reconciled: three kinds of motion (movement, appearance and disappearance, change of a value) plus highlighting as non-motion. A gauge and a counter are a change of a value; no separate kind is needed.
6. **ttyd to the learner's VM as a convenience** (A19) — rejected: R12 requires that the trainer does not execute, the learner works in their own ssh in any case, and the course does not hand out machines of its own, workshops included (09 §5.5).
7. **Memory estimate for the multi-node lab** (A18: 1.5–2 GB; R18: ≈ 1.2 GB) — an acceptance budget of ≤ 1.5 GB with three nodes is adopted; the exact number comes from a measurement in phase 0, and if exceeded, guest memory is reduced rather than the budget increased.
8. **The order of N07 in the graph** (A6 considers 01 already aligned with R8) — accepted with changes: per the 01 graph N07 requires N03, N05, N06, and then envelopes as a vocabulary cannot come at the start of the block, as R8 requires. It is proposed to reduce the prerequisites of N07 to N01 and open up the layer fields in their modules (§7.3); 01 needs to fix the graph.
9. **Keep `ai_context` with a list of forbidden words** — it was there in version 1, both reviews are against it (A16, R13); removed entirely, `ai_context` is now only "what is important here".

### What needs to be fixed in neighboring documents

- **01**: ids L33–L40, N22, N23, K34 (NetworkPolicy), replacing K18 with Gateway API with Ingress as a footnote, N07 prerequisites → N01, remove rule R9 "ink in hooks".
- **02**: the `linux.isolation` module (§7.2.4), explanations §7.2.1–7.2.3, ladder tasks §4.5.
- **03**: block order §7.3, the protocol catalog §7.3.8, two DNS tracks, TLS 1.3.
- **04**: anatomy, six boundaries, towers (§7.4), `nginx:1.27-alpine`/`alpine:3.22`, `tar -tf`, the path through `index.json`, fix uid 100000 in §4.2.
- **05**: the "Kubernetes from blocks" order, networking K-N1…K-N8, `reconcile`, the hybrid, three stages, `endpointslices`, `node-monitor-grace-period` 50 s.
- **06**: explanations §7.6, `code` as the shared editor.
- **07**: remove characters and drawings from E1, E2, E8; explanations §7.1.
- **09**: the bus type §3.0, `CheckResult.hintLevel` 0–5, the `docs-coach` mode, `/api/pair`, `vswitch` instead of `inbrowser` for multi-machine labs, the `dt-kubelet` agent, `CONFIG_WIREGUARD` and `wireguard-tools`, comparing `nspid` by the last element (`nspid~1` in the examples).
