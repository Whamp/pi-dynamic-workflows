export const meta = {
  name: "adversarial_verification",
  description: "Produce claims and verify them in separate skeptical contexts",
  phases: [{ title: "Produce" }, { title: "Verify" }],
};

// ADAPT: Replace topics and define a task-specific skeptical rubric.
const topics = Array.isArray(args?.topics) ? args.topics : [{ id: "claim-a", topic: "A sample technical claim" }];
const rubric = typeof args?.rubric === "string" ? args.rubric : "Evidence is direct, relevant, and sufficient";
const productionSchema = {
  type: "object",
  properties: {
    claim: { type: "string" },
    evidence: { type: "array", items: { type: "string" } },
  },
  required: ["claim", "evidence"],
};
const verdictSchema = {
  type: "object",
  properties: { upheld: { type: "boolean" }, reason: { type: "string" } },
  required: ["upheld", "reason"],
};

phase("Produce");
const produced = await parallel(
  topics.map((topic) => () =>
    agent(`Develop the claim and cite evidence for this topic: ${JSON.stringify(topic)}`, {
      label: `produce-${topic.id}`,
      schema: productionSchema,
    }),
  ),
);
const producerFailures = topics.flatMap((topic, index) => (produced[index] === null ? [topic.id] : []));
const reviewable = topics.flatMap((topic, index) =>
  produced[index] === null ? [] : [{ topic, production: produced[index] }],
);

phase("Verify");
// CONTRACT: Skeptics receive fresh contexts and a rubric rather than producer self-review.
const verdicts = await parallel(
  reviewable.map(({ topic, production }) => () =>
    agent(
      `Act as a skeptic. Try to refute this production under the rubric.\nRubric: ${rubric}\nProduction: ${JSON.stringify(production)}`,
      { label: `verify-${topic.id}`, schema: verdictSchema },
    ),
  ),
);
const verifierFailures = reviewable.flatMap(({ topic }, index) => (verdicts[index] === null ? [topic.id] : []));

return {
  upheld: reviewable.flatMap(({ topic, production }, index) =>
    verdicts[index]?.upheld ? [{ id: topic.id, production, verdict: verdicts[index] }] : [],
  ),
  rejected: reviewable.flatMap(({ topic }, index) =>
    verdicts[index] !== null && !verdicts[index].upheld ? [{ id: topic.id, verdict: verdicts[index] }] : [],
  ),
  failed: { producer: producerFailures, verifier: verifierFailures },
  complete: producerFailures.length === 0 && verifierFailures.length === 0,
};
