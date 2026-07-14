# Claude Code dynamic-workflow provenance and authoring patterns

Research for [Research Claude Code workflow patterns and public saved examples](https://github.com/Whamp/pi-dynamic-workflows/issues/16) in the [Specify minimal cache-safe workflow prompting](https://github.com/Whamp/pi-dynamic-workflows/issues/15) wayfinding effort.

## Decision

Keep the planned `detailed`-default / `minimal`-opt-in profiles, but do not treat the current 24 guidelines as the ideal detailed profile.

Both profiles should share one concise tool description, one concise Available-tools entry, and the same tool schema. The minimal profile should keep only the explicit opt-in boundary plus the three inner-script contracts that the outer schema cannot express: explicit return, `null` handling, and the `agent()` options for labels, semantic tiers, and JSON Schema. The detailed profile should add authoring craft: topology choice, failure accounting, task granularity, conditional synthesis, bounded loops, and scale controls.

Move syntax and parameter facts into the schema or runtime. Move live model and `agentType` catalogs to deliberate discovery. Enforce parser rules, caps, structured output, undefined final results, and `agentType` capability boundaries at runtime. Guidance should not carry rules the runtime can prove.

Three current absolutes need correction:

1. Do not require a synthesis agent for every fan-out. A structured fan-out result can be the deliverable.
2. Do not forbid one-file agents. One file is a good work unit when the task on that file is substantive and independent.
3. Do not prescribe finder → verify → merge as the universal default. Use verification when false positives matter; use `pipeline()` when items can advance independently; use a barrier only when the next step needs the complete prior set.

## Evidence labels

This note keeps four evidence classes separate:

- **Official** — current Claude Code documentation and Anthropic's dated launch post.
- **Observed** — source code, saved scripts, serialized run artifacts, and this extension's implementation.
- **Source-author recommendation** — advice written by workflow-tool or third-party runtime authors. It may be useful without proving reliability.
- **Inference** — recommendations for this Pi extension derived from the evidence above.

A script checked into a popular repository proves that the script was shared, not that it ran successfully. A single completed run proves that one run completed, not a success rate. No conclusion below uses stars, forks, search rank, or one example as a reliability proxy.

## Provenance and canonical terminology

### The feature came from Claude Code; the Pi port came from Michael Livshits

**Official.** Anthropic announced **dynamic workflows in Claude Code** on May 28, 2026. The launch post describes scripts that fan work out to many parallel subagents, check results, preserve progress, and return one coordinated answer. It names `ultracode` as an effort setting that lets Claude decide when to use a workflow; it does not use `ultracode` as the name of the script format. See [Introducing dynamic workflows in Claude Code](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code) and the current [dynamic-workflow documentation](https://code.claude.com/docs/en/workflows).

**Observed.** Michael Livshits created the first Pi prototype on the same date. The root commit is [Initial Pi dynamic workflows prototype](https://github.com/Michaelliv/pi-dynamic-workflows/commit/68aa52c020ef3551532f79928ecdd370f3973a35). Its tool schema and eight initial guidelines already contain the `meta` header, injected globals, thunk rule, labels, and JSON Schema contract ([source](https://github.com/Michaelliv/pi-dynamic-workflows/blob/68aa52c020ef3551532f79928ecdd370f3973a35/src/workflow-tool.ts#L14-L54)). Quintin Shaw later expanded and released that code; this repository is Will's fork of Quintin's repository.

The evidence does not support attributing the idea to Matt Pocock or calling it a Matt Pocock workflow format. The defensible lineage is:

1. Claude Code dynamic workflows — the reference feature and terminology.
2. Michael Livshits's `pi-dynamic-workflows` prototype — the first commit in this repository's history.
3. Quintin Shaw's production expansion.
4. Will's fork and current prompt/profile work.

### Use these terms

**Official.** The current docs define a **dynamic workflow** as a JavaScript script that orchestrates subagents at scale. The script holds the plan, branching, loops, and intermediate results; the runtime executes it. Claude Code calls each worker a **subagent** and the executable file a **workflow script**. The SDK exposes the **Workflow tool** with `script`, `name`, `scriptPath`, `args`, and `resumeFromRunId` inputs ([SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript#workflow)).

Use:

- **dynamic workflow** — the feature or one orchestration run;
- **workflow script** — the JavaScript artifact;
- **subagent** or **agent call** — one worker invocation;
- **pipeline** — per-item stage flow without a cross-item barrier;
- **parallel barrier** — a fan-out that waits for every thunk;
- **ultracode** — Claude Code's trigger/effort mode, not the language name.

`Agent Script` is a useful third-party portability term coined by ultracodex, not Claude Code's canonical name. “Code mode for subagents” is this project's explanatory phrase, not upstream terminology.

Describe the orchestration as **script-controlled** or **repeatable**. Do not call real subagent output deterministic. The script can make control flow reproducible while model output remains stochastic.

## What the reference sources show

### Public docs: move the plan into code

**Official.** Claude Code distinguishes workflows from subagents, skills, and agent teams by who owns the plan. A workflow moves the plan into a runtime-executed script and keeps intermediate values in script variables. The public docs recommend workflows when one conversation cannot coordinate the work or when the orchestration itself should be readable and reusable.

The docs repeatedly use these shapes:

- broad audit or migration over many independent units;
- research with source cross-checking;
- several independent plans followed by judgment;
- repeated fixing until a check passes or progress stops;
- one saved, parameterized orchestration reused as a command.

They also recommend starting on a small slice, watching token use, and keeping human sign-off between workflows because a workflow cannot ask for arbitrary mid-run input.

### Captured tool description: a large authoring manual

**Observed, third-party capture.** TokenRollAI published a May 29 capture of the Workflow tool description, tool schema, generated script, subagent prompts, structured-output handoffs, journal, final state, and result. The capture is not an official source release, but its artifacts are internally consistent and immutable at commit [`711518b`](https://github.com/TokenRollAI/claude-code-workflow-research/tree/711518bb6922e7085fa2c460b5eb0fdd213ad6ac/workflow-artifacts).

The captured prompt:

- requires explicit user opt-in ([lines 101–108](https://github.com/TokenRollAI/claude-code-workflow-research/blob/711518bb6922e7085fa2c460b5eb0fdd213ad6ac/workflow-artifacts/workflow-tool-prompt.md#L101-L108));
- recommends inline scouting before a well-scoped fan-out ([lines 110–124](https://github.com/TokenRollAI/claude-code-workflow-research/blob/711518bb6922e7085fa2c460b5eb0fdd213ad6ac/workflow-artifacts/workflow-tool-prompt.md#L110-L124));
- defines `agent()`, `pipeline()`, and `parallel()` failure and barrier semantics ([lines 142–154](https://github.com/TokenRollAI/claude-code-workflow-research/blob/711518bb6922e7085fa2c460b5eb0fdd213ad6ac/workflow-artifacts/workflow-tool-prompt.md#L142-L154));
- defaults multi-stage work to `pipeline()` and gives a deciding test for barriers ([lines 157–175](https://github.com/TokenRollAI/claude-code-workflow-research/blob/711518bb6922e7085fa2c460b5eb0fdd213ad6ac/workflow-artifacts/workflow-tool-prompt.md#L157-L175));
- presents adversarial verification, judge panels, loop-until-dry, completeness critics, and no-silent-cap rules as a menu, not mandatory stages ([lines 235–249](https://github.com/TokenRollAI/claude-code-workflow-research/blob/711518bb6922e7085fa2c460b5eb0fdd213ad6ac/workflow-artifacts/workflow-tool-prompt.md#L235-L249)).

This is evidence that the source tool once carried detailed authoring craft directly in its tool description. It does not show that every rule belongs in Pi's always-on system prompt.

### One serialized completed run

**Observed.** The same capture contains a real `tool_use` JSON object with the complete inline script, the persisted `.js` file, structured-output schemas and handoffs, a journal, final state, and result-only JSON. The workflow uses this topology:

1. five independent concept agents;
2. three judges per concept in a `parallel()` barrier;
3. plain JavaScript to discard null votes, average scores, and rank concepts;
4. one final agent to synthesize the winner with selected runner-up ideas.

The script is visible at [lines 69–124](https://github.com/TokenRollAI/claude-code-workflow-research/blob/711518bb6922e7085fa2c460b5eb0fdd213ad6ac/workflow-artifacts/boardgame-tournament-wf_1b6a0439-04e.js#L69-L124). The final state records `status: "completed"`, 21 agent calls, 232,900 tokens, and a structured result ([state](https://github.com/TokenRollAI/claude-code-workflow-research/blob/711518bb6922e7085fa2c460b5eb0fdd213ad6ac/workflow-artifacts/workflow-final-state.json#L140-L148), [token total](https://github.com/TokenRollAI/claude-code-workflow-research/blob/711518bb6922e7085fa2c460b5eb0fdd213ad6ac/workflow-artifacts/workflow-final-state.json#L619-L625)).

This proves one useful pattern completed once. It does not measure the pattern's reliability.

## Public saved-script corpus

### Method and limits

**Observed.** On July 14, 2026, this research ran:

```bash
gh search code '"export const meta" path:.claude/workflows' \
  --limit 100 --json repository,path,url,sha
```

After filtering to `.js` and `.mjs`, the corpus contained 95 scripts from 92 repositories. GitHub returned only the first 100 relevance-ranked matches. The query favors scripts with the canonical `meta` spelling, excludes private and unindexed repositories, and can change as GitHub's index changes. Counts below describe this corpus only.

A static text pass found:

| Feature | Scripts | Corpus share |
| --- | ---: | ---: |
| Explicit top-level `return` | 95/95 | 100.0% |
| `label` on an agent | 94/95 | 98.9% |
| `phase` call | 86/95 | 90.5% |
| JSON Schema | 86/95 | 90.5% |
| An explicit null/failure guard | 79/95 | 83.2% |
| `.filter(Boolean)` | 69/95 | 72.6% |
| `parallel()` | 68/95 | 71.6% |
| `pipeline()` | 40/95 | 42.1% |
| `args` | 64/95 | 67.4% |
| Synthesis/merge language | 57/95 | 60.0% |
| Any `model:` field, including display metadata | 24/95 | 25.3% |
| `agentType` | 30/95 | 31.6% |
| `budget` | 13/95 | 13.7% |
| Worktree isolation | 8/95 | 8.4% |
| Nested `workflow()` | 16/95 | 16.8% |

The median script had 210 lines and four static `agent()` call sites; the interquartile ranges were 135–288 lines and three–six call sites. Ten scripts exceeded 500 lines and four exceeded 1,000. These sizes show that saved workflows often become substantial programs. They do not prove that longer scripts are better.

### Recurring structures

**Observed.** The strongest repeated structures are:

1. **A concrete work unit.** Scripts fan out over `(directory × dimension)`, one document group, one finding, one module, one test, or one issue. TinyUSB's driver review builds `(dir × dimension)` scan units, then verifies each finding independently ([lines 53–88](https://github.com/hathach/tinyusb/blob/ac595bc5cf64949332347a2b9d901de507a744a6/.claude/workflows/driver-review.js#L53-L88)).
2. **Structured handoffs.** Agents return small schemas with ids, file paths, verdicts, counts, and evidence. Plain JavaScript performs deterministic joins, filters, and ranking.
3. **Verification at the cost boundary.** Expensive or actionable findings get independent refutation. Cheap discovery often does not.
4. **Conditional final synthesis.** Narrative reports use a final agent; exact row sets often return directly.
5. **Parameterization.** Saved scripts read `args` for scope, paths, caps, or targets rather than baking one invocation into the script.
6. **Thin composition.** A deprecated 386-line duplicate in `boshu2/agentops` became a 15-line alias that delegates to the canonical saved workflow ([source](https://github.com/boshu2/agentops/blob/0007e49cccb6ccfa39b5aee41a6284fd8127914b/.claude/workflows/bead-crank.js#L1-L15)).

### Failure handling

**Observed.** Most scripts do more than filter nulls, but the quality varies.

Good examples preserve missing-work information:

- TinyUSB counts dead scanners and verifiers, logs which units lost coverage, and calls dead-verifier findings unverified rather than clean ([lines 65–88](https://github.com/hathach/tinyusb/blob/ac595bc5cf64949332347a2b9d901de507a744a6/.claude/workflows/driver-review.js#L65-L88)).
- Atmosphere converts null audit and verifier results into explicit failure sentinels. Any failed inventory, group, or verifier produces `incomplete: true` and “Do NOT treat as clean” instead of an empty success ([lines 130–184](https://github.com/Atmosphere/atmosphere/blob/b9f0388f11e42e9a0ea2fc0def449b558c9ed3e9/.claude/workflows/doc-drift-audit.js#L130-L184)).

The recurring lesson is stronger than “call `.filter(Boolean)`”:

> A failed agent is missing coverage. Preserve its identity, distinguish it from a negative finding, and make partial completion visible in the return value.

Bounded retries appear mainly for infrastructure death, not for a substantive rejection. Loops use round caps, dry-round counters, budget floors, or explicit uncovered counts. Scripts that retry every negative verdict risk converting judgment into persistence.

### Synthesis strategies

**Observed.** Saved scripts use four distinct endings:

- **Direct structured return** when the result is already the required row set.
- **Plain-JavaScript reduction** for deduplication, counts, thresholds, averaging, and ranking.
- **Final narrative synthesis** when a human-facing report must reconcile many results.
- **Judge-and-graft** when several candidate designs compete and the final answer should combine the winner with selected runner-up strengths.

A mandatory final synthesis agent is therefore wrong. It can corrupt exact paths, counts, or record identity. The script should synthesize only when the deliverable requires cross-item judgment or prose.

## The Bun port: scale through a sequence of specialized workflows

**Official.** Anthropic's launch post reports that Jarred Sumner used dynamic workflows to port Bun from Zig to Rust: roughly 750,000 lines, 99.8% of the existing tests passing, and eleven days from first commit to merge. It describes separate workflows for lifetime mapping, file ports with two reviewers, build/test fix loops, and later copy-removal work.

**Observed.** The referenced Bun commit contains 53 saved workflow scripts under [`.claude/workflows/`](https://github.com/oven-sh/bun/tree/23427dbc12fdcff30c23a96a3d6a66d62fdc091d/.claude/workflows). The files support the launch post's “several workflows in sequence” account better than a single giant orchestrator:

- `phase-a-port` pipelines one source file through implement → verify → conditional fix and returns failed-file identity ([lines 148–224](https://github.com/oven-sh/bun/blob/23427dbc12fdcff30c23a96a3d6a66d62fdc091d/.claude/workflows/phase-a-port.workflow.js#L148-L224)).
- `phase-b2-cycle` fans out per crate, runs two independent module verifiers plus tie-breakers for disputes, then fixes by crate ([lines 57–166](https://github.com/oven-sh/bun/blob/23427dbc12fdcff30c23a96a3d6a66d62fdc091d/.claude/workflows/phase-b2-cycle.workflow.js#L57-L166)).
- `phase-g-mega-swarm` uses a ten-round cap, a per-round file cap, cumulative passing/failing files, and an explicit `uncovered` count before declaring done ([lines 109–250](https://github.com/oven-sh/bun/blob/23427dbc12fdcff30c23a96a3d6a66d62fdc091d/.claude/workflows/phase-g-mega-swarm.workflow.js#L109-L250)).

The corpus also shows why runtime enforcement matters. `lifetime-classify` samples confident findings with `Math.random()` ([lines 113–115](https://github.com/oven-sh/bun/blob/23427dbc12fdcff30c23a96a3d6a66d62fdc091d/.claude/workflows/lifetime-classify.workflow.js#L113-L115)), which current Workflow descriptions ban because it breaks reproducible resume. A saved artifact can outlive the runtime contract under which it was written.

## Source-author guidance and what it contributes

### The useful split is contract versus craft

**Source-author recommendation.** ultracodex's authoring skill separates **Part 1 — Core contract** from **Part 2 — Craft reference** ([source](https://github.com/YuanpingSong/ultracodex/blob/5519ed1da818b4b43e23b7547063fac4759f6809/skills/agent-script-authoring/SKILL.md#L11-L13)). That separation maps directly to Pi's minimal and detailed profiles.

The skill adds several rules missing or misstated in Pi's current prompt:

- identify failed items before filtering and join by id, not array position ([lines 88–95](https://github.com/YuanpingSong/ultracodex/blob/5519ed1da818b4b43e23b7547063fac4759f6809/skills/agent-script-authoring/SKILL.md#L88-L95));
- default multi-stage flow to `pipeline()`, but add no stage the deliverable does not need ([lines 116–120](https://github.com/YuanpingSong/ultracodex/blob/5519ed1da818b4b43e23b7547063fac4759f6809/skills/agent-script-authoring/SKILL.md#L116-L120));
- give the terminal producer the strictest schema and make worker prompts self-contained ([lines 145–156](https://github.com/YuanpingSong/ultracodex/blob/5519ed1da818b4b43e23b7547063fac4759f6809/skills/agent-script-authoring/SKILL.md#L145-L156));
- log every bound or dropped slice and pilot expensive transforms before scaling ([lines 159–164](https://github.com/YuanpingSong/ultracodex/blob/5519ed1da818b4b43e23b7547063fac4759f6809/skills/agent-script-authoring/SKILL.md#L159-L164));
- let one judge see all candidates when it must rank or merge them ([lines 168–183](https://github.com/YuanpingSong/ultracodex/blob/5519ed1da818b4b43e23b7547063fac4759f6809/skills/agent-script-authoring/SKILL.md#L168-L183)).

The project's ADR says its private census covered 58 scripts and that budget rails, nesting, convergence loops, isolation, effort, and `agentType` were sparse or absent. Because the census source paths are private, treat the taxonomy and counts as the author's report, not an independently reproducible observation ([ADR](https://github.com/YuanpingSong/ultracodex/blob/5519ed1da818b4b43e23b7547063fac4759f6809/docs/internal/adr/0003-agent-script-authoring-skill.md#L28-L49)).

The same ADR reports multi-model authoring rounds and a useful editorial result: “rules need deciding tests, not absolutes,” followed by a split between a core contract and a craft reference ([lines 105–151](https://github.com/YuanpingSong/ultracodex/blob/5519ed1da818b4b43e23b7547063fac4759f6809/docs/internal/adr/0003-agent-script-authoring-skill.md#L105-L151)). Those are source-author results. The public repository does not contain every raw private-session artifact needed to reproduce all claims.

### Guidance drifts with the runtime

**Observed.** A pre-release workflow-creator skill recorded that structured `args` arrived as JSON text and recommended parsing it ([lines 173–198](https://github.com/ray-amjad/claude-code-workflow-creator/blob/c4e85d883d7c7564f93da34e8811fdde53a5040e/SKILL.md#L173-L198)). Current official docs say `args` arrives as the actual JSON value. The earlier probe may have been correct for that build; it is stale guidance now.

This is another reason to put stable mechanics in schema/runtime and keep detailed prose versioned, testable, and optional.

## This extension's current seams

### Prompt and schema

**Observed.** The open post-model-catalogue PR head keeps one `promptSnippet`, 24 guideline entries, and an eight-field schema in one `createWorkflowTool()` definition ([source](https://github.com/QuintinShaw/pi-dynamic-workflows/blob/f7810869f08d25a5018da6053cf3bd8e7b4b5a28/src/workflow-tool.ts#L56-L181)). That candidate removes the model catalogue but keeps the detailed model-routing paragraph and dynamic `agentType` catalogue.

CodeGraph identifies `src/workflow-tool.ts` as the prompt/schema seam and `extensions/workflow.ts` as the production registration boundary. Its object properties are a CodeGraph blind spot, so the inventory above comes from source reading.

### Runtime already enforces much of the prose

**Observed.** The runtime:

- rejects nondeterministic calls and requires a literal first-statement `meta` export ([source](https://github.com/Whamp/pi-dynamic-workflows/blob/7fa8a5944c5ad4182aee0c43d757350c61e3a5da/src/workflow.ts#L942-L1064));
- validates `parallel()` thunks and `pipeline()` stage functions, preserves result order, and converts recoverable branch failures to `null` ([source](https://github.com/Whamp/pi-dynamic-workflows/blob/7fa8a5944c5ad4182aee0c43d757350c61e3a5da/src/workflow.ts#L600-L652));
- enforces agent caps, budgets, retries, structured-output repair, worktree cleanup, and model precedence ([source](https://github.com/Whamp/pi-dynamic-workflows/blob/7fa8a5944c5ad4182aee0c43d757350c61e3a5da/src/workflow.ts#L346-L598));
- currently logs an unknown `agentType` and silently falls back to default tools/model ([lines 390–396](https://github.com/Whamp/pi-dynamic-workflows/blob/7fa8a5944c5ad4182aee0c43d757350c61e3a5da/src/workflow.ts#L390-L396));
- currently accepts an `undefined` top-level result as a completed run ([lines 915–938](https://github.com/Whamp/pi-dynamic-workflows/blob/7fa8a5944c5ad4182aee0c43d757350c61e3a5da/src/workflow.ts#L915-L938)).

The last two behaviors are better fixed than explained repeatedly.

## Disposition of the 24 post-model-catalogue guidelines

The table refers to the ordered entries at the [post-catalogue PR head](https://github.com/QuintinShaw/pi-dynamic-workflows/blob/f7810869f08d25a5018da6053cf3bd8e7b4b5a28/src/workflow-tool.ts#L156-L182).

| # | Current subject | Recommended home | Change |
| ---: | --- | --- | --- |
| 1 | Explicit user opt-in | **Always-on** | Keep. This is a cost/permission boundary, not syntax. |
| 2 | Raw JavaScript, no fences | **Tool schema** | Remove from prompt; normalize or reject at runtime. |
| 3 | Exact `meta` first statement | **Tool schema + runtime** | Remove duplicate prompt bullet. |
| 4 | Plain JS; banned APIs | **Runtime + schema summary** | Runtime is authoritative; errors should name the violation. |
| 5 | Available globals; at least one agent | **Tool schema + runtime** | Keep in `script.description`; enforce the agent minimum. |
| 6 | Quality-helper catalog | **Detailed-only / on demand** | Present as optional patterns, not default stages. |
| 7 | Exact phase switching | **Detailed-only + runtime diagnostic** | Warn on declared-but-unused and runtime-only phases. |
| 8 | Do not set token/time caps unless asked | **Parameter schema** | Defaults and policy belong on the fields. |
| 9 | Budgets, retry, gate, degradation | **Detailed-only / on demand** | Keep advanced recipes out of minimal guidance. |
| 10 | Use only for decomposable work | **Always-on description + detailed examples** | Keep the selection boundary concise; do not enumerate every example always-on. |
| 11 | `parallel()` takes thunks | **Tool schema + runtime** | Existing runtime TypeError is the strongest teacher. |
| 12 | `pipeline()` semantics | **Detailed-only** | Add the barrier deciding test; “stages are separate” is not enough. |
| 13 | Unique short labels | **Always-on, compressed** | Keep `label` in the inner `agent()` contract; avoid arbitrary 2–5 word law. |
| 14 | Low concurrency and retries for unstable transport | **Detailed-only + parameter schema** | Conditional operational advice. Retry infrastructure failures only. |
| 15 | Recoverable branches return `null` | **Always-on** | Keep until the inner contract is structurally exposed. Add “missing coverage, not negative evidence.” |
| 16 | Final synthesis agent; compact `ok`/`verdict` return | **Split** | Keep explicit JSON-serializable return always-on. Make synthesis conditional; do not mandate field names. |
| 17 | Finder → verify → merge default | **Detailed-only pattern** | Verification is conditional on false-positive cost. `pipeline()` is the topology default, not this quality stack. |
| 18 | Substantive tasks; avoid one-file agents | **Detailed-only, rewrite** | Use one agent per natural independent work unit. One file can be exactly right. |
| 19 | Plain JSON Schema | **Always-on, compressed + runtime** | Keep `schema` in the inner contract; put strict-schema craft in detailed docs. |
| 20 | Tier routing and exact models | **Always-on core + detailed mapping + discovery** | Name `small`/`medium`/`big`; use exact `model` only when the user names it. Avoid “TAG EVERY” as an absolute. |
| 21 | `agentType` and live catalogue | **Detailed profile + on-demand discovery + runtime** | Snapshot only in `detailed`; omit from `minimal`; preflight a declared manifest and fail closed. |
| 22 | Parent context is absent in subagents | **Detailed-only, merge with #18** | Teach self-contained prompts once. |
| 23 | Background default and inline override | **Parameter schema** | Remove duplicate prompt bullet. |
| 24 | Saved-workflow nesting and caps | **On demand / detailed-only + runtime** | Relevant only when composing saved workflows. |

The `promptSnippet` should also stop saying “deterministic JavaScript workflow.” Use the already-proposed concrete description: `Run JavaScript that delegates tasks to multiple subagents in parallel or in pipelines`.

## Profile recommendation

### Shared surface

Use the same tool name, provider-visible description, schema, and concise `promptSnippet` for both profiles. Read `guidanceProfile` once per session so the prompt remains cache-stable.

### Minimal profile

Keep three bullets:

```text
Use workflow only when the user explicitly requests multiple subagents, fan-out, or multi-agent orchestration.

In workflow scripts, explicitly `return` a JSON-serializable result. Recoverable `agent()`, `parallel()`, and `pipeline()` failures produce `null`; treat them as missing work and never claim complete coverage from a partial run.

In workflow scripts, give each `agent()` a short `label`; route normal work with `tier: 'small'`, `'medium'`, or `'big'`; use `model` only when the user names an exact model; pass plain JSON Schema with `schema` for structured output.
```

This is slightly stronger than the earlier 610-byte draft because it captures the public examples' most important failure lesson: null is missing coverage, not a clean result. Measure the final bytes after wording and Pi rendering are fixed.

### Detailed profile

Add six craft groups, preferably one concise bullet each rather than the current flat 24:

1. **Shape:** identify the natural work unit; use fan-out, pipeline, barrier, or a bounded loop deliberately.
2. **Barrier test:** default staged work to `pipeline()`; use `parallel()` between stages only for whole-set dedup, merge, count-based exit, or cross-item comparison.
3. **Failure accounting:** preserve failed-item ids before filtering; distinguish incomplete from clean; retry only recoverable infrastructure failures and cap retries.
4. **Data and synthesis:** use schemas for programmatic handoffs and plain JS for joins/dedup/counts; add a final agent only when prose or cross-candidate judgment is required.
5. **Task prompts:** one substantive, self-contained prompt per natural work unit, with paths, constraints, evidence requirements, and output contract.
6. **Scale:** bound loops, expose dropped/sampled work, pilot expensive transformations, and use worktrees only when concurrent edits would conflict and a merge path exists.

Keep brief optional-helper names and the accepted session-snapshotted `agentType` catalogue in `detailed`. Put full helper signatures, budget recipes, nested-workflow rules, worktree details, and exact catalogs behind deliberate discovery or documentation.

## Runtime recommendations

**Inference.** Runtime enforcement gives both profiles the same safety floor.

1. **Fail closed on unknown `agentType`.** Add `meta.agentTypes` as a required pure-literal manifest whenever a script uses `agentType`. Preflight every declared type before the body starts; statically require literal uses to appear in the manifest; reject a runtime-selected value outside the manifest before reserving a slot or launching. This prevents silent capability widening.
2. **Reject undefined final results.** If a workflow with agent calls completes with `result === undefined`, fail with `workflow returned no value; explicitly return the final result`. This directly closes the omission observed in the local schema-only experiment.
3. **Expose partial completion structurally.** Track failed and skipped agent counts in the run result and use a status such as `completed_with_errors`. A script can still choose its domain result, but the delivery layer must not visually present a partial run as fully clean.
4. **Diagnose phase mismatches.** Report declared phases with no agents and runtime phase titles absent from `meta.phases`. Prefer a warning unless the title is statically provable.
5. **Keep existing parser and cap enforcement.** First-statement literal metadata, nondeterminism bans, thunk validation, concurrency, hard caps, budget behavior, retries, and structured-output validation already belong in runtime.
6. **Do not enforce craft as syntax.** The runtime cannot decide whether a verifier, synthesizer, worktree, or one-file unit is warranted. Teach those as deciding tests in `detailed`.

## Correction to the local schema-only experiment

The prior experiment ran one script-generation trial per model in each tested condition. It found useful counterexamples:

- two schema-only scripts failed to handle `null`;
- two omitted an explicit return;
- schema-only scripts omitted labels and tiers, and one invented a model name;
- all four targeted reruns with the full guidelines produced valid scripts for that trial.

This supports minimum contracts and proves that failures are possible. It does **not** establish failure rates, show that either profile is reliable, or prove that the full guidelines caused the reruns to improve. Any profile comparison intended to estimate reliability needs repeated trials, raw counts, and no causal claim beyond the design.

The final specification should correct “reliably conveyed” language in [What the workflow schema teaches parent models](workflow-schema-comprehension.md) and use the experiment only for counterexamples and compatibility evidence.

## Limits and confidence

- Official docs and the launch post are current primary sources but do not expose Claude Code's proprietary runtime implementation.
- The captured Workflow prompt and serialized run are third-party artifacts from one version and one run.
- The GitHub corpus is a capped, relevance-ranked search sample. Its percentages are descriptive, not prevalence estimates.
- The Bun rewrite is a large official case study and a rich artifact set, but still one project.
- ultracodex's private 58-script census and some parity runs are author-reported; not all raw source artifacts are public.
- The local schema-only experiment has one trial per model/condition.

Confidence is **high** on provenance, canonical terms, current Pi runtime behavior, and the need to separate core contract from craft. Confidence is **moderate** on the exact detailed-profile wording until repeated authoring trials compare the implemented profiles.

## Source-evidence ledger

### CodeGraph evidence

The rebuilt index identified `src/workflow-tool.ts` as the workflow prompt/schema seam, `src/workflow.ts` as the parser/runtime seam, and `extensions/workflow.ts` as the production registration boundary. It also showed `createWorkflowTool()` is consumed by production registration and the schema-only experiment. Object-property prompt metadata is a CodeGraph blind spot; source reads supplied that inventory.

### Source-read interpretation

Source reads established the post-catalogue 24-guideline inventory, runtime validation and failure semantics, unknown-`agentType` fallback, and undefined-result behavior. Official docs established the public feature model and terminology. Immutable third-party captures supplied one complete tool-call/run chain. Saved scripts supplied concrete topology and failure-accounting examples.

### Proof and research commands

```bash
codegraph build .
codegraph stats -T
codegraph map -T
codegraph brief src/workflow-tool.ts -T
codegraph deps src/workflow-tool.ts -T --json
codegraph context parseWorkflowScript -T --file src/workflow.ts
codegraph context agent -T --file src/workflow.ts

gh search code '"export const meta" path:.claude/workflows' \
  --limit 100 --json repository,path,url,sha

gh api 'repos/oven-sh/bun/contents/.claude/workflows?ref=23427dbc12fdcff30c23a96a3d6a66d62fdc091d'
```

This ticket changes only this research artifact. It does not implement profiles or runtime changes.
