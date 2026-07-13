import { writeFile } from "node:fs/promises";
import { runWorkflow } from "../../src/index.js";

const script = `export const meta = { name: 'schema_integration', description: 'One real subagent proves the generated workflow path reaches a model', phases: [{ title: 'Check' }] }
const result = await agent('Determine whether 17 is prime. Return only the requested structured result.', {
  label: 'real prime check',
  model: 'openai-codex/gpt-5.4-mini:low',
  schema: {
    type: 'object',
    properties: {
      prime: { type: 'boolean' },
      evidence: { type: 'string' }
    },
    required: ['prime', 'evidence'],
    additionalProperties: false
  }
})
return result`;

const result = await runWorkflow(script, {
  concurrency: 1,
  maxAgents: 1,
  persistLogs: false,
});

await writeFile(
  new URL("./real-integration-result.json", import.meta.url),
  `${JSON.stringify({ script, result }, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify(result.result));
