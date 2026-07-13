# Pi browser-hosting and display seams

Research for **Research Pi browser-hosting and display seams** in the browser workflow inspector wayfinding effort.

## Scope and source baseline

This note answers which Pi facilities the inspector can reuse and what they constrain. It does not choose the observation model, transport, server, persistence schema, or browser stack.

The installed package is `@earendil-works/pi-coding-agent` **0.80.6**, corresponding to tag `v0.80.6` and commit [`2b3fda9921b5590f285165287bd442a25817f17b`](https://github.com/earendil-works/pi/commit/2b3fda9921b5590f285165287bd442a25817f17b). Pi citations below are pinned to that commit. Repository citations describe the current `pi-dynamic-workflows` source at `bf15ee1924b56813a1307473c6ea7b4db02b9e85`.

## Executive answer

The inspector should remain part of the existing Pi extension and use an explicit extension command as its launch seam. Pi supplies the necessary session lifecycle hooks, direct SDK session subscriptions, model/session context, cumulative usage accounting, tool execution events, and exported truncation utilities. The current workflow runtime already has a single `WorkflowManager`, a direct `AgentSession.subscribe()` seam inside every subagent, and persistence for run summaries.

Pi does **not** expose a public HTTP-server facility or public browser-launch API. It has an internal safe cross-platform browser opener, but the package export map makes it private. The inspector must therefore own its loopback server and either own or add a supported browser launcher.

The current workflow callback/snapshot layer is too lossy for the requested inspector. It collapses raw SDK events into agent start/end, compact history, and final usage; it has no first-class orchestration nodes for `parallel`, `pipeline`, nested `workflow`, `retry`, or `gate`; and its persisted timestamps do not represent each agent's actual event times. The observation contract must be introduced at or immediately above each subagent's `AgentSession.subscribe()` seam and below the TUI/browser projections.

## Reusable Pi facilities

### 1. Explicit launch and extension lifecycle

- `ExtensionAPI.registerCommand()` is the natural explicit, opt-in launch seam. The same API exposes event registration and custom tool registration. See [`ExtensionAPI`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/extensions/types.ts#L1165-L1281).
- Extension factories may use Node built-ins. Pi's extension documentation explicitly permits `node:fs`, `node:path`, and other Node built-ins; the inspector can therefore own a `node:http` server without a Pi-specific bridge.
- `session_start` distinguishes `startup`, `reload`, `new`, `resume`, and `fork`. `session_shutdown` distinguishes `quit`, `reload`, `new`, `resume`, and `fork` and includes the replacement target when applicable. See [session event types](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/extensions/types.ts#L548-L611).
- A session replacement tears down and recreates the extension runtime even though the OS process may continue. Therefore a server promised to be reused for the launching Pi **process** cannot live only in a per-session command closure. It needs process-scoped ownership and session rebinding, while `session_shutdown: quit` is the definitive normal cleanup signal. Reload/replacement failures and hard process termination still require idempotent cleanup and OS socket release.
- `ExtensionContext` supplies `cwd`, `sessionManager`, `modelRegistry`, current `model`, `isIdle()`, `signal`, and `getContextUsage()`. See [`ExtensionContext`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/extensions/types.ts#L302-L333).

Current project fit:

- The extension already creates one `WorkflowManager` in its factory, registers the workflow tool, and rebinds model registry and session id on `session_start`: [`extensions/workflow.ts:19-82`](../../extensions/workflow.ts#L19-L82).
- The manager is currently session-filtered through `setSessionId()`, matching the standing boundary that a browser view only shows runs owned by the active Pi session: [`src/workflow-manager.ts:126-134`](../../src/workflow-manager.ts#L126-L134), [`src/workflow-manager.ts:625-632`](../../src/workflow-manager.ts#L625-L632).

### 2. Browser launch and server hosting

Pi has an internal browser helper that safely chooses:

- macOS: `open`
- Windows: `rundll32 url.dll,FileProtocolHandler`
- Linux/Unix: `xdg-open`

It spawns without a shell, detaches, ignores stdio, handles launcher errors, and unrefs the child. See [`open-browser.ts`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/utils/open-browser.ts#L1-L24).

That helper is **not a public API**:

- The package exports only `.` and `./rpc-entry`: [`package.json`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/package.json#L14-L21).
- The root public index exports SDK, extension, truncation, TUI, and utility surfaces but not `openBrowser`: [`src/index.ts`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/index.ts#L1-L392).

The installed 0.80.6 source contains no public server/listener abstraction. Exact searches of the installed non-source-map distribution found no `createServer(` or `.listen(` call. This is absence evidence, not an API guarantee; the stronger package-boundary evidence is that no server type or factory is exported from the root entry point.

**Constraint:** the production design must own the loopback listener and browser launch. It may copy the security properties of Pi's internal launcher, but importing `dist/utils/open-browser.js` would rely on a blocked, unstable package subpath and is not acceptable as a supported seam.

### 3. Live subagent event stream

`AgentSession.subscribe()` is the strongest existing observation seam.

Its event union includes:

- agent, turn, message, and tool execution events from agent-core;
- `agent_end` with `willRetry`;
- `agent_settled` after retry/compaction/continuations are exhausted;
- queue changes;
- compaction start/end;
- `entry_appended`;
- session-info and thinking-level changes;
- automatic retry start/end.

See [`AgentSessionEvent`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/agent-session.ts#L127-L154) and [`subscribe()`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/agent-session.ts#L762-L772).

Tool lifecycle events expose:

- start: `toolCallId`, `toolName`, `args`;
- update: the same identity plus accumulated `partialResult`;
- end: identity, final `result`, and `isError`.

See [Pi extension tool event types](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/extensions/types.ts#L748-L773) and the SDK's event forwarding [in `AgentSession`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/agent-session.ts#L713-L750).

Important event constraints:

- Tool lifecycle events do not include timestamps. The observation layer must stamp receipt time with one clock policy if it will show “elapsed since last observable event.” Message records do carry timestamps.
- `agent_end` is not necessarily terminal. Use `willRetry` and/or `agent_settled` when representing Pi SDK retry state.
- Tool update frequency is tool-defined. Built-in bash throttles updates to 100 ms, which is comfortably below the inspector's one-second normal-local target, but tools that do not call `onUpdate` only produce start/end events. See [`BASH_UPDATE_THROTTLE_MS`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/tools/bash.ts#L174-L175) and update scheduling [at lines 317-351](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/tools/bash.ts#L317-L351).
- Tool start is emitted before argument preparation, validation, and `beforeToolCall`; the tool executes the prepared/possibly mutated `args`. Tool end does not repeat those args. See agent-core's [start/preparation order](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/agent/src/agent-loop.ts#L438-L466), [`beforeToolCall`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/agent/src/agent-loop.ts#L610-L652), and [execution with prepared args](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/agent/src/agent-loop.ts#L671-L699). If “full tool arguments” means the exact post-hook executed value, the observation contract cannot rely only on `tool_execution_start`; it must capture the prepared args at the tool-call/result hook or an equivalent wrapper seam.
- Direct SDK listeners run after extension event handlers for each agent event, so finalized message replacements are visible to the listener. See [`_handleAgentEvent`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/agent-session.ts#L560-L607).

Current project fit:

- Every workflow agent already creates an SDK `AgentSession`: [`src/agent.ts:471-498`](../../src/agent.ts#L471-L498).
- It already subscribes while the prompt runs, but converts every event into a compacted message history at most every 250 ms: [`src/agent.ts:503-524`](../../src/agent.ts#L503-L524).
- `compactAgentHistory()` keeps at most 40 entries, 2,000 characters per entry, and 20,000 total characters: [`src/agent-history.ts:20-27`](../../src/agent-history.ts#L20-L27). That is suitable for the existing TUI preview, not the requested diagnostic record.
- The browser observation seam should therefore branch from the raw `AgentSessionEvent` before `compactAgentHistory()`, not scrape `WorkflowSnapshot.history`.

### 4. Model and cumulative token usage

Every finalized assistant message carries provider, model, stop reason, error, timestamp, and usage. Usage includes input, output, cache read/write, optional reasoning breakdown, `totalTokens`, and cost. See [`Usage` and `AssistantMessage`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/ai/src/types.ts#L352-L395).

`AgentSession.getSessionStats()` is the reusable cumulative-accounting API. It intentionally aggregates **all persisted session entries**, including history compacted out of the active LLM context, and sums input, output, cache reads, cache writes, and cost. See [`getSessionStats()`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/agent-session.ts#L3018-L3076).

Constraints:

- Pi's `SessionStats.tokens.total` is calculated as input + output + cache read + cache write. This is not necessarily identical to a provider's per-message `Usage.totalTokens`; the specification must name which total the inspector displays.
- `getContextUsage()` is an estimate for the active context window and may return null token/percent values immediately after compaction. It is not cumulative billed usage: [`getContextUsage()`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/agent-session.ts#L3078-L3124).
- The current workflow layer reads `getSessionStats()` only in `finally`, immediately before disposing the subagent session: [`src/agent.ts:553-572`](../../src/agent.ts#L553-L572). Per-agent and run token totals therefore update only when an agent attempt ends, and the workflow-level `onTokenUsage` callback fires only after the whole script resolves: [`src/workflow.ts:915-935`](../../src/workflow.ts#L915-L935).
- Live cumulative usage can be obtained without provider-specific logic by sampling `getSessionStats()` after finalized assistant messages or by accumulating message usage with stable message identity. The observation contract must prevent double counting across retries/replays and define whether replayed journal results report zero new tokens (the current workflow does).

### 5. Tool call/result display and truncation conventions

Pi separates semantic tool data from terminal rendering:

- A `ToolDefinition` has parameter schema, execution, optional `renderCall`, optional `renderResult`, and optional self-owned shell framing. Renderers receive `expanded`, `isPartial`, tool args, per-row state, and error status. See [`ToolDefinition`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/extensions/types.ts#L437-L486).
- The interactive `ToolExecutionComponent` chooses custom renderers first, inherits built-in renderer slots when a built-in tool is overridden, and falls back to tool name/raw text if no renderer exists or a renderer throws. See [renderer selection and fallback](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/modes/interactive/components/tool-execution.ts#L81-L141) and [collapsed/partial rendering](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/modes/interactive/components/tool-execution.ts#L253-L315).
- `ToolExecutionComponent` is publicly exported, but it renders TUI components/ANSI lines and depends on terminal theme/UI state; it is not a semantic browser renderer. See the [public export](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/index.ts#L348-L389).

Pi's truncation utilities **are** portable and public:

- default limits are 2,000 lines and 50 KiB;
- `truncateHead()` keeps the beginning for reads/search-like output;
- `truncateTail()` keeps the end for logs/command output.

See [truncation constants and contracts](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/tools/truncate.ts#L1-L12), [`truncateHead`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/tools/truncate.ts#L70-L135), [`truncateTail`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/tools/truncate.ts#L160-L226), and their [root exports](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/index.ts#L267-L315).

Built-in conventions the browser can preserve:

- `read` returns head-truncated semantic content with an actionable continuation notice. In the TUI, a successful collapsed read hides result content; expansion shows all already-returned lines, while errors show up to 10 lines when collapsed. See [`formatReadResult`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/tools/read.ts#L164-L197), [read execution truncation](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/tools/read.ts#L279-L317), and [renderer wiring](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/tools/read.ts#L329-L345).
- `bash` returns tail-truncated content, writes a full-output temp file when truncated, shows five visual lines when collapsed, shows all already-returned content when expanded, and always keeps truncation/full-path warnings. See [bash preview policy](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/tools/bash.ts#L174-L284), [execution truncation/full-output notice](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/tools/bash.ts#L360-L398), and [renderer timing](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/tools/bash.ts#L430-L463).

**Constraint:** transport the tool's existing `content` and `details` without inventing a second truncation rule. Browser expansion can reveal the complete **transported** result and full arguments, but cannot recover bytes already truncated by the tool unless the product intentionally exposes and reads the local `fullOutputPath`. That file-access decision belongs to the security/persistence tickets.

## Current workflow-runtime gaps exposed by the research

These are facts for later tickets, not design decisions made here.

1. **No observation model yet.** `WorkflowRunOptions` exposes only phase, agent start/end, compact history, logs, journal, and final usage callbacks: [`src/workflow.ts:91-136`](../../src/workflow.ts#L91-L136).
2. **Orchestration structure is invisible.** `parallel`, `pipeline`, nested `workflow`, `retry`, and `gate` execute directly without emitting node lifecycle/dependency events: [`src/workflow.ts:600-687`](../../src/workflow.ts#L600-L687), [`src/workflow.ts:811-839`](../../src/workflow.ts#L811-L839).
3. **Authored role metadata is dropped.** `AgentOptions` has `agentType`, but `onAgentStart` emits only label, phase, prompt, and model. Structural position is also absent: [`src/workflow.ts:162-198`](../../src/workflow.ts#L162-L198), [`src/workflow.ts:439-456`](../../src/workflow.ts#L439-L456).
4. **Attempts are log text, not entities.** Workflow retries loop internally and emit one agent start plus a final end; failed intermediate attempts are only logged: [`src/workflow.ts:453-580`](../../src/workflow.ts#L453-L580).
5. **Nested workflows share parent callbacks without a child identity.** They receive spread parent options and a synthetic nested run id, so current callback consumers cannot reliably distinguish parent and child structure: [`src/workflow.ts:657-687`](../../src/workflow.ts#L657-L687).
6. **Persistence is summary-shaped.** It stores agent prompt/result/error, compact history, run status/result, aggregate usage, and journal: [`src/run-persistence.ts:13-61`](../../src/run-persistence.ts#L13-L61). It does not store raw observation events, dependency edges, attempt entities, structural position, latest successful tool call as a dedicated field, or a known-horizon model.
7. **Per-agent timestamps are not factual yet.** `persistRun()` currently writes every agent's `startedAt` as the run start and `endedAt` as the persistence time: [`src/workflow-manager.ts:476-523`](../../src/workflow-manager.ts#L476-L523). Those fields cannot drive elapsed-agent activity displays.
8. **Persistence is already crash-conscious.** Run files are written via temp + rename with a backup fallback, and completed/failed/paused/aborted states survive process restarts: [`src/run-persistence.ts:172-224`](../../src/run-persistence.ts#L172-L224). A new diagnostic design should preserve that property rather than bypass it.

## Constraints handed to the next tickets

### Observation-model ticket

- Define one timestamped event/observation contract sourced from raw `AgentSessionEvent` plus orchestration-runtime events.
- Preserve authored prompt separately from execution context.
- Add stable identities for run, workflow nesting, orchestration node, agent invocation, attempt/replay, dependency, and tool call.
- Capture exact executed tool args at a post-preparation seam, not only start args.
- Define cumulative token semantics and replay accounting.
- Represent only the runtime-known horizon; lack of a future node must remain “undetermined,” not “not scheduled.”

### Server/synchronization ticket

- Own the loopback server; no Pi server API exists.
- Design process-scoped ownership across extension session replacement and cleanup on quit/reload/crash.
- Use an explicit registered command to launch/open.
- Meet one-second browser freshness from observation events; Pi's event rates do not block that target.

### Browser packaging/UI ticket

- Do not depend on TUI components as browser renderers.
- Reuse semantic `content`/`details`, exported truncation constants/utilities, and the collapsed/expanded policies where they make sense.
- Decide whether to reproduce built-in/custom tool renderer output, create browser-native semantic renderers, or support a deliberate fallback hierarchy.

### Persistence/security tickets

- Decide whether full tool arguments/results and local full-output paths become durable diagnostic data.
- Preserve current session scoping and finalized run states.
- Treat prompts, execution context, tool arguments, results, scripts, and local paths as sensitive even though the service is loopback-only.

## Source-evidence ledger

### CodeGraph evidence

The rebuilt repository graph identified `src/workflow.ts`, `src/workflow-manager.ts`, `src/run-persistence.ts`, `src/display.ts`, `src/agent.ts`, and `extensions/workflow.ts` as the relevant runtime, projection, persistence, and extension seams. CodeGraph showed `src/workflow.ts` as the principal coupling hotspot and `extensions/workflow.ts` importing the manager/tool/UI registration spine. This narrowed the source reads; it does not validate runtime behavior.

### Source-read interpretation

The source reads establish the API and current-runtime facts summarized above. Absence claims were corroborated by exact search of Pi 0.80.6's installed distribution and its public package export boundary.

### Proof commands used

```bash
codegraph build .
codegraph stats -T
codegraph map -T
codegraph structure src --depth 2 -T --limit 120
codegraph brief src/workflow.ts -T
codegraph brief src/agent.ts -T
codegraph brief src/display.ts -T
codegraph brief src/run-persistence.ts -T
codegraph brief extensions/workflow.ts -T

gh api repos/earendil-works/pi/git/ref/tags/v0.80.6
rg -n --glob '!*.map' 'xdg-open|openBrowser|createServer\(|\.listen\(' <installed-pi>/dist
```

No production behavior was implemented or validated in this research ticket.
