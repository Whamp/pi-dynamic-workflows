import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { WorkflowManager } from "../src/workflow-manager.js";
import { backgroundStartedText, createWorkflowTool } from "../src/workflow-tool.js";

/** Minimal fake ModelRegistry, matching the shape used by workflow manager tests. */
function fakeRegistry(models: Array<{ provider: string; id: string }>) {
  return {
    getAvailable: () => models,
    find: () => undefined,
    getAll: () => models,
  } as any;
}

// ─── backgroundStartedText ─────────────────────────────────────────────────────

test("backgroundStartedText tells the user it auto-continues and they can wait", () => {
  const text = backgroundStartedText("audit", "abc-123");
  assert.match(text, /audit/);
  assert.match(text, /abc-123/);
  assert.match(text, /wait here/i);
  assert.match(text, /continues automatically|resume the conversation/i);
  assert.match(text, /other things/i);
  assert.match(text, /\/workflows status abc-123/);
});

// ─── createWorkflowTool ────────────────────────────────────────────────────────

test("createWorkflowTool has correct name and label", () => {
  const tool = createWorkflowTool();
  assert.equal(tool.name, "workflow");
  assert.equal(tool.label, "Workflow");
});

test("createWorkflowTool description states its delegation capability", () => {
  const description = createWorkflowTool().description;

  assert.match(description, /JavaScript workflow.*delegates work to subagents/i);
  assert.match(description, /agent\(\).*optionally composing calls.*parallel\(\).*pipeline\(\)/i);
  assert.doesNotMatch(description, /deterministic|required raw JavaScript|export const meta/i);
});

test("createWorkflowTool has parameters defined", () => {
  const tool = createWorkflowTool();
  assert.ok(tool.parameters, "should have parameters schema");
});

test("createWorkflowTool has execute function", () => {
  const tool = createWorkflowTool();
  assert.equal(typeof tool.execute, "function");
});

test("createWorkflowTool has renderCall and renderResult", () => {
  const tool = createWorkflowTool();
  assert.equal(typeof tool.renderCall, "function");
  assert.equal(typeof tool.renderResult, "function");
});

test("createWorkflowTool promptSnippet describes delegation and optional composition", () => {
  const snippet = createWorkflowTool().promptSnippet;

  assert.match(snippet, /delegate substantive .* work to subagents/i);
  assert.match(snippet, /optionally composing agent calls/i);
  assert.match(snippet, /parallel\(\)/);
  assert.match(snippet, /pipeline\(\)/);
  assert.match(snippet, /or both/i);
  assert.doesNotMatch(snippet, /required script header|export const meta/i);
});

test("createWorkflowTool keeps permanent workflow guidance focused", () => {
  const tool = createWorkflowTool();
  const descriptor = Object.getOwnPropertyDescriptor(tool, "promptGuidelines");

  assert.ok(Array.isArray(tool.promptGuidelines), "tool.promptGuidelines should be an array");
  assert.equal(descriptor?.get, undefined, "permanent guidance should not depend on a dynamic getter");
});

test("createWorkflowTool permanent guidance covers the authoring contract", () => {
  const all = createWorkflowTool().promptGuidelines.join(" ");

  assert.match(all, /explicit workflow intent/i);
  assert.match(all, /request for a workflow.*subagent delegation.*fan-out.*multi-agent orchestration/i);
  assert.match(all, /enabled mode.*requires workflow/i);
  assert.match(all, /ordinary tools.*work you can perform directly/i);
  assert.match(all, /work unit.*natural task boundary/i);
  assert.match(all, /comfortably.*one context window/i);
  assert.match(all, /split larger work.*natural boundar/i);
  assert.match(all, /agent prompt.*self-contained/i);
  assert.match(all, /compose parallel\(\) and pipeline\(\).*both shapes/i);
  assert.match(all, /parallel\(\).*independent work.*between stages.*all prior results/i);
  assert.match(all, /pipeline\(\).*each item.*stages independently/i);
  assert.match(all, /verification.*materially benefit.*cross-checking/i);
  assert.match(all, /final synthesis agent.*comparison or prose/i);
  assert.match(all, /explicitly `return`.*JSON-serializable/i);
  assert.match(all, /`null`.*missing coverage.*not a negative finding/i);
  assert.match(all, /failed work-unit identities.*before filtering/i);
  assert.match(all, /coverage.*remains incomplete/i);
  assert.match(all, /agent\(\) invocation.*short, unique `label`.*identifies its work unit/i);
  assert.match(all, /`tier`.*configured model route/i);
  assert.match(all, /standard routes.*`small`.*`medium`.*`big`/i);
  assert.match(all, /user-configured route only when.*name and purpose.*provided in context/i);
  assert.match(all, /use `model` instead of `tier` only to honor.*exact model.*user/i);
  assert.match(
    all,
    /when an agent must return structured data.*plain JSON Schema.*`schema` option.*on success.*agent\(\).*validated object/i,
  );
});

