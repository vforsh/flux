import { Command } from "commander";
import { CliError } from "../errors.ts";
import { ctxFromCommand, makeClient, resolvePrompt, throwIfHttpError } from "../shared.ts";
import { pollUntilDone } from "../poll.ts";
import { buildEditBody, type OutputFormat } from "../../models/builders.ts";
import { DEFAULT_MODEL } from "../../models/catalog.ts";
import { readJsonArg } from "../../util/json.ts";
import { toBase64OrUrl } from "../../io/image.ts";
import { extForFormat, resolveOutputTarget, writeBytes } from "../../io/output.ts";

export function registerEdit(program: Command): void {
  program
    .command("edit")
    .description("Edit an image using a prompt + one or more reference images")
    .argument("[prompt]", "edit prompt text, or '-' to read from stdin")
    .requiredOption("--input <path|url|base64>", "input image (repeatable)", collect, [] as string[])
    .option("--model <key>", `model key (default: ${DEFAULT_MODEL})`)
    .option("--width <px>", "width (model-dependent)", (v) => parseInt(v, 10))
    .option("--height <px>", "height (model-dependent)", (v) => parseInt(v, 10))
    .option("--aspect <w:h>", "aspect ratio (kontext)")
    .option("--seed <n>", "seed", (v) => parseInt(v, 10))
    .option("--safety <n>", "safety_tolerance (model-dependent)", (v) => parseInt(v, 10))
    .option("--format <jpeg|png>", "output_format", (v) => v as OutputFormat)
    .option("--prompt-upsampling", "prompt_upsampling (kontext)")
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

      const inputs = (options.input as string[]).map(String);
      const encodedInputs = await Promise.all(inputs.map((v) => toBase64OrUrl(v)));

      let modelPath: string;
      let body: Record<string, unknown>;

      if (options.body) {
        const raw = await readJsonArg(String(options.body));
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new CliError("--body must be a JSON object", { exitCode: 2 });
        body = { ...(raw as any) };
        if (body.prompt == null) body.prompt = prompt;
        // If user didn't set input_image fields, populate them from --input.
        if (body.input_image == null && encodedInputs.length > 0) {
          for (let i = 0; i < encodedInputs.length; i++) {
            const k = i === 0 ? "input_image" : `input_image_${i + 1}`;
            body[k] = encodedInputs[i];
          }
        }
        modelPath = model;
      } else {
        const built = buildEditBody({
          model,
          prompt,
          inputs: encodedInputs,
          width: options.width,
          height: options.height,
          aspect: options.aspect,
          seed: options.seed,
          safety: options.safety,
          format,
          promptUpsampling: options.promptUpsampling,
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

function collect(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

