---
name: workflow-authoring
description: Workflow code authoring for pi-dynamic-workflows. Use when writing, editing, reviewing, or debugging JavaScript passed to the workflow tool, adapting a reusable workflow pattern, or when another skill needs the workflow script contract.
compatibility: Pi with @quintinshaw/pi-dynamic-workflows 2.13.1.
metadata:
  package: "@quintinshaw/pi-dynamic-workflows"
  package-version: "2.13.1"
  prototype-status: "throwaway"
---

# Workflow Authoring

Contract target: `@quintinshaw/pi-dynamic-workflows@2.13.1`. This skill accompanies that installed extension version. If versions differ, treat its references and templates as suspect until revalidated.

The workflow tool description, parameter descriptions, prompt snippet, and prompt guidelines are the fixed compact baseline. This skill adds on-demand depth at the package-discovery seam; it does not replace that baseline.

## Author

1. Load only the branch needed:
   - Writing executable code: read [runtime contract](references/runtime-contract.md) and [pattern selection](references/patterns.md), then one template.
   - Structurally editing code: read [runtime contract](references/runtime-contract.md) and the relevant [helper contracts](references/helper-contracts.md).
   - Reviewing code: read [review and debugging](references/review-debug.md) and [runtime contract](references/runtime-contract.md).
   - Debugging a run: read [review and debugging](references/review-debug.md), [runtime contract](references/runtime-contract.md), [helper contracts](references/helper-contracts.md), and [lifecycle controls](references/lifecycle-controls.md).
2. Adapt the selected scaffold to natural work units, explicit output contracts, and stable work identities.
3. Use route or `agentType` names only when the current context or their owning live catalogue supplies both name and purpose.
4. Validate with the installed parser and a representative fixture.

Completion criterion: the script parses; calls have unique labels; failed work identities survive filtering; the return is JSON-serializable; loops and retries are bounded; and no live catalogue name was guessed.

## Template index

- [Classify and act](templates/classify-and-act.workflow.js) · [Fan out and synthesize](templates/fan-out-and-synthesize.workflow.js)
- [Adversarial verification](templates/adversarial-verification.workflow.js) · [Generate and filter](templates/generate-and-filter.workflow.js)
- [Tournament](templates/tournament.workflow.js) · [Loop until done](templates/loop-until-done.workflow.js)
- [Phased budgets](templates/phased-budgets.workflow.js) · [Saved nested workflow](templates/saved-nested-workflow.workflow.js)
- [Retry and graceful failure](templates/retry-graceful-failure.workflow.js) · [Structured output](templates/structured-output.workflow.js)

Templates are adaptable scaffolds, not fixed scripts. Read [version and registry ownership](references/version-and-registry.md) before changing exact API facts. Run `npm run prototype:workflow-authoring:validate` from the extension repository after changing a template.
