// PROTOTYPE — throwaway executable definition for issue #28. Not production code.

import {
  type CapabilityDescriptor,
  type CompactWorkflowGuidance,
  type ConstraintDescriptor,
  defineWorkflowCapabilityContract,
  type OptionDescriptor,
  type WorkflowCapabilityDefinition,
} from "./logic.prototype.js";

const EXTENSION_VERSION = "2.13.1";
const REFERENCE_PATH = "skills/workflow-authoring/references/capabilities.md";
const RUNTIME_PATH = "src/workflow.ts";
const BASELINE = { contractFormat: 1, extension: { kind: "present-at", version: EXTENSION_VERSION } } as const;

const RECOVERABLE_NULL: ConstraintDescriptor = {
  id: "recoverable-failure",
  oneLine: "Recoverable agent failures return null after retries; nonrecoverable failures throw.",
  enforcement: "runtime",
  scope: "agent(), parallel(), and pipeline()",
  expectedRuntimeFact: "recoverable-null-nonrecoverable-throws",
  link: "src/workflow.ts#agent",
};
const MODEL_PRECEDENCE: ConstraintDescriptor = {
  id: "model-selector-priority",
  oneLine: "Explicit model > agentType model > tier > phase/top-level routing > implicit medium > session default.",
  enforcement: "runtime",
  scope: "agent() model selection",
  expectedRuntimeFact: "explicit>agentType>tier>phase>meta>implicit-medium>session-default",
  link: "src/model-routing.ts#resolveModelForPhase",
};
const SOFT_TOKEN_GATE: ConstraintDescriptor = {
  id: "token-budget-gate",
  oneLine: "The token budget is a soft pre-call gate; concurrent in-flight work can overshoot.",
  enforcement: "runtime",
  scope: "run and phase token budgets",
  expectedRuntimeFact: "soft-pre-call-gate",
  link: "src/workflow.ts#budget",
};
const CHECKPOINT_PARTIAL: ConstraintDescriptor = {
  id: "checkpoint-ui-scope",
  oneLine: "Confirm/headless behavior is wired; input, select, choices, and timeout remain declared-only.",
  enforcement: "tool-adapter",
  scope: "checkpoint() host interaction",
  expectedRuntimeFact: "confirm-and-headless-only",
  link: "src/workflow-tool.ts#createWorkflowTool",
};
const PARALLEL_ORDER: ConstraintDescriptor = {
  id: "parallel-result-order",
  oneLine: "parallel() requires thunks and returns results in input order.",
  enforcement: "runtime",
  scope: "parallel()",
  expectedRuntimeFact: "input-order",
  link: "src/workflow.ts#parallel",
};
const ONE_LEVEL_NESTING: ConstraintDescriptor = {
  id: "workflow-nesting",
  oneLine: "workflow() permits one nested level and shares limiter, counters, store, and token accounting.",
  enforcement: "runtime",
  scope: "workflow()",
  expectedRuntimeFact: "one-level-shared-resources",
  link: "src/workflow.ts#workflowFn",
};
const FENCE_COMPATIBILITY: ConstraintDescriptor = {
  id: "markdown-fence-compatibility",
  oneLine: "Whole-input JavaScript Markdown fences are stripped for compatibility.",
  enforcement: "tool-adapter",
  scope: "workflow tool script input",
  expectedRuntimeFact: "whole-input-fences-stripped",
  link: "src/workflow-tool.ts#normalizeWorkflowScript",
};

const REQUIRED_PROMPT: OptionDescriptor = { name: "prompt", type: "string", optional: false };
const OPTIONAL_OPTIONS: OptionDescriptor = { name: "options", type: "object", optional: true };

const runtimeCapability = (
  name: string,
  details: {
    discovery?: "compact" | "workflow-authoring" | "none";
    syntax?: string;
    parameters?: readonly OptionDescriptor[];
    returns?: string;
    optionShape?: string;
    constraints?: readonly ConstraintDescriptor[];
    symbol?: string;
  } = {},
): CapabilityDescriptor => ({
  id: `workflow.runtime.${name}`,
  label: name,
  classification: "runtime-capability",
  support: "supported",
  discovery: details.discovery ?? "compact",
  origin: "project-bound",
  lifecycle: BASELINE,
  signature: details.syntax
    ? {
        syntax: details.syntax,
        parameters: details.parameters ?? [],
        returns: details.returns ?? "unknown",
      }
    : undefined,
  optionShape: details.optionShape,
  constraints: details.constraints ?? [],
  binding: { global: name, implementation: name },
  links: {
    reference: { path: REFERENCE_PATH, anchor: name.toLowerCase() },
    runtime: { path: RUNTIME_PATH, symbol: details.symbol ?? `runWorkflow.${name}` },
    tests: ["tests/workflow-runtime.test.ts"],
  },
});

