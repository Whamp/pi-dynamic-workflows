# Workflow schema-comprehension experiment

This experiment supports [Measure what the workflow tool schema alone teaches parent models](https://github.com/Whamp/pi-dynamic-workflows/issues/11).

## Request

Every parent model received this exact request:

> Use the workflow tool to solve this small task: run two independent primality checks for 17 in parallel, tolerate one failed checker, then ask one final subagent to synthesize the surviving evidence. Return a compact JSON-serializable object with prime, evidence, and failedChecks. Run inline so your response includes the result.

## Controls

- Parent models: `openai-codex/gpt-5.6-sol:high`, `openai-codex/gpt-5.6-terra:high`, `openai-codex/gpt-5.6-luna:high`, and `zai/glm-5.2:high`.
- Pi loaded only [`extension.ts`](./extension.ts) as an extension. Skills, prompt templates, context files, sessions, and other extensions were disabled.
- Schema-only runs kept the real workflow tool definition, JSON schema, and `promptSnippet`, but replaced `promptGuidelines` with an empty array.
- The harness persisted each tool call before parsing or executing its script.
- The first logical checker returned fixed evidence. The second threw a recoverable failure. The harness honored retries against that same checker. Later calls returned deterministic synthesis data.
- Failed scripts were rerun with the current `promptGuidelines`; successful dimensions were not expanded into a separate baseline matrix.

## Artifacts

- [`session-summary.json`](./session-summary.json): compact Pi event-stream summary, including tool selection and final parent output.
- [`results/`](./results/): schema-only scripts, tool arguments, fake-subagent calls, logs, and runtime results.
- [`current-guidelines-results/`](./current-guidelines-results/): targeted current-guideline reruns.
- [`real-integration.ts`](./real-integration.ts) and [`real-integration-result.json`](./real-integration-result.json): one real workflow using `openai-codex/gpt-5.4-mini:low`.

The raw Pi JSON event streams were 100+ MB because they repeated provider and prompt state. `session-summary.json` preserves the fields used in the assessment; the generated scripts and runtime traces remain in full.
