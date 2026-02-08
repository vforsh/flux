import { CliError } from "./errors.ts";
import type { Ctx } from "./context.ts";
import type { BflClient, GetResultResponse } from "../api/bfl.ts";
import { sleep } from "../util/time.ts";

export async function pollUntilDone(opts: {
  ctx: Ctx;
  client: BflClient;
  pollingUrl: string;
  intervalMs: number;
  maxWaitMs?: number;
}): Promise<GetResultResponse> {
  const { ctx, client, pollingUrl } = opts;
  const intervalMs = Math.max(50, opts.intervalMs);
  const maxWaitMs = opts.maxWaitMs ?? 0;
  const startedAt = Date.now();

  let lastStatus: string | null = null;
  while (true) {
    if (maxWaitMs > 0 && Date.now() - startedAt > maxWaitMs) {
      throw new CliError("Max wait time exceeded", { exitCode: 7 });
    }
    const res = await client.getResultByUrl(pollingUrl);
    const status = String(res.status ?? "Unknown");
    if (status !== lastStatus) {
      ctx.log.debug("status:", status);
      lastStatus = status;
    }

    if (status === "Ready") return res;
    if (status === "Request Moderated" || status === "Content Moderated") {
      throw new CliError(status, { exitCode: 6 });
    }
    if (status === "Error") throw new CliError("Task failed (status=Error)", { exitCode: 7 });
    if (status === "Task not found") throw new CliError("Task not found", { exitCode: 7 });

    await sleep(intervalMs);
  }
}
