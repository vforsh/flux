import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type FluxConfig = {
  apiKey?: string;
  endpointHost?: string; // e.g. api.bfl.ai
  defaultModel?: string;
  outDir?: string;
  pollIntervalMs?: number;
};

export function configPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.trim().length > 0 ? xdg : path.join(os.homedir(), ".config");
  return path.join(base, "flux", "config.json");
}

export async function loadConfig(): Promise<{ path: string; config: FluxConfig }> {
  const p = configPath();
  try {
    const txt = await readFile(p, "utf8");
    const parsed = JSON.parse(txt) as FluxConfig;
    return { path: p, config: parsed ?? {} };
  } catch (err) {
    // Missing file is fine; other errors should surface.
    if (isMissing(err)) return { path: p, config: {} };
    throw err;
  }
}

export async function saveConfig(next: FluxConfig): Promise<{ path: string }> {
  const p = configPath();
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return { path: p };
}

function isMissing(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "code" in err && (err as any).code === "ENOENT");
}

