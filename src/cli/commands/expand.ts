import { Command } from "commander";
import { CliError } from "../errors.ts";
import { ctxFromCommand, makeClient, resolvePrompt, throwIfHttpError } from "../shared.ts";
import { pollUntilDone } from "../poll.ts";
import { buildExpandBody, type OutputFormat } from "../../models/builders.ts";
import { readJsonArg } from "../../util/json.ts";
import { toBase64 } from "../../io/image.ts";
import { extForFormat, resolveOutputTarget, writeBytes } from "../../io/output.ts";

export function registerExpand(program: Command): void {
  program
    .command("expand")
    .description("Outpaint by expanding an image (add pixels to any side)")
    .argument("[prompt]", "prompt text, or '-' to read from stdin")
    .requiredOption("--image <path|url|base64>", "input image")
    .option("--top <px>", "pixels to add on top", (v) => parseInt(v, 10))
    .option("--bottom <px>", "pixels to add on bottom", (v) => parseInt(v, 10))
    .option("--left <px>", "pixels to add on left", (v) => parseInt(v, 10))
    .option("--right <px>", "pixels to add on right", (v) => parseInt(v, 10))
    .option("--steps <n>", "steps (default often 50)", (v) => parseInt(v, 10))
    .option("--guidance <n>", "guidance (default often 60)", (v) => parseFloat(v))
    .option("--seed <n>", "seed", (v) => parseInt(v, 10))
    .option("--safety <n>", "safety_tolerance (model-dependent)", (v) => parseInt(v, 10))
    .option("--format <jpeg|png>", "output_format", (v) => v as OutputFormat)
    .option("-o, --out <path|->", "output file or directory, or '-' for stdout")
    .option("--no-wait", "submit task and print id only")
    .option("--poll-interval <ms>", "poll interval in ms (default: 500)", (v) => parseInt(v, 10))
    .option("--body <json|@file>", "raw request body (advanced)")
    .option("-n, --dry-run", "print resolved request and exit")
    .action(async (promptArg: string | undefined, options: any, cmd: Command) => {
      const ctx = await ctxFromCommand(cmd);
      const client = makeClient(ctx);
      const prompt = await resolvePrompt(promptArg);

      const format = options.format as OutputFormat | undefined;
      const imageBase64 = await toBase64(String(options.image));

      let modelPath = "flux-pro-1.0-expand";
      let body: Record<string, unknown>;

      if (options.body) {
        const raw = await readJsonArg(String(options.body));
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new CliError("--body must be a JSON object", { exitCode: 2 });
        body = { ...(raw as any) };
        if (body.prompt == null) body.prompt = prompt;
        if (body.image == null) body.image = imageBase64;
      } else {
        const built = buildExpandBody({
          prompt,
          imageBase64,
          top: options.top,
          bottom: options.bottom,
          left: options.left,
          right: options.right,
          steps: options.steps,
          guidance: options.guidance,
          seed: options.seed,
          safety: options.safety,
          format,
        });
        modelPath = built.modelPath;
        body = built.body;
      }

      if (options.dryRun) {
        const url = `https://${ctx.endpointHost}/v1/${modelPath}`;
        if (ctx.mode === "json") process.stdout.write(`${JSON.stringify({ method: "POST", url, body }, null, 2)}\n`);
        else process.stdout.write(`${url}\n${JSON.stringify(body, null, 2)}\n`);
        return;
      }

      try {
        const task = await client.createTask(modelPath, body);
        if (options.noWait) {
          if (ctx.mode === "json") process.stdout.write(`${JSON.stringify({ id: task.id, pollingUrl: task.polling_url, model: modelPath }, null, 2)}\n`);
          else process.stdout.write(`${task.id}\n`);
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
          process.stdout.write(`${JSON.stringify({ id: task.id, model: modelPath, status: res.status, resultUrl: url, file: written.path ?? null }, null, 2)}\n`);
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

