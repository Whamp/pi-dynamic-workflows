// PROTOTYPE — throwaway terminal driver for issue #28. Not production code.

import { createHash } from "node:crypto";
import { createInterface } from "node:readline";
import { COMPACT_GUIDANCE_BASELINE, WORKFLOW_CAPABILITY_CONTRACT } from "./contract.prototype.js";
import type {
  CapabilityDescriptor,
  CompactWorkflowGuidance,
  ContractEvidence,
  DriftDiagnostic,
} from "./logic.prototype.js";

const QUESTION =
  "Can one executable capability contract assemble project-owned workflow globals, project compact and detailed authoring facts, and expose drift without taking semantic authority away from the runtime?";
const ASSUMPTION =
  "This is a logic prototype: existing runWorkflow() behavior is represented as evidence, the current compact guidance is copied byte-for-byte as a frozen baseline, and no production module imports this code.";

const RUNTIME_NAMES = [
  "agent",
  "parallel",
  "pipeline",
  "workflow",
  "verify",
  "judgePanel",
  "loopUntilDry",
  "completenessCheck",
  "retry",
  "gate",
  "checkpoint",
  "log",
  "phase",
  "args",
  "cwd",
  "process",
  "budget",
  "console",
] as const;

type Scenario =
  | "baseline"
  | "undeclared-runtime"
  | "missing-implementation"
  | "compact-drift"
  | "constraint-disagreement"
  | "skill-version-drift"
  | "dynamic-connected";

type PrototypeState = {
  scenario: Scenario;
  selectedIndex: number;
  lastAction: string;
};

type PrototypeAction = { type: "scenario"; scenario: Scenario } | { type: "select-next" } | { type: "select-previous" };

const scenarioLabels: Readonly<Record<Scenario, string>> = {
  baseline: "Baseline contract",
  "undeclared-runtime": "Undeclared runtime global",
  "missing-implementation": "Missing declared implementation",
  "compact-drift": "Compact guidance drift",
  "constraint-disagreement": "Runtime/reference constraint disagreement",
  "skill-version-drift": "Skill/extension version drift",
  "dynamic-connected": "Future dynamic providers connected",
};

const runtimeImplementations: Readonly<Record<string, unknown>> = {
  agent: async () => "agent",
  parallel: async () => [],
  pipeline: async () => [],
  workflow: async () => undefined,
  verify: async () => ({ real: true }),
  judgePanel: async () => undefined,
  loopUntilDry: async () => [],
  completenessCheck: async () => ({ complete: true }),
  retry: async () => undefined,
  gate: async () => ({ ok: true }),
  checkpoint: async () => true,
  log: () => undefined,
  phase: () => undefined,
  args: { prototype: true },
  cwd: "/prototype/cwd",
  process: Object.freeze({ cwd: () => "/prototype/cwd" }),
  budget: Object.freeze({ total: null, spent: () => 0, remaining: () => Number.POSITIVE_INFINITY }),
  console: Object.freeze({ log: () => undefined }),
};

const runtimeFacts: Readonly<Record<string, string>> = {
  "recoverable-failure": "recoverable-null-nonrecoverable-throws",
  "model-selector-priority": "explicit>agentType>tier>phase>meta>implicit-medium>session-default",
  "token-budget-gate": "soft-pre-call-gate",
  "checkpoint-ui-scope": "confirm-and-headless-only",
  "parallel-result-order": "input-order",
  "workflow-nesting": "one-level-shared-resources",
  "markdown-fence-compatibility": "whole-input-fences-stripped",
};

function copyGuidance(guidance: CompactWorkflowGuidance): CompactWorkflowGuidance {
  return {
    toolDescription: guidance.toolDescription,
    toolInputDescriptions: { ...guidance.toolInputDescriptions },
    promptSnippet: guidance.promptSnippet,
    promptGuidelines: [...guidance.promptGuidelines],
  };
}

function anchors(): string[] {
  return WORKFLOW_CAPABILITY_CONTRACT.definition.capabilities
    .filter((capability) => capability.discovery !== "none")
    .map((capability) => capability.links.reference.anchor);
}

function evidenceFor(scenario: Scenario): ContractEvidence {
  const suppliedImplementations: Record<string, unknown> = { ...runtimeImplementations };
  const observedRuntimeGlobals: string[] = [...RUNTIME_NAMES];
  const compactGuidance = copyGuidance(COMPACT_GUIDANCE_BASELINE);
  const observedFacts: Record<string, string> = { ...runtimeFacts };
  const skill = { extensionVersion: "2.13.1", anchors: anchors() };
  const dynamicReferences: ContractEvidence["dynamicReferences"] = {};

  switch (scenario) {
    case "undeclared-runtime":
      suppliedImplementations.mysteryHelper = () => "not exposed";
      observedRuntimeGlobals.push("mysteryHelper");
      break;
    case "missing-implementation":
      delete suppliedImplementations.checkpoint;
      observedRuntimeGlobals.splice(observedRuntimeGlobals.indexOf("checkpoint"), 1);
      break;
    case "compact-drift":
      compactGuidance.toolInputDescriptions = {
        ...compactGuidance.toolInputDescriptions,
        tokenBudget: "A strict in-flight token cap.",
      };
      break;
    case "constraint-disagreement":
      observedFacts["parallel-result-order"] = "completion-order";
      observedFacts["token-budget-gate"] = "hard-in-flight-cap";
      break;
    case "skill-version-drift":
      skill.extensionVersion = "2.13.2";
      skill.anchors = skill.anchors.filter((anchor) => anchor !== "checkpoint");
      break;
    case "dynamic-connected":
      dynamicReferences["model-routes"] = [
        { name: "small", description: "fixture from model-tier-config" },
        { name: "medium" },
      ];
      dynamicReferences["agent-types"] = [{ name: "reviewer", description: "fixture from agent-registry" }];
      break;
    case "baseline":
      break;
  }

  return {
    suppliedImplementations,
    observedRuntimeGlobals,
    compactGuidance,
    runtimeFacts: observedFacts,
    skill,
    dynamicReferences,
  };
}

