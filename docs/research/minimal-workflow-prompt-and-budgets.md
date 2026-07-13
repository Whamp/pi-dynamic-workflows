# Minimal always-on workflow prompt and size budgets

Research for [Define the minimal always-on workflow prompt and size budgets](https://github.com/Whamp/pi-dynamic-workflows/issues/13) in the [Specify minimal cache-safe workflow prompting](https://github.com/Whamp/pi-dynamic-workflows/issues/15) wayfinding effort.

## Decision

Keep one concrete Available-tools line and three short guidelines. Remove every model name, `agentType` name, advanced authoring pattern, and duplicated syntax rule from the system prompt. Keep the strict script contract and parameter semantics in the tool definition.

The resulting limits should be:

1. **700 UTF-8 bytes** for the workflow extension's rendered system-prompt contribution: its `- workflow: <promptSnippet>` line plus its rendered `promptGuidelines` bullets.
2. **1,600 UTF-8 bytes** for compact JSON of the provider-visible workflow definition: `JSON.stringify({ name, description, parameters })`.

Measure bytes, not estimated tokens. Token counts vary by provider tokenizer; UTF-8 bytes are deterministic and bound the actual payload text. Report character counts and schema-only bytes as diagnostics, but make the two limits above the regression gates.

## Proposed always-on text

### Tool description

```text
Run JavaScript that delegates work to multiple subagents through agent(), parallel(), and pipeline().
```

This replaces “Execute a deterministic JavaScript workflow.” The runtime controls orchestration and test harnesses can use deterministic fake subagents, but real subagent output is not deterministic.

### Available-tools entry

`promptSnippet`:

```text
Run JavaScript that delegates tasks to multiple subagents in parallel or in pipelines
```

Pi renders it as:

```text
- workflow: Run JavaScript that delegates tasks to multiple subagents in parallel or in pipelines
```

The sentence names the behavior directly. It does not rely on “workflow” meaning multi-agent delegation, and it does not claim deterministic output.

### Guidelines

```text
Use workflow only when the user explicitly requests multiple subagents, fan-out, or multi-agent orchestration.

In workflow scripts, explicitly `return` a JSON-serializable result. Recoverable `agent()`, `parallel()`, and `pipeline()` failures produce `null`; handle them.

In workflow scripts, give each `agent()` a short `label`; route normal work with `tier: 'small'`, `'medium'`, or `'big'`; use `model` only when the user names an exact model; pass plain JSON Schema with `schema` for structured output.
```

Pi flattens `promptGuidelines` into the general Guidelines section, so every retained bullet names `workflow`. Pi documents and implements that rendering in its [extension tool guidance](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/docs/extensions.md#L1321-L1358) and [system-prompt builder](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/system-prompt.ts#L47-L79).

## Why three facts remain outside the schema

[What the workflow schema teaches parent models](workflow-schema-comprehension.md) tested the real tool description, `promptSnippet`, and schema with no `promptGuidelines`.

- All four models selected `workflow`, produced parser-valid JavaScript, used `parallel()` correctly, delegated to two checkers and a synthesizer, and selected inline execution. The schema already teaches the script header, available globals, thunk shape, and `background` behavior well enough for this task.
- Sol and Luna treated recoverable `null` results as successful evidence. Terra and GLM omitted an explicit `return`, so their workflows completed without a result.
- The outer tool schema cannot structurally describe the inner `agent(prompt, opts)` object. Schema-only scripts omitted labels and tier routing; Luna invented the unavailable exact model name `sonnet`.
- Targeted reruns with the current guidelines fixed all four failures: the scripts handled `null`, returned their result, supplied labels and tiers, and used plain JSON Schema for structured subagent output.

That evidence supports the second and third proposed bullets. It does not support keeping the current quality-helper catalog, phase UI rules, budget recipes, retry advice, model catalog, `agentType` catalog, nesting rules, or prompt-writing advice always on.

The first bullet is the user-control boundary for tool selection. The concrete Available-tools line tells the model what the tool does; the guideline tells it when it has permission to pay for multiple subagents.

## Proposed schema descriptions

Keep the current eight fields and their required/optional shape. Replace only their prose:

| Field | Proposed description |
| --- | --- |
| `script` | `Raw JavaScript without Markdown fences. First statement: \`export const meta = { name: 'short_snake_case', description: 'non-empty description', phases: [{ title: 'Phase' }] }\`. Available globals: \`agent\`, \`parallel\`, \`pipeline\`, \`phase\`, \`log\`, \`args\`, \`cwd\`, \`process.cwd()\`, and \`budget\`. Call \`agent()\` at least once. \`parallel()\` takes functions, not promises: \`await parallel(items.map(item => () => agent(...)))\`.` |
| `args` | `JSON value exposed to the script as \`args\`.` |
| `background` | `Run in the background and return a run ID immediately. Default: true; set false only when the result is needed in this turn.` |
| `maxAgents` | `Maximum agents for this run. Default: 1000.` |
| `concurrency` | `Maximum concurrent agents, capped by the runtime.` |
| `agentRetries` | `Retries per recoverable agent failure. Default: 0 unless configured.` |
| `agentTimeoutMs` | `Per-agent timeout in milliseconds. Omit for no hard timeout.` |
| `tokenBudget` | `Hard run-wide token limit. Omit for no limit; set only when the user requests a spend cap.` |

The `script` description retains each fact that the schema-only experiment exercised successfully. The other descriptions retain defaults and units while deleting policy essays already handled by the caller's request or by on-demand documentation.

## Current prompt inventory

The current source has one `promptSnippet` and 24 runtime guideline entries in [`src/workflow-tool.ts`](https://github.com/Whamp/pi-dynamic-workflows/blob/2e76d16b90ffbe34aa3d725704bdbdece2f689c2/src/workflow-tool.ts#L158-L198). “Duplicated” means the current tool description/schema or another retained line already supplies the fact. “Conditional” means useful only after a specific advanced feature is chosen. “Obsolete” means contradicted by the cache-safe discovery decision or by runtime reality.

### `promptSnippet`

| Current content | Classification | Disposition |
| --- | --- | --- |
| “Run a deterministic JavaScript workflow. Required script header: …” | Obsolete and duplicated | Replace with the concrete delegation sentence above. Remove “deterministic”; leave the header in `script.description`. |

### `promptGuidelines`

| # | Current entry | Classification | Disposition |
| --- | --- | --- | --- |
| 1 | Use only when the user explicitly asks for workflow/workflows/fan-out/multi-agent orchestration. | Essential | Retain in concrete terms as proposed guideline 1. |
| 2 | Pass one raw JavaScript string; no fences or prose. | Duplicated | The required `script` field and its description own this. |
| 3 | Require the exact `export const meta` first statement and non-empty name/description. | Duplicated | The `script` description and parser own this. |
| 4 | Plain JavaScript only; ban TypeScript, imports, filesystem access, clocks, and randomness. | Conditional | Runtime validation and errors own forbidden syntax. Detailed authoring docs can explain it when needed. |
| 5 | List globals and require at least one `agent()` call. | Duplicated | Keep in `script.description`. |
| 6 | Catalog `verify`, `judgePanel`, `loopUntilDry`, and `completenessCheck`. | Conditional | Advanced authoring documentation, not always-on selection/use. |
| 7 | Require phase switching and explain empty/misassigned phase UI. | Conditional | Relevant only to multi-phase scripts; move to authoring docs/runtime diagnostics. |
| 8 | Do not set token/time limits unless requested. | Duplicated | The parameter descriptions state omission/default behavior. |
| 9 | Explain run and phase budgets, `retry`, `gate`, and graceful degradation. | Conditional | Advanced budget authoring; remove from always-on text. |
| 10 | Prefer decomposable work and reject one-file/one-command work. | Duplicated | Proposed selection line and guideline 1 supply the boundary without examples. |
| 11 | Explain that `parallel()` takes thunks, with positive and negative examples. | Duplicated | Keep one positive form in `script.description`; schema-only models used it correctly. |
| 12 | Explain `pipeline()` stage ordering and arguments. | Conditional | Relevant only when choosing `pipeline`; move to authoring docs. |
| 13 | Require unique 2–5 word labels and give examples. | Essential, over-specified | Retain only “give each `agent()` a short `label`” in guideline 3. |
| 14 | Recommend low concurrency/retries for unstable transports and mention `null` after exhaustion. | Conditional and duplicated | Parameters own controls; guideline 2 owns the `null` contract. |
| 15 | Failed branches return `null`; inspect them. | Essential | Retain in guideline 2, backed by the observed Sol/Luna failures. |
| 16 | Require a synthesis agent and compact `ok`/`verdict` return shape. | Essential return contract plus conditional style | Retain only explicit JSON-serializable `return`; synthesis and field names depend on the task. |
| 17 | Prescribe finder → verify → merge. | Conditional | Quality strategy, not basic tool use. |
| 18 | Require substantive self-contained prompts and fewer high-level agents. | Conditional | Authoring quality advice; the experiment did not show it was needed for valid use. |
| 19 | Explain plain JSON Schema through `opts.schema`. | Essential | Compress into guideline 3; the inner `agent()` options are not represented structurally by the outer schema. |
| 20 | Explain all tiers, fallback/override rules, thinking suffixes, and inject every available model. | Mixed: essential abstract tiers; conditional detail; obsolete live catalog | Retain only `small`/`medium`/`big` and user-named exact models in guideline 3. Discover exact models through `workflow_discover`; never inject the catalog. |
| 21 | Explain `opts.agentType` and inject all discovered names/descriptions. | Obsolete | [Cache-safe on-demand workflow discovery](cache-safe-workflow-discovery.md) moves this catalog to explicit `workflow_discover` results. |
| 22 | Remind the parent to make subagent prompts self-contained. | Conditional | Authoring advice; no schema-only failure supports always-on retention. |
| 23 | Explain background default, result delivery, and `background: false`. | Duplicated | Compress into the `background` field description. |
| 24 | Explain saved-workflow nesting and global caps. | Conditional | Relevant only when nesting a saved workflow; move to authoring docs. |

The two generated catalog entries are especially expensive and unstable. On the measurement machine, entry 20 listed 363 models and entry 21 listed six `agentType` definitions. Together they rendered as 14,861 bytes.

## Current tool-definition inventory

The current provider-visible definition consists of `name`, `description`, and the TypeBox `parameters` schema. Pi's wrapper forwards those fields directly to the agent runtime ([source](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/tools/tool-definition-wrapper.ts#L3-L14)). Provider adapters then serialize the same description and parameters; for example, OpenAI Responses uses `{ name, description, parameters }` ([source](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/ai/src/api/openai-responses-shared.ts#L205-L216)).

| Surface | Current content | Classification | Disposition |
| --- | --- | --- | --- |
| Tool `description` | Deterministic JavaScript workflow; repeats required script header and `agent()` minimum. | Obsolete and duplicated | Replace with the concrete one-sentence delegation description. |
| `script` fragment 1 | Required raw JavaScript, no Markdown fences. | Essential | Keep, shorten. |
| `script` fragment 2 | Exact metadata first statement. | Essential | Keep. |
| `script` fragment 3 | Globals and at least one `agent()` call. | Essential | Keep. |
| `script` fragment 4 | `parallel()` requires functions, not promises, with example. | Essential | Keep; every schema-only model used the thunk shape correctly. |
| `args` | Optional JSON exposed as global `args`. | Essential | Keep, shorten. |
| `background` | Default background behavior, immediate run ID, later delivery, when to run inline. | Essential but verbose | Keep default and choice, shorten. |
| `maxAgents` | Maximum and default 1000. | Essential | Keep, shorten. |
| `concurrency` | Runtime-capped concurrency and stability advice. | Essential semantics plus conditional advice | Keep cap; remove advice. |
| `agentRetries` | Recoverable-failure retries and default. | Essential | Keep, shorten. |
| `agentTimeoutMs` | Unit, unbounded default, and user-request policy. | Essential | Keep unit/default, shorten. |
| `tokenBudget` | Hard total-token behavior, unlimited default, and user-request policy. | Essential | Keep behavior/default, shorten. |

No runtime field is removed. This ticket reduces descriptions, not capability.

## Measurements

Measurements use compact JSON and UTF-8 byte counts from the actual `createWorkflowTool()` output at commit `2e76d16b90ffbe34aa3d725704bdbdece2f689c2`. The current prompt measurement used this machine's live 363-model and six-`agentType` catalogs, matching what the extension injects after `session_start`.

| Surface | Current | Proposed | Reduction | Budget |
| --- | ---: | ---: | ---: | ---: |
| Rendered system-prompt contribution | 20,485 bytes | 610 bytes | 97.0% | **700 bytes** |
| Current prompt without the two dynamic catalog guidelines | 5,623 bytes | 610 bytes | 89.2% | **700 bytes** |
| Parameter schema JSON only | 1,890 bytes | 1,316 bytes | 30.4% | Diagnostic only |
| Full provider-visible definition JSON | 2,204 bytes | 1,467 bytes | 33.4% | **1,600 bytes** |

The 700-byte prompt budget leaves 90 bytes (14.8%) of headroom. The 1,600-byte definition budget leaves 133 bytes (9.1%). Either limit can absorb small wording corrections but not another catalog, policy essay, helper tutorial, or schema field without an explicit budget review.

## Regression checks

The eventual implementation should add one focused test file with two failing gates.

### 1. Render the real system-prompt contribution

Do not add the lengths of source constants. Instantiate the real tool, load it through Pi's public SDK, and inspect `session.agent.state.systemPrompt`, which the SDK documents as the effective system prompt. Create a control session with the same tool definition but with `promptSnippet` and `promptGuidelines` omitted. Diff the two rendered prompts and collect the added lines. Assert that the additions are exactly:

- one `- workflow: <actual promptSnippet>` line;
- one `- <actual guideline>` line for each actual guideline;
- no model names or `agentType` names.

Measure `Buffer.byteLength(addedLines.join("\n"), "utf8")` and fail above `700`.

Using the actual SDK renderer catches Pi formatting, duplicate suppression, accidental dynamic getters, and registration mistakes. A test that measures a hand-copied string would not.

### 2. Serialize the real provider-visible definition

Read the actual wrapped `workflow` tool from `session.agent.state.tools`, then construct the provider-neutral definition Pi forwards:

```ts
const definitionJson = JSON.stringify({
  name: workflow.name,
  description: workflow.description,
  parameters: workflow.parameters,
});
```

Fail when `Buffer.byteLength(definitionJson, "utf8") > 1_600`. Also report `Buffer.byteLength(JSON.stringify(workflow.parameters), "utf8")` in the assertion message so schema growth is visible even though the full-definition gate is canonical.

The failure should print current bytes, budget bytes, and the rendered text/JSON. That makes a deliberate budget increase reviewable instead of turning the test into a magic-number failure.

## Detailed on-demand authoring help

Do not add a help mode now. Keep advanced guidance in project documentation and improve runtime/parser errors at the failing seam. [Cache-safe on-demand workflow discovery](cache-safe-workflow-discovery.md) has a deliberately narrow catalog contract; expanding it into a general tutorial service would weaken that contract without evidence that parent models need it.

Add on-demand authoring help only after a focused experiment demonstrates a recurring failure that the schema, three retained guidelines, and runtime diagnostics cannot resolve. This clears the current “whether detailed on-demand authoring help is needed” fog with **not yet** rather than creating another always-active interface.

## Source-evidence ledger

### CodeGraph evidence

The rebuilt index identified `src/workflow-tool.ts` as the sole workflow prompt/schema seam and `extensions/workflow.ts` as its production registration boundary. `createWorkflowTool` is imported by the production extension and the schema-only experiment. CodeGraph did not find `promptSnippet` as a symbol because it is an object property; targeted source reading and exact search supplied that blind spot.

### Source-read interpretation

The project source establishes the current one snippet, 24 guidelines, generated model and `agentType` catalogs, tool description, and eight-field schema. The two prerequisite research notes establish which schema-only behaviors succeeded, which failed, and why static on-demand discovery replaces catalog injection. Pi 0.80.6 source and docs establish the exact default system-prompt line/bullet rendering and the provider-visible `name`/`description`/`parameters` shape.

### Proof commands and primary sources

```bash
codegraph build .
codegraph stats -T
codegraph map -T
codegraph brief src/workflow-tool.ts -T
codegraph deps src/workflow-tool.ts -T --json
npx tsx <measurement script importing createWorkflowTool>
```

Primary project sources:

- [`src/workflow-tool.ts`](https://github.com/Whamp/pi-dynamic-workflows/blob/2e76d16b90ffbe34aa3d725704bdbdece2f689c2/src/workflow-tool.ts)
- [What the workflow schema teaches parent models](workflow-schema-comprehension.md)
- [Cache-safe on-demand workflow discovery](cache-safe-workflow-discovery.md)
- [Pi extension documentation, pinned to 0.80.6](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/docs/extensions.md)
- [Pi SDK documentation, pinned to 0.80.6](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/docs/sdk.md)

This ticket changes only the research artifact. It does not implement production prompt or schema changes.
