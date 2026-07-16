export const meta = {
  name: "fan_out_and_synthesize",
  description: "Run independent work units, then cross a whole-set synthesis barrier",
  phases: [{ title: "Gather" }, { title: "Synthesize" }],
};

// ADAPT: Replace work units, the per-unit prompt, and the synthesis contract.
const work = Array.isArray(args?.work)
  ? args.work
  : [
      { id: "alpha", task: "Inspect alpha" },
      { id: "beta", task: "Inspect beta" },
    ];
const findingSchema = {
  type: "object",
  properties: { finding: { type: "string" }, evidence: { type: "array", items: { type: "string" } } },
  required: ["finding", "evidence"],
};
const synthesisSchema = {
  type: "object",
  properties: { summary: { type: "string" }, disagreements: { type: "array", items: { type: "string" } } },
  required: ["summary", "disagreements"],
};

phase("Gather");
const gathered = await parallel(
  work.map((unit) => () =>
    agent(`Complete this independent work unit with evidence: ${JSON.stringify(unit)}`, {
      label: `gather-${unit.id}`,
      schema: findingSchema,
    }),
  ),
);
const failed = work.flatMap((unit, index) => (gathered[index] === null ? [unit.id] : []));
const completed = work.flatMap((unit, index) =>
  gathered[index] === null ? [] : [{ id: unit.id, result: gathered[index] }],
);

phase("Synthesize");
// CONTRACT: This call is a barrier because it starts after the full indexed result set exists.
const synthesis = await agent(
  `Synthesize completed work, deduplicate overlap, and name disagreements. Missing identities are coverage gaps.\n\nCompleted: ${JSON.stringify(completed)}\nMissing: ${JSON.stringify(failed)}`,
  { label: "synthesize-whole-set", schema: synthesisSchema },
);

return {
  synthesis,
  completed,
  failed: synthesis === null ? [...failed, "synthesis"] : failed,
  complete: failed.length === 0 && synthesis !== null,
};
