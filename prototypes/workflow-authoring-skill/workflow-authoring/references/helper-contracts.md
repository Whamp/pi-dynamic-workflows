# Helper contracts

Read this when an edit or debug session touches topology, quality, or control helpers. Helpers encode common mechanics, but fixed helper prompts or return shapes may be weaker than a task-specific direct topology.

<!-- REGISTRY-OWNED PROTOTYPE EXCERPT: helper-signatures@2.13.1 BEGIN -->
- `parallel(thunks)` awaits function thunks in input order. Recoverable branch failures become `null`; nonrecoverable failures halt the run.
- `pipeline(items, ...stages)` runs items concurrently and stages sequentially as `(previousValue, originalItem, index)`. A recoverable stage failure yields `null` for that item and skips later stages.
- `workflow(savedName, childArgs?)` returns the child result, allows one nested level, and shares concurrency, agent count, token accounting, and store state.
- `verify(item, { reviewers = 2, threshold = 0.5, lens? })` returns `{ real, realCount, total, votes }` over successful votes.
- `judgePanel(attempts, { judges = 3, rubric? })` returns the highest mean-scored `{ index, attempt, score, judgments }`; input order breaks ties.
- `loopUntilDry({ round, key = JSON.stringify, consecutiveEmpty = 2, maxRounds = 50 })` returns fresh values in discovery order.
- `completenessCheck(taskArgs, results)` returns a structured `{ complete, missing? }` critic result; result context is truncated.
- `retry(thunk, { attempts = 3, until? })` passes a zero-based attempt and returns the accepted or last result. It does not catch thrown errors or delay.
- `gate(thunk, validator, { attempts = 3 })` feeds validator feedback into the next attempt and returns `{ ok, value, attempts }`.
<!-- REGISTRY-OWNED PROTOTYPE EXCERPT: helper-signatures@2.13.1 END -->

## Choosing direct topology

Prefer direct producer and skeptic calls when task identities, custom rubrics, distinct labels, or explicit failure ledgers matter. `verify` and `judgePanel` are convenient when their built-in prompts and aggregate shapes fit without translation. JavaScript-owned pairwise brackets are easier to observe than absolute score panels for tournament selection.

## Failure handling

Capture identities before filtering:

```js
const failed = results.flatMap((value, index) => (value === null ? [items[index].id] : []));
const completed = results.filter((value) => value !== null);
```

If a helper removes failed reviewers internally, report the helper's successful vote count as coverage. A successful aggregate verdict does not prove every requested reviewer ran.

## Structured output

Use a plain JSON Schema for classifiers, judges, verifiers, filters, discovery rounds, and any agent whose result controls JavaScript. Keep schemas small and require every field the script dereferences. Prose synthesis can remain text only when no later code interprets it.
