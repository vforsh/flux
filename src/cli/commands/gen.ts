import { Command } from "commander";
import { CliError } from "../errors.ts";
import { ctxFromCommand, makeClient, resolvePrompt, throwIfHttpError } from "../shared.ts";
import { pollUntilDone } from "../poll.ts";
import { buildGenBody, type OutputFormat } from "../../models/builders.ts";
import { DEFAULT_MODEL } from "../../models/catalog.ts";
import { readJsonArg } from "../../util/json.ts";
import { extForFormat, resolveOutputTarget, writeBytes } from "../../io/output.ts";
import { readFile } from "node:fs/promises";

export function registerGen(program: Command): void {
  program
    .command("gen")
    .description("Generate an image from a text prompt")
    .argument("[prompt]", "prompt text, or '-' to read from stdin")
    .option("--model <key>", `model key (default: ${DEFAULT_MODEL})`)
    .option("--width <px>", "width (model-dependent)", (v) => parseInt(v, 10))
    .option("--height <px>", "height (model-dependent)", (v) => parseInt(v, 10))
    .option("--aspect <w:h>", "aspect ratio (model-dependent)")
    .option("--seed <n>", "seed", (v) => parseInt(v, 10))
    .option("--safety <n>", "safety_tolerance (model-dependent)", (v) => parseInt(v, 10))
    .option("--format <jpeg|png>", "output_format", (v) => v as OutputFormat)
    .option("--steps <n>", "steps (flux-2-flex only)", (v) => parseInt(v, 10))
    .option("--guidance <n>", "guidance (flux-2-flex only)", (v) => parseFloat(v))
    .option("--prompt-upsampling", "prompt_upsampling (kontext)")
    .option("--raw", "raw mode (flux-pro-1.1-ultra)")
    .option("--image-prompt <path|url|base64>", "image_prompt (flux-pro-1.1-ultra)")
    .option("--image-prompt-strength <n>", "image_prompt_strength (flux-pro-1.1-ultra)", (v) => parseFloat(v))
    .option("--webhook-url <url>", "webhook_url")
    .option("--webhook-secret-file <path>", "webhook_secret read from file (advanced)")
    .option("-o, --out <path|->", "output file or directory, or '-' for stdout")
    .option("--no-wait", "submit task and print id only")
    .option("--poll-interval <ms>", "poll interval in ms (default: 500)", (v) => parseInt(v, 10))
    .option("--body <json|@file>", "raw request body (advanced)")
    .option("-n, --dry-run", "print resolved request and exit")
    .action(async (promptArg: string | undefined, options: any, cmd: Command) => {
      const ctx = await ctxFromCommand(cmd);
      const client = makeClient(ctx);
      const prompt = await resolvePrompt(promptArg);

      const model = String(options.model ?? ctx.defaultModel ?? DEFAULT_MODEL);
      const format = options.format as OutputFormat | undefined;
      const webhookSecret = options.webhookSecretFile ? (await readFile(String(options.webhookSecretFile), "utf8")).trim() : undefined;

      let modelPath: string;
      let body: Record<string, unknown>;

      if (options.body) {
        const raw = await readJsonArg(String(options.body));
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new CliError("--body must be a JSON object", { exitCode: 2 });
        body = { ...(raw as any) };
        if (body.prompt == null) body.prompt = prompt;
        modelPath = model;
      } else {
        const built = buildGenBody({
          model,
          prompt,
          width: options.width,
          height: options.height,
          aspect: options.aspect,
          seed: options.seed,
          safety: options.safety,
          format,
          steps: options.steps,
          guidance: options.guidance,
          promptUpsampling: options.promptUpsampling,
          raw: options.raw,
          imagePrompt: options.imagePrompt,
          imagePromptStrength: options.imagePromptStrength,
          webhookUrl: options.webhookUrl,
          webhookSecret,
        });
        modelPath = built.modelPath;
        body = built.body;
      }

      if (options.dryRun) {
        const url = `https://${ctx.endpointHost}/v1/${modelPath}`;
        if (ctx.mode === "json") {
          process.stdout.write(`${JSON.stringify({ method: "POST", url, body }, null, 2)}\n`);
        } else {
          process.stdout.write(`${url}\n${JSON.stringify(body, null, 2)}\n`);
        }
        return;
      }

      try {
        const task = await client.createTask(modelPath, body);

        if (options.noWait) {
          if (ctx.mode === "json") {
            process.stdout.write(`${JSON.stringify({ id: task.id, pollingUrl: task.polling_url, model: modelPath }, null, 2)}\n`);
          } else {
            process.stdout.write(`${task.id}\n`);
          }
          return;
        }

        const pollInterval = Number.isFinite(options.pollInterval)
          ? Math.max(50, Number(options.pollInterval))
          : ctx.config.pollIntervalMs ?? 500;

        const res = await pollUntilDone({ ctx, client, pollingUrl: task.polling_url, intervalMs: pollInterval });
        const url = res.result?.sample;
        if (!url) throw new CliError("No result.sample URL in response", { exitCode: 7 });

        const bytes = await client.download(String(url));
        const ext = extForFormat(format);
        const target = await resolveOutputTarget({ out: options.out, outDir: ctx.outDir, id: task.id, ext });
        const written = await writeBytes(target, bytes);

        if (ctx.mode === "json") {
          process.stdout.write(
            `${JSON.stringify(
              {
                id: task.id,
                model: modelPath,
                status: res.status,
                resultUrl: url,
                file: written.path ?? null,
                cost: task.cost ?? task.input_cost ?? null,
                inputMp: task.input_mp ?? null,
                outputMp: task.output_mp ?? null,
              },
              null,
              2,
            )}\n`,
          );
        } else if (ctx.mode === "plain") {
          if (written.path) process.stdout.write(`${written.path}\n`);
          else process.stdout.write(`-\n`);
        } else {
          if (written.path) process.stdout.write(`${written.path}\n`);
          else process.stdout.write(`(wrote to stdout)\n`);
        }
      } catch (err) {
        throwIfHttpError(err);
        throw err;
      }
    });
}
