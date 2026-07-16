import { readFile } from "node:fs/promises";
import readline from "node:readline";
import { AUTHORING_TASKS, createPrototypeState, reducePrototypeState, TEMPLATES } from "./prototype-state.mjs";

const rootUrl = new URL("./", import.meta.url);
const skillText = await readFile(new URL("workflow-authoring/SKILL.md", rootUrl), "utf8");
const description = skillText.match(/^description:\s*(.+)$/m)?.[1] ?? "";
const templateKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const commandToTask = { w: "write", e: "edit", r: "review", d: "debug" };
let state = createPrototypeState();

async function disclosedSize(files) {
  const contents = await Promise.all(files.map((file) => readFile(new URL(file, rootUrl), "utf8")));
  return contents.reduce((total, content) => total + content.length, 0);
}

async function render({ clear = true } = {}) {
  if (clear && process.stdout.isTTY) console.clear();
  const onDemandCharacters = await disclosedSize(state.disclosedFiles);
  const view = {
    authoringTask: state.authoringTask,
    authoringTaskLabel: state.authoringTask ? AUTHORING_TASKS[state.authoringTask].label : null,
    disclosedFiles: state.disclosedFiles,
    selectedTemplate: state.selectedTemplate,
    extensionVersion: state.extensionVersion,
    compactBaseline: state.compactBaseline,
    registryBoundary: state.registryBoundary,
    context: {
      permanentDescriptionCharacters: description.length,
      disclosedOnDemandCharacters: onDemandCharacters,
    },
    lastAction: state.lastAction,
  };

  console.log("\x1b[1mTHROWAWAY PROTOTYPE — workflow-authoring disclosure\x1b[0m");
  console.log(
    "\x1b[2mQuestion: can one short model-invoked skill route four authoring tasks to only the needed detail?\x1b[0m\n",
  );
  console.log("\x1b[1mComplete relevant state\x1b[0m");
  console.log(JSON.stringify(view, null, 2));
  console.log("\n\x1b[1mAuthoring task\x1b[0m  [w] write  [e] edit  [r] review  [d] debug");
  console.log(
    `\x1b[1mTemplate\x1b[0m        ${templateKeys.map((key, index) => `[${key}] ${TEMPLATES[index].replace(".workflow.js", "")}`).join("  ")}`,
  );
  console.log("\x1b[1mState\x1b[0m           [c] clear  [q] quit");
}

function actionForCommand(command) {
  if (commandToTask[command]) return { type: "select-task", task: commandToTask[command] };
  const templateIndex = templateKeys.indexOf(command);
  if (templateIndex >= 0) return { type: "select-template", template: TEMPLATES[templateIndex] };
  if (command === "c") return { type: "reset" };
  return { type: "unknown", command };
}

async function runDemo() {
  await render({ clear: false });
  const actions = [
    { type: "select-task", task: "write" },
    { type: "select-template", template: "fan-out-and-synthesize.workflow.js" },
    { type: "select-task", task: "review" },
    { type: "select-task", task: "debug" },
  ];
  for (const action of actions) {
    state = reducePrototypeState(state, action);
    console.log(`\n--- ${state.lastAction} ---\n`);
    await render({ clear: false });
  }
}

if (process.argv.includes("--demo")) {
  await runDemo();
} else {
  await render();
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  terminal.on("line", async (line) => {
    const command = line.trim().toLowerCase();
    if (command === "q") {
      terminal.close();
      return;
    }
    state = reducePrototypeState(state, actionForCommand(command));
    await render();
  });
}
