# Cache-safe post-trigger workflow guidance placement

Research for [Determine cache-safe post-trigger workflow guidance placement](https://github.com/Whamp/pi-dynamic-workflows/issues/17) in [Specify minimal cache-safe workflow prompting](https://github.com/Whamp/pi-dynamic-workflows/issues/15).

## Decision

Keep the `workflow` and planned `workflow_discover` definitions active and byte-stable from before the first provider request until the session ends. Never change the system prompt, active tools, or either tool definition in response to a workflow trigger.

Use three layers:

1. **Static selection and basic-use contract:** one concrete Available-tools line and three short guidelines. This is the only guidance available when the parent selects `workflow` without a recognized trigger.
2. **Triggered control block:** append a small, versioned block to the submitted conversation message when the configured trigger, `/workflows run`, or standing effort mode explicitly selects workflow execution. Do not inject a second authoring manual.
3. **Schema, parser, runtime, diagnostics, and docs:** place syntax, defaults, advanced helpers, phases, budgets, discovery, and nesting at the seam that can state or enforce them.

The configured trigger is the strongest per-message intent signal. With `keywordTriggerWord: "pi-workflows"`, only the case-insensitive literal term `pi-workflows` arms keyword mode. The words `workflow`, `workflows`, and `pi-workflow` do not. A generic occurrence of the tool's name is not consent to delegate.

A workflow may launch **one or more** subagents. One substantive subagent is valid when one worker is proportionate or `workflow` is the deployment's only subagent interface. A direct file read, one shell command, or a similarly trivial operation is not a substantive delegated task.

## Smallest static guidance

This revises the wording in [Minimal always-on workflow prompt and size budgets](minimal-workflow-prompt-and-budgets.md) without changing its three-guideline shape or 700-byte budget.

`promptSnippet`:

```text
Delegate substantive work to one or more subagents
```

Guidelines:

```text
Use workflow only when the user explicitly requests substantive subagent delegation, fan-out, or multi-agent orchestration, or pi-dynamic-workflows marks the request as triggered. One subagent is valid; do not delegate trivial reads or edits.

In workflow scripts, return a JSON-serializable result and handle `null` from recoverable `agent()`, `parallel()`, or `pipeline()` failures.

In workflow scripts, label each `agent()`; use `small`, `medium`, or `big` tier for normal routing, `model` only when the user names one, and plain JSON Schema in `schema`.
```

Pi renders these four lines in **625 UTF-8 bytes**, below the approved 700-byte system-prompt budget. The first guideline is the only pre-selection policy. The other two remain static because an untriggered parent can select and author a workflow in one provider response; Pi has no cache-safe hook between that internal decision and script composition.

The tool description should likewise say **one or more**, not **multiple**:

```text
Run JavaScript that delegates substantive work to one or more subagents through agent(), parallel(), and pipeline().
```

## Triggered-message contract

Use one pure builder for all model-mediated explicit modes:

```ts
type WorkflowSelectionSource = "keyword" | "command" | "effort-high" | "effort-ultra";

buildTriggeredWorkflowMessage({
  originalText,
  source,
  configuredTriggerWord,
}): string
```

The result is the original request followed once by this control block:

```text
---
[pi-dynamic-workflows selection v1]
source: keyword
configured-trigger: pi-workflows
The user explicitly selected `workflow` for this request. Call `workflow`.
Give every subagent a substantive, self-contained task. One subagent is valid when one is enough; do not create subagents for trivial direct operations.
```

Contract rules:

1. `source: keyword` is emitted only after the enabled configured matcher succeeds and one-shot suppression has not consumed the submission. With `pi-workflows`, generic `workflow` or `workflows` text does not qualify.
2. `/workflows run <prompt>` emits `source: command` through the same builder. It does not depend on keyword matching.
3. `/effort high`, `/effort ultra`, and `/ultracode` emit the matching effort source for substantive requests. They are standing opt-ins, not keyword matches.
4. The block carries no model names, tier assignments, `agentType` names, filesystem paths, helper catalog, or machine-specific data.
5. The builder appends the block to a user or custom conversation message. It never returns `systemPrompt`, calls `setActiveTools`, re-registers a tool, or changes a tool definition.
6. The block is persisted with the conversation message, so retries, compaction input, and session inspection retain the reason the workflow was selected.
7. The static guidelines remain authoritative for return, `null`, labels, routing, and structured output. The triggered block does not duplicate them.

The current forcing text says every request must fan out and that even a small task must launch an agent. Replace those claims. They conflict with valid one-agent deployments and encourage frivolous delegation.

## Entry-path audit

| Entry path | Parent authors a script? | Guidance available before authoring | Required treatment |
| --- | --- | --- | --- |
| Configured interactive/print trigger | Yes | Static prompt/schema plus transformed request | Exact configured matcher; append the `keyword` control block; do not change active tools. |
| Backspace-suppressed keyword submission | Maybe | Static prompt/schema only | Do not append the block. Suppression means the trigger did not select workflow. |
| `/workflows run <prompt>` | Yes | Static prompt/schema plus a custom message | Build the same block with `source: command`. This path bypasses the normal `input` event and `before_agent_start`. |
| Standing `/effort` or `/ultracode` | Yes | Static prompt/schema plus transformed request | Append the matching effort block only for the existing substantive-request predicate. |
| Ordinary natural-language request | Maybe | Static prompt/schema | The parent may select `workflow` for an explicit substantive delegation request. Generic `workflow(s)` text is not a trigger when the configured word is `pi-workflows`. |
| RPC prompt | Maybe | Static prompt/schema | The current keyword hook ignores `source: "rpc"`; use explicit delegation language or `/workflows run`. Do not pretend the interactive configured trigger fired. |
| Parent calls `workflow` autonomously | Yes | Static prompt/schema only | This is why return/`null` and inner `agent()` guidance cannot live only in the triggered block. |
| Resumed/stored `workflow` tool call | Already authored | Stable schema, `prepareArguments`, parser/runtime | Keep compatibility in `prepareArguments`; enforce current script invariants at runtime. |
| Saved workflow slash command | No | Saved script | Runs through `WorkflowManager` or `runWorkflow`; parent authoring guidance is irrelevant. Runtime validation must own invariants. |
| Bundled workflow command | No | Generated script | Runs `runWorkflow` directly; parent authoring guidance is irrelevant. Runtime validation must own invariants. |
| Nested saved workflow | Yes, for the parent script | Static schema; advanced docs on demand | Keep depth and shared-cap enforcement in runtime. Do not advertise nesting always-on. |

Pi 0.80.6 checks extension commands before the `input` event. Its `sendCustomMessage(..., {triggerTurn: true})` calls the agent directly rather than running `input` or `before_agent_start`. The current `/workflows run` implementation uses that route. A `before_agent_start`-only design therefore misses a real explicit entry path.

## Placement matrix

“Schema” means the stable provider-visible `workflow` description and parameter schema. “Runtime” distinguishes current behavior from validation that the implementation should add. “Triggered” means the small control block above, not a copy of the current guideline catalog.

| # | Current instruction | Needed before selection? | Schema carries it? | Runtime can enforce it? | Verdict |
| ---: | --- | :---: | :---: | --- | --- |
| 1 | Use only for explicit workflow/workflows/fan-out/multi-agent requests. | **Yes** | Capability only | No; user intent is semantic. | **KEEP, rewrite.** Use substantive delegation and the extension's trigger marker. Do not treat generic `workflow(s)` as consent. |
| 2 | Pass one raw JavaScript string; no fences or prose. | No | **Yes**: required string plus `script` description | **Current:** schema validates string; `prepareArguments` strips a full fence. | **REMOVE guideline.** Keep the strict public schema and compatibility normalizer. |
| 3 | Require the exact first `export const meta` statement and non-empty name/description. | No | **Yes** | **Current:** Acorn parse plus `validateMeta`. | **ENFORCE.** Keep in schema and parser; remove guideline. |
| 4 | Plain JavaScript; no TypeScript, imports, `require`, filesystem, clocks, or randomness. | No | Partly | **Current:** JavaScript parser/VM reject unavailable syntax/globals; Date/Math guards reject accidental nondeterminism. | **ENFORCE.** Keep parser/runtime diagnostics; remove guideline. |
| 5 | List globals and require at least one `agent()` call. | No | **Yes** | **Partial:** globals are fixed; the foreground tool rejects zero agents, but `runWorkflow` itself does not, so direct/background paths differ. | **ENFORCE at `runWorkflow`.** Keep globals and minimum in schema; remove guideline. |
| 6 | Catalog `verify`, `judgePanel`, `loopUntilDry`, and `completenessCheck`. | No | No | Runtime provides them but cannot choose a quality strategy. | **MOVE to docs/saved examples.** Do not include in the default triggered block. |
| 7 | Require exact phase switching and explain empty/misassigned phase UI. | No | Phase declaration only | **Can add:** compare declared phases and actual assignments at the common runtime seam. | **ENFORCE/diagnose at runtime.** Keep detailed UI advice in docs. |
| 8 | Do not set token/time limits unless the user requests them. | No | **Yes**: defaults and omission semantics | **Current:** omitted values stay unbounded/configured. | **REMOVE guideline.** Parameter descriptions own it. |
| 9 | Explain run/phase budgets, `retry`, `gate`, and graceful degradation. | No | Tool-level caps only | Runtime enforces caps and helper semantics, not author strategy. | **MOVE to docs/saved examples.** Surface precise errors at exhaustion. |
| 10 | Prefer decomposable work; reject quick reads/edits. | **Yes** | Capability only | No; task substance is semantic. | **KEEP, merge into #1.** Allow one substantive subagent; reject trivial delegation. |
| 11 | `parallel()` takes thunks, not promises; results preserve input order. | No | **Yes** | **Current:** validates array/functions; `Promise.all` preserves input order. | **ENFORCE.** Keep one positive form in schema and the runtime error; remove guideline. |
| 12 | Explain `pipeline()` stage ordering and arguments. | No | Names `pipeline` only | **Current:** validates input/stages and supplies `(previous, original, index)`. | **MOVE to docs/runtime errors.** Do not send on every trigger. |
| 13 | Give each agent a unique short label. | No | No; outer schema cannot describe inner `agent()` options | Runtime supplies a default label but does not ensure useful uniqueness. | **KEEP compressed** as “label each `agent()`.” Do not retain length rules/examples. |
| 14 | Use low concurrency/retries for unstable transports; inspect `null` after exhaustion. | No | Controls/defaults only | **Current:** clamps concurrency, retries recoverable failures, returns `null` after exhaustion. | **SPLIT.** Remove transport advice; merge the `null` contract into #15. |
| 15 | Recoverable failed branches return `null`; check them. | No | No | **Current behavior**, but handling is script semantics. | **KEEP compressed.** Schema-only Sol and Luna treated `null` as evidence without this guidance. |
| 16 | Add a synthesis agent and return compact JSON with `ok`/`verdict`. | No | No | **Can add:** reject non-JSON-serializable or missing final results. Runtime cannot require one synthesis strategy. | **SPLIT.** Keep only JSON-serializable `return`; move synthesis/field style to examples. |
| 17 | Prescribe finder → verify → merge. | No | No | No; it is a strategy. | **MOVE to docs/saved examples.** Do not include in default trigger guidance. |
| 18 | Give each subagent a substantive, self-contained task; prefer fewer high-level agents. | Selection half only | No | No; prompt quality is semantic. | **SPLIT.** Merge “substantive” into #1; put “self-contained” in the triggered block; keep strategy examples in docs. |
| 19 | Use plain JSON Schema in `opts.schema`. | No | No; outer schema cannot describe the inner object | **Current:** structured output is validated against the supplied schema and repaired or failed. | **KEEP compressed.** Schema-only parents omitted or misused the inner contract. |
| 20 | Explain tiers/exact model precedence and inject every available model. | No | No | **Partial:** routing precedence works; invalid tier names currently fall back instead of failing. | **SPLIT.** Keep only `small`/`medium`/`big` and user-named exact model guidance; **remove catalog**; validate tier names at runtime. |
| 21 | Explain `agentType` and inject all discovered names/descriptions. | No | Planned discovery tool describes the interface | **Must add:** unknown `agentType` should fail before launch instead of silently falling back. | **MOVE to `workflow_discover`; ENFORCE stale names.** No trigger block catalog. |
| 22 | Do not assume subagents have parent context; include paths/context. | No | No | No; context sufficiency is semantic. | **MOVE to triggered block** as “self-contained task,” with full examples in docs. |
| 23 | Explain background default, delayed delivery, and `background: false`. | No | **Yes** | **Current:** defaults true and branches on false. | **REMOVE guideline.** Keep concise parameter description and result text. |
| 24 | Explain saved-workflow nesting and global caps. | No | No | **Current:** one-level depth and shared limiter/count/budget are enforced. | **MOVE to docs/runtime errors.** Do not advertise on every trigger. |

## Delivery mechanisms considered

| Mechanism | Cache behavior | Coverage | Verdict |
| --- | --- | --- | --- |
| Existing `input` transformation | Appends variable text in the new user message; system prompt and tools stay stable. | Configured interactive/print keyword and effort modes. | **Use.** Remove its active-tool save/add/restore behavior. |
| Shared builder used by `/workflows run` | Appends variable text in a custom conversation message. | Explicit command path, including the path that bypasses `input` and `before_agent_start`. | **Use.** |
| `before_agent_start` appended custom message | Cache-safe when it returns `message` only. Returning `systemPrompt` is not. | Ordinary prompt path only; misses `/workflows run` and cannot help autonomous same-turn selection. | **Do not use as source of truth.** A later presentation-only hook may consume the same marker, but the marker must already be in the message. |
| `tool_call` hook or tool execution validation | Adds no prompt-prefix churn; failures return after the script has been authored. | Every model-mediated `workflow` call. | **Use for enforcement/diagnostics**, not selection guidance. |
| Stable provider-visible schema | Stable prefix when byte-identical. | Every parent-authored call, including autonomous selection. | **Use for syntax and outer parameters.** |
| Stable `workflow_discover` result | Definition remains static; catalog arrives as an appended tool result. | Explicit model/`agentType` discovery. | **Use for catalogs only.** |
| Skill or repository docs | Content arrives after an explicit read; skill descriptions still occupy a small static list entry. | Advanced authoring when `read` exists; unavailable in some tool-restricted deployments. | **Use for optional recipes, never required correctness.** |
| Dynamic system prompt, lazy guideline getter, or trigger-time tool activation | Changes the prefix or tool list; fallback providers lose cache reuse. | Recognized paths only. | **Reject.** |

## Cache verification

A no-network Pi 0.80.6 SDK probe used the real `createWorkflowTool()`, a faux provider, an exact `pi-workflows` matcher, and an `input` transformation that appended the current forcing block. It sent three prompts in one session:

1. `Please discuss workflows as a topic.`
2. `Please discuss workflow implementation details.`
3. `pi-workflows compare two approaches.`

The faux provider captured the final `Context` for each request. Results:

```json
{
  "calls": 3,
  "systemPromptStable": true,
  "toolsStable": true,
  "genericWorkflowUntransformed": true,
  "configuredTriggerTransformed": true,
  "promptBytes": [22162, 22162, 22162],
  "toolBytes": [2225, 2225, 2225]
}
```

Only the third request's newest conversation message contained the forcing block. The system prompt and serialized tool array were byte-identical for all three provider calls.

This matches Pi's implementation:

- `input` transforms become the new user-message text before `before_agent_start` and provider dispatch.
- A `before_agent_start` `message` is appended to the message list; a returned `systemPrompt` replaces the prompt for that run.
- `setActiveToolsByName()` always replaces `agent.state.tools` and rebuilds the base system prompt.
- tool `promptSnippet` and `promptGuidelines` are read into that rebuilt prompt.

OpenAI's prompt-caching guidance requires an exact shared prefix and recommends placing static content first and variable content later. Its Codex agent-loop description also says tools must remain identical between requests. The triggered-message contract follows both rules: stable prompt and tools first, per-request control text in the newest message.

## Implementation acceptance criteria

1. The extension registers and activates `workflow` and `workflow_discover` before the first provider request. Their provider-visible definitions and prompt metadata remain byte-identical for the session.
2. Trigger handling never calls `setActiveTools`, `registerTool`, or returns a modified `systemPrompt`.
3. With `keywordTriggerWord: "pi-workflows"`, exact case-insensitive `pi-workflows` input gets one `keyword` block; `workflow`, `workflows`, `pi-workflow`, slash commands with similar names, disabled triggering, and one-shot suppression do not.
4. `/workflows run` and effort modes use the same builder with the correct source. Tests prove `/workflows run` receives the block despite bypassing `input` and `before_agent_start`.
5. The static selection text says one or more substantive subagents. Tests cover one valid substantive agent and reject a zero-agent workflow at the common runtime seam.
6. Runtime tests cover parser metadata, forbidden/nondeterministic constructs, thunk validation, phase diagnostics, final JSON-serializable result validation, tier enum validation, and unknown/stale `agentType` failure.
7. Provider-context tests capture at least one untriggered and one triggered request and assert byte equality for the system prompt and serialized tools. They also assert that only the newest triggered message differs.
8. The rendered static contribution stays at or below 700 UTF-8 bytes. The proposed four lines measure 625 bytes.
9. No concrete model, tier assignment, `agentType` name, or machine path appears in static prompt text, either tool definition, or the trigger block.
10. Saved and bundled workflows still run without parent guidance and receive the same common runtime validation as tool-authored workflows.

## Evidence ledger

### CodeGraph evidence

The rebuilt index identified [`src/workflow-tool.ts`](../../src/workflow-tool.ts) as the prompt/schema/tool boundary, [`src/workflow-editor.ts`](../../src/workflow-editor.ts) as the configured-trigger/input-transform boundary, [`src/workflow-commands.ts`](../../src/workflow-commands.ts) as the explicit command boundary, [`src/workflow.ts`](../../src/workflow.ts) as the common parser/runtime, and [`extensions/workflow.ts`](../../extensions/workflow.ts) as the production registration boundary. CodeGraph does not model object-property prompt metadata or Pi's runtime event ordering; targeted source reads supplied those blind spots.

### Source-read interpretation

Project source at commit [`7fa8a5944c5ad4182aee0c43d757350c61e3a5da`](https://github.com/Whamp/pi-dynamic-workflows/tree/7fa8a5944c5ad4182aee0c43d757350c61e3a5da) establishes the 24 current guidelines, exact custom-trigger matching, forced-message builder, active-tool mutation, `/workflows run` custom-message path, direct saved/bundled execution paths, parser checks, branch `null` semantics, phase behavior, routing, and nesting caps.

Pi 0.80.6 source establishes input and command ordering, `before_agent_start` behavior, custom-message direct turns, active-tool prompt rebuilding, and provider-visible context construction:

- [Extension event and tool documentation](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/docs/extensions.md)
- [Agent session prompt/input path](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/agent-session.ts)
- [Extension event runner](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/extensions/runner.ts)
- [System prompt builder](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/system-prompt.ts)

Provider-level cache sources:

- [OpenAI: Prompt Caching in the API](https://openai.com/index/api-prompt-caching/)
- [OpenAI: Unrolling the Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/)

Prior project evidence:

- [What the workflow schema teaches parent models](workflow-schema-comprehension.md)
- [Cache-safe on-demand workflow discovery](cache-safe-workflow-discovery.md)
- [Minimal always-on workflow prompt and size budgets](minimal-workflow-prompt-and-budgets.md)

### Proof commands

```bash
codegraph build .
codegraph stats -T
codegraph map -T
codegraph structure src --depth 3 -T --limit 120
codegraph brief src/workflow-tool.ts -T
codegraph brief src/workflow-editor.ts -T
codegraph deps src/workflow-tool.ts -T --json
npx tsx /tmp/pi-workflow-trigger-cache-probe.mts
```

The SDK probe used Pi's faux provider and made no network request. This ticket changes only this research note; it does not implement production behavior.