function reduceState(state: PrototypeState, action: PrototypeAction): PrototypeState {
  const count = WORKFLOW_CAPABILITY_CONTRACT.definition.capabilities.length;
  switch (action.type) {
    case "scenario":
      return {
        ...state,
        scenario: action.scenario,
        lastAction: `Loaded: ${scenarioLabels[action.scenario]}`,
      };
    case "select-next":
      return {
        ...state,
        selectedIndex: (state.selectedIndex + 1) % count,
        lastAction: "Selected next descriptor",
      };
    case "select-previous":
      return {
        ...state,
        selectedIndex: (state.selectedIndex - 1 + count) % count,
        lastAction: "Selected previous descriptor",
      };
  }
}

const bold = (text: string): string => (process.stdout.isTTY ? `\x1b[1m${text}\x1b[0m` : text);
const dim = (text: string): string => (process.stdout.isTTY ? `\x1b[2m${text}\x1b[0m` : text);

function compactGuidanceHash(guidance: CompactWorkflowGuidance): string {
  return createHash("sha256").update(JSON.stringify(guidance)).digest("hex").slice(0, 16);
}

function formatDiagnostic(diagnostic: DriftDiagnostic): string {
  return `- ${diagnostic.severity.toUpperCase()} ${diagnostic.code} [${diagnostic.subject}] ${diagnostic.detail}`;
}

function formatSelectedCapability(capability: CapabilityDescriptor): string[] {
  const optionShape = capability.optionShape
    ? WORKFLOW_CAPABILITY_CONTRACT.definition.optionShapes.find((shape) => shape.id === capability.optionShape)
    : undefined;
  const lines = [
    `${bold("id")}: ${capability.id}`,
    `${bold("axes")}: classification=${capability.classification}; support=${capability.support}; discovery=${capability.discovery}; origin=${capability.origin}`,
    `${bold("lifecycle")}: present-at extension ${capability.lifecycle.extension.version}; contract format ${capability.lifecycle.contractFormat}`,
    `${bold("signature")}: ${capability.signature?.syntax ?? "value/global"} -> ${capability.signature?.returns ?? "runtime value"}`,
    `${bold("reference")}: ${capability.links.reference.path}#${capability.links.reference.anchor}`,
    `${bold("runtime")}: ${capability.links.runtime.path} :: ${capability.links.runtime.symbol}`,
    `${bold("tests")}: ${capability.links.tests.join(", ")}`,
  ];

  if (optionShape) {
    lines.push(`${bold("shared option shape")}: ${optionShape.id}`);
    for (const option of optionShape.options) {
      const dynamic = option.dynamicReference ? ` -> ${option.dynamicReference}` : "";
      lines.push(`  - ${option.name}${option.optional ? "?" : ""}: ${option.type}${dynamic}`);
    }
  }
  if (capability.constraints.length > 0) {
    lines.push(`${bold("constraints")}:`);
    for (const constraint of capability.constraints) {
      lines.push(
        `  - ${constraint.id} [${constraint.enforcement}/${constraint.scope}]: ${constraint.oneLine} (${constraint.link})`,
      );
    }
  }
  if (capability.dynamicReference) {
    lines.push(
      `${bold("dynamic connector")}: ${capability.dynamicReference.catalogue} owned by ${capability.dynamicReference.owner}; shape ${capability.dynamicReference.itemShape}; ${capability.dynamicReference.connection}`,
    );
  }
  return lines;
}

