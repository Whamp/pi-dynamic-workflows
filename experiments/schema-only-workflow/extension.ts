import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createWorkflowTool, runWorkflow, WorkflowError, WorkflowErrorCode } from "../../src/index.js";

const outputPath = process.env.SCHEMA_ONLY_OUTPUT;

async function persist(record: Record<string, unknown>): Promise<void> {
  if (!outputPath) return;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

export default function schemaOnlyWorkflowExtension(pi: ExtensionAPI): void {
  const tool = createWorkflowTool({ cwd: process.cwd() });
  if (process.env.SCHEMA_ONLY_KEEP_GUIDELINES !== "1") {
    Object.defineProperty(tool, "promptGuidelines", {
      configurable: true,
      enumerable: true,
      value: [],
    });
  }

  tool.execute = async (_toolCallId, params) => {
    const calls: Array<Record<string, unknown>> = [];
    const record: Record<string, unknown> = {
      capturedBeforeExecution: true,
      script: params.script,
      toolArgs: params,
      calls,
    };
    await persist(record);

    let firstCheckerPrompt: string | undefined;
    let failingCheckerPrompt: string | undefined;
    const fakeAgent = {
      async run(
        prompt: string,
        options: {
          label?: string;
          phase?: string;
          tier?: string;
          model?: string;
          schema?: unknown;
        },
      ): Promise<unknown> {
        const index = calls.length;
        const call: Record<string, unknown> = {
          index,
          prompt,
          label: options.label,
          phase: options.phase,
          tier: options.tier,
          model: options.model,
          schema: options.schema,
        };
        calls.push(call);

        if (firstCheckerPrompt === undefined) {
          firstCheckerPrompt = prompt;
          const result = "17 is prime: no integer from 2 through floor(sqrt(17)) divides it.";
          call.result = result;
          await persist(record);
          return result;
        }

        if (failingCheckerPrompt === undefined && prompt !== firstCheckerPrompt) failingCheckerPrompt = prompt;
        if (prompt === failingCheckerPrompt) {
          call.simulatedFailure = "recoverable subagent failure";
          await persist(record);
          throw new WorkflowError("simulated subagent failure", WorkflowErrorCode.AGENT_EMPTY_OUTPUT, {
            recoverable: true,
          });
        }

        const evidence = "No divisor exists among 2, 3, and 4, which cover candidates through sqrt(17).";
        let result: unknown;
        if (/return only the evidence string/i.test(prompt)) {
          result = evidence;
        } else if (/exactly two keys/i.test(prompt)) {
          result = JSON.stringify({ prime: true, evidence });
        } else {
          const statedFailure =
            prompt.match(/(?:number\s+)?failedChecks must be (\[[^\]]*\]|\d+)/i)?.[1] ??
            prompt.match(
              /(?:Failed check indices|Failed checks|Failed checker numbers|Failed checker names):\s*(\[[^\]]*\])/i,
            )?.[1];
          let failedChecks: unknown = prompt.includes("null") ? [2] : [];
          try {
            failedChecks = JSON.parse(statedFailure ?? JSON.stringify(failedChecks));
          } catch {
            // Keep the deterministic fallback if a generated prompt embeds malformed JSON.
          }
          const wantsEvidenceString = /evidence[^\n]*(?:concise|short|single)[^\n]*string/i.test(prompt);
          const wantsFailureCount =
            /failedChecks[^\n]*(?:integer|number)/i.test(prompt) || typeof failedChecks === "number";
          const normalizedFailures = wantsFailureCount
            ? Array.isArray(failedChecks)
              ? failedChecks.length
              : failedChecks
            : failedChecks;
          const synthesis = {
            prime: true,
            evidence: wantsEvidenceString ? evidence : [evidence],
            failedChecks: normalizedFailures,
          };
          result = options.schema ? synthesis : JSON.stringify(synthesis);
        }
        call.result = result;
        await persist(record);
        return result;
      },
    };

    try {
      const execution = await runWorkflow(params.script, {
        agent: fakeAgent,
        concurrency: 4,
        maxAgents: params.maxAgents,
        agentRetries: params.agentRetries,
        agentTimeoutMs: params.agentTimeoutMs,
        tokenBudget: params.tokenBudget,
        args: params.args,
        persistLogs: false,
      });
      record.execution = execution;
      await persist(record);
      return {
        content: [{ type: "text", text: JSON.stringify(execution.result) }],
        details: execution,
      };
    } catch (error) {
      record.executionError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      await persist(record);
      throw error;
    }
  };

  pi.registerTool(tool);
}
