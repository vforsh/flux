import { readFile } from "node:fs/promises";

export async function readJsonArg(input: string): Promise<unknown> {
  if (input.startsWith("@")) {
    const path = input.slice(1);
    const txt = await readFile(path, "utf8");
    return JSON.parse(txt);
  }
  return JSON.parse(input);
}

