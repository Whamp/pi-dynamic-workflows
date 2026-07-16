export const meta = {
  name: "loop_until_done",
  description: "Discover unknown-cardinality findings until repeated rounds are dry",
  phases: [{ title: "Discover" }],
};

// ADAPT: Replace the discovery target, finding schema, stable key, and bounds.
const target = typeof args?.target === "string" ? args.target : "recurring root causes";
const maxRounds = Number.isInteger(args?.maxRounds) ? Math.max(1, Math.min(args.maxRounds, 20)) : 6;
const roundSchema = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, detail: { type: "string" } },
        required: ["id", "detail"],
      },
    },
  },
  required: ["findings"],
};
const failedRounds = [];
const findingsSoFar = [];

phase("Discover");
const findings = await loopUntilDry({
  round: async (roundIndex) => {
    const response = await agent(
      `Find new ${target}. Return only findings not represented by these stable IDs: ${JSON.stringify(
        findingsSoFar.map((item) => item.id),
      )}`,
      { label: `discover-round-${roundIndex + 1}`, schema: roundSchema },
    );
    if (response === null) {
      failedRounds.push(roundIndex + 1);
      return [];
    }
    findingsSoFar.push(...response.findings);
    return response.findings;
  },
  key: (item) => item.id,
  consecutiveEmpty: 2,
  maxRounds,
});

// CONTRACT: Two dry rounds and maxRounds bound unknown cardinality.
return { findings, failedRounds, complete: failedRounds.length === 0 };
