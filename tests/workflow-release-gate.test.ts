import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import packageJson from "../package.json" with { type: "json" };
import { WORKFLOW_AUTHORING_COVERAGE } from "../src/workflow-authoring-coverage.js";
import { WORKFLOW_CAPABILITY_DEFINITION } from "../src/workflow-capability-contract.js";
import { checkWorkflowRelease, parseNpmPackFilePaths } from "../src/workflow-release-gate.js";

const ROOT = new URL("..", import.meta.url).pathname;

function publishableFiles(): string[] {
  const output = execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: ROOT, encoding: "utf8" });
  return parseNpmPackFilePaths(output);
}

test("npm pack parsing keeps only valid publishable file paths", () => {
  assert.deepEqual(parseNpmPackFilePaths(JSON.stringify([{ files: [{ path: "README.md" }, {}, { path: 42 }] }])), [
    "README.md",
  ]);
  assert.deepEqual(parseNpmPackFilePaths(JSON.stringify({ files: [] })), []);
});

test("normal tests and publishing share the model-free release gate", () => {
  assert.match(packageJson.scripts.test, /release:check/);
  assert.match(packageJson.scripts.prepublishOnly, /release:check/);
  assert.match(packageJson.scripts["release:check"], /docs:check/);
  assert.match(packageJson.scripts["release:check"], /context:check/);
  assert.match(packageJson.scripts["release:check"], /test:unit/);
  assert.match(packageJson.scripts["release:check"], /release:verify/);
  assert.doesNotMatch(packageJson.scripts["release:check"], /model|provider|comprehension/i);
});

test("release gate accepts the aligned contract, package, documentation, and measurements", () => {
  const diagnostics = checkWorkflowRelease({ root: ROOT, publishableFiles: publishableFiles() });

  assert.deepEqual(diagnostics, []);
});

test("release gate blocks runtime constraint disagreements", () => {
  const definition = structuredClone(WORKFLOW_CAPABILITY_DEFINITION);
  const tokenBudgetIndex = definition.capabilities.findIndex(({ label }) => label === "tokenBudget");
  const tokenBudget = definition.capabilities[tokenBudgetIndex];
  assert.ok(tokenBudget);
  definition.capabilities[tokenBudgetIndex] = {
    ...tokenBudget,
    constraints: ["hard total-token budget with no overshoot"],
  };

  const diagnostics = checkWorkflowRelease({ root: ROOT, definition, publishableFiles: publishableFiles() });

  assert.ok(
    diagnostics.some(
      ({ code, severity, subject }) =>
        code === "RUNTIME_CONSTRAINT_DISAGREEMENT" && severity === "error" && subject === "tokenBudget",
    ),
  );
});

test("release gate names incompatible versions and missing behavior evidence", () => {
  const definition = structuredClone(WORKFLOW_CAPABILITY_DEFINITION);
  definition.versions.content.version = "0.0.0";
  definition.capabilities[0] = { ...definition.capabilities[0], behaviorEvidence: [] };

  const diagnostics = checkWorkflowRelease({
    root: ROOT,
    definition,
    extensionVersion: packageJson.version,
    skillVersion: "9.0.0",
    publishableFiles: publishableFiles(),
  });

  assert.ok(
    diagnostics.some(
      ({ code, subject, message }) =>
        code === "INCOMPATIBLE_VERSION" && subject === "contract content" && message.includes(packageJson.version),
    ),
  );
  assert.ok(diagnostics.some(({ code, subject }) => code === "INCOMPATIBLE_VERSION" && subject === "installed skill"));
  assert.ok(
    diagnostics.some(
      ({ code, subject }) => code === "MISSING_BEHAVIOR_EVIDENCE" && subject === "workflow.runtime.agent",
    ),
  );
});

test("release gate requires auditable coverage for every stable authoring surface", () => {
  const diagnostics = checkWorkflowRelease({
    root: ROOT,
    publishableFiles: publishableFiles(),
    authoringCoverage: [],
  });

  assert.ok(
    diagnostics.some(
      ({ code, severity, subject }) =>
        code === "MISSING_AUTHORING_COVERAGE" && severity === "error" && subject === "workflow.runtime.agent",
    ),
  );
  assert.ok(
    diagnostics.some(
      ({ code, subject }) => code === "MISSING_AUTHORING_COVERAGE" && subject === "workflow.pattern.tournament",
    ),
  );
});

test("release gate blocks drift in guidance frozen outside provider-backed comprehension", () => {
  const patternPath = "skills/workflow-authoring/references/pattern-selection.md";
  const patternSelection = readFileSync(new URL(`../${patternPath}`, import.meta.url), "utf8");
  const withoutTournament = patternSelection.replace(
    "| Pairwise comparison beats absolute scoring | Tournament | Let JavaScript run the bounded bracket and byes; agents compare one pair; ledger match failures | [Adapt](../examples/tournament.js) |",
    "",
  );
  assert.notEqual(withoutTournament, patternSelection);

  const diagnostics = checkWorkflowRelease({
    root: ROOT,
    publishableFiles: publishableFiles(),
    guidanceOverrides: { [patternPath]: withoutTournament },
  });

  assert.ok(
    diagnostics.some(
      ({ code, severity, subject }) =>
        code === "PROTECTED_GUIDANCE_DRIFT" && severity === "error" && subject === "workflow.pattern.tournament",
    ),
  );
});