const toolInput = (
  name: string,
  type: string,
  constraints: readonly ConstraintDescriptor[] = [],
): CapabilityDescriptor => ({
  id: `workflow.tool-input.${name}`,
  label: name,
  classification: "tool-input",
  support: "supported",
  discovery: "compact",
  origin: "not-applicable",
  lifecycle: BASELINE,
  signature: { syntax: `${name}?: ${type}`, parameters: [], returns: "workflow tool input" },
  constraints,
  links: {
    reference: { path: REFERENCE_PATH, anchor: `tool-input-${name.toLowerCase()}` },
    runtime: { path: "src/workflow-tool.ts", symbol: `workflowToolSchema.${name}` },
    tests: ["tests/workflow-tool.test.ts"],
  },
});

export const COMPACT_GUIDANCE_BASELINE: CompactWorkflowGuidance = {
  toolDescription:
    "Run a JavaScript workflow that delegates work to subagents with agent(), optionally composing calls with parallel() and pipeline().",
  toolInputDescriptions: {
    script: [
      "Required raw JavaScript workflow script, with no Markdown fences.",
      "First statement: export const meta = { name: 'short_snake_case', description: 'non-empty description' }. Add phases: [{ title: 'Phase' }] only when the workflow has named phases, and declare only phases it will use. With multiple phases, call phase('Exact Title') before each phase's work or set `phase` in the agent options.",
      "Use `await workflow(savedName, childArgs)` to run a saved workflow inline; nesting is limited to one level and shares the parent run's concurrency, agent, and token limits.",
      "Optional quality helpers include verify(), judgePanel(), loopUntilDry(), and completenessCheck().",
      "Optional control helpers include retry() and gate(); budget exposes total, spent(), and remaining(), and phase('Name', { budget: N }) sets a phase token limit.",
      "The optional `agentType` option selects a named user or project definition that can bind tools, a model, and role instructions; use it only when its name and purpose are provided in context. Its bound model overrides `tier`; an explicit `model` overrides both.",
      "Use plain JavaScript only; imports, require(), filesystem modules, Date.now(), Math.random(), and new Date() are unavailable.",
      "Use phase('Name'), agent(prompt, opts), parallel(arrayOfFunctions), pipeline(items, ...stages), log(message), args, cwd, process.cwd(), and budget. The workflow must call agent() at least once.",
      "parallel() requires functions, not promises, and returns results in input order: await parallel(items.map(item => () => agent(...))).",
      "pipeline(items, ...stages) runs stages sequentially for each item while items proceed concurrently; each stage receives (previousValue, originalItem, index).",
    ].join(" "),
    args: "Optional JSON value exposed to the workflow script as global `args`.",
    background:
      "Run the workflow in the background. Default: true — the tool returns immediately with a run ID, the turn ends so the user isn't blocked, and the result is delivered back into the conversation when it finishes. Set to false only when you need the result inline in this same turn (the call will block until the workflow completes).",
    maxAgents:
      "Maximum number of agents allowed in this run. Default: 1000; this is a safety ceiling, not a target. Set a lower limit for dynamic or exploratory fan-out, and reserve large fan-outs for explicit user intent.",
    concurrency:
      "Maximum concurrent agents for this run. Clamped to the runtime maximum. Use when provider/transport stability matters.",
    agentRetries:
      "Retry attempts for recoverable agent failures such as timeout, connection failure, or empty assistant output. Default 0 unless configured.",
    agentTimeoutMs:
      "Timeout per agent in milliseconds. Omit for no hard timeout by default. Set only when the user asks to bound time.",
    tokenBudget:
      "Hard total-token budget for the whole run. Once spent reaches it, further agent() calls fail and the run stops. Omit for no limit. Set it when the user asks to cap spend.",
  },
  promptSnippet:
    "Delegate substantive independent or staged work to subagents with a JavaScript workflow, optionally composing agent calls with parallel(), pipeline(), or both",
  promptGuidelines: [
    "Use workflow only for explicit workflow intent: a request for a workflow, subagent delegation, fan-out, or multi-agent orchestration, or an enabled mode that requires workflow. Use ordinary tools for work you can perform directly.",
    "For workflow, assign each agent a substantive work unit at a natural task boundary that it can complete comfortably within one context window. Split larger work at additional natural boundaries. Make each agent prompt self-contained with relevant context, paths, constraints, and expected output.",
    "For workflow, compose parallel() and pipeline() when the work has both shapes: use parallel() for independent work and between stages when the next stage needs all prior results; use pipeline() when each item can pass through its stages independently. Add verification when results would materially benefit from cross-checking, or a final synthesis agent when the deliverable needs comparison or prose.",
    "For workflow, explicitly `return` a JSON-serializable result. Treat `null` from recoverable agent(), parallel(), or pipeline() failures as missing coverage, not a negative finding. Record failed work-unit identities before filtering, and report any coverage that remains incomplete.",
    "For workflow, give each agent() invocation a short, unique `label` that identifies its work unit. For workflow, `tier` selects a configured model route. Standard routes are `small` for lightweight or high-volume work, `medium` for routine work, and `big` for the hardest or highest-stakes work; use another user-configured route only when its name and purpose are provided in context. Use `model` instead of `tier` only to honor an exact model named by the user. When an agent must return structured data, pass a plain JSON Schema in its `schema` option; on success, `agent()` returns the validated object.",
  ],
};

