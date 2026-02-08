import { Command } from "commander";
import { ctxFromCommand, makeClient, throwIfHttpError } from "../shared.ts";

export function registerCredits(program: Command): void {
  program
    .command("credits")
    .description("Show remaining credits")
    .action(async (_options: any, cmd: Command) => {
      const ctx = await ctxFromCommand(cmd);
      const client = makeClient(ctx);
      try {
        const res = await client.getCredits();
        if (ctx.mode === "json") {
          process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
          return;
        }
        const credits = res.credits;
        if (ctx.mode === "plain") {
          process.stdout.write(`${credits ?? ""}\n`);
          return;
        }
        process.stdout.write(credits != null ? `${credits}\n` : `${JSON.stringify(res, null, 2)}\n`);
      } catch (err) {
        throwIfHttpError(err);
        throw err;
      }
    });
}

