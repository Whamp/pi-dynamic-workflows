export const AUTHORING_TASKS = Object.freeze({
  write: {
    label: "Write workflow code",
    files: [
      "workflow-authoring/SKILL.md",
      "workflow-authoring/references/runtime-contract.md",
      "workflow-authoring/references/patterns.md",
    ],
  },
  edit: {
    label: "Edit workflow code",
    files: [
      "workflow-authoring/SKILL.md",
      "workflow-authoring/references/runtime-contract.md",
      "workflow-authoring/references/helper-contracts.md",
    ],
  },
  review: {
    label: "Review workflow code",
    files: [
      "workflow-authoring/SKILL.md",
      "workflow-authoring/references/review-debug.md",
      "workflow-authoring/references/runtime-contract.md",
    ],
  },
  debug: {
    label: "Debug a workflow run",
    files: [
      "workflow-authoring/SKILL.md",
      "workflow-authoring/references/review-debug.md",
      "workflow-authoring/references/runtime-contract.md",
      "workflow-authoring/references/helper-contracts.md",
      "workflow-authoring/references/lifecycle-controls.md",
    ],
  },
});

export const TEMPLATES = Object.freeze([
  "classify-and-act.workflow.js",
  "fan-out-and-synthesize.workflow.js",
  "adversarial-verification.workflow.js",
  "generate-and-filter.workflow.js",
  "tournament.workflow.js",
  "loop-until-done.workflow.js",
  "phased-budgets.workflow.js",
  "saved-nested-workflow.workflow.js",
  "retry-graceful-failure.workflow.js",
  "structured-output.workflow.js",
]);

export function createPrototypeState() {
  return {
    authoringTask: null,
    disclosedFiles: [],
    selectedTemplate: null,
    lastAction: "Prototype initialized; choose an authoring task.",
    compactBaseline: "preserved",
    registryBoundary: "exact static facts are marked; live catalogue values remain external",
    extensionVersion: "2.13.1",
  };
}

export function reducePrototypeState(state, action) {
  if (action.type === "select-task") {
    const definition = AUTHORING_TASKS[action.task];
    if (!definition) return { ...state, lastAction: `Unknown authoring task: ${action.task}` };
    return {
      ...state,
      authoringTask: action.task,
      disclosedFiles: [...definition.files],
      selectedTemplate: null,
      lastAction: `Selected ${definition.label}; disclosed only that branch.`,
    };
  }

  if (action.type === "select-template") {
    if (state.authoringTask === null) {
      return { ...state, lastAction: "Choose write, edit, review, or debug before loading a template." };
    }
    if (!TEMPLATES.includes(action.template)) {
      return { ...state, lastAction: `Unknown template: ${action.template}` };
    }
    const templatePath = `workflow-authoring/templates/${action.template}`;
    return {
      ...state,
      selectedTemplate: action.template,
      disclosedFiles: [...state.disclosedFiles.filter((file) => !file.includes("/templates/")), templatePath],
      lastAction: `Loaded adaptable scaffold ${action.template}.`,
    };
  }

  if (action.type === "reset") return createPrototypeState();
  return { ...state, lastAction: `Ignored action: ${action.type}` };
}
