import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAgentSession,
  DefaultResourceLoader,
  type ExtensionAPI,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { withFakeHomeAsync } from "../../tests/helpers/fake-home.js";

type Profile = "detailed" | "minimal";

type CapturedCall = {
  call: number;
  systemPrompt: string;
  tools: Array<{ name: string; description: string; parameters: unknown }>;
  messages: unknown[];
};

type ProfileRun = {
  calls: CapturedCall[];
  finalSessionMessages: unknown[];
};

type FauxCompat = typeof import("@earendil-works/pi-ai/compat");

async function loadFaux(): Promise<FauxCompat> {
  const nested = fileURLToPath(
    new URL(
      "../../node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai/dist/compat.js",
      import.meta.url,
    ),
  );
  const entry = existsSync(nested) ? nested : "@earendil-works/pi-ai/compat";
  return import(entry) as Promise<FauxCompat>;
}

function extension(profile: Profile) {
  return (pi: ExtensionAPI): void => {
    let ephemeralGuidanceArmed = false;

    pi.registerTool({
      name: "lifecycle_probe",
      label: "Lifecycle probe",
      description: "Return a marker proving that execution-time guidance appears only after this call.",
      promptSnippet: "Probe workflow-guidance lifecycle ordering",
      promptGuidelines: [
        profile === "detailed"
          ? "DETAILED_PERMANENT: full permanent workflow guidance selected before the first provider request."
          : "MINIMAL_PERMANENT: reduced permanent workflow guidance selected before the first provider request.",
      ],
      parameters: Type.Object({}),
      async execute() {
        return {
          content: [
            {
              type: "text",
              text: "POST_CALL_GUIDANCE: visible only after the parent already chose and called lifecycle_probe.",
            },
          ],
          details: {},
        };
      },
    });

    pi.on("input", (event) => {
      if (event.text.startsWith("pi-workflows ")) {
        return {
          action: "transform",
          text: `/skill:workflow-runtime ${event.text.slice("pi-workflows ".length)}`,
        };
      }
      if (event.text.startsWith("context-workflows ")) {
        ephemeralGuidanceArmed = true;
        return {
          action: "transform",
          text: event.text.slice("context-workflows ".length),
        };
      }
    });

    pi.on("context", (event) => {
      if (!ephemeralGuidanceArmed) return;
      return {
        messages: [
          ...event.messages,
          {
            role: "custom",
            customType: "workflow-ephemeral-guidance",
            content: "EPHEMERAL_CONTEXT_GUIDANCE: present before workflow authoring but absent from stored history.",
            display: false,
            timestamp: Date.now(),
          },
        ],
      };
    });

    pi.on("tool_call", (event) => {
      if (event.toolName === "lifecycle_probe") ephemeralGuidanceArmed = false;
    });

    pi.on("before_agent_start", (event) => {
      if (!event.prompt.startsWith("before-message ")) return;
      return {
        message: {
          customType: "workflow-guidance-probe",
          content: "BEFORE_AGENT_MESSAGE: appended after the user message but before the first parent response.",
          display: false,
        },
      };
    });

    pi.registerCommand("context-run", {
      description: "Probe command-triggered ephemeral guidance",
      async handler(args) {
        ephemeralGuidanceArmed = true;
        await pi.sendMessage(
          {
            customType: "workflow-command-probe",
            content: `COMMAND_TRIGGER_MESSAGE: ${args}`,
            display: false,
          },
          { triggerTurn: true, deliverAs: "followUp" },
        );
      },
    });
  };
}

async function runProfile(profile: Profile): Promise<ProfileRun> {
  const { registerFauxProvider, fauxAssistantMessage, fauxToolCall } = await loadFaux();
  const home = mkdtempSync(join(tmpdir(), `pi-guidance-${profile}-home-`));
  const cwd = mkdtempSync(join(tmpdir(), `pi-guidance-${profile}-cwd-`));
  const skillDir = join(cwd, "workflow-runtime");
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(cwd, "probe.txt"), "probe input\n");
  writeFileSync(
    join(skillDir, "SKILL.md"),
    `---\nname: workflow-runtime\ndescription: Probe skill that must not appear in permanent context.\ndisable-model-invocation: true\n---\n\nSKILL_EXPANDED_GUIDANCE: loaded into the triggered user message before the parent responds.\n`,
  );

  const previousKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "faux-dummy-key-not-used";
  const faux = registerFauxProvider({
    provider: "deepseek",
    models: [{ id: `faux-${profile}`, name: `Faux ${profile}`, contextWindow: 128000, maxTokens: 4096 }],
  });
  const captured: CapturedCall[] = [];
  const capture = (reply: unknown) => (context: { systemPrompt: string; tools?: unknown[]; messages: unknown[] }) => {
    captured.push({
      call: captured.length + 1,
      systemPrompt: context.systemPrompt,
      tools: (context.tools ?? []).map((tool) => {
        const value = tool as { name: string; description: string; parameters: unknown };
        return { name: value.name, description: value.description, parameters: value.parameters };
      }),
      messages: JSON.parse(JSON.stringify(context.messages)),
    });
    return reply;
  };

  try {
    return await withFakeHomeAsync(home, async () => {
      const loader = new DefaultResourceLoader({
        cwd,
        agentDir: home,
        additionalSkillPaths: [skillDir],
        extensionFactories: [{ name: `lifecycle-${profile}`, factory: extension(profile) }],
        noContextFiles: true,
        appendSystemPromptOverride: () => [],
      });
      await loader.reload();

      faux.setResponses([
        capture(fauxAssistantMessage("ordinary complete")),
        capture(fauxAssistantMessage("skill complete")),
        capture(fauxAssistantMessage("before-agent complete")),
        capture(fauxAssistantMessage(fauxToolCall("lifecycle_probe", {}), { stopReason: "toolUse" })),
        capture(fauxAssistantMessage("post-tool complete")),
        capture(
          fauxAssistantMessage(fauxToolCall("read", { path: join(cwd, "probe.txt") }), { stopReason: "toolUse" }),
        ),
        capture(fauxAssistantMessage(fauxToolCall("lifecycle_probe", {}), { stopReason: "toolUse" })),
        capture(fauxAssistantMessage("ephemeral post-tool complete")),
        capture(fauxAssistantMessage(fauxToolCall("lifecycle_probe", {}), { stopReason: "toolUse" })),
        capture(fauxAssistantMessage("command post-tool complete")),
      ]);

      const { session } = await createAgentSession({
        cwd,
        agentDir: home,
        model: faux.getModel(),
        tools: ["read", "lifecycle_probe"],
        resourceLoader: loader,
        sessionManager: SessionManager.inMemory(cwd),
        settingsManager: SettingsManager.inMemory(),
      });

      try {
        await session.prompt("ordinary request");
        await session.prompt("pi-workflows triggered request");
        await session.prompt("before-message request");
        await session.prompt("call the lifecycle probe");
        await session.prompt("context-workflows inspect then call the lifecycle probe");
        await session.prompt("/context-run call the lifecycle probe from a command");
        const deadline = Date.now() + 5_000;
        while (captured.length < 10 && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        if (captured.length !== 10) {
          throw new Error(`expected 10 provider calls, captured ${captured.length}`);
        }
        return {
          calls: captured,
          finalSessionMessages: JSON.parse(JSON.stringify(session.messages)),
        };
      } finally {
        session.dispose();
      }
    });
  } finally {
    faux.unregister();
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousKey;
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  }
}

