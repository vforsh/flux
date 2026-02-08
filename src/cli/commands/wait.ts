import { Command } from "commander";
import { ctxFromCommand, makeClient, throwIfHttpError } from "../shared.ts";
import { pollUntilDone } from "../poll.ts";
import { extForFormat, resolveOutputTarget, writeBytes } from "../../io/output.ts";

export function registerWait(program: Command): void {
  program
    .command("wait")
    .description("Wait for a task to complete")
    .argument("<id>", "task id")
    .option("--polling-url <url>", "explicit polling_url (recommended if provided by create response)")
    .option("--poll-interval <ms>", "poll interval in ms (default: 500)", (v) => parseInt(v, 10))
    .option("--max-wait <ms>", "max time to wait (ms); 0 means no limit", (v) => parseInt(v, 10), 0)
    .option("-o, --out <path|->", "download result.sample to file/stdout (when status=Ready)")
    .option("--format <jpeg|png>", "output format for file extension inference", (v) => v as "jpeg" | "png")
    .action(async (id: string, options: any, cmd: Command) => {
      const ctx = await ctxFromCommand(cmd);
      const client = makeClient(ctx);

      const pollingUrl =
        options.pollingUrl ?? `https://${ctx.endpointHost}/v1/get_result?id=${encodeURIComponent(String(id))}`;

      const intervalMs = Number.isFinite(options.pollInterval) ? Math.max(50, Number(options.pollInterval)) : ctx.config.pollIntervalMs ?? 500;
      const maxWaitMs = Number.isFinite(options.maxWait) ? Math.max(0, Number(options.maxWait)) : 0;

      try {
        const res = await pollUntilDone({ ctx, client, pollingUrl, intervalMs, maxWaitMs });
        const sample = res.result?.sample ? String(res.result.sample) : null;

        if (options.out && res.status === "Ready" && sample) {
          const bytes = await client.download(sample);
          const ext = extForFormat(options.format);
          const target = await resolveOutputTarget({ out: options.out, outDir: ctx.outDir, id: String(id), ext });
          const written = await writeBytes(target, bytes);
          if (ctx.mode === "json") {
            process.stdout.write(`${JSON.stringify({ id: String(id), status: res.status, resultUrl: sample, file: written.path ?? null }, null, 2)}\n`);
          } else if (ctx.mode === "plain") {
            if (written.path) process.stdout.write(`${written.path}\n`);
            else process.stdout.write(`-\n`);
          } else {
            if (written.path) process.stdout.write(`${written.path}\n`);
            else process.stdout.write(`(wrote to stdout)\n`);
          }
          return;
        }

        if (ctx.mode === "json") {
          process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
        } else if (ctx.mode === "plain") {
          process.stdout.write(sample ? `${res.status}\t${sample}\n` : `${res.status}\n`);
        } else {
          if (sample) process.stdout.write(`${res.status}\n${sample}\n`);
          else process.stdout.write(`${res.status}\n`);
        }
      } catch (err) {
        throwIfHttpError(err);
        throw err;
      }
    });
}
