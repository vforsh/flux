import { buildProgram } from "./cli/program.ts";
import { CliError, isCliError } from "./cli/errors.ts";

export async function main(argv: string[]): Promise<void> {
  const program = buildProgram();

  try {
    await program.parseAsync(argv);
  } catch (err) {
    // Commander already printed help for many usage errors; we still want
    // deterministic exit codes and no stack traces by default.
    const e = normalizeError(err);
    process.exitCode = e.exitCode;

    const wantsJson = argv.includes("--json");
    if (wantsJson) {
      process.stdout.write(`${JSON.stringify({ error: { message: e.message, exitCode: e.exitCode } }, null, 2)}\n`);
      return;
    }

    if (e.printStack) {
      // Explicitly requested debug stack trace.
      // eslint-disable-next-line no-console
      console.error(e.cause ?? e);
      return;
    }

    // eslint-disable-next-line no-console
    console.error(e.message);
  }
}

function normalizeError(err: unknown): { message: string; exitCode: number; printStack: boolean; cause?: unknown } {
  if (isCliError(err)) return { message: err.message, exitCode: err.exitCode, printStack: err.debug, cause: err.cause };
  if (err instanceof Error) return { message: err.message, exitCode: 1, printStack: false };
  return { message: String(err), exitCode: 1, printStack: false };
}

// Re-export for external tooling.
export { CliError };