function contains(value: unknown, marker: string): boolean {
  return JSON.stringify(value).includes(marker);
}

const detailed = await runProfile("detailed");
const minimal = await runProfile("minimal");

const summarize = (run: ProfileRun) => ({
  calls: run.calls.length,
  systemPromptBytes: run.calls.map((call) => Buffer.byteLength(call.systemPrompt, "utf8")),
  toolBytes: run.calls.map((call) => Buffer.byteLength(JSON.stringify(call.tools), "utf8")),
  systemPromptStable: run.calls.every((call) => call.systemPrompt === run.calls[0]?.systemPrompt),
  toolsStable: run.calls.every((call) => JSON.stringify(call.tools) === JSON.stringify(run.calls[0]?.tools)),
  hiddenSkillAbsentFromPermanentPrompt: run.calls.every(
    (call) => !call.systemPrompt.includes("workflow-runtime") && !call.systemPrompt.includes("SKILL_EXPANDED_GUIDANCE"),
  ),
  skillExpansionVisibility: run.calls.map((call) => contains(call.messages, "SKILL_EXPANDED_GUIDANCE")),
  beforeAgentMessageVisibility: run.calls.map((call) => contains(call.messages, "BEFORE_AGENT_MESSAGE")),
  postCallGuidanceVisibility: run.calls.map((call) => contains(call.messages, "POST_CALL_GUIDANCE")),
  ephemeralGuidanceVisibility: run.calls.map((call) => contains(call.messages, "EPHEMERAL_CONTEXT_GUIDANCE")),
  ephemeralGuidanceAbsentFromStoredHistory: !contains(run.finalSessionMessages, "EPHEMERAL_CONTEXT_GUIDANCE"),
});

const trace = (run: ProfileRun) =>
  run.calls.map((call) => ({
    call: call.call,
    skillExpanded: contains(call.messages, "SKILL_EXPANDED_GUIDANCE"),
    beforeAgentMessage: contains(call.messages, "BEFORE_AGENT_MESSAGE"),
    postCallGuidance: contains(call.messages, "POST_CALL_GUIDANCE"),
    ephemeralGuidance: contains(call.messages, "EPHEMERAL_CONTEXT_GUIDANCE"),
  }));

const result = {
  piVersion: "0.80.7",
  detailed: summarize(detailed),
  minimal: summarize(minimal),
  crossProfile: {
    permanentPromptsDiffer: detailed.calls[0]?.systemPrompt !== minimal.calls[0]?.systemPrompt,
    providerToolDefinitionsMatch: JSON.stringify(detailed.calls[0]?.tools) === JSON.stringify(minimal.calls[0]?.tools),
    detailedMarkerOnlyInDetailed: detailed.calls.every((call) => call.systemPrompt.includes("DETAILED_PERMANENT")),
    minimalMarkerOnlyInMinimal: minimal.calls.every((call) => call.systemPrompt.includes("MINIMAL_PERMANENT")),
  },
  evidence: {
    detailedPermanentPrompt: detailed.calls[0]?.systemPrompt,
    minimalPermanentPrompt: minimal.calls[0]?.systemPrompt,
    providerTools: detailed.calls[0]?.tools,
    detailedTrace: trace(detailed),
    minimalTrace: trace(minimal),
  },
};

const outputPath = fileURLToPath(new URL("./probe-result.json", import.meta.url));
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      piVersion: result.piVersion,
      detailed: result.detailed,
      minimal: result.minimal,
      crossProfile: result.crossProfile,
      outputPath,
    },
    null,
    2,
  ),
);
