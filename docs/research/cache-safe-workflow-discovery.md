# Cache-safe on-demand workflow discovery

Research for **Design cache-safe on-demand workflow discovery** in the **Specify minimal cache-safe workflow prompting** wayfinding effort.

## Decision

Register one small companion tool, `workflow_discover`, alongside `workflow` before the first model turn. Keep both tools and both definitions stable for the session. Put no model names or `agentType` names in either tool's prompt metadata or in the system prompt. Return catalogs only as the result of an explicit `workflow_discover` call.

This is the smallest interface that preserves the strict, required `script` contract of `workflow`, works when the parent chooses workflows without a recognizable user trigger, and keeps discovery data in append-only conversation messages rather than mutating the cached prefix.

Normal routing remains `small`, `medium`, or `big`. The models catalog is for deliberate exact-model discovery only. A user-supplied exact `opts.model` does not require a discovery call and must not be rejected merely because it was absent from an earlier catalog result.

## Concrete tool contract

The extension should register and activate `workflow_discover` at the same time as `workflow`, before the session's first provider request.

```ts
{
  name: "workflow_discover",
  description:
    "Inspect workflow-specific catalogs after choosing workflows. " +
    "Inspect agentTypes before using opts.agentType. " +
    "Inspect models only when the user deliberately requests exact-model discovery; " +
    "use small, medium, or big for normal routing.",
  // No promptSnippet and no promptGuidelines.
  parameters: Type.Object({
    catalog: StringEnum(["agentTypes", "models"] as const),
    name: Type.Optional(
      Type.String({
        description: "Exact name to inspect. Omit to list the catalog.",
      }),
    ),
  }),
}
```

Use Pi's `StringEnum`, not `Type.Union`/`Type.Literal`, so the schema remains compatible with Google-backed providers. Pi documents this constraint in its [custom-tool guidance](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/docs/extensions.md#L1838-L1851) and [explicit enum warning](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/docs/extensions.md#L1893-L1907).

The tool returns the following object as JSON text in `content` and repeats the same value in `details`:

```ts
type WorkflowDiscoveryResult = {
  catalog: "agentTypes" | "models";
  requestedName?: string;
  status: "ok" | "empty" | "not_found" | "partial" | "error";
  items: Array<{
    name: string;
    description?: string;
  }>;
  diagnostics: Array<{
    code: string;
    message: string;
  }>;
};
```

