export const meta = {
  name: "phased_budgets",
  description: "Bound exploration and synthesis with separate soft phase budgets",
  phases: [{ title: "Explore" }, { title: "Synthesize" }],
};

// ADAPT: Set phase budgets from the task's total budget and expected value per phase.
const exploreBudget = typeof args?.exploreBudget === "number" ? args.exploreBudget : 4000;
const synthesizeBudget = typeof args?.synthesizeBudget === "number" ? args.synthesizeBudget : 2000;
const topics = Array.isArray(args?.topics) ? args.topics : [{ id: "sample", topic: "Inspect the sample" }];
const findingSchema = {
  type: "object",
  properties: { finding: { type: "string" } },
  required: ["finding"],
};
const summarySchema = {
  type: "object",
  properties: { summary: { type: "string" } },
  required: ["summary"],
};

phase("Explore", { budget: exploreBudget });
const explored = await parallel(
  topics.map((topic) => () =>
    agent(`Explore this topic within the phase budget: ${JSON.stringify(topic)}`, {
      label: `explore-${topic.id}`,
      schema: findingSchema,
    }),
  ),
);
const failedExplore = topics.flatMap((topic, index) => (explored[index] === null ? [topic.id] : []));

phase("Synthesize", { budget: synthesizeBudget });
const summary = await agent(
  `Synthesize available findings and state missing topic identities.\nFindings: ${JSON.stringify(explored)}\nMissing: ${JSON.stringify(failedExplore)}`,
  { label: "synthesize-budgeted", schema: summarySchema },
);
const remaining = budget.remaining();

// CONTRACT: Phase budgets are soft pre-call gates; report observed accounting rather than claiming a hard cap.
return {
  summary,
  failed: summary === null ? [...failedExplore, "synthesis"] : failedExplore,
  accounting: {
    total: budget.total,
    spent: budget.spent(),
    remaining: Number.isFinite(remaining) ? remaining : null,
  },
  complete: failedExplore.length === 0 && summary !== null,
};