function render(state: PrototypeState, clear: boolean): string {
  if (clear) console.clear();
  const evidence = evidenceFor(state.scenario);
  const definition = WORKFLOW_CAPABILITY_CONTRACT.definition;
  const assembly = WORKFLOW_CAPABILITY_CONTRACT.assembleRuntimeBindings(evidence.suppliedImplementations);
  const compactIndex = WORKFLOW_CAPABILITY_CONTRACT.compactIndex();
  const detailedReference = WORKFLOW_CAPABILITY_CONTRACT.detailedReference();
  const diagnostics = WORKFLOW_CAPABILITY_CONTRACT.diagnose(evidence);
  const selected = definition.capabilities[state.selectedIndex];
  const bindingDescriptors = definition.capabilities.filter((capability) => capability.binding);
  const toolInputs = definition.capabilities.filter((capability) => capability.classification === "tool-input");
  const driftCount = diagnostics.filter((diagnostic) => diagnostic.severity !== "information").length;
  const identityCount = assembly.ok
    ? Object.entries(assembly.globals).filter(([name, value]) => evidence.suppliedImplementations[name] === value)
        .length
    : 0;
  const dynamicLines = (["model-routes", "agent-types"] as const).map((catalogue) => {
    const values = evidence.dynamicReferences[catalogue];
    return `${catalogue}: ${values ? `connected (${values.map((value) => value.name).join(", ")})` : "future provider disconnected (informational)"}`;
  });

  return [
    bold("PROTOTYPE — executable workflow capability contract (throwaway)"),
    `${bold("Question")}: ${QUESTION}`,
    `${bold("Assumption")}: ${ASSUMPTION}`,
    "",
    `${bold("Scenario")}: ${scenarioLabels[state.scenario]}`,
    `${bold("Last action")}: ${state.lastAction}`,
    `${bold("Versions")}: contract-format=${definition.contractFormatVersion}; extension=${definition.extensionVersion}; skill=${evidence.skill.extensionVersion}`,
    `${bold("Registration")}: descriptors=${definition.capabilities.length}; project bindings=${bindingDescriptors.length}; tool inputs=${toolInputs.length}; shared option shapes=${definition.optionShapes.length}`,
    `${bold("Project-owned globals")}: ${bindingDescriptors.map((capability) => capability.binding?.global).join(", ")}`,
    `${bold("Tool inputs")}: ${toolInputs.map((input) => input.label).join(", ")}`,
    "",
    bold("Runtime binding assembly"),
    `status: ${assembly.ok ? "materialized" : "REFUSED"}`,
    `bound globals: ${assembly.ok ? Object.keys(assembly.globals).join(", ") : "none"}`,
    `identity preserved: ${identityCount}/${bindingDescriptors.length}`,
    `missing implementations: ${assembly.missingImplementations.join(", ") || "none"}`,
    `ignored implementations: ${assembly.ignoredImplementations.join(", ") || "none"}`,
    "",
    bold("Projections"),
    `compact guidance hash: expected=${compactGuidanceHash(definition.compactGuidance)} observed=${compactGuidanceHash(evidence.compactGuidance)}`,
    `compact index (${compactIndex.length}): ${compactIndex.map((entry) => entry.label).join(", ")}`,
    `detailed reference (${detailedReference.length}): ${detailedReference.map((entry) => entry.reference).join(", ")}`,
    "",
    bold(`Selected descriptor ${state.selectedIndex + 1}/${definition.capabilities.length}`),
    ...formatSelectedCapability(selected),
    "",
    bold("Dynamic connections"),
    ...dynamicLines,
    "",
    bold(`Diagnostics (${driftCount} drift/failure, ${diagnostics.length - driftCount} informational)`),
    ...(diagnostics.length > 0 ? diagnostics.map(formatDiagnostic) : ["- none"]),
    "",
    `${bold("Actions")}: ${dim("[1] baseline  [2] undeclared  [3] missing  [4] compact drift  [5] constraint drift  [6] version drift  [7] dynamic connected  [n/p] descriptor  [q] quit")}`,
  ].join("\n");
}

const actionByInput: Readonly<Record<string, PrototypeAction>> = {
  "1": { type: "scenario", scenario: "baseline" },
  "2": { type: "scenario", scenario: "undeclared-runtime" },
  "3": { type: "scenario", scenario: "missing-implementation" },
  "4": { type: "scenario", scenario: "compact-drift" },
  "5": { type: "scenario", scenario: "constraint-disagreement" },
  "6": { type: "scenario", scenario: "skill-version-drift" },
  "7": { type: "scenario", scenario: "dynamic-connected" },
  n: { type: "select-next" },
  p: { type: "select-previous" },
};

let state: PrototypeState = {
  scenario: "baseline",
  selectedIndex: 0,
  lastAction: "Initialized in-memory prototype state",
};

if (!process.stdin.isTTY || process.argv.includes("--demo")) {
  const demoScenarios: readonly Scenario[] = [
    "baseline",
    "undeclared-runtime",
    "missing-implementation",
    "compact-drift",
    "constraint-disagreement",
    "skill-version-drift",
    "dynamic-connected",
  ];
  for (const scenario of demoScenarios) {
    state = reduceState(state, { type: "scenario", scenario });
    process.stdout.write(`\n${"=".repeat(120)}\n${render(state, false)}\n`);
  }
} else {
  process.stdout.write(`${render(state, true)}\n> `);
  const input = createInterface({ input: process.stdin, output: process.stdout });
  input.on("line", (line) => {
    const command = line.trim().toLowerCase();
    if (command === "q") {
      input.close();
      return;
    }
    const action = actionByInput[command];
    if (action) state = reduceState(state, action);
    else state = { ...state, lastAction: `Ignored unknown action: ${JSON.stringify(command)}` };
    process.stdout.write(`${render(state, true)}\n> `);
  });
}
