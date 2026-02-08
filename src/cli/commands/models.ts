import { Command } from "commander";
import { MODEL_SPECS } from "../../models/catalog.ts";
import { ctxFromCommand } from "../shared.ts";

export function registerModels(program: Command): void {
  program
    .command("models")
    .description("List supported model keys")
    .action(async (_options: any, cmd: Command) => {
      const ctx = await ctxFromCommand(cmd);
      if (ctx.mode === "json") {
        process.stdout.write(`${JSON.stringify({ models: MODEL_SPECS }, null, 2)}\n`);
        return;
      }
      if (ctx.mode === "plain") {
        for (const m of MODEL_SPECS) process.stdout.write(`${m.key}\n`);
        return;
      }
      for (const m of MODEL_SPECS) {
        const note = m.notes ? ` (${m.notes})` : "";
        process.stdout.write(`${m.key}${note}\n`);
      }
    });
}

