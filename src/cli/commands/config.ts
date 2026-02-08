import { Command } from "commander";
import { CliError } from "../errors.ts";
import { ctxFromCommand } from "../shared.ts";
import { configPath, loadConfig, saveConfig, type FluxConfig } from "../../config/config.ts";
import { readStdinText, stdinIsTty } from "../../util/stdin.ts";
import { redactApiKey } from "../../util/redact.ts";

export function registerConfig(program: Command): void {
  const cmd = program.command("config").description("Manage local configuration");

  cmd
    .command("path")
    .description("Print config file path")
    .action(async () => {
      process.stdout.write(`${configPath()}\n`);
    });

  cmd
    .command("get")
    .description("Print current config (apiKey redacted)")
    .action(async (_options: any, cmd: Command) => {
      const ctx = await ctxFromCommand(cmd);
      const { config, path } = await loadConfig();
      const safe = toSafeConfig(config);
      if (ctx.mode === "json") process.stdout.write(`${JSON.stringify({ path, config: safe }, null, 2)}\n`);
      else process.stdout.write(`${JSON.stringify({ path, config: safe }, null, 2)}\n`);
    });

  cmd
    .command("set")
    .description("Set a config key")
    .argument("<key>", "apiKey|endpointHost|defaultModel|outDir|pollIntervalMs")
    .argument("[value]", "value (avoid for apiKey; use stdin)")
    .option("--from-env", "for apiKey: read from BFL_API_KEY")
    .action(async (key: string, value: string | undefined, options: any, parent: Command) => {
      await ctxFromCommand(parent); // ensures global flag validation; no output needed

      const { config } = await loadConfig();
      const next: FluxConfig = { ...config };

      if (key === "apiKey") {
        if (options.fromEnv) {
          const v = process.env.BFL_API_KEY;
          if (!v) throw new CliError("BFL_API_KEY is not set", { exitCode: 2 });
          next.apiKey = v;
        } else {
          if (value != null) throw new CliError("Refusing to read apiKey from argv. Use stdin: echo $BFL_API_KEY | flux config set apiKey", { exitCode: 2 });
          if (stdinIsTty()) throw new CliError("apiKey must be provided via stdin (pipe)", { exitCode: 2 });
          const v = (await readStdinText()).trim();
          if (!v) throw new CliError("stdin was empty", { exitCode: 2 });
          next.apiKey = v;
        }
      } else if (key === "endpointHost") {
        if (!value) throw new CliError("value is required", { exitCode: 2 });
        next.endpointHost = value.replace(/^https?:\/\//, "").replace(/\/+$/, "");
      } else if (key === "defaultModel") {
        if (!value) throw new CliError("value is required", { exitCode: 2 });
        next.defaultModel = value;
      } else if (key === "outDir") {
        if (!value) throw new CliError("value is required", { exitCode: 2 });
        next.outDir = value;
      } else if (key === "pollIntervalMs") {
        if (!value) throw new CliError("value is required", { exitCode: 2 });
        const n = parseInt(value, 10);
        if (!Number.isFinite(n) || n < 50) throw new CliError("pollIntervalMs must be an integer >= 50", { exitCode: 2 });
        next.pollIntervalMs = n;
      } else {
        throw new CliError(`Unknown key: ${key}`, { exitCode: 2 });
      }

      const { path } = await saveConfig(next);
      process.stdout.write(`${path}\n`);
    });

  cmd
    .command("unset")
    .description("Unset a config key")
    .argument("<key>", "apiKey|endpointHost|defaultModel|outDir|pollIntervalMs")
    .action(async (key: string, _options: any, parent: Command) => {
      await ctxFromCommand(parent);
      const { config } = await loadConfig();
      const next: FluxConfig = { ...config };
      if (key === "apiKey") delete next.apiKey;
      else if (key === "endpointHost") delete next.endpointHost;
      else if (key === "defaultModel") delete next.defaultModel;
      else if (key === "outDir") delete next.outDir;
      else if (key === "pollIntervalMs") delete next.pollIntervalMs;
      else throw new CliError(`Unknown key: ${key}`, { exitCode: 2 });
      const { path } = await saveConfig(next);
      process.stdout.write(`${path}\n`);
    });
}

function toSafeConfig(c: FluxConfig): Omit<FluxConfig, "apiKey"> & { apiKey: string | null } {
  const { apiKey: _apiKey, ...rest } = c;
  return { ...rest, apiKey: redactApiKey(c.apiKey) };
}
