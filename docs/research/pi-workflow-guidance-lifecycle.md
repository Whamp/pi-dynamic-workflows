# Pi workflow-guidance lifecycle and feasibility

Research for [Determine Pi lifecycle placement for workflow guidance profiles](https://github.com/Whamp/pi-dynamic-workflows/issues/18), blocking [Assemble and approve the minimal workflow prompting specification](https://github.com/Whamp/pi-dynamic-workflows/issues/14).

## Decision

The profile concept drifted. Restore its original meaning:

- **Detailed and minimal are permanent prompt profiles.** They select how much workflow guidance Pi adds to the session’s stable system-prompt prefix before the first parent-model response.
- **On-demand authoring guidance is a separate mechanism.** It may supplement either permanent profile after an explicit trigger, but it is not what “detailed” or “minimal” means.
- **Runtime enforcement is a third layer.** It validates or supplies behavior after the parent has authored a script. It cannot teach the parent how to author that same tool call retroactively.

Pi 0.80.7 supports all three layers. It does not remove the central tradeoff: anything needed for autonomous one-response selection and script authoring must be present in the permanent system/tool prefix, or the interaction must become a two-step loader-then-workflow exchange.

## Correct vocabulary

| Term | Meaning |
| --- | --- |
| **Permanent prompt profile** | `detailed` or `minimal`; fixed for one Pi session and represented by fixed `promptSnippet`/`promptGuidelines`. |
| **Provider tool contract** | The active `workflow` tool’s name, description, and JSON schema. It is provider input but not part of Pi’s system-prompt string. |
| **On-demand authoring guidance** | Extra instructions delivered after an explicit trigger and before the parent authors `workflow`. |
| **Persistent trigger guidance** | Trigger guidance stored as a user/custom message. It remains in conversation history. |
| **Ephemeral trigger guidance** | Trigger guidance added by Pi’s `context` event to outgoing model context but not stored in session history. |
| **Tool-result guidance** | Instructions returned by a loader/tool and available only on the next parent-model call. |
| **Workflow runtime contract** | Parser, validation, defaults, execution semantics, subagent-prompt construction, and result diagnostics. |

Do not call trigger-time variants “detailed profile” and “minimal profile.” That wording caused the current ambiguity.

## Pi’s actual lifecycle

Pi 0.80.7 processes a session and prompt in this order:

```text
Extension factory
  ├─ read configuration
  ├─ register workflow with fixed prompt metadata and schema
  └─ Pi constructs the base system prompt and active tool list
           │
           ▼
session_start
           │
           ▼
User prompt
  ├─ extension command check
  ├─ input handlers may transform the text
  ├─ /skill:name and prompt-template expansion
  ├─ before_agent_start may add persistent messages or replace the system prompt
  └─ parent agent run starts
           │
           ▼
Before every provider request in that run
  ├─ context handlers receive a deep copy of messages and may return a modified copy
  └─ provider serializes system prompt, messages, and active tool definitions
           │
           ▼
Parent response
  ├─ may use ordinary tools first
  └─ may author and call workflow
           │
           ▼
tool_call hook
  ├─ may mutate or block the already-authored call
  └─ workflow.execute parses, validates, and runs the script
           │
           ▼
Tool result
  └─ visible to the parent only on a later provider request
```

Primary Pi sources:

- [Extension lifecycle and APIs](https://github.com/earendil-works/pi/blob/818d67457cdd6b60bce6b121d16b23141c252dd8/packages/coding-agent/docs/extensions.md)
- [Agent-session input, skill expansion, and prompt lifecycle](https://github.com/earendil-works/pi/blob/818d67457cdd6b60bce6b121d16b23141c252dd8/packages/coding-agent/src/core/agent-session.ts)
- [System-prompt construction](https://github.com/earendil-works/pi/blob/818d67457cdd6b60bce6b121d16b23141c252dd8/packages/coding-agent/src/core/system-prompt.ts)
- [`context` event chaining](https://github.com/earendil-works/pi/blob/818d67457cdd6b60bce6b121d16b23141c252dd8/packages/coding-agent/src/core/extensions/runner.ts)
- [SDK binding of `context` to every model call](https://github.com/earendil-works/pi/blob/818d67457cdd6b60bce6b121d16b23141c252dd8/packages/coding-agent/src/core/sdk.ts)
- [Skill discovery and prompt formatting](https://github.com/earendil-works/pi/blob/818d67457cdd6b60bce6b121d16b23141c252dd8/packages/coding-agent/src/core/skills.ts)

The installed package and probe used `@earendil-works/pi-coding-agent` 0.80.7. npm reports commit `818d67457cdd6b60bce6b121d16b23141c252dd8` for that release.

## What the session pays before workflows are used

When `workflow` is active, the first provider request contains three workflow-related surfaces even if the parent never calls it:

1. `promptSnippet`, rendered in Pi’s system-prompt **Available tools** section;
2. every `promptGuidelines` entry, rendered as flat system-prompt **Guidelines** bullets;
3. the provider tool definition: name, description, and JSON schema.

A visible skill adds its name, description, and path to the system prompt as well. Pi does not add the full `SKILL.md`; the model must read it or the user must invoke `/skill:name`.

This permanent input has three distinct costs:

- **context and attention:** it occupies the model’s context on every provider request;
- **first-request tokens:** a new session sends the prefix before any cache hit exists for that conversation;
- **cache sensitivity:** changing prompt text or immediate tool definitions can invalidate prefix reuse on later requests.

A cache hit may reduce billed input cost. It does not remove the text from the model’s context or attention, and it does not make a bloated first request free.

## Feasibility matrix

| Mechanism | First visible to parent | Stored in history? | Can shape the first `workflow` call? | Cache/context behavior | Verdict |
| --- | --- | :---: | :---: | --- | --- |
| Fixed `promptSnippet`/`promptGuidelines` selected during extension construction | First provider request | No; rebuilt as system prompt | **Yes** | Permanent session prefix; stable when snapshotted | **Use for detailed/minimal permanent profiles.** |
| Workflow description/schema | First provider request | No; provider tool input | **Yes** | Permanent while active | **Use for syntax and outer arguments.** Keep identical between profiles unless a reviewed reason requires divergence. |
| Visible skill metadata | First provider request | No | Only tells the parent to read the skill | Permanent system-prompt cost | **Avoid for zero-cost optional help.** |
| Hidden skill with `disable-model-invocation: true` | Not visible until `/skill:name` expansion | Full expansion is stored as user text | **Yes**, after explicit expansion | No permanent skill-catalogue cost; expanded body persists and accumulates | **Feasible for explicit/manual help, not ephemeral help.** |
| `input` transformation | Initial request after a matching trigger | **Yes** | **Yes** | Stable prefix, variable tail; transformed text remains in later history | **Feasible, but persistent.** Keep any marker small. |
| `before_agent_start` custom message | Initial request | **Yes** | **Yes** | Stable system prefix; message remains in later history | **Feasible, but persistent and bypassed by current `/workflows run`.** |
| `before_agent_start` system-prompt replacement | Initial request | No | **Yes** | Changes the prefix for that run and can lose cache reuse; bypassed by direct custom-message turns | **Reject for trigger-time guidance.** |
| Ephemeral `context` message | Before every selected provider request | **No** | **Yes** | Stable system/tool prefix; extra tail tokens only while armed | **Best Pi mechanism for automatic on-demand guidance.** |
| Loader/tool result | Provider request after the loader returns | Tool result persists | **Yes, for a later workflow call** | Adds a model/tool round trip and result tokens | **Feasible two-step design.** |
| Additive dynamic tool loading | Provider request after loader result | Tool result records added names | **Yes, for a later workflow call** | Native deferred loading on supported providers; fallback changes the normal tool list | **Possible but provider-dependent for cache preservation.** |
| `tool_call` hook | After parent authored the call | Error/result persists | **No** for the initial call | Can block and cause a repair turn | **Use only for validation and repair.** |
| `workflow.execute` | After parent authored the script | Tool result persists | **No** for the initial call | Runtime-only | **Use for parsing, defaults, validation, and execution.** |
| Runtime subagent-prompt augmentation | Before each subagent launches | Inside subagent request | Cannot change parent topology | Cost multiplies per launched subagent | **Use only for universal worker requirements.** |

## Permanent detailed and minimal profiles are possible

The extension already loads settings synchronously in its factory before creating and registering the tool. It can select one fixed `promptSnippet` and one fixed guideline array at that boundary.

Implementation constraints:

1. Read the profile before `createWorkflowTool()` returns its definition.
2. Use ordinary immutable strings/arrays, not a getter that reads live registries.
3. Keep the selected metadata fixed until the session is replaced or reloaded.
4. Apply global/project settings precedence before registration.
5. Keep the workflow provider schema shared unless the profiles intentionally expose different capabilities—which this effort does not propose.

The probe created separate detailed and minimal sessions. Each session had a distinct permanent guideline marker, a byte-stable system prompt across ten provider calls, and identical provider tool definitions across profiles.

This proves the original profile concept is implementable in Pi.

## On-demand guidance mechanisms

### Skill expansion

Pi processes `input` transformations before skill-command expansion. An exact configured trigger can therefore transform:

```text
pi-workflows investigate the cache
```

into:

```text
/skill:workflow-authoring investigate the cache
```

Pi then replaces the skill command with the full `SKILL.md` body before the parent responds. A skill marked `disable-model-invocation: true` is absent from the permanent system-prompt skill catalogue but remains explicitly invokable.

This works, but the expansion becomes the stored user message. The probe saw the skill body first appear on the triggered provider call and remain visible on every later call. Repeated triggers would accumulate repeated skill bodies until compaction or branch removal.

**Verdict:** a hidden skill is useful for explicit manual reference or a deliberately persistent authoring mode. It is not the best automatic mechanism for large per-workflow guidance.

### Persistent custom messages

`before_agent_start` can append a custom message. Pi stores that message in the session and converts it to a user-role message for providers. The probe showed that it remained visible on every subsequent call.

The current `/workflows run` command calls `pi.sendMessage(..., { triggerTurn: true })` directly. That path does not run normal `input` or `before_agent_start` processing. A design based only on either hook misses the command path.

**Verdict:** use persistent messages only for small durable markers whose audit value justifies their continuing token cost.

### Ephemeral `context` injection

Pi fires `context` before every model request. The handler receives a cloned message list and can append guidance to that outgoing copy. The returned copy is not written to `SessionManager`.

The probe armed ephemeral guidance from both:

- an exact input-trigger path; and
- a command path that used `pi.sendMessage(..., { triggerTurn: true })`.

For the input path, the first parent response called `read`; the guidance remained present on the next provider call, where the parent called the workflow-like tool. The `tool_call` hook then cleared the armed state. The guidance was absent from the post-tool provider call and absent from stored session history.

Observed visibility across the ten calls in each profile:

```json
[false, false, false, false, false, true, true, false, true, false]
```

The two consecutive `true` values are the trigger request and its pre-workflow read continuation. The later isolated `true` is the command-triggered request. Both following tool-result calls are `false`.

**Verdict:** this is the strongest mechanism for automatic, cache-safe, nonpersistent authoring guidance after explicit workflow selection.

Required safeguards:

- arm state from every supported explicit entry path;
- keep guidance active through ordinary pre-workflow tool turns;
- clear it when `tool_call` sees `workflow`, when the agent settles without calling workflow, on abort, and on session shutdown/replacement;
- restore state deliberately across automatic retry or compaction if the workflow call has not occurred;
- add tests for concurrent steering/follow-up messages and repeated triggers;
- keep a small persistent marker only if later auditability is required.

### Loader/tool-result guidance

A tool result is visible only after the parent has already called that tool. It can teach the parent how to make a later `workflow` call.

A two-step design could expose a small loader, return authoring guidance, and then let the parent call `workflow`. Pi 0.80.7 also supports additive dynamic tool loading. On supported providers, Pi anchors added definitions at the loader result using native deferred-loading protocol. On unsupported providers, Pi sends the complete updated tool list on the next request, which may invalidate the cached tool prefix.

Pi’s documentation warns that activating a deferred tool with `promptSnippet` or `promptGuidelines` rebuilds the system prompt even when native deferred schema loading exists. A lazily added workflow tool would therefore need to rely on description/schema or keep its prompt metadata permanently active.

Relevant sources:

- [Dynamic tool loading documentation](https://github.com/earendil-works/pi/blob/818d67457cdd6b60bce6b121d16b23141c252dd8/packages/coding-agent/docs/extensions.md#dynamic-tool-loading)
- [Deferred-tool split](https://github.com/earendil-works/pi/blob/818d67457cdd6b60bce6b121d16b23141c252dd8/packages/ai/src/utils/deferred-tools.ts)
- [OpenAI Responses deferred placement](https://github.com/earendil-works/pi/blob/818d67457cdd6b60bce6b121d16b23141c252dd8/packages/ai/src/api/openai-responses-shared.ts)

**Verdict:** feasible, but it adds a round trip and cache behavior depends on provider support. It is an alternative when minimal permanent guidance is too weak for autonomous one-call authoring, not a free replacement.

## What “inside workflow runtime” can and cannot do

By the time `workflow.execute` runs, the parent has already decided:

- whether to use workflow;
- script topology;
- work-unit size;
- prompts for each agent;
- labels, tiers, schemas, models, and agent types;
- failure and synthesis logic.

Execution-time code can still:

- reject malformed scripts;
- validate metadata and manifests;
- fail closed on unknown agent types;
- require labels or valid tiers;
- reject zero-agent or undefined-result workflows;
- inject universal text into every subagent prompt;
- supply safe defaults;
- record failed coverage and structural status;
- return actionable diagnostics so the parent can repair the script in a later call.

Execution-time code cannot teach the parent a better topology for the script it has already submitted. It cannot recover work lost because the original script omitted a necessary branch, silently filtered `null`, or chose the wrong work units—except by rejecting the call and paying for another parent turn.

Therefore “inject it at workflow runtime” must name one of two different designs:

1. **pre-authoring runtime guidance:** an ephemeral `context` message or a loader result before `workflow` is called; or
2. **execution enforcement/augmentation:** logic inside `workflow.execute` after the script exists.

The first can influence authorship. The second cannot.

## Placement by information group

| Information group | Earliest point it is needed | Best permanent location | Optional on-demand location | Runtime role |
| --- | --- | --- | --- | --- |
| Capability and selection boundary | Before parent chooses workflow | Snippet/short guideline and tool description | Small trigger marker | Cannot infer user intent reliably |
| Outer call shape and parameters | Before parent calls workflow | Tool description/schema | None | Validate outer arguments |
| Script envelope and deterministic restrictions | Before first script succeeds | Schema where concise | Ephemeral guidance or hidden skill examples | Parser must enforce and diagnose |
| `agent()` inner contract: labels, tiers, schemas | Before script authoring | Irreducible concise guideline if autonomous one-call use is allowed | Ephemeral authoring guidance | Validate what can be proved |
| Recoverable `null` semantics | Before script authoring | Concise permanent rule if autonomous one-call use is allowed | Ephemeral examples | Expose failures; cannot infer intended coverage |
| Explicit final return | Before script authoring | Concise permanent rule or schema description | Ephemeral example | Reject `undefined`/non-serializable output |
| Topology, natural work units, barriers, conditional synthesis | Before script authoring | Detailed permanent profile only if its every-session value justifies cost | Ephemeral guidance or loader result | Cannot choose semantics after submission |
| Helper signatures and advanced recipes | Only when chosen | None | Hidden skill/docs/ephemeral targeted help | Implement helpers and errors |
| Agent-type names/descriptions | Before selecting an agent type | Detailed profile only if accepted permanent cost | Ephemeral snapshot or ordinary file inspection | Manifest preflight and fail closed |
| Full agent-type role/capability definition | Before selecting an agent type | Never | Ordinary file read or loader result | Bind selected definition |
| Model catalogue | Never for normal routing | Never | None; user names exact model | Resolve semantic tiers and exact user override |
| Universal subagent evidence/output rules | Before each subagent call | Parent only needs to know if it affects authored schema | Ephemeral authoring help | Runtime may augment every worker prompt, with per-agent token cost |
| Completion/failure status | After execution | None | Tool result | Structural runtime result |

## The unavoidable autonomous-selection tradeoff

Pi has no hook between these two operations inside one parent response:

1. the model internally decides to use `workflow`;
2. the model emits the authored `workflow` call.

Consequences:

- Trigger-time ephemeral guidance helps explicit keyword, command, and effort paths.
- It cannot help an untriggered autonomous workflow selected and authored in one response.
- If autonomous one-call workflows must remain supported, the minimal permanent profile still needs every inner contract required for acceptable first-attempt scripts.
- If that permanent cost is unacceptable, autonomous use must become a two-step loader-first protocol or accept runtime rejection/repair.

This is a product tradeoff, not an extension API gap that a skill can erase.

## Probe evidence

The no-network probe is reproducible:

- [`experiments/workflow-guidance-lifecycle/probe.ts`](../../experiments/workflow-guidance-lifecycle/probe.ts)
- [`experiments/workflow-guidance-lifecycle/probe-result.json`](../../experiments/workflow-guidance-lifecycle/probe-result.json)

It uses Pi’s faux provider and makes no external model call.

For both permanent profiles:

- ten provider-context calls were captured;
- the system prompt was byte-identical across all ten calls;
- the provider tool definitions were byte-identical across all ten calls;
- the hidden skill name and body were absent from permanent context;
- skill expansion and `before_agent_start` messages persisted in later history;
- tool-result guidance appeared only after the tool call;
- ephemeral `context` guidance survived a pre-workflow read turn and a direct command-triggered turn;
- ephemeral guidance disappeared after the workflow-like call and never entered stored history.

Across profiles:

- the permanent detailed and minimal system prompts differed;
- provider tool definitions matched;
- each profile retained only its selected permanent marker.

The probe captures Pi’s provider `Context`, the object passed into provider serialization. Installed Pi source supplies the final provider-specific serialization evidence. The probe does not claim to capture a real network HTTP request.

## Recommendation for issue 14

Do not continue editing the final specification from its current trigger-profile model. Replace it with this three-layer architecture before approval:

1. **Permanent profile layer**
   - `detailed` and `minimal` choose fixed session-start `promptSnippet`/`promptGuidelines`.
   - Measure and compare their permanent system-prompt contribution separately.
   - Keep one shared provider tool schema.

2. **On-demand authoring layer**
   - Treat this as independent of profile selection.
   - Prefer ephemeral `context` injection after exact configured trigger, command, or effort selection.
   - Keep it armed through pre-workflow parent tool calls and clear it at the `workflow` call or settled run.
   - Use hidden skills/docs for optional manual recipes, not as the automatic transport for a large repeated block.

3. **Runtime layer**
   - Enforce mechanical and safety invariants.
   - Augment subagent prompts only for truly universal worker requirements.
   - Never claim runtime enforcement can replace semantic guidance needed before script authorship.

The next specification question is no longer “Is trigger-time detailed/minimal possible?” It is:

> Which instruction groups earn permanent placement in each profile, which trigger paths receive ephemeral authoring guidance, and which requirements can move entirely into runtime enforcement?

That decision should be made with separate byte/token measurements for the permanent detailed profile, permanent minimal profile, shared provider tool contract, and optional ephemeral guidance block.

## Verification

```bash
# Structural scout
codegraph build .
codegraph stats -T
codegraph where createWorkflowTool -T
codegraph where installWorkflowEditor -T
codegraph where buildForcedWorkflowPrompt -T

# No-network lifecycle probe
npx tsx experiments/workflow-guidance-lifecycle/probe.ts

# Artifact checks
node -e 'JSON.parse(require("node:fs").readFileSync("experiments/workflow-guidance-lifecycle/probe-result.json", "utf8"))'
git diff --check
```
