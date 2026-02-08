import { CliError } from "./errors.ts";
import type { Ctx } from "./context.ts";

export function writeOut(ctx: Ctx, payload: { human?: string; plain?: string; json?: unknown }): void {
  if (ctx.mode === "json") {
    process.stdout.write(`${JSON.stringify(payload.json ?? {}, null, 2)}\n`);
    return;
  }
  if (ctx.mode === "plain") {
    if (payload.plain != null) process.stdout.write(`${payload.plain}\n`);
    return;
  }
  if (payload.human != null) process.stdout.write(`${payload.human}\n`);
}

export function writeJson(ctx: Ctx, obj: unknown): void {
  if (ctx.mode !== "json") throw new CliError("Internal: writeJson requires --json mode", { exitCode: 2 });
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

export function writeErrorJson(message: string, details?: unknown): void {
  process.stdout.write(`${JSON.stringify({ error: { message, details } }, null, 2)}\n`);
}

