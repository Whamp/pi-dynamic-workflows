export const meta = {
  name: "pairwise_tournament",
  description: "Generate competing attempts and choose a winner through pairwise comparisons",
  phases: [{ title: "Compete" }, { title: "Judge" }],
};

// ADAPT: Replace task, contender count, and pairwise rubric.
const task = typeof args?.task === "string" ? args.task : "Propose a concise CLI name";
const contenderCount = Number.isInteger(args?.contenders) ? Math.max(2, Math.min(args.contenders, 8)) : 4;
const rubric = typeof args?.rubric === "string" ? args.rubric : "Prefer the more memorable and task-appropriate candidate";
const contenderSchema = {
  type: "object",
  properties: { candidate: { type: "string" }, rationale: { type: "string" } },
  required: ["candidate", "rationale"],
};
const judgeSchema = {
  type: "object",
  properties: { winnerIndex: { type: "integer", enum: [0, 1] }, reason: { type: "string" } },
  required: ["winnerIndex", "reason"],
};

phase("Compete");
const attempts = await parallel(
  Array.from({ length: contenderCount }, (_, index) => () =>
    agent(`${task}\nAttempt a distinct approach as contender ${index + 1}.`, {
      label: `contender-${index + 1}`,
      schema: contenderSchema,
    }),
  ),
);
const failedContenders = attempts.flatMap((attempt, index) => (attempt === null ? [index + 1] : []));
let round = attempts.flatMap((attempt, index) =>
  attempt === null ? [] : [{ id: `contender-${index + 1}`, attempt }],
);
const failedMatches = [];

phase("Judge");
let roundNumber = 1;
while (round.length > 1) {
  const matches = [];
  for (let index = 0; index < round.length; index += 2) {
    matches.push({ left: round[index], right: round[index + 1] ?? null, match: index / 2 + 1 });
  }
  const judged = await parallel(
    matches.map(({ left, right, match }) => () =>
      right === null
        ? Promise.resolve({ winnerIndex: 0, reason: "bye" })
        : agent(
            `Choose index 0 or 1 under this rubric: ${rubric}\n0: ${JSON.stringify(left.attempt)}\n1: ${JSON.stringify(right.attempt)}`,
            { label: `judge-round-${roundNumber}-match-${match}`, schema: judgeSchema },
          ),
    ),
  );
  round = matches.flatMap(({ left, right, match }, index) => {
    const verdict = judged[index];
    if (verdict === null) {
      failedMatches.push(`round-${roundNumber}-match-${match}`);
      return [];
    }
    return [verdict.winnerIndex === 1 && right !== null ? right : left];
  });
  roundNumber++;
}

// CONTRACT: JavaScript owns the bracket; agents only make pairwise judgments.
return {
  winner: failedMatches.length === 0 ? (round[0] ?? null) : null,
  failed: { contenders: failedContenders, matches: failedMatches },
  complete: failedContenders.length === 0 && failedMatches.length === 0 && round.length === 1,
};
