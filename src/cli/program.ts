import { Command } from "commander";
import { readFileSync } from "node:fs";
import { CliError } from "./errors.ts";
import { registerCredits } from "./commands/credits.ts";
import { registerModels } from "./commands/models.ts";
import { registerConfig } from "./commands/config.ts";
import { registerResult } from "./commands/result.ts";
import { registerWait } from "./commands/wait.ts";
import { registerGen } from "./commands/gen.ts";
import { registerEdit } from "./commands/edit.ts";
import { registerFill } from "./commands/fill.ts";
import { registerExpand } from "./commands/expand.ts";

export function buildProgram(): Command {
  const pkg = readPkg();
  const program = new Command();

  program.name("flux");
  program.description("CLI for Black Forest Labs FLUX image generation and editing");
  program.version(pkg.version ?? "0.0.0");

  program
    .option("--json", "machine-readable output (stable JSON)")
    .option("--plain", "stable line-based output (paths/ids only)")
    .option("-q, --quiet", "suppress progress / logs")
    .option("-v, --verbose", "verbose diagnostics to stderr (no secrets)")
    .option("--no-color", "disable colored output")
    .option("--endpoint <host>", "API host (default: api.bfl.ai)")
    .option("--region <us|eu|global>", "shortcut for endpoint host")
    .option("--timeout <ms>", "request timeout in ms", (v) => parseInt(v, 10))
    .option("--retries <n>", "retries for 429/5xx (default: 3)", (v) => parseInt(v, 10))
    .option("--out-dir <dir>", "default output directory for saved images");

  program.hook("preAction", (cmd) => {
    const o = cmd.optsWithGlobals();
    if (o.json && o.plain) throw new CliError("Use only one of --json or --plain", { exitCode: 2 });
  });

  registerGen(program);
  registerEdit(program);
  registerFill(program);
  registerExpand(program);
  registerResult(program);
  registerWait(program);
  registerCredits(program);
  registerModels(program);
  registerConfig(program);

  return program;
}

function readPkg(): { version?: string } {
  try {
    const url = new URL("../../package.json", import.meta.url);
    const txt = readFileSync(url, "utf8");
    return JSON.parse(txt) as { version?: string };
  } catch {
    return {};
  }
}

