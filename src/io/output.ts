import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { CliError } from "../cli/errors.ts";

export type OutputTarget =
  | { kind: "stdout" }
  | { kind: "file"; path: string };

export function extForFormat(format: "jpeg" | "png" | undefined): string {
  if (format === "png") return ".png";
  // default jpeg
  return ".jpg";
}

export async function resolveOutputTarget(opts: { out?: string; outDir?: string; id: string; ext: string }): Promise<OutputTarget> {
  const out = opts.out;
  if (out === "-") return { kind: "stdout" };

  const baseDir = opts.outDir ?? ".";
  if (!out) {
    const p = path.join(baseDir, `flux_${opts.id}${opts.ext}`);
    await mkdir(path.dirname(p), { recursive: true });
    return { kind: "file", path: p };
  }

  const looksLikeDir = out.endsWith(path.sep) || (await isDir(out));
  const p = looksLikeDir ? path.join(out, `flux_${opts.id}${opts.ext}`) : out;
  await mkdir(path.dirname(p), { recursive: true });
  return { kind: "file", path: p };
}

export async function writeBytes(target: OutputTarget, bytes: Uint8Array): Promise<{ path?: string }> {
  if (target.kind === "stdout") {
    process.stdout.write(bytes);
    return {};
  }
  await writeFile(target.path, bytes);
  return { path: target.path };
}

async function isDir(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    // Not existing isn't a directory.
    return false;
  }
}

export function requireNonEmptyFilePath(p: string | undefined, flagName: string): string {
  if (!p || p.trim().length === 0) throw new CliError(`${flagName} is required`, { exitCode: 2 });
  return p;
}

