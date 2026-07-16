export const meta = {
  name: "generate_and_filter",
  description: "Generate divergent candidates, deduplicate them, then filter by a rubric",
  phases: [{ title: "Generate" }, { title: "Filter" }],
};

// ADAPT: Replace topic, batch count, and rubric. Keep deterministic deduplication before filtering.
const topic = typeof args?.topic === "string" ? args.topic : "A name for a command-line tool";
const batchCount = Number.isInteger(args?.batches) ? Math.max(1, Math.min(args.batches, 8)) : 3;
const rubric = typeof args?.rubric === "string" ? args.rubric : "Distinct, concise, and fit for the stated topic";
const generationSchema = {
  type: "object",
  properties: { candidates: { type: "array", items: { type: "string" } } },
  required: ["candidates"],
};
const filterSchema = {
  type: "object",
  properties: { keep: { type: "boolean" }, reason: { type: "string" } },
  required: ["keep", "reason"],
};

phase("Generate");
const batches = await parallel(
  Array.from({ length: batchCount }, (_, index) => () =>
    agent(`Generate three divergent candidates for ${topic}. Batch ${index + 1} must seek a distinct angle.`, {
      label: `generate-batch-${index + 1}`,
      schema: generationSchema,
    }),
  ),
);
const failedBatches = batches.flatMap((batch, index) => (batch === null ? [index + 1] : []));
// CONTRACT: Deduplicate exact normalized candidates before spending filter calls.
const seen = new Set();
const candidates = [];
for (const batch of batches) {
  for (const candidate of batch?.candidates ?? []) {
    const key = candidate.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      candidates.push(candidate);
    }
  }
}

phase("Filter");
const verdicts = await parallel(
  candidates.map((candidate, index) => () =>
    agent(`Apply this rubric: ${rubric}\nCandidate: ${candidate}`, {
      label: `filter-candidate-${index + 1}`,
      schema: filterSchema,
    }),
  ),
);
const failedFilters = candidates.flatMap((candidate, index) => (verdicts[index] === null ? [candidate] : []));

return {
  survivors: candidates.filter((_, index) => verdicts[index]?.keep),
  rejected: candidates.filter((_, index) => verdicts[index] !== null && !verdicts[index].keep),
  failed: { batches: failedBatches, filters: failedFilters },
  complete: failedBatches.length === 0 && failedFilters.length === 0,
};
