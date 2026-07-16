# Review and debugging

## Review order

1. **Envelope:** metadata is first and literal; script uses supported deterministic JavaScript.
2. **Topology:** each agent owns a substantive natural work unit; barriers wait for all inputs.
3. **Identity:** every call label is unique and failed input identities remain visible.
4. **Data:** control-flow results use schemas; every dereferenced field is required.
5. **Routing:** each nonstandard route or `agentType` has name-and-purpose provenance from current context.
6. **Bounds:** loops, retries, contenders, reviewers, and fan-out sizes have explicit limits.
7. **Coverage:** `null` means missing; filtered values have a matching failure ledger.
8. **Return:** the explicit result is JSON-serializable and states whether coverage is complete.
9. **Version:** exact facts match the installed extension version and marked registry excerpts.

Completion criterion: every item above is either satisfied or reported with a concrete script location and consequence.

## Symptom map

| Symptom | Inspect |
|---|---|
| Parser rejects the first line | Literal `export const meta` envelope; unsupported expressions or deterministic-source guards |
| `parallel()` fails immediately | It received promises instead of function thunks |
| Unexpected `null` | Agent timeout, empty output, execution failure, exhausted retries, or recoverable branch failure; inspect its identity and run diagnostics |
| Schema failure throws instead of returning `null` | `SCHEMA_NONCOMPLIANCE` is nonrecoverable after repair attempts |
| Results silently disappear | A filter ran before failed identities were recorded |
| Synthesis misses branches | The barrier prompt omitted completed results or the failure ledger |
| Loop stops too early or never stops | Stable key, fresh-item extraction, dry-round count, and maximum rounds |
| Later phase does not run | Shared or phase token gate, agent limit, or uncaught nonrecoverable error |
| Nested workflow fails | Saved-name resolution, one-level limit, concurrent sibling call, or 2.13.1 persistence defect |
| Model route surprises | Selector priority and live name provenance; an unresolved selected route can fall to session default |
| Foreground formatting/delivery fails | Returned value contains cycles, `BigInt`, functions, or another non-JSON value |

## Supported versus observed behavior

The skill teaches the preferred authoring contract, not every accepted legacy input. Fence stripping, unknown metadata, raw-script nested fallback, VM escape globals, incomplete checkpoint modes, and nested persistence defects are compatibility or implementation observations. Flag reliance on them; defer cleanup to its own scope.
