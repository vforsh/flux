import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { extForFormat, resolveOutputTarget } from "./output.ts";

describe("output helpers", () => {
  test("extForFormat", () => {
    expect(extForFormat(undefined)).toBe(".jpg");
    expect(extForFormat("jpeg")).toBe(".jpg");
    expect(extForFormat("png")).toBe(".png");
  });

  test("resolveOutputTarget stdout", async () => {
    const t = await resolveOutputTarget({ out: "-", id: "abc", ext: ".jpg" });
    expect(t.kind).toBe("stdout");
  });

  test("resolveOutputTarget default file in outDir", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "flux-"));
    try {
      await mkdir(path.join(tmp, "out"), { recursive: true });
      const t = await resolveOutputTarget({ outDir: path.join(tmp, "out"), id: "abc", ext: ".jpg" });
      expect(t.kind).toBe("file");
      if (t.kind === "file") expect(path.basename(t.path)).toBe("flux_abc.jpg");
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

