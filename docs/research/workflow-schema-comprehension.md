# What the workflow schema teaches parent models

## Decision

The existing tool definition and JSON schema reliably teach all four tested parent models to select the workflow tool, write parseable workflow JavaScript, fan out through `parallel()`, call a synthesis subagent, and request inline execution. They do not reliably teach two runtime contracts: failed subagents resolve to `null`, and a workflow must explicitly `return` its final value.

Keep those two contracts in always-on guidance unless the schema itself can express them. Keep concise guidance for `label`, `tier`, and structured output because the schema cannot describe `agent()` options inside the script string. The experiment does not support keeping the model catalog, `agentType` catalog, quality-helper guidance, budget controls, retry advice, nesting rules, worktree advice, or other advanced authoring rules always on.

## Method

Every model received the same explicit request: run two independent primality checks for 17 in parallel, tolerate one failed checker, ask a final subagent to synthesize surviving evidence, return `{ prime, evidence, failedChecks }`, and run inline. The harness kept the real tool definition, schema, and `promptSnippet`, but removed `promptGuidelines`. It captured each generated script before execution and ran it with deterministic fake subagents. The second logical checker raised a recoverable failure. See the [experiment README](../../experiments/schema-only-workflow/README.md), [session summary](../../experiments/schema-only-workflow/session-summary.json), and complete [schema-only traces](../../experiments/schema-only-workflow/results/).

## Schema-only results

| Parent model | Selected tool | Runtime-valid script | Parallel checks + synthesis | Accounted for failed checker | Explicitly returned result |
| --- | --- | --- | --- | --- | --- |
| `openai-codex/gpt-5.6-sol:high` | Yes | Yes | Yes | No | Yes |
| `openai-codex/gpt-5.6-terra:high` | Yes | Yes | Yes | Yes | No |
| `openai-codex/gpt-5.6-luna:high` | Yes | Yes | Yes | No | Yes |
| `zai/glm-5.2:high` | Yes | Yes | Yes | Yes | No |

All four made exactly one workflow tool call, and all four scripts executed without a parse or runtime exception. [The Pi event summary](../../experiments/schema-only-workflow/session-summary.json) records those calls and outputs.

### Sol

Sol wrapped each checker in `try/catch`, then marked every resolved `agent()` value successful. The runtime converted the simulated recoverable failure to `null`; no exception reached the generated `catch`. Sol therefore passed `null` as surviving evidence and reported zero failed checks. The full script and trace are in [`sol-execution.json`](../../experiments/schema-only-workflow/results/sol-execution.json).

### Terra

Terra correctly treated falsy checker output as failure and passed one survivor plus the failed checker to synthesis. It then called `log(synthesis)` without returning `synthesis`, so the workflow completed with no result and the parent returned an empty response. See [`terra-execution.json`](../../experiments/schema-only-workflow/results/terra-execution.json).

### Luna

Luna also expected the failed checker to throw. It wrapped `await run()` in `try/catch`, marked the resolved `null` as successful evidence, and told synthesis that no checker failed. It also invented the exact model name `sonnet`, although the user named no model and that name was not supplied by the tool schema. The deterministic synthesis stub exposed a correct-looking final value in this run, but the generated synthesis prompt contained `Failed checker numbers: []`; the script itself did not carry the failure correctly. See [`luna-execution.json`](../../experiments/schema-only-workflow/results/luna-execution.json).

### GLM

GLM correctly converted `null` to one failed check and synthesized only surviving evidence. Its last statement was `result;`, not `return result`, so the workflow completed with no result and the parent returned an empty response. See [`glm-execution.json`](../../experiments/schema-only-workflow/results/glm-execution.json).

## What current guidance fixed

Each failed parent model was rerun with the current `promptGuidelines`. All four generated scripts then:

- treated failed `agent()` calls as `null`;
- supplied short `label` values;
- routed checkers with `tier: 'small'` and synthesis with `tier: 'big'` or `tier: 'medium'`;
- used JSON schemas for structured subagent output;
- explicitly returned the final value.

The targeted reruns all returned the requested result and preserved the simulated failure. Their scripts and traces are in [`current-guidelines-results/`](../../experiments/schema-only-workflow/current-guidelines-results/).

This comparison supports a small always-on contract, not the current full guideline set. The observed fixes map to four facts:

1. A recoverable `agent()`, `parallel()`, or `pipeline()` branch yields `null`; scripts must inspect it.
2. The script must explicitly `return` its final JSON-serializable value.
3. `agent(prompt, opts)` supports `label`, `tier`, and plain JSON Schema through `schema`.
4. Normal routing should use `small`, `medium`, or `big`; use an exact model only when the user names one.

The tool schema already conveyed the required raw script, metadata header, available globals, thunk shape for `parallel()`, and `background: false` behavior well enough for this task. Repeating those facts as many separate always-on bullets is not supported by this experiment.

## Real integration check

A one-agent real workflow used `openai-codex/gpt-5.4-mini:low` with structured output. It returned `prime: true` and concise evidence in 4.461 seconds. The recorded run used one agent and 15,854 tokens. See [`real-integration-result.json`](../../experiments/schema-only-workflow/real-integration-result.json).

After the successful result, an unrelated installed cache extension emitted a stale-context notification warning. The workflow result had already been written, and the warning did not affect the run.

## Limitations

- This is one explicit, small orchestration request per parent model, not a statistical benchmark.
- Deterministic fake subagents validate script structure and result flow, not model-answer quality.
- The fake synthesizer follows common prompt contracts but does not validate arbitrary generated JSON Schemas. The generated scripts and prompts, rather than fake prose quality, determine the authoring assessment.
- The experiment does not test implicit workflow selection. It tests whether an explicit workflow request can be authored correctly from the real tool schema.