const AGENT_OPTIONS = {
  id: "agent-options",
  options: [
    { name: "label", type: "string", optional: true },
    { name: "phase", type: "string", optional: true },
    { name: "schema", type: "JSON Schema", optional: true },
    { name: "model", type: "string", optional: true, dynamicReference: "model-routes" },
    { name: "tier", type: "string", optional: true, dynamicReference: "model-routes" },
    { name: "isolation", type: '"worktree"', optional: true },
    { name: "agentType", type: "string", optional: true, dynamicReference: "agent-types" },
    { name: "timeoutMs", type: "number | null", optional: true },
    { name: "retries", type: "number", optional: true, constraints: ["floored and clamped to 0..3"] },
  ],
} as const;
const CHECKPOINT_OPTIONS = {
  id: "checkpoint-options",
  options: [
    { name: "default", type: "unknown", optional: true },
    { name: "headless", type: '"default" | "abort"', optional: true, default: '"default"' },
    { name: "kind", type: '"confirm" | "input" | "select"', optional: true },
    { name: "choices", type: "string[]", optional: true },
    { name: "timeoutMs", type: "number", optional: true },
  ],
} as const;
const PHASE_OPTIONS = {
  id: "phase-options",
  options: [{ name: "budget", type: "number", optional: true, constraints: ["positive soft sub-budget"] }],
} as const;

