export const meta = {
  name: "saved_nested_workflow",
  description: "Frame a task and delegate it to one context-supplied saved workflow",
  phases: [{ title: "Frame" }, { title: "Delegate" }],
};

// ADAPT: Supply a saved workflow name from current context; never guess catalogue contents.
const savedName = typeof args?.savedName === "string" ? args.savedName : "prototype-child";
const subject = args?.subject ?? { task: "Inspect the sample" };
const framingSchema = {
  type: "object",
  properties: { brief: { type: "string" } },
  required: ["brief"],
};

phase("Frame");
const framing = await agent(`Frame a self-contained brief for this saved workflow: ${JSON.stringify(subject)}`, {
  label: "frame-child-input",
  schema: framingSchema,
});
if (framing === null) {
  return { child: null, failed: ["framing"], complete: false };
}

phase("Delegate");
// CONTRACT: One sequential nested level shares the parent's limits and returns child.result only.
const child = await workflow(savedName, { subject, brief: framing.brief });
return { child, failed: child === null ? [savedName] : [], complete: child !== null };
