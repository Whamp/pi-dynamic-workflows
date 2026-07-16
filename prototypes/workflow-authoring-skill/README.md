# THROWAWAY PROTOTYPE — workflow-authoring skill

This prototype asks whether one model-invoked skill can route workflow-code writing, editing, reviewing, and debugging to focused references and adaptable templates without changing the compact `workflow` tool guidance.

It is intentionally outside the package's shipped `files` and `pi.skills` manifest. The terminal shell and prototype library are primary-source design evidence, not production implementation.

## Try it

```bash
npm run prototype:workflow-authoring
```

Choose an authoring task, then a template. Each action redraws the selected task, disclosed files, chosen template, version pin, registry boundary, and context-size totals.

For a non-interactive walkthrough:

```bash
npm run prototype:workflow-authoring -- --demo
```

## Validate templates

```bash
npm run prototype:workflow-authoring:validate
```

The validator compares the skill's version metadata with `package.json`, checks invocation/disclosure structure, parses every template with the extension's real `parseWorkflowScript`, safely executes each through `runWorkflow` using a schema-aware fake agent, and checks that each result is JSON-serializable. It does not test provider quality, prompt quality, live route discovery, persistence/resume, worktree behavior, or production packaging.

Biome is scoped to the terminal driver, pure state module, validator, and package manifest. Its standard JavaScript parser rejects workflow-valid top-level `return`; template syntax is therefore owned by the extension's real parser/runtime validation above.

## Architecture seam

`src/workflow-tool.ts` remains the fixed compact interface. A production change would add a generated capability-registry seam behind the references and include the finished skill through package resource discovery (`files` plus `pi.skills`). This prototype changes neither seam.
