# Pattern selection

Choose a pattern from the dependency shape, then load exactly one scaffold. Templates carry `ADAPT` markers for task-owned decisions and `CONTRACT` markers for invariants worth preserving.

| Need | Pattern | Template |
|---|---|---|
| Route heterogeneous items | Classify and act | `templates/classify-and-act.workflow.js` |
| Independent work plus whole-set merge | Fan out and synthesize | `templates/fan-out-and-synthesize.workflow.js` |
| Counter self-preferential bias | Adversarial verification | `templates/adversarial-verification.workflow.js` |
| Diverge, deduplicate, then apply a rubric | Generate and filter | `templates/generate-and-filter.workflow.js` |
| Comparative judgment beats absolute scoring | Tournament | `templates/tournament.workflow.js` |
| Work cardinality is unknown | Loop until done | `templates/loop-until-done.workflow.js` |
| Bound noisy stages separately | Phased budgets | `templates/phased-budgets.workflow.js` |
| Reuse a saved child harness | Saved nested workflow | `templates/saved-nested-workflow.workflow.js` |
| Recover from missing semantic output | Retry and graceful failure | `templates/retry-graceful-failure.workflow.js` |
| JavaScript consumes the model result | Structured output | `templates/structured-output.workflow.js` |

## Composition rules

Classify before spending expensive actors. Fan-out produces an indexed result set and failure ledger before synthesis. Producers and skeptics use separate agent contexts. Generate/filter deduplicates in JavaScript before filter calls. Tournaments hold their bracket in JavaScript and compare pairs. Unknown-cardinality loops use stable keys, consecutive dry rounds, and a maximum bound.

Combine patterns only when both dependency shapes are present. Coordination costs tokens and context; ordinary direct work remains the right choice for small tasks.
