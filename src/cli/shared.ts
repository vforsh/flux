import { CliError } from "./errors.ts";
import { createCtx, type Ctx, type GlobalOptions } from "./context.ts";
import { readStdinText, stdinIsTty } from "../util/stdin.ts";
import { BflClient, HttpError } from "../api/bfl.ts";

export async function ctxFromCommand(cmd: any): Promise<Ctx> {
  const opts = cmd.optsWithGlobals() as GlobalOptions;
  return await createCtx(opts);
}

export function requireApiKey(ctx: Ctx): string {
  if (!ctx.apiKey) throw new CliError("Missing API key. Set BFL_API_KEY or run: flux config set apiKey", { exitCode: 3 });
  return ctx.apiKey;
}

export function makeClient(ctx: Ctx): BflClient {
  const apiKey = requireApiKey(ctx);
  return new BflClient({
    apiKey,
    endpointHost: ctx.endpointHost,
    timeoutMs: ctx.timeoutMs,
    retries: ctx.retries,
    userAgent: "flux-cli/@vforsh",
  });
}

export async function resolvePrompt(promptArg: string | undefined): Promise<string> {
  if (promptArg === "-" || (!promptArg && !stdinIsTty())) {
    const txt = (await readStdinText()).trim();
    if (!txt) throw new CliError("Prompt is required (stdin was empty)", { exitCode: 2 });
    return txt;
  }
  if (!promptArg) throw new CliError("Prompt is required (pass it as an argument or via stdin)", { exitCode: 2 });
  return promptArg;
}

export function mapAndThrowHttpError(err: HttpError): never {
  if (err.status === 402) throw new CliError("Insufficient credits (HTTP 402)", { exitCode: 4, cause: err });
  if (err.status === 403) throw new CliError("Forbidden (check API key / permissions) (HTTP 403)", { exitCode: 3, cause: err });
  if (err.status === 429) throw new CliError("Rate limited (HTTP 429)", { exitCode: 5, cause: err });
  throw new CliError(`API error (HTTP ${err.status})`, { exitCode: 7, cause: err });
}

export function throwIfHttpError(err: unknown): void {
  if (err instanceof HttpError) mapAndThrowHttpError(err);
}

