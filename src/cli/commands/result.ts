import { Command } from "commander";
import { ctxFromCommand, makeClient, throwIfHttpError } from "../shared.ts";
import { extForFormat, resolveOutputTarget, writeBytes } from "../../io/output.ts";

export function registerResult(program: Command): void {
  program
    .command("result")
    .description("Fetch task status/result by id")
    .argument("<id>", "task id")
    .option("--raw", "print raw API response (implies --json output schema for machines)")
    .option("-o, --out <path|->", "download result.sample to file/stdout (when status=Ready)")
    .option("--format <jpeg|png>", "output format for file extension inference", (v) => v as "jpeg" | "png")
    .action(async (id: string, options: any, cmd: Command) => {
      const ctx = await ctxFromCommand(cmd);
      const client = makeClient(ctx);

      try {
        const res = await client.getResultById(String(id));

        if (options.raw || ctx.mode === "json") {
          process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
          return;
        }

        const status = String(res.status ?? "Unknown");
        const sample = res.result?.sample ? String(res.result.sample) : null;

        if (options.out && status === "Ready" && sample) {
          const bytes = await client.download(sample);
          const ext = extForFormat(options.format);
          const target = await resolveOutputTarget({ out: options.out, outDir: ctx.outDir, id: String(id), ext });
          const written = await writeBytes(target, bytes);
          if (ctx.mode === "plain") {
            if (written.path) process.stdout.write(`${written.path}\n`);
            else process.stdout.write(`-\n`);
          } else {
            if (written.path) process.stdout.write(`${written.path}\n`);
            else process.stdout.write(`(wrote to stdout)\n`);
          }
          return;
        }

        if (ctx.mode === "plain") {
          process.stdout.write(sample ? `${status}\t${sample}\n` : `${status}\n`);
          return;
        }

        if (sample) process.stdout.write(`${status}\n${sample}\n`);
        else process.stdout.write(`${status}\n`);
      } catch (err) {
        throwIfHttpError(err);
        throw err;
      }
    });
}