The result must be deterministic: merge with runtime precedence, sort items by `name`, and sort diagnostics by stable source/code order. Do not throw for expected discovery outcomes; `status` is part of the discovery protocol and remains available even for partial results. Throw only for an unclassified implementation failure that prevents constructing the protocol result. Pi otherwise exposes thrown tool errors only as failed executions, while returned values are not marked as tool errors ([Pi extension docs](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/docs/extensions.md#L1893-L1905)).

### Status semantics

| Situation | Status | Items | Diagnostics |
| --- | --- | --- | --- |
| Successful list or exact lookup | `ok` | All entries or the one exact entry | Empty |
| All configured sources were read successfully but contain no entries | `empty` | Empty | Empty |
| `name` is absent from an otherwise usable catalog | `not_found` | Empty | One concise unknown-name diagnostic |
| Some sources failed but trustworthy entries remain | `partial` | Available entries | One diagnostic per failed source |
| No trustworthy catalog can be produced | `error` | Empty | One or more root-cause diagnostics |

An unknown exact name must not automatically dump the full catalog. The result tells the parent to call the same tool without `name` if it deliberately wants the list. This preserves the rule that an exact model catalog appears only after explicit discovery.

## Catalog semantics

### `agentTypes`

- Read definitions at call time from `<project>/.pi/agents/`, `~/.pi/agent/agents/`, and the deprecated `~/.pi/agents/` fallback.
- Preserve runtime precedence: project, then current user location, then legacy user location; first definition for a name wins.
- Return only `name` and optional `description`. Do not expose role prompts, tool policies, bound models, isolation settings, or absolute source paths to the parent.
- Missing directories and a successful scan with no Markdown definitions produce `empty`, not `error`.
- Unreadable directories/files and parse fallbacks must become diagnostics instead of silently becoming an apparently empty catalog.

The current loader already implements the required locations and precedence, but it swallows directory and file read failures ([`src/agent-registry.ts`](https://github.com/Whamp/pi-dynamic-workflows/blob/f8b6f5c34e9476e014d2906a257344e410a00364/src/agent-registry.ts#L105-L176)). The implementation therefore needs a diagnostic discovery API rather than reusing today's lossy `loadAgentRegistry()` result unchanged. Runtime loading and discovery should share the same merge/parser core so they cannot disagree.

The extension ships no definitions. The current projection already has the correct minimal item shape—name plus optional description ([`listAgentTypes()`](https://github.com/Whamp/pi-dynamic-workflows/blob/f8b6f5c34e9476e014d2906a257344e410a00364/src/agent-registry.ts#L218-L220)).

If a workflow later references an `agentType` that disappeared after discovery, execution should fail before launching that subagent with the unknown name and a direction to call `workflow_discover`. The current silent fallback to default tools/model ([`src/workflow.ts`](https://github.com/Whamp/pi-dynamic-workflows/blob/f8b6f5c34e9476e014d2906a257344e410a00364/src/workflow.ts#L390-L402)) would make a stale discovery result change the requested role without consent.

### `models`

- Read the live host-session `ModelRegistry` through the shared `WorkflowManager`, not a stale snapshot or a separately constructed registry. The extension binds that registry during `session_start` today ([`extensions/workflow.ts`](https://github.com/Whamp/pi-dynamic-workflows/blob/f8b6f5c34e9476e014d2906a257344e410a00364/extensions/workflow.ts#L50-L63)).
- Return auth-configured available models as canonical `provider/modelId` names. Do not return configured tier-to-model assignments.
- `ModelRegistry.getAvailable()` defines availability as auth configured, and `getError()` separately reports a `models.json` load error ([Pi `ModelRegistry`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/model-registry.ts#L406-L425), [availability methods](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/model-registry.ts#L654-L674)). Use both: entries plus a load error produce `partial`; no entries plus a load error produce `error`; no entries and no load error produce `empty`.
- If the live registry is unavailable, return `error` with `MODEL_REGISTRY_UNAVAILABLE`; do not silently build a second registry whose providers may differ from the host session.
- A catalog result is advisory, not an allowlist. A user may explicitly provide an exact model later. Dynamic provider registration or auth changes can also make a previous result stale.

The current always-on helper collapses all registry failures to an empty array ([`src/agent.ts`](https://github.com/Whamp/pi-dynamic-workflows/blob/f8b6f5c34e9476e014d2906a257344e410a00364/src/agent.ts#L226-L243)); the discovery protocol must preserve the distinction between `empty`, `partial`, and `error`.

## Why this preserves prompt caching

Pi's tool definition separates the LLM-visible `description` and parameter schema from optional system-prompt `promptSnippet` and `promptGuidelines` ([Pi `ToolDefinition`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/extensions/types.ts#L434-L472)). Omitting the companion tool's prompt metadata keeps it out of Pi's `Available tools` prose and flat guideline bullets while leaving it callable through the stable provider tool list.

Pi rebuilds its base system prompt whenever the active tool set changes ([`setActiveToolsByName()`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/agent-session.ts#L882-L903)); that rebuild pulls each active tool's snippets and guidelines into the prompt ([`_rebuildSystemPrompt()`](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/agent-session.ts#L983-L1016)). Dynamically registering a tool also refreshes the registry, activates new extension tools, and rebuilds the prompt ([Pi source](https://github.com/earendil-works/pi/blob/2b3fda9921b5590f285165287bd442a25817f17b/packages/coding-agent/src/core/agent-session.ts#L2397-L2487)). Therefore delayed registration or activation is not cache-safe.

Registering both static definitions before the first turn avoids that churn. A discovery result arrives later as an ordinary tool-result message. OpenAI's prompt-caching contract requires exact prefix matches and says tool lists must remain identical, while variable content should be appended after static content ([OpenAI Prompt Caching](https://developers.openai.com/api/docs/guides/prompt-caching)). This design keeps the system prompt and tool list identical and appends only the requested catalog result.

Catalog changes on disk or in the model registry consequently change only a future tool result. They never mutate a previous system prompt, tool definition, or active-tool prefix.

## Interfaces considered

| Interface | Cache-safe across turns? | Cost / failure mode | Verdict |
| --- | --- | --- | --- |
| Inject catalogs into `promptGuidelines` through the current lazy getters | No | Rebuilds the system prompt and keeps both catalogs always on; current implementation does exactly this for models and agent types ([`src/workflow-tool.ts`](https://github.com/Whamp/pi-dynamic-workflows/blob/f8b6f5c34e9476e014d2906a257344e410a00364/src/workflow-tool.ts#L20-L65)). | Reject |
| Detect workflow intent and append a message in `before_agent_start` | Only for recognized user triggers | Misses autonomous tool selection and explicit calls produced from indirect instructions; cannot provide data after the parent's decision but before script authorship in the same model turn. | Reject |
| Register or activate a discovery tool only after workflow intent | No | Changes the provider tool list and causes Pi to rebuild the system prompt after the conversation prefix already exists. | Reject |
| Add `run`/`discover` modes to the existing `workflow` tool | Yes | Makes the currently required `script` conditional, weakens the schema proven to teach workflow authoring, and either needs provider-incompatible unions or manual validation of a broad optional object. The present schema has one unambiguous required `script` ([`src/workflow-tool.ts`](https://github.com/Whamp/pi-dynamic-workflows/blob/f8b6f5c34e9476e014d2906a257344e410a00364/src/workflow-tool.ts#L68-L126)). | Viable but inferior |
| Use a sentinel/failed workflow call to return discovery data | Technically | The parent has already authored the script; it spends an avoidable failed tool round and cannot discover valid `agentType` names beforehand. | Reject |
| Always-active static `workflow_discover` companion | Yes | Adds one small stable tool definition to every provider request, but no catalog and no extra system-prompt prose. Preserves `workflow`'s strict run schema. | **Recommend** |

## Acceptance criteria for the eventual implementation

1. Before the first provider request, both `workflow` and `workflow_discover` are registered and active; their names, descriptions, schemas, snippets, and guidelines remain byte-stable for the session.
2. No concrete model, tier assignment, `agentType` name, or `agentType` description appears in the system prompt or either tool definition.
3. A normal workflow can be authored using only `small`, `medium`, and `big` without discovery.
4. `workflow_discover({catalog: "agentTypes"})` returns the merged, sorted names/descriptions without role-prompt or policy contents.
5. `workflow_discover({catalog: "models"})` returns the sorted canonical names from the live host registry only after the parent deliberately calls it.
6. Exact-name lookup returns one item or `not_found`; it never expands an unknown name into an unsolicited full catalog.
7. Tests separately cover successful, empty, not-found, partial, and error results for both catalogs.
8. Tests mutate agent-definition files and the shared model registry between calls and confirm that only tool results change; captured system prompt text and serialized tool definitions remain identical.
9. A stale/unknown `agentType` fails before subagent launch rather than silently using defaults.
10. The existing schema-only workflow-authoring experiment still passes, proving that the companion tool did not weaken the required `workflow.script` contract.

## Source-evidence ledger

### CodeGraph evidence

The rebuilt index identified `src/workflow-tool.ts` as the tool/prompt seam, `src/agent-registry.ts` as the `agentType` discovery seam, `src/agent.ts` as the model-list projection, `src/workflow-manager.ts` as the live registry holder, and `extensions/workflow.ts` as the registration/activation boundary. CodeGraph narrowed these reads; it does not prove runtime or cache behavior.

### Source-read interpretation

The project source establishes that both catalogs are currently flattened into always-on `promptGuidelines`, both current helpers collapse discovery failures, the workflow schema has an unambiguous required script, and the extension already has a live host model-registry seam. Pi's pinned source establishes that changing active tools rebuilds the system prompt, dynamic tool registration refreshes the active registry, prompt snippets/guidelines are system-prompt metadata, and model-registry load errors are separately observable from available entries.

### Proof commands and primary sources

```bash
codegraph build .
codegraph stats -T
codegraph map -T
codegraph structure src --depth 3 -T --limit 120
codegraph brief src/workflow-tool.ts -T
codegraph deps src/workflow-tool.ts -T --json
codegraph brief src/agent-registry.ts -T
codegraph deps src/agent-registry.ts -T --json
codegraph brief src/model-tier-config.ts -T
```

Pi citations are pinned to installed `@earendil-works/pi-coding-agent` 0.80.6, tag `v0.80.6`, commit [`2b3fda9921b5590f285165287bd442a25817f17b`](https://github.com/earendil-works/pi/commit/2b3fda9921b5590f285165287bd442a25817f17b). OpenAI's official prompt-caching guide supplies the provider-level exact-prefix and identical-tools constraint.

This ticket changes only the research artifact; it implements no production behavior.
