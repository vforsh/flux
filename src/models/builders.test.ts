import { describe, expect, test } from "bun:test";
import { CliError } from "../cli/errors.ts";
import { buildGenBody } from "./builders.ts";

describe("buildGenBody", () => {
  test("flux-2-pro defaults to 1024x1024", () => {
    const { modelPath, body } = buildGenBody({ model: "flux-2-pro", prompt: "x" });
    expect(modelPath).toBe("flux-2-pro");
    expect(body.width).toBe(1024);
    expect(body.height).toBe(1024);
  });

  test("flux-2-pro enforces multiple-of-16", () => {
    expect(() => buildGenBody({ model: "flux-2-pro", prompt: "x", width: 1000, height: 1024 })).toThrow(CliError);
  });

  test("flux-pro-1.1 enforces multiple-of-32", () => {
    expect(() => buildGenBody({ model: "flux-pro-1.1", prompt: "x", width: 1024, height: 1000 })).toThrow(CliError);
    const ok = buildGenBody({ model: "flux-pro-1.1", prompt: "x", width: 1024, height: 1024 });
    expect(ok.modelPath).toBe("flux-pro-1.1");
  });
});

