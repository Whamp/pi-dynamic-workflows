# Lifecycle controls

Read this for phase budgets, nested saved workflows, retries, checkpoints, or resume-sensitive debugging.

## Budgets and phases

`phase(title, { budget })` creates a soft sub-budget measured from shared spending when declared. `budget.total`, `budget.spent()`, and `budget.remaining()` expose run-wide accounting. Both phase and run limits are pre-call gates: concurrent in-flight agents can overshoot before later calls are blocked. Catch a phase-budget failure only when later phases can still return a truthful partial result.

<!-- REGISTRY-OWNED PROTOTYPE EXCERPT: controls@2.13.1 BEGIN -->
- Run controls: `maxAgents`, `concurrency`, `agentRetries`, `agentTimeoutMs`, and `tokenBudget`.
- Per-agent overrides: `retries` and `timeoutMs`; `timeoutMs: null` disables the timeout.
- Error codes relevant to authors: `AGENT_TIMEOUT`, `WORKFLOW_ABORTED`, `AGENT_LIMIT_EXCEEDED`, `TOKEN_BUDGET_EXHAUSTED`, `PROVIDER_USAGE_LIMIT`, `SCRIPT_VALIDATION_ERROR`, `SCHEMA_NONCOMPLIANCE`, `AGENT_EMPTY_OUTPUT`, and `AGENT_EXECUTION_ERROR`.
<!-- REGISTRY-OWNED PROTOTYPE EXCERPT: controls@2.13.1 END -->

## Saved nested workflows

Use `workflow(savedName, childArgs)` only with a saved name supplied by current context. A child shares the parent's limits and returns only `child.result`. Keep nesting sequential and one level deep. In 2.13.1, concurrent sibling nesting is unsafe and persisted parent/child journal indices can collide; template validation exercises only an in-memory sequential child fixture.

Unknown saved-name fallback to raw script is compatibility behavior, not a preferred authoring pattern.

## Retry and graceful failure

Per-agent `retries` rerun recoverable execution failures. The `retry` helper instead repeats a thunk until its returned value satisfies a predicate; use it to retry semantic incompleteness or `null`, with a unique label per attempt. Bound every retry and return the attempt ledger when exhausted.

Use `gate` when validator feedback should shape the next attempt. Keep the validator result structured and preserve the final rejected value for diagnosis.

## Checkpoints and resume

`checkpoint` is reliably wired only as a foreground binary confirmation or a headless default/abort in this version. Input/select/timeout options are not complete end-to-end authoring promises.

Resume replays the longest unchanged lexical prefix of agent calls. Labels are for observability, not resume identity. Keep call order and deterministic inputs stable. Original limits and prior spending are not restored on resume in 2.13.1; treat resumed accounting as a known limitation rather than a guarantee.