const capabilities: readonly CapabilityDescriptor[] = [
  runtimeCapability("agent", {
    syntax: "agent(prompt, options?)",
    parameters: [REQUIRED_PROMPT, OPTIONAL_OPTIONS],
    returns: "Promise<string | structured value | null>",
    optionShape: AGENT_OPTIONS.id,
    constraints: [RECOVERABLE_NULL, MODEL_PRECEDENCE],
  }),
  runtimeCapability("parallel", {
    syntax: "parallel(thunks)",
    parameters: [{ name: "thunks", type: "Array<() => Promise<T>>", optional: false }],
    returns: "Promise<Array<T | null>>",
    constraints: [PARALLEL_ORDER, RECOVERABLE_NULL],
  }),
  runtimeCapability("pipeline", {
    syntax: "pipeline(items, ...stages)",
    parameters: [
      { name: "items", type: "unknown[]", optional: false },
      { name: "stages", type: "Array<(previous, original, index) => unknown>", optional: false },
    ],
    returns: "Promise<unknown[]>",
    constraints: [RECOVERABLE_NULL],
  }),
  runtimeCapability("workflow", {
    syntax: "workflow(savedName, childArgs?)",
    parameters: [
      { name: "savedName", type: "string", optional: false },
      { name: "childArgs", type: "unknown", optional: true },
    ],
    returns: "Promise<unknown>",
    constraints: [ONE_LEVEL_NESTING],
    symbol: "runWorkflow.workflowFn",
  }),
  runtimeCapability("verify", { discovery: "workflow-authoring", syntax: "verify(item, options?)" }),
  runtimeCapability("judgePanel", {
    discovery: "workflow-authoring",
    syntax: "judgePanel(attempts, options?)",
  }),
  runtimeCapability("loopUntilDry", {
    discovery: "workflow-authoring",
    syntax: "loopUntilDry(options)",
  }),
  runtimeCapability("completenessCheck", {
    discovery: "workflow-authoring",
    syntax: "completenessCheck(taskArgs, results)",
  }),
  runtimeCapability("retry", { discovery: "workflow-authoring", syntax: "retry(thunk, options?)" }),
  runtimeCapability("gate", {
    discovery: "workflow-authoring",
    syntax: "gate(thunk, validator, options?)",
  }),
  runtimeCapability("checkpoint", {
    discovery: "workflow-authoring",
    syntax: "checkpoint(prompt, options?)",
    parameters: [REQUIRED_PROMPT, OPTIONAL_OPTIONS],
    returns: "Promise<unknown>",
    optionShape: CHECKPOINT_OPTIONS.id,
    constraints: [CHECKPOINT_PARTIAL],
  }),
  runtimeCapability("log", { syntax: "log(message)", returns: "void" }),
  runtimeCapability("phase", {
    syntax: "phase(title, options?)",
    optionShape: PHASE_OPTIONS.id,
    constraints: [SOFT_TOKEN_GATE],
  }),
  runtimeCapability("args"),
  runtimeCapability("cwd"),
  runtimeCapability("process"),
  runtimeCapability("budget", { constraints: [SOFT_TOKEN_GATE] }),
  runtimeCapability("console", { discovery: "workflow-authoring" }),
  toolInput("script", "string"),
  toolInput("args", "unknown"),
  toolInput("background", "boolean"),
  toolInput("maxAgents", "number"),
  toolInput("concurrency", "number"),
  toolInput("agentRetries", "number"),
  toolInput("agentTimeoutMs", "number"),
  toolInput("tokenBudget", "number", [SOFT_TOKEN_GATE]),
  {
    id: "workflow.script.metadata",
    label: "export const meta",
    classification: "script-contract",
    support: "supported",
    discovery: "workflow-authoring",
    origin: "not-applicable",
    lifecycle: BASELINE,
    signature: {
      syntax: "export const meta = { name, description, phases?, model? }",
      parameters: [],
      returns: "first-statement workflow metadata",
    },
    constraints: [],
    links: {
      reference: { path: REFERENCE_PATH, anchor: "metadata" },
      runtime: { path: RUNTIME_PATH, symbol: "parseWorkflowScript" },
      tests: ["tests/workflow-parser.test.ts"],
    },
  },
  {
    id: "workflow.compat.markdown-fence-stripping",
    label: "Markdown-fence stripping",
    classification: "script-contract",
    support: "compatibility",
    discovery: "workflow-authoring",
    origin: "not-applicable",
    lifecycle: BASELINE,
    constraints: [FENCE_COMPATIBILITY],
    links: {
      reference: { path: REFERENCE_PATH, anchor: "markdown-fence-stripping" },
      runtime: { path: "src/workflow-tool.ts", symbol: "normalizeWorkflowScript" },
      tests: ["tests/workflow-tool.test.ts"],
    },
  },
  {
    id: "workflow.vm.realm-substrate",
    label: "VM realm substrate",
    classification: "script-contract",
    support: "internal",
    discovery: "none",
    origin: "realm-inherited",
    lifecycle: BASELINE,
    constraints: [],
    links: {
      reference: { path: REFERENCE_PATH, anchor: "vm-realm-substrate" },
      runtime: { path: RUNTIME_PATH, symbol: "vm.createContext" },
      tests: ["tests/workflow-runtime.test.ts"],
    },
  },
  {
    id: "workflow.dynamic.model-routes",
    label: "model routes",
    classification: "dynamic-reference",
    support: "supported",
    discovery: "workflow-authoring",
    origin: "not-applicable",
    lifecycle: BASELINE,
    constraints: [MODEL_PRECEDENCE],
    dynamicReference: {
      catalogue: "model-routes",
      owner: "model-tier-config",
      itemShape: "{ name: string; description?: string }",
      connection: "future-provider",
    },
    links: {
      reference: { path: REFERENCE_PATH, anchor: "model-routes" },
      runtime: { path: "src/model-tier-config.ts", symbol: "loadModelTierConfig" },
      tests: ["tests/workflows-models-command.test.ts"],
    },
  },
  {
    id: "workflow.dynamic.agent-types",
    label: "agent types",
    classification: "dynamic-reference",
    support: "supported",
    discovery: "workflow-authoring",
    origin: "not-applicable",
    lifecycle: BASELINE,
    constraints: [],
    dynamicReference: {
      catalogue: "agent-types",
      owner: "agent-registry",
      itemShape: "{ name: string; description?: string }",
      connection: "future-provider",
    },
    links: {
      reference: { path: REFERENCE_PATH, anchor: "agent-types" },
      runtime: { path: "src/agent-registry.ts", symbol: "loadAgentRegistry" },
      tests: ["tests/agent-registry.test.ts"],
    },
  },
];

export const WORKFLOW_CAPABILITY_DEFINITION: WorkflowCapabilityDefinition = {
  contractFormatVersion: 1,
  extensionVersion: EXTENSION_VERSION,
  optionShapes: [AGENT_OPTIONS, CHECKPOINT_OPTIONS, PHASE_OPTIONS],
  capabilities,
  compactGuidance: COMPACT_GUIDANCE_BASELINE,
};

export const WORKFLOW_CAPABILITY_CONTRACT = defineWorkflowCapabilityContract(WORKFLOW_CAPABILITY_DEFINITION);
