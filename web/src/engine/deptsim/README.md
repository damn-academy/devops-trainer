# Department simulator

The `deptsim` widget offers a portable GM prompt and optional streamed play via
`ai()` from the public AI service facade. It makes no provider requests itself.
Engine discovery registers the widget through `module.ts`; imports are safe in
Node. No core or AI engine changes are required.

## Register a scenario

Call the registry directly at the top level of a block's `index.ts`, before its
`defineModule` export. The platform's `setup` hooks configure terminal machines;
they are not general module initialization hooks.

```ts
import { registerScenarios } from '../../engine/deptsim';
import { launchScenario } from './scenarios/launch';

registerScenarios([launchScenario]);
// Include this section in the block's lesson data:
// { id: 'launch-sim', kind: 'widget', widget: 'deptsim',
//   props: { scenario: 'marketing.launch' } }
```

`SimScenario` and `SimOptions` are exported from `index.ts`. IDs must be unique;
registration rejects duplicates and invalid turn bounds. `demo.ts` exports
`demoScenario` (`demo.deptsim`) for explicit registration by tests only. It is
not imported by the engine module or attached to any lesson.

## Prompt contract

Templates supply RU and EN text and may use `{{SEED}}`, `{{DICE}}`,
`{{DIFFICULTY}}`, `{{TURNS}}`, `{{TURN_UNIT}}`, `{{COMPANY}}`, and
`{{LANG_RULES}}`. Unknown placeholders fail explicitly. `buildPrompt` appends
the dice-consumption instructions even when a scenario author forgets them.
`strings.ts` owns bilingual UI, difficulty and language rules. `legends.ts`
contains three `TODO(prose)` company placeholders for the prose owner.

A game has 400 d100 values from mulberry32, formatted as 20 indexed rows of
20 numbers. A fresh unsigned 32-bit seed comes from `crypto.getRandomValues`.
The learner can enter a saved seed before play. The seed reproduces the dice
and prompt settings, not the model's exact output. Every uncertain outcome
consumes one value in order; the GM names it and keeps the next index in its
ledger. The model remains responsible for following these instructions.

Ask the GM to finish each turn with a **closed**, line-delimited fence with
exact info string `state`, containing all facts needed to continue (including
turn and next dice index). The renderer uses the project's Markdown code hook
to display it in a compact disclosure without interpreting its contents.
The final response must contain a closed `debrief` fence. Only assistant
messages can supply state or complete the section; learner code cannot do so.

`trimHistory(messages)` is pure: it retains system messages, the latest
assistant message containing a complete state fence, and the last 12 non-system
messages, in chronological order without duplication. Each request supplies
one system message containing the full built prompt. Trimming limits message
count, not tokens; very long individual messages may still exceed a provider's
context limit.

## Lifecycle and storage

Play starts with a localized request for the opening situation. Settings lock
at the first request. New game asks for inline confirmation, aborts any active
request, clears the transcript and creates a new seed. Stop retains partial
text; stale stream callbacks cannot alter a stopped, reset or disposed game.
Ctrl/Cmd+Enter sends a decision. Clipboard failure reveals a selected read-only
textarea. Export downloads Markdown containing the transcript and settings.

`dt.deptsim.<scenario id>` stores a versioned game, settings, seed, language,
transcript and the exact prompt snapshot. Thus later prose changes do not
silently change an active game. Every localStorage access is guarded; invalid
saved data is ignored. Storage failure leaves the game usable in memory.
A scenario is shared across its mounts; avoid showing multiple independent
copies of the same scenario simultaneously (last saved copy wins).

The default widget uses the shared `AiService`; `mountDeptSim` accepts a small
facade-compatible service argument for tests. It subscribes to configuration
changes and aborts/unsubscribes on disposal. No keys enter simulator storage.
All layouts stay within a single 760px column; no popup or diagram legend is
needed.

## Checks

```sh
cd web
npx tsc --noEmit
npx vitest run
```

`tests/deptsim.test.ts` covers seeded dice, bilingual substitution, history
trimming, registration, streaming, completion, clipboard fallback, persistence,
export, reset/stop/disposal races and unavailable storage using jsdom and fake
AI. Live provider behavior is intentionally outside these tests.
