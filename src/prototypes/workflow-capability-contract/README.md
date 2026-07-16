# PROTOTYPE — executable workflow capability contract

> **Throwaway architecture prototype for issue #28. Do not productionize this directory.**

## Question

Can one executable capability contract assemble every project-owned workflow global, project compact and detailed authoring facts, and make drift observable while `runWorkflow()` remains the semantic authority?

## Assumption

This is a **logic** prototype, not production implementation. It models the existing `vm.createContext({...})` seam without wiring into it. Existing runtime closures are represented by identity-bearing fixtures, runtime observations win disagreements, and the current workflow tool description, all eight parameter descriptions, prompt snippet, and five prompt guidelines are copied byte-for-byte as the frozen compact baseline. The generated compact index is displayed separately; it is not injected into the prompt.

## Run

```bash
npm run prototype:capability-contract
```

In a terminal, enter `1`–`7`, `n`, `p`, or `q`, then press Enter. When stdin is not a TTY, the same command runs every scenario once and exits, which is useful for review or CI-like smoke checks.

## What to inspect

- **Baseline:** 18 project-owned bindings materialize with unchanged value identity; eight tool inputs and three reusable option shapes project from the same definition.
- **Undeclared runtime global:** an extra implementation is ignored and an observed bypass is reported.
- **Missing implementation:** context materialization is refused.
- **Compact drift:** exact placement-aware guidance drift is reported without changing the baseline.
- **Constraint disagreement:** runtime facts are displayed as authoritative and the reference is marked stale.
- **Version drift:** stale skill version and missing anchors are independent diagnostics.
- **Dynamic connections:** route and agent-type values attach through future-provider metadata while ownership stays with `model-tier-config` and `agent-registry`.

Classification, support, discovery, origin, lifecycle, enforcement, signatures, options, constraints, and links are separate dimensions. VM-realm globals are represented as internal realm substrate, not promoted into the 18 project-owned bindings.

## Deliberate limits

- No production imports or `vm.createContext()` changes.
- No persistence, package skill, capability-help tool, live catalogue lookup, or template execution.
- No attempt to fix legacy/compatibility behavior or compact-guidance drift already documented by the inventory.
- No reconstructed introduction history: existing entries use honest `present-at: 2.13.1` baselines.
- Fixtures represent audited runtime evidence; they do not replace eventual behavior probes and exact-text tests.
- No tests: the terminal scenarios are the prototype’s inspection surface.
