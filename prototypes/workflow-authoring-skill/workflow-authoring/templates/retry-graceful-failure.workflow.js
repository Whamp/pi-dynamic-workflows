export const meta = {
  name: "retry_graceful_failure",
  description: "Retry bounded semantic work and return a truthful failure ledger when exhausted",
  phases: [{ title: "Attempt" }],
};

// ADAPT: Replace work, acceptance predicate, and attempt bound.
const work = args?.work ?? { id: "sample", task: "Produce a usable result" };
const maxAttempts = Number.isInteger(args?.attempts) ? Math.max(1, Math.min(args.attempts, 5)) : 3;
const resultSchema = {
  type: "object",
  properties: { value: { type: "string" } },
  required: ["value"],
};
const attempts = [];

phase("Attempt");
const result = await retry(
  async (attemptIndex) => {
    const value = await agent(
      `Attempt ${attemptIndex + 1}. Produce a non-empty usable value for: ${JSON.stringify(work)}`,
      { label: `work-attempt-${attemptIndex + 1}`, schema: resultSchema, retries: 1 },
    );
    attempts.push({ attempt: attemptIndex + 1, succeeded: value !== null });
    return value;
  },
  { attempts: maxAttempts, until: (value) => value !== null && value.value.trim().length > 0 },
);

// CONTRACT: Exhaustion returns the last value; inspect it and preserve the attempt ledger.
const accepted = result !== null && result.value.trim().length > 0;
return {
  result: accepted ? result : null,
  attempts,
  failed: accepted ? [] : [work.id ?? "work"],
  complete: accepted,
};
