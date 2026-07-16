// PROTOTYPE — throwaway logic for issue #28. This file is not production wiring.

export type CapabilityClassification = "runtime-capability" | "script-contract" | "tool-input" | "dynamic-reference";
export type CapabilitySupport = "supported" | "compatibility" | "internal";
export type DiscoveryPlacement = "compact" | "workflow-authoring" | "none";
export type CapabilityOrigin = "project-bound" | "realm-inherited" | "not-applicable";
export type ConstraintEnforcement = "runtime" | "tool-adapter" | "guidance";
export type DiagnosticSeverity = "error" | "warning" | "information";

export type CapabilityLifecycle = {
  contractFormat: 1;
  extension: { kind: "present-at"; version: string } | { kind: "introduced-in"; version: string };
  deprecatedIn?: string;
};

export type OptionDescriptor = {
  name: string;
  type: string;
  optional: boolean;
  default?: string;
  constraints?: readonly string[];
  dynamicReference?: "model-routes" | "agent-types";
};

export type OptionShape = {
  id: string;
  options: readonly OptionDescriptor[];
};

export type ConstraintDescriptor = {
  id: string;
  oneLine: string;
  enforcement: ConstraintEnforcement;
  scope: string;
  expectedRuntimeFact?: string;
  link: string;
};

export type CapabilityDescriptor = {
  id: `workflow.${string}`;
  label: string;
  classification: CapabilityClassification;
  support: CapabilitySupport;
  discovery: DiscoveryPlacement;
  origin: CapabilityOrigin;
  lifecycle: CapabilityLifecycle;
  signature?: {
    syntax: string;
    parameters: readonly OptionDescriptor[];
    returns: string;
  };
  optionShape?: string;
  constraints: readonly ConstraintDescriptor[];
  binding?: {
    global: string;
    implementation: string;
  };
  dynamicReference?: {
    catalogue: "model-routes" | "agent-types";
    owner: "model-tier-config" | "agent-registry";
    itemShape: "{ name: string; description?: string }";
    connection: "future-provider";
  };
  links: {
    reference: { path: string; anchor: string };
    runtime: { path: string; symbol: string };
    tests: readonly string[];
  };
};

export type CompactWorkflowGuidance = {
  toolDescription: string;
  toolInputDescriptions: Readonly<Record<string, string>>;
  promptSnippet: string;
  promptGuidelines: readonly string[];
};

export type WorkflowCapabilityDefinition = {
  contractFormatVersion: 1;
  extensionVersion: string;
  optionShapes: readonly OptionShape[];
  capabilities: readonly CapabilityDescriptor[];
  compactGuidance: CompactWorkflowGuidance;
};

export type CompactCapabilityEntry = {
  id: string;
  label: string;
  signature: string;
};

export type DetailedCapabilityEntry = CompactCapabilityEntry & {
  classification: CapabilityClassification;
  support: CapabilitySupport;
  origin: CapabilityOrigin;
  optionShape?: OptionShape;
  constraints: readonly ConstraintDescriptor[];
  reference: string;
};

export type DriftDiagnostic = {
  code: string;
  severity: DiagnosticSeverity;
  subject: string;
  detail: string;
};

export type ContractEvidence = {
  suppliedImplementations: Readonly<Record<string, unknown>>;
  observedRuntimeGlobals: readonly string[];
  compactGuidance: CompactWorkflowGuidance;
  runtimeFacts: Readonly<Record<string, string>>;
  skill: {
    extensionVersion: string;
    anchors: readonly string[];
  };
  dynamicReferences: Partial<Record<"model-routes" | "agent-types", readonly { name: string; description?: string }[]>>;
};

export type RuntimeBindingResult =
  | {
      ok: true;
      globals: Readonly<Record<string, unknown>>;
      missingImplementations: readonly string[];
      ignoredImplementations: readonly string[];
    }
  | {
      ok: false;
      globals: undefined;
      missingImplementations: readonly string[];
      ignoredImplementations: readonly string[];
    };

