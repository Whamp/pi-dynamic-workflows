export const meta = {
  name: "structured_output",
  description: "Use a plain JSON Schema when JavaScript consumes an agent result",
  phases: [{ title: "Analyze" }],
};

// ADAPT: Make the schema the smallest exact contract downstream JavaScript needs.
const input = args?.input ?? { task: "Analyze the sample" };
const analysisSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    risks: { type: "array", items: { type: "string" } },
    complete: { type: "boolean" },
  },
  required: ["summary", "risks", "complete"],
};

phase("Analyze");
const analysis = await agent(`Analyze this input against its stated task: ${JSON.stringify(input)}`, {
  label: "analyze-structured-input",
  schema: analysisSchema,
});
if (analysis === null) {
  return { analysis: null, failed: ["analysis"], complete: false };
}

// CONTRACT: Every field dereferenced below is required by the schema.
return {
  analysis: { summary: analysis.summary, risks: analysis.risks },
  failed: [],
  complete: analysis.complete,
};
