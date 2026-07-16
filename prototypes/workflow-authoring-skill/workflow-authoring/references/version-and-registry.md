# Version and registry ownership

This prototype is pinned to `@quintinshaw/pi-dynamic-workflows@2.13.1`, the version in the repository's `package.json`. The validator compares that value with `metadata.package-version` in `SKILL.md` before it trusts any template.

## Production ownership

The future internal capability registry owns exact names, signatures, option fields, defaults, and supported-versus-legacy classifications. Hand-written prose owns judgment: when a capability fits, how patterns compose, what failure means for coverage, and which caveats change an author's decision.

Every exact-fact block in these references is marked as one of:

- **REGISTRY-OWNED PROTOTYPE EXCERPT** — hand-transcribed from the 2.13.1 inventory so this throwaway branch is useful; production should generate or check it from the registry.
- **REGISTRY PLACEHOLDER** — the owning registry or live catalogue must fill it; authors must not invent values.

A package-version bump must regenerate/recheck those blocks and rerun template validation. Copying an old block forward is not version parity.

## Live catalogue connection

<!-- REGISTRY PLACEHOLDER: live-route-and-agent-type-catalogues -->

Route and `agentType` catalogue contents remain owned by separate live-discovery efforts. This skill defines only their connection rule: consume a name only with purpose metadata supplied in current context. It intentionally lists no user-specific route, model, or agent-type names.

## Distribution seam

This throwaway prototype is deliberately not package-discovered. Production would add the finished `skills/` resource to the npm `files` allowlist and `pi.skills`, while keeping `src/workflow-tool.ts` as the fixed compact interface. No capability-help tool is needed.