test("release gate freezes mixed guidance files against contradictory additions during autoresearch", () => {
  const patternPath = "skills/workflow-authoring/references/pattern-selection.md";
  const patternSelection = readFileSync(new URL(`../${patternPath}`, import.meta.url), "utf8");
  const contradictory = `${patternSelection}\nTournament workflows should skip brackets and compare every candidate at once.\n`;

  const diagnostics = checkWorkflowRelease({
    root: ROOT,
    publishableFiles: publishableFiles(),
    guidanceOverrides: { [patternPath]: contradictory },
  });

  assert.ok(diagnostics.some(({ code, subject }) => code === "PROTECTED_GUIDANCE_DRIFT" && subject === patternPath));
});

test("release gate blocks deletion of routing to guidance-frozen capabilities", () => {
  const skillPath = "skills/workflow-authoring/SKILL.md";
  const skill = readFileSync(new URL(`../${skillPath}`, import.meta.url), "utf8");
  const withoutPatternRoute = skill.replace(
    "- **Write or edit:** start with [runtime](references/runtime.md). Add [pattern selection](references/pattern-selection.md) for topology, [lifecycle](references/lifecycle.md) for limits or resume, and [focused recipes](references/focused-recipes.md) for the matching concern.",
    "",
  );
  assert.notEqual(withoutPatternRoute, skill);

  const diagnostics = checkWorkflowRelease({
    root: ROOT,
    publishableFiles: publishableFiles(),
    guidanceOverrides: { [skillPath]: withoutPatternRoute },
  });

  assert.ok(
    diagnostics.some(
      ({ code, subject }) => code === "PROTECTED_GUIDANCE_DRIFT" && subject === "workflow.pattern.tournament",
    ),
  );
});

test("release gate rejects unprotected guidance and invented comprehension coverage", () => {
  const authoringCoverage = structuredClone(WORKFLOW_AUTHORING_COVERAGE);
  const tournament = authoringCoverage.find(({ id }) => id === "workflow.pattern.tournament");
  const judgePanel = authoringCoverage.find(({ id }) => id === "workflow.runtime.judgePanel");
  assert.ok(tournament);
  assert.ok(judgePanel);
  tournament.protectedGuidance = [];
  judgePanel.comprehensionScenarios = ["not-a-real-scenario"];

  const diagnostics = checkWorkflowRelease({
    root: ROOT,
    publishableFiles: publishableFiles(),
    authoringCoverage,
  });

  assert.ok(
    diagnostics.some(({ code, subject }) => code === "UNPROTECTED_AUTHORING_GUIDANCE" && subject === tournament.id),
  );
  assert.ok(
    diagnostics.some(({ code, subject }) => code === "UNKNOWN_COMPREHENSION_SCENARIO" && subject === judgePanel.id),
  );
});

test("release gate names omitted package resources and stale generated surfaces", () => {
  const files = publishableFiles().filter((path) => path !== "skills/workflow-authoring/examples/tournament.js");
  const diagnostics = checkWorkflowRelease({
    root: ROOT,
    publishableFiles: files,
    publicationOverrides: { "README.md": "stale" },
    contextMeasurement: "stale",
    guidanceBaseline: "stale",
  });

  assert.ok(
    diagnostics.some(
      ({ code, subject }) =>
        code === "MISSING_PACKAGE_RESOURCE" && subject === "skills/workflow-authoring/examples/tournament.js",
    ),
  );
  assert.ok(diagnostics.some(({ code, subject }) => code === "STALE_GENERATED_SURFACE" && subject === "README.md"));
  assert.ok(
    diagnostics.some(
      ({ code, subject }) => code === "STALE_GENERATED_SURFACE" && subject === "docs/workflow-context-surfaces.json",
    ),
  );
  assert.ok(
    diagnostics.some(
      ({ code, severity, subject }) =>
        code === "NON_CONTRACTUAL_PROSE_DRIFT" &&
        severity === "warning" &&
        subject === "docs/workflow-guidance-baseline.json",
    ),
  );
});

test("release gate reports unresolved behavior and reference paths precisely", () => {
  const definition = structuredClone(WORKFLOW_CAPABILITY_DEFINITION);
  definition.capabilities[0] = {
    ...definition.capabilities[0],
    behaviorEvidence: ["tests/does-not-exist.test.ts"],
    staticReference: { path: "skills/workflow-authoring/references/capabilities.md", anchor: "does-not-exist" },
  };

  const diagnostics = checkWorkflowRelease({ root: ROOT, definition, publishableFiles: publishableFiles() });

  assert.ok(
    diagnostics.some(
      ({ code, subject }) => code === "UNRESOLVED_BEHAVIOR_EVIDENCE" && subject === "tests/does-not-exist.test.ts",
    ),
  );
  assert.ok(
    diagnostics.some(
      ({ code, subject }) =>
        code === "BROKEN_CONTRACT_REFERENCE" &&
        subject === "skills/workflow-authoring/references/capabilities.md#does-not-exist",
    ),
  );
});