test("createWorkflowTool permanent guidance omits conditional catalogs and recipes", () => {
  const all = createWorkflowTool().promptGuidelines.join(" ");

  assert.doesNotMatch(all, /Available agentTypes:/i);
  assert.doesNotMatch(all, /currently available models/i);
  assert.doesNotMatch(all, /verify\(|judgePanel\(|loopUntilDry\(|completenessCheck\(/i);
  assert.doesNotMatch(all, /tokenBudget|agentTimeoutMs|agentRetries/i);
});

test("createWorkflowTool keeps script syntax in the parameter schema", () => {
  const tool = createWorkflowTool();
  const parameters = tool.parameters as { properties?: Record<string, { description?: string }> };
  const description = parameters.properties?.script?.description ?? "";

  assert.match(description, /raw JavaScript workflow script.*no Markdown fences/i);
  assert.match(description, /First statement: export const meta = \{ name:.*description:.*\}\. Add phases:/i);
  assert.doesNotMatch(
    description,
    /First statement: export const meta = \{ name: '[^']+', description: '[^']+', phases:/i,
  );
  assert.match(description, /phases.*only when.*named phases.*declare only phases it will use/i);
  assert.match(description, /multiple phases.*phase\('Exact Title'\).*agent options/i);
  assert.match(description, /await workflow\(savedName, childArgs\).*saved workflow inline/i);
  assert.match(description, /nesting.*one level.*parent run's concurrency, agent, and token limits/i);
  assert.match(
    description,
    /Optional quality helpers include verify\(\), judgePanel\(\), loopUntilDry\(\), and completenessCheck\(\)/i,
  );
  assert.match(description, /Optional control helpers include retry\(\) and gate\(\)/i);
  assert.match(description, /budget exposes total, spent\(\), and remaining\(\)/i);
  assert.match(description, /phase\('Name', \{ budget: N \}\).*phase token limit/i);
  assert.match(description, /optional `agentType` option.*named user or project definition/i);
  assert.match(description, /bind tools, a model, and role instructions/i);
  assert.match(description, /name and purpose.*provided in context/i);
  assert.match(description, /bound model overrides `tier`.*explicit `model` overrides both/i);
  assert.match(description, /plain JavaScript only.*imports.*require\(\).*filesystem modules/i);
  assert.match(description, /Date\.now\(\).*Math\.random\(\).*new Date\(\).*unavailable/i);
  assert.match(description, /args, cwd, process\.cwd\(\), and budget/i);
  assert.match(description, /must call agent\(\) at least once/i);
  assert.match(description, /parallel\(\) requires functions, not promises.*results in input order/i);
  assert.match(description, /pipeline\(items, \.\.\.stages\).*stages sequentially.*items proceed concurrently/i);
  assert.match(description, /each stage receives.*previousValue.*originalItem.*index/i);

  const guidance = tool.promptGuidelines.join(" ");
  assert.doesNotMatch(guidance, /Markdown fences|First statement: export const meta/i);
  assert.doesNotMatch(guidance, /Date\.now\(\)|Math\.random\(\)|new Date\(\)/i);
  assert.doesNotMatch(guidance, /parallel\(\) requires functions, not promises|results in input order/i);
  assert.doesNotMatch(guidance, /each stage receives.*previousValue.*originalItem.*index/i);
});

test("createWorkflowTool keeps background behavior in the parameter schema", () => {
  const tool = createWorkflowTool();
  const parameters = tool.parameters as { properties?: Record<string, { description?: string }> };
  const description = parameters.properties?.background?.description ?? "";

  assert.match(description, /Default: true/i);
  assert.match(description, /result is delivered back.*when it finishes/i);
  assert.match(description, /false only when.*result inline.*same turn/i);
  assert.doesNotMatch(tool.promptGuidelines.join(" "), /runs are background by default/i);
});

test("createWorkflowTool schema describes unbounded default timeout", () => {
  const tool = createWorkflowTool();
  const parameters = tool.parameters as { properties?: Record<string, { description?: string }> };
  const description = parameters.properties?.agentTimeoutMs?.description ?? "";
  assert.match(description, /Omit for no hard timeout/i);
  assert.match(description, /only when the user asks/i);
});

test("createWorkflowTool schema exposes resource controls and large-fan-out authority", () => {
  const tool = createWorkflowTool();
  const parameters = tool.parameters as { properties?: Record<string, { description?: string }> };

  assert.match(parameters.properties?.concurrency?.description ?? "", /Maximum concurrent agents/i);
  assert.match(parameters.properties?.agentRetries?.description ?? "", /Retry attempts/i);
  assert.match(parameters.properties?.maxAgents?.description ?? "", /1000.*safety ceiling, not a target/i);
  assert.match(parameters.properties?.maxAgents?.description ?? "", /lower limit.*dynamic or exploratory fan-out/i);
  assert.match(parameters.properties?.maxAgents?.description ?? "", /large fan-outs.*explicit user intent/i);
});

test("createWorkflowTool invalid args throws descriptive error", () => {
  const tool = createWorkflowTool();
  if (tool.prepareArguments) {
    const prepare = tool.prepareArguments as (args: unknown) => unknown;
    assert.throws(() => prepare({ script: 123 }), /script.*string/);
    assert.throws(() => prepare("not-an-object"), /object argument/);
  }
});

test("createWorkflowTool with custom cwd creates tool", () => {
  const tool = createWorkflowTool({ cwd: "/tmp" });
  assert.equal(tool.name, "workflow");
});

test("foreground workflow tool reports a missing script result as failure", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-dw-tool-"));
  try {
    const manager = new WorkflowManager({
      cwd,
      agent: {
        async run() {
          return "ok";
        },
      },
    });
    manager.on("error", () => {});
    const tool = createWorkflowTool({ cwd, manager });
    assert.ok(tool.execute);

    await assert.rejects(
      tool.execute(
        "missing-result-call",
        {
          script: `export const meta = { name: 'missing_result', description: 'missing result' }
await agent('work', { label: 'worker' })`,
          background: false,
        },
        new AbortController().signal,
        () => {},
        undefined,
      ),
      /Workflow completed without returning a result\. Explicitly return a JSON-serializable value\./,
    );

    assert.equal(manager.listRuns()[0]?.status, "failed");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("createWorkflowTool does not add configured model IDs to permanent guidance", () => {
  const manager = new WorkflowManager({ cwd: "/tmp" });
  manager.setModelRegistry(fakeRegistry([{ provider: "router", id: "private-model" }]));
  const tool = createWorkflowTool({ cwd: "/tmp", manager });

  assert.doesNotMatch(tool.promptGuidelines.join(" "), /router\/private-model/);

  manager.setModelRegistry(fakeRegistry([{ provider: "router", id: "later-private-model" }]));
  assert.doesNotMatch(tool.promptGuidelines.join(" "), /router\/later-private-model/);
});

// ─── prepareArguments / normalizeWorkflowScript ─────────────────────────────────

test("createWorkflowTool prepareArguments strips markdown fences from script", () => {
  const tool = createWorkflowTool();
  if (tool.prepareArguments) {
    const prepare = tool.prepareArguments as (args: unknown) => { script: string };
    const result = prepare({
      script: "```js\nconst x = 1\n```",
    });
    assert.equal(result.script, "const x = 1");
  }
});

test("createWorkflowTool prepareArguments strips javascript fences", () => {
  const tool = createWorkflowTool();
  if (tool.prepareArguments) {
    const prepare = tool.prepareArguments as (args: unknown) => { script: string };
    const result = prepare({
      script: "```\nexport const meta = { name: 't', description: 't' }\n```",
    });
    assert.equal(result.script, "export const meta = { name: 't', description: 't' }");
  }
});

test("createWorkflowTool prepareArguments passes through args", () => {
  const tool = createWorkflowTool();
  if (tool.prepareArguments) {
    const prepare = tool.prepareArguments as (args: unknown) => {
      script: string;
      args?: unknown;
      maxAgents?: number;
      concurrency?: number;
      agentRetries?: number;
    };
    const result = prepare({
      script: "export const meta = { name: 't', description: 't' }",
      args: { question: "test" },
      maxAgents: 5,
      concurrency: 2,
      agentRetries: 1,
    });
    assert.equal(result.script, "export const meta = { name: 't', description: 't' }");
    assert.deepEqual(result.args, { question: "test" });
    assert.equal(result.maxAgents, 5);
    assert.equal(result.concurrency, 2);
    assert.equal(result.agentRetries, 1);
  }
});
