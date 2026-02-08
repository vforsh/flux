import { readFile } from "node:fs/promises";
import { CliError } from "../cli/errors.ts";
import { isHttpUrl } from "../util/url.ts";

export async function toBase64(input: string): Promise<string> {
  if (looksLikeBase64(input)) return stripDataUrlPrefix(input);
  if (isHttpUrl(input)) {
    const res = await fetch(input);
    if (!res.ok) throw new CliError(`Failed to download image: HTTP ${res.status}`, { exitCode: 7 });
    const ab = await res.arrayBuffer();
    return Buffer.from(ab).toString("base64");
  }
  // Local file path
  try {
    const buf = await readFile(input);
    return buf.toString("base64");
  } catch (err) {
    throw new CliError(`Cannot read image input: ${input}`, { exitCode: 2, cause: err });
  }
}

export async function toBase64OrUrl(input: string): Promise<string> {
  if (isHttpUrl(input)) return input;
  return await toBase64(input);
}

function looksLikeBase64(s: string): boolean {
  if (s.startsWith("data:")) return true;
  if (s.length < 64) return false;
  return /^[A-Za-z0-9+/=\n\r]+$/.test(s);
}

function stripDataUrlPrefix(s: string): string {
  if (!s.startsWith("data:")) return s;
  const idx = s.indexOf("base64,");
  if (idx === -1) return s;
  return s.slice(idx + "base64,".length);
}