export type WorkflowCapabilityContract = {
  readonly definition: WorkflowCapabilityDefinition;
  assembleRuntimeBindings(implementations: Readonly<Record<string, unknown>>): RuntimeBindingResult;
  compactIndex(): readonly CompactCapabilityEntry[];
  detailedReference(): readonly DetailedCapabilityEntry[];
  diagnose(evidence: ContractEvidence): readonly DriftDiagnostic[];
};

function guidanceFragments(guidance: CompactWorkflowGuidance): Readonly<Record<string, string>> {
  const fragments: Record<string, string> = {
    "tool-description": guidance.toolDescription,
    "prompt-snippet": guidance.promptSnippet,
  };
  for (const [name, description] of Object.entries(guidance.toolInputDescriptions)) {
    fragments[`tool-input:${name}`] = description;
  }
  guidance.promptGuidelines.forEach((guideline, index) => {
    fragments[`prompt-guideline:${index + 1}`] = guideline;
  });
  return fragments;
}

function compareCompactGuidance(
  expected: CompactWorkflowGuidance,
  observed: CompactWorkflowGuidance,
): DriftDiagnostic[] {
  const expectedFragments = guidanceFragments(expected);
  const observedFragments = guidanceFragments(observed);
  const diagnostics: DriftDiagnostic[] = [];

  for (const [placement, exactText] of Object.entries(expectedFragments)) {
    const observedText = observedFragments[placement];
    if (observedText !== exactText) {
      diagnostics.push({
        code: "COMPACT_GUIDANCE_DRIFT",
        severity: "warning",
        subject: placement,
        detail: `expected ${JSON.stringify(exactText)}; observed ${JSON.stringify(observedText)}`,
      });
    }
  }
  return diagnostics;
}

