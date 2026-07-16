import { readdir, readFile } from "node:fs/promises";
import { parseWorkflowScript, runWorkflow } from "../../../../dist/index.js";

const skillUrl = new URL("../SKILL.md", import.meta.url);
const templatesUrl = new URL("../templates/", import.meta.url);
const packageUrl = new URL("../../../../package.json", import.meta.url);
const skillText = await readFile(skillUrl, "utf8");
const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));
const skillVersion = skillText.match(/package-version:\s*"([^"]+)"/)?.[1];
const description = skillText.match(/^description:\s*(.+)$/m)?.[1] ?? "";

if (skillVersion !== packageJson.version) {
  throw new Error(`Version mismatch: skill=${skillVersion ?? "missing"}, package=${packageJson.version}`);
}
for (const trigger of ["writing", "editing", "reviewing", "debugging"]) {
  if (!description.includes(trigger)) throw new Error(`Skill description is missing the ${trigger} trigger`);
}
if (/\b(running|executing)\b/i.test(description)) {
  throw new Error("Skill description should not trigger merely for running an existing workflow");
}
const skillLines = skillText.trimEnd().split("\n").length;
if (skillLines > 60) throw new Error(`SKILL.md is not short enough: ${skillLines} lines`);
const linkTargets = [...skillText.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]);
for (const target of linkTargets) await readFile(new URL(target, skillUrl), "utf8");

function fakeStructuredValue(label) {
  if (label.startsWith("classify-")) return { category: "direct", reason: "fixture route" };
  if (label.startsWith("act-")) return { outcome: "fixture handled" };
  if (label.startsWith("gather-") || label.startsWith("explore-")) {
    return { finding: `fixture finding for ${label}`, evidence: ["fixture evidence"] };
  }
  if (label.includes("synthesize")) return { summary: "fixture synthesis", disagreements: [] };
  if (label.startsWith("produce-")) return { claim: "fixture claim", evidence: ["fixture evidence"] };
  if (label.startsWith("verify-")) return { upheld: true, reason: "fixture upheld" };
  if (label.startsWith("generate-batch-")) return { candidates: [`candidate-${label}`] };
  if (label.startsWith("filter-candidate-")) return { keep: true, reason: "fixture kept" };
  if (label.startsWith("contender-")) return { candidate: label, rationale: "fixture contender" };
  if (label.startsWith("judge-round-")) return { winnerIndex: 0, reason: "fixture comparison" };
  if (label === "discover-round-1") return { findings: [{ id: "finding-1", detail: "fixture finding" }] };
  if (label.startsWith("discover-round-")) return { findings: [] };
  if (label === "frame-child-input") return { brief: "fixture brief" };
  if (label === "nested-child-agent") return { summary: "fixture child result" };
  if (label === "work-attempt-1") return null;
  if (label.startsWith("work-attempt-")) return { value: "fixture recovered value" };
  if (label === "analyze-structured-input") return { summary: "fixture analysis", risks: [], complete: true };
  return { result: `fixture result for ${label}` };
}

const fakeAgent = {
  async run(_prompt, options) {
    if (options.schema) return fakeStructuredValue(options.label);
    return `fixture result for ${options.label}`;
  },
};

const childFixture = `export const meta = { name: "prototype_child", description: "Validation-only saved child" };
const result = await agent("Run the validation child", {
  label: "nested-child-agent",
  schema: {
    type: "object",
    properties: { summary: { type: "string" } },
    required: ["summary"],
  },
});
return result;`;

const templateNames = (await readdir(templatesUrl)).filter((name) => name.endsWith(".workflow.js")).sort();
if (templateNames.length !== 10) throw new Error(`Expected 10 templates, found ${templateNames.length}`);

const checks = [];
for (const templateName of templateNames) {
  const source = await readFile(new URL(templateName, templatesUrl), "utf8");
  if (!source.includes("// ADAPT:")) throw new Error(`${templateName} has no ADAPT marker`);
  if (!source.includes("// CONTRACT:")) throw new Error(`${templateName} has no CONTRACT marker`);
  parseWorkflowScript(source);

  const labels = [];
  const execution = await runWorkflow(source, {
    agent: fakeAgent,
    concurrency: 4,
    maxAgents: 100,
    tokenBudget: 100_000,
    persistLogs: false,
    loadSavedWorkflow(name) {
      return name === "prototype-child" ? childFixture : undefined;
    },
    onAgentStart(event) {
      labels.push(event.label);
    },
  });
  if (execution.agentCount < 1) throw new Error(`${templateName} exercised no agents`);
  if (new Set(labels).size !== labels.length) throw new Error(`${templateName} emitted duplicate labels`);
  if (JSON.stringify(execution.result) === undefined) throw new Error(`${templateName} returned no JSON value`);
  checks.push(`${templateName}: parsed, exercised ${execution.agentCount} agent call(s), serialized`);
}

console.log(`workflow-authoring prototype version parity: ${skillVersion}`);
console.log(`PASS invocation triggers and ${skillLines}-line SKILL.md`);
console.log(`PASS ${linkTargets.length} progressively disclosed SKILL links`);
for (const check of checks) console.log(`PASS ${check}`);
console.log(`PASS ${checks.length} adaptable templates`);
