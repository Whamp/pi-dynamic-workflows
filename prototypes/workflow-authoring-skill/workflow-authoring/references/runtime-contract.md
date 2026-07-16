# Runtime contract

Read this when creating or changing executable workflow code. The compact tool guidance remains the construction floor; this file co-locates version-specific details that affect correctness.

## Script envelope

A workflow is plain JavaScript. Its first statement is a literal `export const meta = { name, description, phases? }`; the remaining body runs inside an async function. Keep metadata literal, declare only meaningful phases, call at least one agent, and explicitly return a JSON-serializable result.

The runtime rejects `Date.now()`, `Math.random()`, and no-argument `new Date()`. Imports, `require`, filesystem modules, and the real Node `process` are unavailable. Treat ordinary JavaScript collections and JSON helpers as language substrate, not every VM-realm global as a stable interface.

<!-- REGISTRY-OWNED PROTOTYPE EXCERPT: script-globals@2.13.1 BEGIN -->
Exact curated globals: `agent`, `parallel`, `pipeline`, `workflow`, `verify`, `judgePanel`, `loopUntilDry`, `completenessCheck`, `retry`, `gate`, `checkpoint`, `log`, `phase`, `args`, `cwd`, `process`, `budget`, `console`.
<!-- REGISTRY-OWNED PROTOTYPE EXCERPT: script-globals@2.13.1 END -->

## Agent calls

Give each call a stable label tied to its work identity. A recoverable failure can return `null`; record the corresponding input identity before filtering results. Structured work should use a plain JSON Schema so downstream JavaScript receives a predictable object.

<!-- REGISTRY-OWNED PROTOTYPE EXCERPT: agent-options@2.13.1 BEGIN -->
`agent(prompt, options?)` accepts exactly these script options: `label`, `phase`, `schema`, `model`, `tier`, `isolation`, `agentType`, `timeoutMs`, and `retries`.

Selector priority is explicit `model`, resolved `agentType` model, `tier`, exact phase model, top-level metadata model, implicit configured `medium`, then session default. This is selector priority, not a fallback chain: an unresolved selected value can go directly to the session default.
<!-- REGISTRY-OWNED PROTOTYPE EXCERPT: agent-options@2.13.1 END -->

Exact model and `agentType` values are live catalogue data. Use only names whose purpose is supplied by the current context; otherwise omit the selector.

## Composition shape

Use `parallel` when work units are independent and `pipeline` when each item has ordered stages. A synthesis agent forms a whole-set barrier: it starts only after all fan-out results and their failure ledger exist. Keep deterministic bookkeeping—deduplication, brackets, stable keys, stopping counters—in JavaScript; spend agents on semantic judgment.

## Return and coverage

Return an object that distinguishes findings from coverage. Recommended fields are `result` or domain output, `failed` identities, and `complete`. `null` means missing coverage, never a negative verdict. Before returning, ensure `JSON.stringify(result)` succeeds and no failure was erased by `filter(Boolean)`.
