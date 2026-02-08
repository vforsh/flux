import pc from "picocolors";
import { loadConfig, type FluxConfig } from "../config/config.ts";
import { DEFAULT_MODEL } from "../models/catalog.ts";

export type OutputMode = "human" | "plain" | "json";

export type GlobalOptions = {
  json?: boolean;
  plain?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  noColor?: boolean;
  endpoint?: string;
  region?: string;
  timeout?: number;
  retries?: number;
  outDir?: string;
};

export type Ctx = {
  mode: OutputMode;
  quiet: boolean;
  verbose: boolean;
  color: boolean;
  endpointHost: string;
  timeoutMs: number;
  retries: number;
  apiKey?: string;
  defaultModel: string;
  outDir?: string;
  configPath: string;
  config: FluxConfig;
  log: {
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    debug: (...args: any[]) => void;
  };
};

export async function createCtx(opts: GlobalOptions): Promise<Ctx> {
  const { path: cfgPath, config } = await loadConfig();

  const mode: OutputMode = opts.json ? "json" : opts.plain ? "plain" : "human";
  const quiet = Boolean(opts.quiet);
  const verbose = Boolean(opts.verbose);
  const color = !opts.noColor && !process.env.NO_COLOR && Boolean(process.stderr.isTTY);

  const endpointHost =
    normalizeEndpointHost(opts.endpoint) ??
    regionToHost(opts.region) ??
    normalizeEndpointHost(config.endpointHost) ??
    "api.bfl.ai";

  const timeoutMs = Number.isFinite(opts.timeout) ? Math.max(1, Number(opts.timeout)) : 60_000;
  const retries = Number.isFinite(opts.retries) ? Math.max(0, Math.floor(Number(opts.retries))) : 3;

  const apiKey = process.env.BFL_API_KEY ?? config.apiKey;
  const defaultModel = config.defaultModel ?? DEFAULT_MODEL;
  const outDir = opts.outDir ?? config.outDir;

  const tagInfo = color ? pc.cyan("[flux]") : "[flux]";
  const tagWarn = color ? pc.yellow("[flux]") : "[flux]";
  const tagDbg = color ? pc.dim("[flux]") : "[flux]";
  const log = {
    info: (...args: any[]) => {
      if (quiet) return;
      // eslint-disable-next-line no-console
      console.error(tagInfo, ...args);
    },
    warn: (...args: any[]) => {
      if (quiet) return;
      // eslint-disable-next-line no-console
      console.error(tagWarn, ...args);
    },
    debug: (...args: any[]) => {
      if (!verbose) return;
      // eslint-disable-next-line no-console
      console.error(tagDbg, ...args);
    },
  };

  return {
    mode,
    quiet,
    verbose,
    color,
    endpointHost,
    timeoutMs,
    retries,
    apiKey,
    defaultModel,
    outDir,
    configPath: cfgPath,
    config,
    log,
  };
}

function regionToHost(region: string | undefined): string | null {
  if (!region) return null;
  const r = region.toLowerCase().trim();
  if (r === "us") return "api.us.bfl.ai";
  if (r === "eu") return "api.eu.bfl.ai";
  if (r === "global") return "api.bfl.ai";
  return null;
}

function normalizeEndpointHost(host: string | undefined): string | null {
  if (!host) return null;
  const h = host.trim();
  if (!h) return null;
  return h.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}
