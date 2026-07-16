export const meta = {
  name: "classify_and_act",
  description: "Classify each work item, then route it to a matching actor",
  phases: [{ title: "Classify" }, { title: "Act" }],
};

// ADAPT: Replace categories, items, classifier prompt, and actor instructions.
const categories = ["direct", "parallel", "iterative"];
const items = Array.isArray(args?.items) ? args.items : [{ id: "sample", task: "Inspect one sample item" }];
const classificationSchema = {
  type: "object",
  properties: { category: { type: "string", enum: categories }, reason: { type: "string" } },
  required: ["category", "reason"],
};
const actionSchema = {
  type: "object",
  properties: { outcome: { type: "string" } },
  required: ["outcome"],
};

phase("Classify");
const classifications = await parallel(
  items.map((item) => () =>
    agent(`Classify this work as ${categories.join(", ")}: ${JSON.stringify(item)}`, {
      label: `classify-${item.id}`,
      schema: classificationSchema,
    }),
  ),
);
const failedClassification = items.flatMap((item, index) => (classifications[index] === null ? [item.id] : []));
const routed = items.flatMap((item, index) =>
  classifications[index] === null ? [] : [{ item, classification: classifications[index] }],
);

phase("Act");
const actions = await parallel(
  routed.map(({ item, classification }) => () =>
    agent(
      `Handle this ${classification.category} work item. Return its outcome.\n\n${JSON.stringify(item)}`,
      { label: `act-${item.id}`, schema: actionSchema },
    ),
  ),
);
const failedAction = routed.flatMap(({ item }, index) => (actions[index] === null ? [item.id] : []));

// CONTRACT: Preserve both failure ledgers before filtering results.
return {
  handled: routed.flatMap(({ item, classification }, index) =>
    actions[index] === null ? [] : [{ id: item.id, category: classification.category, result: actions[index] }],
  ),
  failed: { classification: failedClassification, action: failedAction },
  complete: failedClassification.length === 0 && failedAction.length === 0,
};