export function defineWorkflowCapabilityContract(definition: WorkflowCapabilityDefinition): WorkflowCapabilityContract {
  const projectBindings = definition.capabilities.flatMap((capability) =>
    capability.origin === "project-bound" && capability.binding ? [capability.binding] : [],
  );
  const declaredImplementationNames = new Set(projectBindings.map((binding) => binding.implementation));
  const declaredGlobalNames = new Set(projectBindings.map((binding) => binding.global));
  const optionShapes = new Map(definition.optionShapes.map((shape) => [shape.id, shape]));

  const assembleRuntimeBindings = (implementations: Readonly<Record<string, unknown>>): RuntimeBindingResult => {
    const missingImplementations = projectBindings
      .filter((binding) => !Object.hasOwn(implementations, binding.implementation))
      .map((binding) => binding.implementation);
    const ignoredImplementations = Object.keys(implementations).filter(
      (name) => !declaredImplementationNames.has(name),
    );

    if (missingImplementations.length > 0) {
      return { ok: false, globals: undefined, missingImplementations, ignoredImplementations };
    }

    const globals: Record<string, unknown> = {};
    for (const binding of projectBindings) {
      globals[binding.global] = implementations[binding.implementation];
    }
    return { ok: true, globals, missingImplementations, ignoredImplementations };
  };

  const compactIndex = (): readonly CompactCapabilityEntry[] =>
    definition.capabilities
      .filter((capability) => capability.support === "supported" && capability.discovery === "compact")
      .map((capability) => ({
        id: capability.id,
        label: capability.label,
        signature: capability.signature?.syntax ?? capability.label,
      }));

  const detailedReference = (): readonly DetailedCapabilityEntry[] =>
    definition.capabilities
      .filter((capability) => capability.support !== "internal" && capability.discovery !== "none")
      .map((capability) => ({
        id: capability.id,
        label: capability.label,
        signature: capability.signature?.syntax ?? capability.label,
        classification: capability.classification,
        support: capability.support,
        origin: capability.origin,
        optionShape: capability.optionShape ? optionShapes.get(capability.optionShape) : undefined,
        constraints: capability.constraints,
        reference: `${capability.links.reference.path}#${capability.links.reference.anchor}`,
      }));

  const diagnose = (evidence: ContractEvidence): readonly DriftDiagnostic[] => {
    const diagnostics: DriftDiagnostic[] = [];
    const assembly = assembleRuntimeBindings(evidence.suppliedImplementations);

    for (const implementation of assembly.missingImplementations) {
      diagnostics.push({
        code: "RUNTIME_DECLARED_BINDING_MISSING",
        severity: "error",
        subject: implementation,
        detail: "A declared runtime implementation is absent; context materialization is refused.",
      });
    }
    for (const implementation of assembly.ignoredImplementations) {
      diagnostics.push({
        code: "EXTRA_IMPLEMENTATION_IGNORED",
        severity: "information",
        subject: implementation,
        detail: "The implementation was supplied but is not exposed by the contract.",
      });
    }
    for (const observedGlobal of evidence.observedRuntimeGlobals) {
      if (!declaredGlobalNames.has(observedGlobal)) {
        diagnostics.push({
          code: "RUNTIME_UNDECLARED_BINDING",
          severity: "warning",
          subject: observedGlobal,
          detail: "The observed project-owned runtime global does not pass through the contract.",
        });
      }
    }
    for (const declaredGlobal of declaredGlobalNames) {
      if (!evidence.observedRuntimeGlobals.includes(declaredGlobal)) {
        diagnostics.push({
          code: "RUNTIME_DECLARED_GLOBAL_UNOBSERVED",
          severity: "error",
          subject: declaredGlobal,
          detail: "The contract declares a project-owned global that runtime evidence did not observe.",
        });
      }
    }

    diagnostics.push(...compareCompactGuidance(definition.compactGuidance, evidence.compactGuidance));

    const checkedConstraintIds = new Set<string>();
    for (const capability of definition.capabilities) {
      for (const constraint of capability.constraints) {
        if (!constraint.expectedRuntimeFact || checkedConstraintIds.has(constraint.id)) continue;
        checkedConstraintIds.add(constraint.id);
        const observed = evidence.runtimeFacts[constraint.id];
        if (observed !== constraint.expectedRuntimeFact) {
          diagnostics.push({
            code: "REFERENCE_CONSTRAINT_STALE",
            severity: "warning",
            subject: constraint.id,
            detail: `Runtime remains authoritative: reference expects ${JSON.stringify(constraint.expectedRuntimeFact)}, evidence reports ${JSON.stringify(observed)}.`,
          });
        }
      }

      if (capability.discovery !== "none" && !evidence.skill.anchors.includes(capability.links.reference.anchor)) {
        diagnostics.push({
          code: "REFERENCE_ANCHOR_MISSING",
          severity: "warning",
          subject: capability.id,
          detail: `Missing workflow-authoring reference anchor #${capability.links.reference.anchor}.`,
        });
      }

      if (capability.dynamicReference) {
        const values = evidence.dynamicReferences[capability.dynamicReference.catalogue];
        if (!values) {
          diagnostics.push({
            code: "DYNAMIC_REFERENCE_DISCONNECTED",
            severity: "information",
            subject: capability.dynamicReference.catalogue,
            detail: `Future provider not connected; values remain owned by ${capability.dynamicReference.owner}.`,
          });
        }
      }
    }

    if (evidence.skill.extensionVersion !== definition.extensionVersion) {
      diagnostics.push({
        code: "SKILL_EXTENSION_VERSION_MISMATCH",
        severity: "warning",
        subject: "workflow-authoring",
        detail: `Contract describes ${definition.extensionVersion}; skill describes ${evidence.skill.extensionVersion}.`,
      });
    }

    return diagnostics;
  };

  return { definition, assembleRuntimeBindings, compactIndex, detailedReference, diagnose };
}
